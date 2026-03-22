import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
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
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s') && word.length > 1) return word.slice(0, -1);
  return word;
}

function looksLikeId(value: string): boolean {
  return /^[a-z0-9_-]{3,}$/i.test(value);
}

function fakeValueFromKey(key: string, idHint?: string): unknown {
  const k = key.toLowerCase();
  if (k === 'id' || k.endsWith('_id')) return idHint ?? 'id_1234';
  if (k.includes('name')) return idHint ? `User ${idHint}` : 'Mock Name';
  if (k.includes('email')) return idHint ? `user${idHint}@example.com` : 'user@example.com';
  if (k.includes('phone')) return '+1-555-0100';
  if (k.includes('active') || k.startsWith('is_') || k.startsWith('has_')) return true;
  if (k.includes('count') || k.includes('total')) return 1;
  if (k.includes('date') || k.includes('at')) return new Date().toISOString();
  if (k.includes('status')) return 'active';
  return 'mock';
}

function synthesizeFromExample(example: unknown, idHint?: string): unknown {
  if (!example || typeof example !== 'object' || Array.isArray(example)) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(example as Record<string, unknown>)) {
    out[key] = fakeValueFromKey(key, idHint);
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
      if (parsed && typeof parsed === 'object') snippets.push(parsed);
    } catch {}
  }

  return snippets;
}

function pickContextShape(input: AiGenerateInput, idHint?: string): unknown {
  const segments = input.path.toLowerCase().split('/').filter(Boolean);
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

  return synthesizeFromExample(best.obj, idHint) ?? best.obj;
}

function detectPreferredFormat(input: AiGenerateInput): 'json' | 'text' | 'html' {
  const acceptRaw = input.requestHeaders?.accept;
  const accept = Array.isArray(acceptRaw) ? acceptRaw.join(',') : (acceptRaw ?? '');
  const a = accept.toLowerCase();

  if (a.includes('text/html')) return 'html';
  if (a.includes('text/plain') && !a.includes('application/json')) return 'text';
  return 'json';
}

function synthesizeFallbackBody(input: AiGenerateInput, signature: string): unknown {
  const segments = input.path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const prev = segments[segments.length - 2];
  const idHint = last && looksLikeId(last) ? last : undefined;

  const contextShape = pickContextShape(input, idHint);
  if (contextShape && typeof contextShape === 'object') {
    return { ...(contextShape as Record<string, unknown>), generated: true, signature };
  }

  const nearbyExample = input.nearbyExamples.find((e) => e.responseBody && typeof e.responseBody === 'object')?.responseBody;
  const shaped = synthesizeFromExample(nearbyExample, idHint);
  if (shaped) return { ...(shaped as Record<string, unknown>), generated: true, signature };

  if (input.method === 'GET' && idHint && prev) {
    const entity = singularize(prev);
    return {
      id: idHint,
      type: entity,
      name: `${entity[0]?.toUpperCase() ?? 'E'}${entity.slice(1)} ${idHint}`,
      status: 'active',
      email: `${entity}${idHint}@example.com`,
      generated: true,
      signature,
    };
  }

  if (input.method === 'GET') {
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

  if (input.method === 'POST') {
    return {
      id: 'created_1001',
      created: true,
      ...((input.body && typeof input.body === 'object') ? (input.body as Record<string, unknown>) : {}),
      generated: true,
      signature,
    };
  }

  return { generated: true, endpoint: `${input.method} ${input.path}`, signature, note: 'Deterministic fallback' };
}

function fallbackResponse(input: AiGenerateInput, config: AppConfig, promptHint?: string): StoredMock {
  const seedPart = config.aiSeed ?? 0;
  const signature = shortHash(JSON.stringify({ ...input, seedPart }));
  const format = detectPreferredFormat(input);

  const bodyObject = synthesizeFallbackBody(input, signature);
  const responseBody =
    format === 'text'
      ? `Mock response for ${input.method} ${input.path}`
      : format === 'html'
        ? `<html><body><pre>${JSON.stringify(bodyObject, null, 2)}</pre></body></html>`
        : bodyObject;

  const contentType = format === 'text' ? 'text/plain; charset=utf-8' : format === 'html' ? 'text/html; charset=utf-8' : 'application/json';

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

export async function generateMockResponse(input: AiGenerateInput, config: AppConfig): Promise<StoredMock> {
  const provider = process.env.MOCK_AI_PROVIDER ?? config.aiProvider ?? "openai";

  const now = new Date();
  const prompt = [
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

  if (provider === "none") return fallbackResponse(input, config, prompt);

  if (provider !== "openai") {
    const fallback = fallbackResponse(input, config, prompt);
    return {
      ...fallback,
      meta: {
        ...fallback.meta,
        notes: `unsupported-provider:${provider}`,
      },
    };
  }

  if (!process.env.OPENAI_API_KEY) return fallbackResponse(input, config, prompt);

  try {

    const result = await generateText({
      model: openai(process.env.MOCK_AI_MODEL ?? config.aiModel ?? "gpt-5.4-mini"),
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
        notes: "vercel-ai-sdk",
        ...(config.aiStorePrompt ? { prompt } : {}),
      },
    };
  } catch {
    return fallbackResponse(input, config, prompt);
  }
}
