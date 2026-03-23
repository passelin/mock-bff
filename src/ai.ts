import { generateText } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AppConfig, StoredMock } from "./types.js";
import { shortHash } from "./utils.js";

export interface AiGenerateInput {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  body: unknown;
  requestHeaders?: Record<string, string | string[] | undefined>;
  context: string;
  nearbyExamples: Array<{ method: string; path: string; responseBody: unknown; label?: string }>;
}

function singularize(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("s") && word.length > 1) return word.slice(0, -1);
  return word;
}

function looksLikeId(value: string): boolean {
  return /^[a-z0-9_-]{3,}$/i.test(value);
}

const FIRST_NAMES = ["Avery", "Maya", "Noah", "Liam", "Sofia", "Ethan", "Aria", "Lucas", "Emma", "Milo", "Zoe", "Nina"];
const LAST_NAMES = ["Chen", "Patel", "Nguyen", "Garcia", "Miller", "Khan", "Singh", "Lopez", "Wright", "Fischer", "Kim", "Brown"];
const EMAIL_DOMAINS = ["example.com", "example.org", "demo.app", "sample.test"];

function seededIndex(seed: string, max: number): number {
  const h = shortHash(seed);
  const num = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(num) ? num % max : 0;
}

function syntheticIdentity(seed: string) {
  const first = FIRST_NAMES[seededIndex(`first:${seed}`, FIRST_NAMES.length)];
  const last = LAST_NAMES[seededIndex(`last:${seed}`, LAST_NAMES.length)];
  const domain = EMAIL_DOMAINS[seededIndex(`domain:${seed}`, EMAIL_DOMAINS.length)];
  const handle = `${first}.${last}`.toLowerCase();
  return {
    first,
    last,
    fullName: `${first} ${last}`,
    email: `${handle}@${domain}`,
    username: `${first.toLowerCase()}_${last.toLowerCase()}`,
  };
}

function fakeValueFromKey(key: string, idHint?: string, seed = "default"): unknown {
  const k = key.toLowerCase();
  const ident = syntheticIdentity(`${seed}:${idHint ?? ''}`);

  if (k === "id" || k.endsWith("_id")) return idHint ?? "id_1234";
  if (k === 'firstname' || k === 'first_name') return ident.first;
  if (k === 'lastname' || k === 'last_name') return ident.last;
  if (k === 'fullname' || k === 'full_name' || k.includes("name")) return ident.fullName;
  if (k.includes("email")) return ident.email;
  if (k.includes("username") || k === 'handle') return ident.username;
  if (k.includes("phone")) return "+1-555-0100";
  if (k.includes("active") || k.startsWith("is_") || k.startsWith("has_")) return true;
  if (k.includes("count") || k.includes("total")) return 1;
  if (k.includes("date") || k.includes("at")) return new Date().toISOString();
  if (k.includes("status")) return "active";
  return "mock";
}

function synthesizeFromExample(example: unknown, idHint?: string, seed = "default"): unknown {
  if (!example || typeof example !== "object" || Array.isArray(example)) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(example as Record<string, unknown>)) {
    out[key] = fakeValueFromKey(key, idHint, seed);
  }
  return out;
}

function extractJsonObjectsFromContext(context: string): unknown[] {
  const snippets: unknown[] = [];
  const codeFenceRegex = /```json\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = codeFenceRegex.exec(context)) !== null) {
    try {
      snippets.push(JSON.parse(m[1]));
    } catch {}
  }

  const braceRegex = /\{[\s\S]*?\}/g;
  const rawMatches = context.match(braceRegex) ?? [];
  for (const raw of rawMatches.slice(0, 40)) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") snippets.push(parsed);
    } catch {}
  }

  return snippets;
}

function extractTypeScriptInterfaceShape(context: string, interfaceName: string): Record<string, unknown> | undefined {
  const re = new RegExp(`export\\s+interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\}`, 'i');
  const m = context.match(re);
  if (!m) return undefined;

  const body = m[1];
  const out: Record<string, unknown> = {};
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lm = line.match(/^([a-zA-Z0-9_]+)\??\s*:\s*([^;]+);?/);
    if (!lm) continue;
    const key = lm[1];
    const type = lm[2].trim();

    if (type.includes('string')) out[key] = fakeValueFromKey(key);
    else if (type.includes('number')) out[key] = key.toLowerCase().includes('id') ? 1234 : 1;
    else if (type.includes('boolean')) out[key] = true;
    else if (type.includes('[]')) out[key] = [];
    else if (type.includes("'")) {
      const v = type.match(/'([^']+)'/)?.[1] ?? 'value';
      out[key] = v;
    } else out[key] = null;
  }

  return Object.keys(out).length ? out : undefined;
}

function pickContextShape(input: AiGenerateInput, idHint?: string): unknown {
  const path = input.path.toLowerCase();
  if (path.includes('/users')) {
    const ts = extractTypeScriptInterfaceShape(input.context, 'User');
    if (ts) {
      const seed = `${input.method}:${input.path}`;
      const ident = syntheticIdentity(seed);
      if (idHint) {
        ts.id = /^\d+$/.test(idHint) ? Number(idHint) : idHint;
      }
      if ('firstName' in ts) ts.firstName = ident.first;
      if ('lastName' in ts) ts.lastName = ident.last;
      if ('fullName' in ts) ts.fullName = ident.fullName;
      if ('email' in ts) ts.email = ident.email;
      if ('username' in ts) ts.username = ident.username;
      return ts;
    }
  }

  const segments = path.split('/').filter(Boolean);
  const contextObjects = extractJsonObjectsFromContext(input.context);
  if (contextObjects.length === 0) return undefined;

  const scored = contextObjects.map((obj) => {
    const text = JSON.stringify(obj).toLowerCase();
    let score = 0;
    for (const s of segments) if (s.length > 2 && text.includes(s)) score += 1;
    if (idHint && text.includes('id')) score += 1;
    return { obj, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score <= 0) return undefined;

  return synthesizeFromExample(best.obj, idHint, `${input.method}:${input.path}`) ?? best.obj;
}

function detectPreferredFormat(input: AiGenerateInput): "json" | "text" | "html" | "xml" {
  const acceptRaw = input.requestHeaders?.accept;
  const accept = Array.isArray(acceptRaw) ? acceptRaw.join(",") : acceptRaw ?? "";
  const a = accept.toLowerCase();

  const isSpecificSingle = a && !a.includes(',') && !a.includes('*/*');

  // If the caller asks explicitly for one format, honor it.
  if (isSpecificSingle) {
    if (a.includes('application/xml') || a.includes('text/xml')) return 'xml';
    if (a.includes('text/plain')) return 'text';
    if (a.includes('text/html')) return 'html';
    if (a.includes('application/json')) return 'json';
  }

  // Browser-generic navigation Accept should default to JSON for mock API behavior.
  const looksBrowserGeneric =
    a.includes('text/html') &&
    a.includes('application/xhtml+xml') &&
    (a.includes('application/xml') || a.includes('*/*'));
  if (looksBrowserGeneric) return 'json';

  if (a.includes("application/xml") || a.includes("text/xml")) return "xml";
  if (a.includes("text/html")) return "html";
  if (a.includes("text/plain") && !a.includes("application/json")) return "text";
  return "json";
}

function objectToXml(obj: unknown, root = 'response'): string {
  if (obj === null || obj === undefined) return `<${root}></${root}>`;
  if (typeof obj !== 'object') return `<${root}>${String(obj)}</${root}>`;
  if (Array.isArray(obj)) return `<${root}>${obj.map((v) => objectToXml(v, 'item')).join('')}</${root}>`;

  const entries = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => objectToXml(v, k))
    .join('');
  return `<${root}>${entries}</${root}>`;
}

function isLikelyCollectionEndpoint(method: string, path: string): boolean {
  if (method !== 'GET') return false;
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1].toLowerCase();
  if (looksLikeId(last)) return false;

  // common plural heuristics
  return last.endsWith('s') || last.endsWith('ies');
}

function synthesizeFallbackBody(input: AiGenerateInput, signature: string): unknown {
  const segments = input.path.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  const prev = segments[segments.length - 2];
  const idHint = last && looksLikeId(last) ? last : undefined;
  const isCollection = isLikelyCollectionEndpoint(input.method, input.path);

  const contextShape = pickContextShape(input, idHint);
  if (contextShape && typeof contextShape === "object") {
    if (isCollection) {
      const entity = last?.toLowerCase() ?? 'items';
      const item1 = { ...(contextShape as Record<string, unknown>), generated: true, signature };
      const item2 = { ...(contextShape as Record<string, unknown>), id: typeof item1.id === 'number' ? (item1.id as number) + 1 : '1002', generated: true, signature };
      return {
        [entity]: [item1, item2],
        total: 2,
        generated: true,
        signature,
      };
    }
    return { ...(contextShape as Record<string, unknown>), generated: true, signature };
  }

  const nearbyExample = input.nearbyExamples.find((e) => e.responseBody && typeof e.responseBody === "object")?.responseBody;
  const shaped = synthesizeFromExample(nearbyExample, idHint, `${input.method}:${input.path}`);
  if (shaped) {
    if (isCollection) {
      const entity = last?.toLowerCase() ?? 'items';
      const item = { ...(shaped as Record<string, unknown>), generated: true, signature };
      return {
        [entity]: [item],
        total: 1,
        generated: true,
        signature,
      };
    }
    return { ...(shaped as Record<string, unknown>), generated: true, signature };
  }

  if (input.method === "GET" && idHint && prev) {
    const entity = singularize(prev);
    const ident = syntheticIdentity(`${entity}:${idHint}`);
    return {
      id: /^\d+$/.test(idHint) ? Number(idHint) : idHint,
      type: entity,
      name: ident.fullName,
      firstName: ident.first,
      lastName: ident.last,
      username: ident.username,
      status: "active",
      email: ident.email,
      generated: true,
      signature,
    };
  }

  if (input.method === "GET") {
    if (isCollection) {
      const entity = last?.toLowerCase() ?? 'items';
      const ident1 = syntheticIdentity(`${entity}:1001`);
      const ident2 = syntheticIdentity(`${entity}:1002`);
      return {
        [entity]: [
          { id: 1001, name: ident1.fullName, email: ident1.email },
          { id: 1002, name: ident2.fullName, email: ident2.email },
        ],
        total: 2,
        generated: true,
        signature,
      };
    }

    return {
      items: [
        { id: '1001', name: 'Mock Item 1' },
        { id: '1002', name: 'Mock Item 2' },
      ],
      total: 2,
      generated: true,
      signature,
    };
  }

  if (input.method === "POST") {
    return {
      id: "created_1001",
      created: true,
      ...((input.body && typeof input.body === "object") ? (input.body as Record<string, unknown>) : {}),
      generated: true,
      signature,
    };
  }

  return { generated: true, endpoint: `${input.method} ${input.path}`, signature, note: "Deterministic fallback" };
}

function fallbackResponse(input: AiGenerateInput, config: AppConfig, promptHint?: string): StoredMock {
  const seedPart = config.aiSeed ?? 0;
  const signature = shortHash(JSON.stringify({ ...input, seedPart }));
  const format = detectPreferredFormat(input);

  const bodyObject = synthesizeFallbackBody(input, signature);
  const responseBody =
    format === "text"
      ? `Mock response for ${input.method} ${input.path}`
      : format === "html"
        ? `<html><body><pre>${JSON.stringify(bodyObject, null, 2)}</pre></body></html>`
        : format === "xml"
          ? objectToXml(bodyObject, 'response')
          : bodyObject;

  const contentType =
    format === "text"
      ? "text/plain; charset=utf-8"
      : format === "html"
        ? "text/html; charset=utf-8"
        : format === "xml"
          ? "application/xml; charset=utf-8"
          : "application/json";

  return {
    requestSignature: {
      method: input.method,
      path: input.path,
      queryHash: shortHash(JSON.stringify(input.query)),
      bodyHash: shortHash(JSON.stringify(input.body ?? {})),
    },
    requestSnapshot: { query: input.query, body: input.body },
    response: {
      status: 200,
      headers: { "content-type": contentType, "x-mock-source": "ai-fallback" },
      body: responseBody,
    },
    meta: {
      source: "ai",
      createdAt: new Date().toISOString(),
      seed: config.aiSeed,
      notes: `fallback:${format}`,
      ...(config.aiStorePrompt ? { prompt: promptHint ?? `Fallback synthesis for ${input.method} ${input.path}` } : {}),
    },
  };
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model output is not valid JSON object");
  }
}

function buildDefaultPrompt(input: AiGenerateInput, now: Date): string {
  return [
    "You generate realistic mock API response bodies.",
    "Return ONLY a valid JSON object (no markdown, no prose).",
    `Current datetime (ISO): ${now.toISOString()}`,
    `Current date (YYYY-MM-DD): ${now.toISOString().slice(0, 10)}`,
    `Endpoint: ${input.method} ${input.path}`,
    `Query: ${JSON.stringify(input.query)}`,
    `Request body: ${JSON.stringify(input.body)}`,
    `Request headers: ${JSON.stringify(input.requestHeaders ?? {})}`,
    `Context (truncated): ${input.context.slice(-4000)}`,
    `Similar request examples (replicate structure when relevant): ${JSON.stringify(input.nearbyExamples.slice(0, 6))}`,
  ].join("\n\n");
}

function renderPromptTemplate(template: string, input: AiGenerateInput, now: Date): string {
  const map: Record<string, string> = {
    datetime_iso: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    method: input.method,
    path: input.path,
    query_json: JSON.stringify(input.query),
    body_json: JSON.stringify(input.body),
    headers_json: JSON.stringify(input.requestHeaders ?? {}),
    context: input.context.slice(-4000),
    similar_examples_json: JSON.stringify(input.nearbyExamples.slice(0, 6)),
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => map[key] ?? "");
}

function buildPrompt(input: AiGenerateInput, config: AppConfig, now: Date): string {
  if (config.aiPromptTemplate && config.aiPromptTemplate.trim()) {
    return renderPromptTemplate(config.aiPromptTemplate, input, now);
  }
  return buildDefaultPrompt(input, now);
}

function selectModel(provider: string, model: string) {
  if (provider === "openai") {
    const baseURL = process.env.OPENAI_BASE_URL;
    if (baseURL) {
      const customOpenAI = createOpenAI({ baseURL });
      return customOpenAI(model);
    }
    return openai(model);
  }

  if (provider === "anthropic") {
    const baseURL = process.env.ANTHROPIC_BASE_URL;
    if (baseURL) {
      const customAnthropic = createAnthropic({ baseURL });
      return customAnthropic(model);
    }
    return anthropic(model);
  }

  if (provider === "ollama") {
    const baseURL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1";
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL,
    });
    return ollama(model);
  }

  return openai(model);
}

export async function generateMockResponse(input: AiGenerateInput, config: AppConfig): Promise<StoredMock> {
  const provider = process.env.MOCK_AI_PROVIDER ?? config.aiProvider ?? "openai";

  const now = new Date();
  const prompt = buildPrompt(input, config, now);

  if (provider === "none") return fallbackResponse(input, config, prompt);

  const providerKeyMissing =
    (provider === "openai" && !process.env.OPENAI_API_KEY) ||
    (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY);

  if (providerKeyMissing) return fallbackResponse(input, config, prompt);

  if (!["openai", "anthropic", "ollama"].includes(provider)) {
    const fallback = fallbackResponse(input, config, prompt);
    return {
      ...fallback,
      meta: {
        ...fallback.meta,
        notes: `unsupported-provider:${provider}`,
      },
    };
  }

  try {
    const model = selectModel(provider, process.env.MOCK_AI_MODEL ?? config.aiModel ?? (provider === "anthropic" ? "claude-3-5-sonnet-latest" : provider === "ollama" ? "llama3.1:8b" : "gpt-5.4-mini"));

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 1200,
      providerOptions: config.aiSeed !== undefined ? { openai: { seed: config.aiSeed } } : undefined,
    });

    const body = parseJsonObject(result.text);

    return {
      requestSignature: {
        method: input.method,
        path: input.path,
        queryHash: shortHash(JSON.stringify(input.query)),
        bodyHash: shortHash(JSON.stringify(input.body ?? {})),
      },
      requestSnapshot: { query: input.query, body: input.body },
      response: {
        status: 200,
        headers: { "content-type": "application/json", "x-mock-source": "ai" },
        body,
      },
      meta: {
        source: "ai",
        createdAt: new Date().toISOString(),
        seed: config.aiSeed,
        notes: `vercel-ai-sdk:${provider}`,
        ...(config.aiStorePrompt ? { prompt } : {}),
      },
    };
  } catch {
    return fallbackResponse(input, config, prompt);
  }
}
