import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { MockStorage } from "./storage.js";
import { parseHar } from "./har.js";
import { buildVariantName, matchMock } from "./matcher.js";
import { generateMockResponse } from "./ai.js";
import { normalizePath, normalizeQuery } from "./utils.js";
import { loadOpenApiFile, validateResponseWithOpenApi } from "./openapi.js";
import type { IndexEntry, StoredMock } from "./types.js";

export interface CreateAppOptions {
  rootDir: string;
  appName: string;
}

function upsertIndex(entries: IndexEntry[], method: string, apiPath: string, variantPath: string): IndexEntry[] {
  const existing = entries.find((e) => e.method === method && e.path === apiPath);
  if (!existing) {
    entries.push({ method, path: apiPath, variants: [variantPath], defaultVariant: variantPath });
    return entries;
  }
  if (!existing.variants.includes(variantPath)) existing.variants.push(variantPath);
  if (!existing.defaultVariant) existing.defaultVariant = variantPath;
  return entries;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: false });
  const storage = new MockStorage(path.join(options.rootDir, "mocks"));
  await storage.ensureLayout();

  const maxRequestLogs = Number(process.env.MOCK_MAX_REQUEST_LOGS || 500);
  const requestLogs: Array<{
    at: string;
    method: string;
    path: string;
    query: Record<string, string | string[]>;
    match: "exact" | "fuzzy" | "default" | "generated" | "generated-invalid" | "none";
    status: number;
  }> = [];

  const pushRequestLog = (entry: {
    at: string;
    method: string;
    path: string;
    query: Record<string, string | string[]>;
    match: "exact" | "fuzzy" | "default" | "generated" | "generated-invalid" | "none";
    status: number;
  }) => {
    requestLogs.push(entry);
    if (requestLogs.length > maxRequestLogs) {
      requestLogs.splice(0, requestLogs.length - maxRequestLogs);
    }
  };

  const initialConfig = await storage.readConfig();
  await storage.writeConfig({ ...initialConfig, appName: options.appName });

  await app.register(cors);
  await app.register(multipart, {
    limits: {
      fileSize: Number(process.env.MOCK_MAX_UPLOAD_BYTES || 250 * 1024 * 1024),
    },
  });

  const adminDistDir = path.join(options.rootDir, "admin", "dist");
  await app.register(fastifyStatic, {
    root: adminDistDir,
    prefix: "/-/admin/",
    decorateReply: false,
  });

  const serveAdminIndex = async (_req: any, reply: any) => {
    try {
      const html = await readFile(path.join(adminDistDir, "index.html"), "utf8");
      return reply.type("text/html").send(html);
    } catch {
      return reply.code(500).send({ error: "Admin UI not built. Run: npm run build:admin" });
    }
  };

  app.get("/-/admin", serveAdminIndex);

  app.get("/admin/health", async () => ({ ok: true, app: options.appName }));
  app.get("/admin/config", async () => storage.readConfig());

  app.patch<{ Body: Record<string, unknown> }>("/admin/config", async (req) => {
    const prev = await storage.readConfig();
    const next = { ...prev, ...req.body };
    await storage.writeConfig(next);
    return next;
  });

  app.post("/admin/openapi", async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: "Missing file" });
    const data = await part.toBuffer();
    const filename = (part.filename || "openapi.json").toLowerCase();
    const target = path.join(storage.metaDir(), filename.endsWith(".yaml") || filename.endsWith(".yml") ? "openapi.yaml" : "openapi.json");
    await writeFile(target, data);
    return { saved: true };
  });

  app.post("/admin/har", async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: "Missing HAR file" });

    const config = await storage.readConfig();
    const content = (await part.toBuffer()).toString("utf8");
    const parsed = parseHar(content, config);
    let index = await storage.readIndex();

    for (const item of parsed) {
      const saved = await storage.saveVariant(item.method, item.path, item.variant, item.mock);
      index = upsertIndex(index, item.method, item.path, saved);
      const existingDefault = await storage.readMock(storage.defaultPath(item.method, item.path));
      if (!existingDefault) await storage.saveDefault(item.method, item.path, item.mock);
    }

    await storage.writeIndex(index);
    return { imported: parsed.length };
  });

  app.get("/admin/endpoints", async () => {
    const index = await storage.readIndex();
    return index.map((e) => ({ method: e.method, path: e.path, variants: e.variants.length, hasDefault: Boolean(e.defaultVariant) }));
  });

  app.get<{ Querystring: { method?: string; path?: string } }>("/admin/variants", async (req, reply) => {
    const method = req.query.method?.toUpperCase();
    const apiPath = req.query.path;
    if (!method || !apiPath) return reply.code(400).send({ error: "method and path query params are required" });

    const files = await storage.listVariants(method, apiPath);
    const items = [] as Array<{ id: string; file: string; source?: string; status?: number; createdAt?: string }>;
    for (const file of files) {
      const mock = await storage.readMock(file);
      const id = file.split("/").pop()?.replace(/\.json$/, "") ?? file;
      items.push({ id, file, source: mock?.meta.source, status: mock?.response.status, createdAt: mock?.meta.createdAt });
    }

    return { method, path: apiPath, variants: items };
  });

  app.get<{ Querystring: { method?: string; path?: string; id?: string } }>("/admin/variant", async (req, reply) => {
    const method = req.query.method?.toUpperCase();
    const apiPath = req.query.path;
    const id = req.query.id;
    if (!method || !apiPath || !id) return reply.code(400).send({ error: "method, path, id are required" });

    const filePath = storage.mockPath(method, apiPath, id);
    const mock = await storage.readMock(filePath);
    if (!mock) return reply.code(404).send({ error: "variant not found" });
    return { method, path: apiPath, id, mock };
  });

  app.put<{ Body: { method?: string; path?: string; id?: string; mock?: StoredMock } }>("/admin/variant", async (req, reply) => {
    const method = req.body.method?.toUpperCase();
    const apiPath = req.body.path;
    const id = req.body.id;
    const mock = req.body.mock;
    if (!method || !apiPath || !id || !mock) return reply.code(400).send({ error: "method, path, id, mock are required" });

    await storage.saveVariant(method, apiPath, id, {
      ...mock,
      meta: {
        ...mock.meta,
        source: "manual",
        createdAt: new Date().toISOString(),
      },
    });

    return { saved: true };
  });

  app.get<{ Querystring: { method?: string; path?: string } }>("/admin/diagnostics", async (req, reply) => {
    const method = req.query.method?.toUpperCase();
    const apiPath = req.query.path;
    if (!method || !apiPath) return reply.code(400).send({ error: "method and path query params are required" });

    const index = await storage.readIndex();
    const entry = index.find((e) => e.method === method && e.path === apiPath);
    const variants = await storage.listVariants(method, apiPath);
    const defaultExists = Boolean(await storage.readMock(storage.defaultPath(method, apiPath)));

    return {
      method,
      path: apiPath,
      indexed: Boolean(entry),
      indexVariantCount: entry?.variants.length ?? 0,
      variantFiles: variants,
      hasDefault: defaultExists,
    };
  });

  app.get("/admin/misses", async (_req, reply) => {
    const file = path.join(storage.metaDir(), "misses.log.jsonl");
    try {
      return (await readFile(file, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return reply.send([]);
    }
  });

  app.get<{ Querystring: { limit?: string } }>("/admin/requests", async (req) => {
    const requested = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(1000, requested)) : 100;
    const rows = requestLogs.slice(-limit).reverse();
    return { max: maxRequestLogs, count: requestLogs.length, rows };
  });

  app.get("/admin/context", async () => ({ context: await readFile(path.join(storage.metaDir(), "context.md"), "utf8") }));
  app.put<{ Body: { context: string } }>("/admin/context", async (req) => {
    await writeFile(path.join(storage.metaDir(), "context.md"), req.body.context, "utf8");
    return { saved: true };
  });

  app.post("/admin/reindex", async () => {
    const index = await storage.readIndex();
    await storage.writeIndex(index);
    return { reindexed: index.length };
  });

  app.all("/mock/*", async (req, reply) => {
    const method = req.method.toUpperCase();
    const fullPath = normalizePath(req.url.split("?")[0].replace(/^\/mock/, "") || "/");
    const config = await storage.readConfig();

    const query = normalizeQuery((req.query as Record<string, string | string[]>) ?? {}, config.ignoredQueryParams);
    const body = req.body;

    const variantName = buildVariantName(query, body ?? {});
    const exact = await storage.readMock(storage.mockPath(method, fullPath, variantName));
    const variantFiles = await storage.listVariants(method, fullPath);
    const variants = (await Promise.all(variantFiles.map((f) => storage.readMock(f)))).filter(Boolean) as StoredMock[];
    const defaultMock = await storage.readMock(storage.defaultPath(method, fullPath));

    const match = matchMock({ exact, variants, defaultMock, requestBody: body });
    if (match.type !== "miss" && match.mock) {
      pushRequestLog({
        at: new Date().toISOString(),
        method,
        path: fullPath,
        query,
        match: match.type,
        status: match.mock.response.status,
      });

      return reply
        .header("x-mock-match", match.type)
        .code(match.mock.response.status)
        .headers(match.mock.response.headers)
        .send(match.mock.response.body);
    }

    await storage.appendMiss({ at: new Date().toISOString(), method, path: fullPath, query, body, resolvedBy: config.aiEnabled ? "ai" : "none" });
    if (!config.aiEnabled) {
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

    const context = await readFile(path.join(storage.metaDir(), "context.md"), "utf8");
    const generated = await generateMockResponse({
      method,
      path: fullPath,
      query,
      body,
      context,
      nearbyExamples: variants.slice(0, 5).map((v) => ({ method, path: fullPath, responseBody: v.response.body })),
    }, config);

    const openapiFileJson = path.join(storage.metaDir(), "openapi.json");
    const openapiFileYaml = path.join(storage.metaDir(), "openapi.yaml");
    const openapi = (await loadOpenApiFile(openapiFileJson)) ?? (await loadOpenApiFile(openapiFileYaml));
    const validation = validateResponseWithOpenApi({ doc: openapi, method, path: fullPath, status: generated.response.status, responseBody: generated.response.body });

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
        .send({ error: "Generated response violates OpenAPI schema", validationErrors: validation.errors });
    }

    if (config.openApiMode === "assist" && !validation.ok) {
      generated.meta.notes = `${generated.meta.notes ?? ""}; openapi-warnings=${validation.errors.join(" | ")}`;
    }

    const savedPath = await storage.saveVariant(method, fullPath, variantName, generated);
    const index = await storage.readIndex();
    await storage.writeIndex(upsertIndex(index, method, fullPath, savedPath));
    await storage.appendContext(`- Learned ${method} ${fullPath} @ ${new Date().toISOString()} (${validation.ok ? "openapi-ok" : "openapi-warning"})`);

    pushRequestLog({
      at: new Date().toISOString(),
      method,
      path: fullPath,
      query,
      match: "generated",
      status: generated.response.status,
    });

    return reply
      .header("x-mock-match", "generated")
      .code(generated.response.status)
      .headers(generated.response.headers)
      .send(generated.response.body);
  });

  return app;
}
