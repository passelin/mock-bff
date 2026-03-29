import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MockStorage } from "./storage.js";
import { isApiLikeRequest, parseHar } from "./har.js";
import { buildVariantName, matchMock } from "./matcher.js";
import { buildPrompt, generateMockResponse } from "./ai.js";
import { normalizePath, normalizeQuery } from "./utils.js";
import {
  listOpenAiModels,
  listAnthropicModels,
  listOllamaModels,
  ollamaFallbackModels,
} from "./providers.js";
import {
  buildOpenApiHint,
  loadOpenApiFile,
  validateResponseWithOpenApi,
} from "./openapi.js";
import type { AppConfig, IndexEntry, RequestLogEntry, StoredMock } from "./types.js";

const DROPPED_REPLAY_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
] as const;

function sanitizeReplayHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const dropped = new Set(DROPPED_REPLAY_HEADERS);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (dropped.has(k.toLowerCase() as (typeof DROPPED_REPLAY_HEADERS)[number]))
      continue;
    out[k] = v;
  }
  return out;
}

function maskApiKey(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${trimmed.slice(0, 6)}…`;
}


export interface CreateAppOptions {
  rootDir: string;
  appName: string;
  mocksDir?: string;
}

async function resolveAdminDistDir(rootDir: string): Promise<string> {
  const preferred = path.join(rootDir, "admin", "dist");
  try {
    await access(path.join(preferred, "index.html"));
    return preferred;
  } catch {}

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const packaged = path.resolve(moduleDir, "..", "admin", "dist");
  try {
    await access(path.join(packaged, "index.html"));
    return packaged;
  } catch {}

  return preferred;
}

function normalizePathTemplate(apiPath: string): string {
  const parts = normalizePath(apiPath)
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      /^[0-9a-f-]{6,}$/i.test(seg) || /^\d+$/.test(seg)
        ? ":id"
        : seg.toLowerCase(),
    );
  return "/" + parts.join("/");
}

async function collectSimilarExamples(args: {
  storage: MockStorage;
  method: string;
  path: string;
  limit?: number;
}): Promise<
  Array<{ method: string; path: string; responseBody: unknown; label: string }>
> {
  const index = await args.storage.readIndex();
  const tpl = normalizePathTemplate(args.path);
  const candidates = index
    .filter(
      (e) => e.method === args.method && normalizePathTemplate(e.path) === tpl,
    )
    .slice(0, args.limit ?? 5);

  const out: Array<{
    method: string;
    path: string;
    responseBody: unknown;
    label: string;
  }> = [];
  for (const c of candidates) {
    const files = await args.storage.listVariants(c.method, c.path);
    if (files.length === 0) continue;
    const first = await args.storage.readMock(files[0]);
    if (!first) continue;
    out.push({
      method: c.method,
      path: c.path,
      responseBody: first.response.body,
      label: `similar-request:${c.method} ${c.path}`,
    });
  }

  return out;
}

function summarizeBodyShape(body: unknown): string {
  if (!body || typeof body !== "object") return typeof body;
  if (Array.isArray(body)) return `array(len=${body.length})`;
  const keys = Object.keys(body as Record<string, unknown>).slice(0, 12);
  return `object{${keys.join(", ")}}`;
}

function shouldWriteContextInsight(args: {
  index: IndexEntry[];
  method: string;
  path: string;
}): boolean {
  const tpl = normalizePathTemplate(args.path);
  return !args.index.some(
    (e) => e.method === args.method && normalizePathTemplate(e.path) === tpl,
  );
}

function pickPriorityKey(obj: Record<string, unknown>): string | undefined {
  const keys = Object.keys(obj);
  if (keys.length === 0) return undefined;
  const exactId = keys.find((k) => k.toLowerCase() === "id");
  if (exactId) return exactId;
  const starId = keys.find((k) => k.toLowerCase().endsWith("id"));
  if (starId) return starId;
  const name = keys.find((k) => k.toLowerCase() === "name");
  if (name) return name;
  const type = keys.find((k) => k.toLowerCase() === "type");
  if (type) return type;
  return keys[0];
}

function upsertIndex(
  entries: IndexEntry[],
  method: string,
  apiPath: string,
  variantPath: string,
): IndexEntry[] {
  const existing = entries.find(
    (e) => e.method === method && e.path === apiPath,
  );
  if (!existing) {
    entries.push({
      method,
      path: apiPath,
      variants: [variantPath],
      defaultVariant: variantPath,
    });
    return entries;
  }
  if (!existing.variants.includes(variantPath))
    existing.variants.push(variantPath);
  if (!existing.defaultVariant) existing.defaultVariant = variantPath;
  return entries;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: false });
  const storage = new MockStorage(options.mocksDir ?? path.join(options.rootDir, "mocks"));
  await storage.ensureLayout();
  let packageVersion = "unknown";
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const packageJson = await readFile(
      path.resolve(moduleDir, "..", "package.json"),
      "utf8",
    );
    const parsed = JSON.parse(packageJson) as { version?: string };
    if (parsed.version) packageVersion = parsed.version;
  } catch {}

  const maxRequestLogs = Number(process.env.MOCK_MAX_REQUEST_LOGS || 500);
  const requestLogs: RequestLogEntry[] = [];

  const sseClients = new Map<string, (event: string, data: unknown) => void>();

  const emitLiveEvent = (event: string, data: unknown = {}) => {
    if (sseClients.size === 0) return;
    for (const send of sseClients.values()) send(event, data);
  };

  const pushRequestLog = (entry: RequestLogEntry) => {
    requestLogs.push(entry);
    if (requestLogs.length > maxRequestLogs) {
      requestLogs.splice(0, requestLogs.length - maxRequestLogs);
    }
    emitLiveEvent("request", {
      at: entry.at,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      match: entry.match,
    });
  };

  const initialConfig = await storage.readConfig();
  await storage.writeConfig({ ...initialConfig, appName: options.appName });

  await app.register(cors);
  await app.register(multipart, {
    limits: {
      fileSize: Number(process.env.MOCK_MAX_UPLOAD_BYTES || 250 * 1024 * 1024),
    },
  });

  app.setErrorHandler((err, req, reply) => {
    const e = err as Error;
    const entry = {
      level: "error",
      ts: new Date().toISOString(),
      kind: "mock-bff-error",
      method: req.method,
      url: req.url,
      message: e.message,
      name: e.name,
      stack: e.stack,
    };
    process.stderr.write(`${JSON.stringify(entry)}\n`);

    if (!reply.sent) {
      reply.code(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: e.message || "Unexpected error",
      });
    }
  });

  const adminDistDir = await resolveAdminDistDir(options.rootDir);
  await app.register(fastifyStatic, {
    root: adminDistDir,
    prefix: "/-/admin/",
    decorateReply: false,
  });

  app.get("/-/admin", async (_req, reply) => {
    try {
      const html = await readFile(path.join(adminDistDir, "index.html"), "utf8");
      return reply.type("text/html").send(html);
    } catch {
      return reply.code(500).send({ error: "Admin UI not built. Run: npm run build:admin" });
    }
  });

  app.get("/-/api/health", async () => ({
    ok: true,
    app: options.appName,
    version: packageVersion,
  }));
  app.get("/-/api/config", async () => storage.readConfig());

  app.patch<{ Body: Record<string, unknown> }>("/-/api/config", async (req) => {
    const prev = await storage.readConfig();
    const patch = req.body as Record<string, unknown>;
    const next: AppConfig = {
      ...prev,
      ...patch,
      har: {
        ...prev.har,
        ...(typeof patch.har === "object" && patch.har
          ? (patch.har as Record<string, unknown>)
          : {}),
      },
      providerBaseUrls: {
        ...prev.providerBaseUrls,
        ...(typeof patch.providerBaseUrls === "object" && patch.providerBaseUrls
          ? (patch.providerBaseUrls as Record<string, unknown>)
          : {}),
      },
    };
    await storage.writeConfig(next);
    return next;
  });

  // Provider model cache — openai/anthropic cached for server lifetime,
  // ollama cached per base URL and refreshable via POST /-/api/providers/ollama/refresh.
  const providerCache: {
    openai?: { models: string[]; disabled: boolean };
    anthropic?: { models: string[]; disabled: boolean };
    ollama?: { models: string[]; base: string };
  } = {};

  function buildProvidersResponse(
    cfg: Awaited<ReturnType<typeof storage.readConfig>>,
    openai: { models: string[]; disabled: boolean },
    anthropic: { models: string[]; disabled: boolean },
    ollamaModels: string[],
    openaiBase: string | undefined,
    anthropicBase: string | undefined,
    ollamaBase: string,
  ) {
    return {
      current: { provider: cfg.aiProvider ?? "openai", model: cfg.aiModel ?? "" },
      providers: {
        openai: {
          models: openai.models,
          disabled: openai.disabled,
          baseUrl: openaiBase,
          apiKeyPreview: maskApiKey(process.env.OPENAI_API_KEY),
          apiKeyHint: "Set OPENAI_API_KEY before starting dev server (e.g. export OPENAI_API_KEY=...).",
        },
        anthropic: {
          models: anthropic.models,
          disabled: anthropic.disabled,
          baseUrl: anthropicBase,
          apiKeyPreview: maskApiKey(process.env.ANTHROPIC_API_KEY),
          apiKeyHint: "Set ANTHROPIC_API_KEY before starting dev server (e.g. export ANTHROPIC_API_KEY=...).",
        },
        ollama: {
          models: ollamaModels.length ? ollamaModels : ollamaFallbackModels(),
          disabled: false,
          baseUrl: ollamaBase,
          apiKeyPreview: null,
          apiKeyHint: "No API key required by default for local Ollama.",
        },
        none: {
          models: [],
          disabled: false,
          baseUrl: null,
          apiKeyPreview: null,
          apiKeyHint: "Disables model calls and uses deterministic fallback generation.",
        },
      },
    };
  }

  app.get("/-/api/providers", async () => {
    const cfg = await storage.readConfig();
    const openaiBase = process.env.OPENAI_BASE_URL ?? cfg.providerBaseUrls?.openai;
    const anthropicBase = process.env.ANTHROPIC_BASE_URL ?? cfg.providerBaseUrls?.anthropic;
    const ollamaBase =
      process.env.OLLAMA_BASE_URL ?? cfg.providerBaseUrls?.ollama ?? "http://127.0.0.1:11434";

    const [openai, anthropic] = await Promise.all([
      providerCache.openai ?? listOpenAiModels(openaiBase, process.env.OPENAI_API_KEY).then((r) => { providerCache.openai = r; return r; }),
      providerCache.anthropic ?? listAnthropicModels(anthropicBase, process.env.ANTHROPIC_API_KEY).then((r) => { providerCache.anthropic = r; return r; }),
    ]);

    if (!providerCache.ollama || providerCache.ollama.base !== ollamaBase) {
      const models = await listOllamaModels(ollamaBase);
      providerCache.ollama = { models, base: ollamaBase };
    }

    return buildProvidersResponse(cfg, openai, anthropic, providerCache.ollama.models, openaiBase, anthropicBase, ollamaBase);
  });

  app.post("/-/api/providers/ollama/refresh", async () => {
    const cfg = await storage.readConfig();
    const ollamaBase =
      process.env.OLLAMA_BASE_URL ?? cfg.providerBaseUrls?.ollama ?? "http://127.0.0.1:11434";
    const models = await listOllamaModels(ollamaBase);
    providerCache.ollama = { models, base: ollamaBase };
    return { models: models.length ? models : ollamaFallbackModels() };
  });

  app.post("/-/api/openapi", async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: "Missing file" });
    const data = await part.toBuffer();
    const filename = (part.filename || "openapi.json").toLowerCase();
    const target = path.join(
      storage.metaDir(),
      filename.endsWith(".yaml") || filename.endsWith(".yml")
        ? "openapi.yaml"
        : "openapi.json",
    );
    await writeFile(target, data);
    emitLiveEvent("openapi-updated", { saved: true });
    return { saved: true };
  });

  app.get("/-/api/openapi", async () => {
    const jsonPath = path.join(storage.metaDir(), "openapi.json");
    const yamlPath = path.join(storage.metaDir(), "openapi.yaml");
    try {
      const raw = await readFile(jsonPath, "utf8");
      return { exists: true, format: "json", raw };
    } catch {}
    try {
      const raw = await readFile(yamlPath, "utf8");
      return { exists: true, format: "yaml", raw };
    } catch {}
    return { exists: false };
  });

  app.delete("/-/api/openapi", async () => {
    await Promise.all([
      rm(path.join(storage.metaDir(), "openapi.json"), { force: true }),
      rm(path.join(storage.metaDir(), "openapi.yaml"), { force: true }),
    ]);
    emitLiveEvent("openapi-updated", { deleted: true });
    return { deleted: true };
  });

  app.post("/-/api/har", async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: "Missing HAR file" });

    const config = await storage.readConfig();
    const content = (await part.toBuffer()).toString("utf8");
    const parsed = parseHar(content, config);
    let index = await storage.readIndex();

    for (const item of parsed) {
      const saved = await storage.saveVariant(
        item.method,
        item.path,
        item.variant,
        item.mock,
      );
      index = upsertIndex(index, item.method, item.path, saved);
      const existingDefault = await storage.readMock(
        storage.defaultPath(item.method, item.path),
      );
      if (!existingDefault)
        await storage.saveDefault(item.method, item.path, item.mock);
    }

    await storage.writeIndex(index);
    emitLiveEvent("endpoints-updated", {
      source: "har",
      imported: parsed.length,
    });
    return { imported: parsed.length };
  });

  app.get("/-/api/endpoints", async () => {
    const index = await storage.readIndex();
    return index.map((e) => ({
      method: e.method,
      path: e.path,
      variants: e.variants.length,
      hasDefault: Boolean(e.defaultVariant),
      forcedVariant: e.forcedVariant,
    }));
  });

  app.delete<{ Querystring: { method?: string; path?: string } }>(
    "/-/api/endpoint",
    async (req, reply) => {
      const method = req.query.method?.toUpperCase();
      const apiPath = req.query.path;
      if (!method || !apiPath)
        return reply
          .code(400)
          .send({ error: "method and path query params are required" });

      await storage.clearEndpoint(method, apiPath);
      const index = await storage.readIndex();
      const next = index.filter(
        (e) => !(e.method === method && e.path === apiPath),
      );
      await storage.writeIndex(next);
      emitLiveEvent("endpoints-updated", {
        action: "endpoint-deleted",
        method,
        path: apiPath,
      });
      return { cleared: true, method, path: apiPath };
    },
  );

  app.delete("/-/api/endpoints", async () => {
    await storage.clearAllMocks();
    emitLiveEvent("endpoints-updated", { action: "endpoints-cleared" });
    return { clearedAll: true };
  });

  app.get<{ Querystring: { method?: string; path?: string } }>(
    "/-/api/variants",
    async (req, reply) => {
      const method = req.query.method?.toUpperCase();
      const apiPath = req.query.path;
      if (!method || !apiPath)
        return reply
          .code(400)
          .send({ error: "method and path query params are required" });

      const files = await storage.listVariants(method, apiPath);
      const items = [] as Array<{
        id: string;
        file: string;
        source?: string;
        status?: number;
        createdAt?: string;
        displayLabel?: string;
      }>;

      for (const file of files) {
        const mock = await storage.readMock(file);
        const id =
          file
            .split("/")
            .pop()
            ?.replace(/\.json$/, "") ?? file;
        const snap = (mock?.requestSnapshot ?? {}) as {
          query?: Record<string, string | string[] | undefined>;
          body?: unknown;
        };
        const query = snap.query ?? {};
        const body = snap.body;

        const usp = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) {
          if (Array.isArray(v)) v.forEach((x) => usp.append(k, String(x)));
          else if (v !== undefined) usp.append(k, String(v));
        }
        const queryStr = usp.toString();

        let bodyStr = "";
        if (Array.isArray(body)) {
          const len = body.length;
          const first = body[0];
          let firstPart = "";
          if (first && typeof first === "object" && !Array.isArray(first)) {
            const k = pickPriorityKey(first as Record<string, unknown>);
            if (k) {
              const v = (first as Record<string, unknown>)[k];
              firstPart = String(v ?? "").slice(0, 10);
            }
          }
          bodyStr = `[${len}]${firstPart ? ` ${firstPart}` : ""}`;
        } else if (body && typeof body === "object") {
          const obj = body as Record<string, unknown>;
          const k = pickPriorityKey(obj);
          if (k) bodyStr = `${k}=${String(obj[k] ?? "")}`;
        }

        const displayLabel =
          [queryStr || "", bodyStr || ""].filter(Boolean).join(" · ") ||
          (method === "GET" ? "No query params" : id);
        items.push({
          id,
          file,
          source: mock?.meta.source,
          status: mock?.response.status,
          createdAt: mock?.meta.createdAt,
          displayLabel,
        });
      }

      const idx = await storage.readIndex();
      const entry = idx.find((e) => e.method === method && e.path === apiPath);
      return { method, path: apiPath, variants: items, forcedVariant: entry?.forcedVariant };
    },
  );

  app.get<{ Querystring: { method?: string; path?: string; id?: string } }>(
    "/-/api/variant",
    async (req, reply) => {
      const method = req.query.method?.toUpperCase();
      const apiPath = req.query.path;
      const id = req.query.id;
      if (!method || !apiPath || !id)
        return reply.code(400).send({ error: "method, path, id are required" });

      const filePath = storage.mockPath(method, apiPath, id);
      const mock = await storage.readMock(filePath);
      if (!mock) return reply.code(404).send({ error: "variant not found" });
      return { method, path: apiPath, id, mock };
    },
  );

  app.delete<{ Querystring: { method?: string; path?: string; id?: string } }>(
    "/-/api/variant",
    async (req, reply) => {
      const method = req.query.method?.toUpperCase();
      const apiPath = req.query.path;
      const id = req.query.id;
      if (!method || !apiPath || !id)
        return reply.code(400).send({ error: "method, path, id are required" });

      const existing = await storage.listVariants(method, apiPath);
      if (existing.length <= 1) {
        return reply.code(400).send({
          error: "Cannot delete the last variant. Delete the endpoint instead.",
        });
      }

      await storage.clearVariant(method, apiPath, id);

      const idx = await storage.readIndex();
      const entry = idx.find((e) => e.method === method && e.path === apiPath);
      if (entry) {
        entry.variants = entry.variants.filter(
          (p) => !p.endsWith(`/${id}.json`),
        );
        await storage.writeIndex(idx);
      }

      emitLiveEvent("variants-updated", {
        action: "variant-deleted",
        method,
        path: apiPath,
        id,
      });
      emitLiveEvent("endpoints-updated", {
        action: "variant-deleted",
        method,
        path: apiPath,
      });
      return { deleted: true };
    },
  );

  app.put<{
    Body: { method?: string; path?: string; id?: string; mock?: StoredMock };
  }>("/-/api/variant", async (req, reply) => {
    const method = req.body.method?.toUpperCase();
    const apiPath = req.body.path;
    const id = req.body.id;
    const mock = req.body.mock;
    if (!method || !apiPath || !id || !mock)
      return reply
        .code(400)
        .send({ error: "method, path, id, mock are required" });

    const existing = await storage.readMock(storage.mockPath(method, apiPath, id));
    const preservedMeta = existing?.meta ?? mock.meta;

    const snap = mock.requestSnapshot ?? existing?.requestSnapshot;
    const newId = snap !== undefined ? buildVariantName(snap.query, snap.body ?? {}) : id;

    const rebuiltSignature = {
      method,
      path: apiPath,
      queryHash: newId.match(/^q_(.+?)__b_/)?.[1] ?? "manual",
      bodyHash: newId.match(/__b_(.+)$/)?.[1] ?? "manual",
    };

    const savedMock = { ...mock, requestSignature: rebuiltSignature, requestSnapshot: snap, meta: preservedMeta };
    const savedPath = await storage.saveVariant(method, apiPath, newId, savedMock);

    if (newId !== id) {
      await storage.clearVariant(method, apiPath, id);
    }

    const [index, existingDefault] = await Promise.all([
      storage.readIndex(),
      storage.readMock(storage.defaultPath(method, apiPath)),
    ]);

    const oldPath = storage.mockPath(method, apiPath, id);
    const entry = index.find((e) => e.method === method && e.path === apiPath);
    if (entry && newId !== id) {
      entry.variants = entry.variants.map((p) => (p === oldPath ? savedPath : p));
      if (entry.forcedVariant === id) entry.forcedVariant = newId;
    }
    await storage.writeIndex(upsertIndex(index, method, apiPath, savedPath));

    if (!existingDefault) {
      await storage.saveDefault(method, apiPath, savedMock);
    }

    emitLiveEvent("variants-updated", {
      action: "variant-saved",
      method,
      path: apiPath,
      id: newId,
    });
    emitLiveEvent("endpoints-updated", {
      action: "variant-saved",
      method,
      path: apiPath,
    });
    return { saved: true, id: newId };
  });

  app.put<{
    Body: { method?: string; path?: string; id?: string | null };
  }>("/-/api/variant/force", async (req, reply) => {
    const method = req.body.method?.toUpperCase();
    const apiPath = req.body.path;
    const id = req.body.id ?? null;
    if (!method || !apiPath)
      return reply
        .code(400)
        .send({ error: "method and path are required" });

    const index = await storage.readIndex();
    const entry = index.find((e) => e.method === method && e.path === apiPath);
    if (!entry)
      return reply.code(404).send({ error: "endpoint not found" });

    if (id === null) {
      delete entry.forcedVariant;
    } else {
      entry.forcedVariant = id;
    }
    await storage.writeIndex(index);

    emitLiveEvent("endpoints-updated", {
      action: "variant-forced",
      method,
      path: apiPath,
      id,
    });
    return { forced: id };
  });

  app.get<{ Querystring: { method?: string; path?: string } }>(
    "/-/api/diagnostics",
    async (req, reply) => {
      const method = req.query.method?.toUpperCase();
      const apiPath = req.query.path;
      if (!method || !apiPath)
        return reply
          .code(400)
          .send({ error: "method and path query params are required" });

      const index = await storage.readIndex();
      const entry = index.find(
        (e) => e.method === method && e.path === apiPath,
      );
      const variants = await storage.listVariants(method, apiPath);
      const defaultExists = Boolean(
        await storage.readMock(storage.defaultPath(method, apiPath)),
      );

      return {
        method,
        path: apiPath,
        indexed: Boolean(entry),
        indexVariantCount: entry?.variants.length ?? 0,
        variantFiles: variants,
        hasDefault: defaultExists,
      };
    },
  );

  app.get("/-/api/misses", async (_req, reply) => {
    const file = path.join(storage.metaDir(), "misses.log.jsonl");
    try {
      return (await readFile(file, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      return reply.send([]);
    }
  });

  app.delete("/-/api/misses", async () => {
    await storage.clearMisses();
    emitLiveEvent("misses-cleared", {});
    return { cleared: true };
  });

  app.get<{ Querystring: { limit?: string } }>(
    "/-/api/requests",
    async (req) => {
      const requested = Number(req.query.limit ?? 100);
      const limit = Number.isFinite(requested)
        ? Math.max(1, Math.min(1000, requested))
        : 100;
      const rows = requestLogs.slice(-limit).reverse();
      return { max: maxRequestLogs, count: requestLogs.length, rows };
    },
  );

  app.get("/-/api/events", async (_req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sseClients.set(id, send);
    send("ready", { ok: true });

    const keepAlive = setInterval(() => {
      reply.raw.write(`: ping\n\n`);
    }, 25000);

    reply.raw.on("close", () => {
      clearInterval(keepAlive);
      sseClients.delete(id);
    });

    return reply;
  });

  app.delete("/-/api/requests", async () => {
    requestLogs.splice(0, requestLogs.length);
    emitLiveEvent("requests-cleared", {});
    return { cleared: true };
  });

  app.get("/-/api/context", async () => ({
    context: await readFile(path.join(storage.metaDir(), "context.md"), "utf8"),
  }));
  app.put<{ Body: { context: string } }>("/-/api/context", async (req) => {
    await writeFile(
      path.join(storage.metaDir(), "context.md"),
      req.body.context,
      "utf8",
    );
    return { saved: true };
  });

  app.post("/-/api/reindex", async () => {
    const index = await storage.readIndex();
    await storage.writeIndex(index);
    return { reindexed: index.length };
  });

  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
    url: "/*",
    handler: async (req, reply) => {
      const method = req.method.toUpperCase();
      const fullPath = normalizePath(req.url.split("?")[0] || "/");

      if (fullPath.startsWith("/-/") || fullPath.startsWith("/admin/")) {
        return reply.code(404).send({ error: "Not found" });
      }
      const config = await storage.readConfig();

      if (
        !isApiLikeRequest({
          method,
          pathname: fullPath,
          config,
          requireJsonResponse: false,
        })
      ) {
        pushRequestLog({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query: (req.query as Record<string, string | string[]>) ?? {},
          match: "none",
          status: 404,
        });
        return reply.code(404).send({ error: "Non-API request is not mocked" });
      }

      const query = normalizeQuery(
        (req.query as Record<string, string | string[]>) ?? {},
        config.ignoredQueryParams,
      );
      const body = req.body;

      const endpointIndex = await storage.readIndex();
      const indexEntry = endpointIndex.find(
        (e) => e.method === method && e.path === fullPath,
      );
      if (indexEntry?.forcedVariant) {
        const forcedMock = await storage.readMock(
          storage.mockPath(method, fullPath, indexEntry.forcedVariant),
        );
        if (forcedMock) {
          pushRequestLog({
            at: new Date().toISOString(),
            method,
            path: fullPath,
            query,
            match: "exact",
            status: forcedMock.response.status,
            prompt: forcedMock.meta.prompt,
          });
          return reply
            .header("x-mock-match", "forced")
            .code(forcedMock.response.status)
            .headers(sanitizeReplayHeaders(forcedMock.response.headers))
            .send(forcedMock.response.body);
        }
      }

      const variantName = buildVariantName(query, body ?? {});
      const [exact, variantFiles, defaultMock] = await Promise.all([
        storage.readMock(storage.mockPath(method, fullPath, variantName)),
        storage.listVariants(method, fullPath),
        storage.readMock(storage.defaultPath(method, fullPath)),
      ]);
      const variants = (
        await Promise.all(variantFiles.map((f) => storage.readMock(f)))
      ).filter(Boolean) as StoredMock[];

      const match = matchMock({
        exact,
        variants,
        defaultMock,
        requestBody: body,
      });
      if (match.type !== "miss" && match.mock) {
        pushRequestLog({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query,
          match: match.type,
          status: match.mock.response.status,
          prompt: match.mock.meta.prompt,
        });

        return reply
          .header("x-mock-match", match.type)
          .code(match.mock.response.status)
          .headers(sanitizeReplayHeaders(match.mock.response.headers))
          .send(match.mock.response.body);
      }

      if (!config.aiEnabled) {
        await storage.appendMiss({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query,
          body,
          resolvedBy: "none",
        });
        emitLiveEvent("miss", { method, path: fullPath, resolvedBy: "none" });
        pushRequestLog({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query,
          match: "none",
          status: 404,
        });
        return reply.code(404).send({ error: "No mock found" });
      }

      const context = await readFile(
        path.join(storage.metaDir(), "context.md"),
        "utf8",
      ).catch(() => "");
      const similarExamples = await collectSimilarExamples({
        storage,
        method,
        path: fullPath,
        limit: 5,
      });

      const openapiDoc =
        (await loadOpenApiFile(path.join(storage.metaDir(), "openapi.json"))) ??
        (await loadOpenApiFile(path.join(storage.metaDir(), "openapi.yaml")));
      const openApiHint = buildOpenApiHint({
        doc: openapiDoc,
        method,
        path: fullPath,
      });
      const mergedContext = openApiHint
        ? `${context}\n\n## OPENAPI HINT FOR THIS REQUEST\n\n${openApiHint}`
        : context;

      const aiInput = {
        method,
        path: fullPath,
        query,
        body,
        requestHeaders: req.headers as Record<
          string,
          string | string[] | undefined
        >,
        context: mergedContext,
        nearbyExamples: [
          ...variants.slice(0, 5).map((v) => ({
            method,
            path: fullPath,
            responseBody: v.response.body,
            label: `same-endpoint:${method} ${fullPath}`,
          })),
          ...similarExamples,
        ],
      };

      const promptForLogs = config.aiStorePrompt
        ? buildPrompt(aiInput, config, new Date())
        : undefined;

      const result = await generateMockResponse(aiInput, config);

      if (!result.ok) {
        await storage.appendMiss({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query,
          body,
          resolvedBy: "none",
        });
        emitLiveEvent("miss", { method, path: fullPath, resolvedBy: "none" });
        pushRequestLog({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query,
          match: "none",
          status: 404,
          prompt: promptForLogs,
          aiError: result.reason,
        });
        return reply.code(404).send({ error: "No mock found" });
      }

      const generated = result.mock;

      await storage.appendMiss({
        at: new Date().toISOString(),
        method,
        path: fullPath,
        query,
        body,
        resolvedBy: "ai",
      });
      emitLiveEvent("miss", { method, path: fullPath, resolvedBy: "ai" });

      const validation = validateResponseWithOpenApi({
        doc: openapiDoc,
        method,
        path: fullPath,
        status: generated.response.status,
        responseBody: generated.response.body,
      });

      if (config.openApiMode === "strict" && !validation.ok) {
        pushRequestLog({
          at: new Date().toISOString(),
          method,
          path: fullPath,
          query,
          match: "generated-invalid",
          status: 502,
        });

        return reply
          .header("x-mock-match", "generated-invalid")
          .code(502)
          .send({
            error: "Generated response violates OpenAPI schema",
            validationErrors: validation.errors,
          });
      }

      if (config.openApiMode === "assist" && !validation.ok) {
        generated.meta.notes = `${generated.meta.notes ?? ""}; openapi-warnings=${validation.errors.join(" | ")}`;
      }

      const savedPath = await storage.saveVariant(
        method,
        fullPath,
        variantName,
        generated,
      );
      const index = await storage.readIndex();
      await storage.writeIndex(upsertIndex(index, method, fullPath, savedPath));
      emitLiveEvent("variants-updated", {
        action: "variant-generated",
        method,
        path: fullPath,
        id: variantName,
      });
      emitLiveEvent("endpoints-updated", {
        action: "variant-generated",
        method,
        path: fullPath,
      });

      pushRequestLog({
        at: new Date().toISOString(),
        method,
        path: fullPath,
        query,
        match: "generated",
        status: generated.response.status,
        prompt: generated.meta.prompt,
      });

      return reply
        .header("x-mock-match", "generated")
        .code(generated.response.status)
        .headers(sanitizeReplayHeaders(generated.response.headers))
        .send(generated.response.body);
    },
  });

  return app;
}
