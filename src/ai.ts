import { generateText } from "ai";
import { z } from "zod";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ai-sdk-ollama";
import type { AppConfig, StoredMock } from "./types.js";
import { shortHash } from "./utils.js";

export interface AiGenerateInput {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  body: unknown;
  requestHeaders?: Record<string, string | string[] | undefined>;
  context: string;
  nearbyExamples: Array<{
    method: string;
    path: string;
    responseBody: unknown;
    label?: string;
  }>;
}

function parseJsonValue(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const objStart = trimmed.indexOf("{");
    const objEnd = trimmed.lastIndexOf("}");
    if (objStart >= 0 && objEnd > objStart) {
      return JSON.parse(trimmed.slice(objStart, objEnd + 1));
    }

    const arrStart = trimmed.indexOf("[");
    const arrEnd = trimmed.lastIndexOf("]");
    if (arrStart >= 0 && arrEnd > arrStart) {
      return JSON.parse(trimmed.slice(arrStart, arrEnd + 1));
    }

    throw new Error("Model output is not valid JSON");
  }
}

const DEFAULT_PROMPT_TEMPLATE = `You are an HTTP server for a Single Page Application.
Read the incoming HTTP request and return the most realistic successful HTTP response for a production-style REST API.

Output requirements:
1. Return exactly one JSON object with these top-level keys:
 - \`status\`: number
 - \`contentType\`: string (mime-type)
 - \`body\`: JSON value or string (depending on content type)
2. Do not include prose, commentary, explanations, or markdown.
3. The response must always be a successful HTTP response (2xx only).

Content negotiation:
1. Inspect the \`Accept\` header to determine the response format.

2. Default behavior (critical):
 - If the \`Accept\` header resembles a typical browser request (e.g. includes multiple types like \`text/html\`, \`application/xhtml+xml\`, \`application/xml\`, \`image/*\`, \`*/*\`), treat it as NO explicit preference.
 - In these cases, ALWAYS return \`application/json\`.
 - If \`*/*\` is present, treat it as no preference and return JSON.

3. Explicit format selection:
 - Only return a non-JSON format (e.g. \`text/html\`) if:
 - The \`Accept\` header specifies a single clear mime type, OR
 - One mime type has a strictly higher q-value than all others and is not a wildcard.
 - Examples that should return HTML:
 - \`Accept: text/html\`
 - \`Accept: text/html;q=1.0, application/json;q=0.5\`

4. Ambiguous or browser-style headers:
 - If multiple types are listed without a clear single winner (even if ordered), IGNORE ordering and return JSON.

5. If the requested type is unsupported or unclear, default to \`application/json\`.

6. For non-JSON responses (only when explicitly required), return a realistic representation (e.g. full HTML document as a string).

7. Always set the \`Content-Type\` header accordingly.

Response behavior:
1. Follow standard REST conventions:
 - \`POST\` creates a resource and returns the created entity.
 - \`GET /collection\` returns an array.
 - \`GET /collection/:id\` returns a single entity.
 - \`PATCH\` partially updates fields and returns the updated entity.
 - \`PUT\` replaces the entity and returns the replaced entity.
 - \`DELETE\` returns \`204\` with \`body: null\` or a confirmation object.
2. Support nested resources such as \`/users/:id/comments/:commentId\`.
3. IDs must be unique and realistic.
4. Timestamps must be realistic ISO-8601 strings.
5. Prefer realistic defaults when information is missing.

Conflict resolution:
1. Always return a successful response (2xx). Never return 4xx or 5xx.
2. If format expectations conflict, prioritize:
 - Explicit \`Accept\` header rules (as defined above)
 - Otherwise default to JSON

Data modeling rules:
1. Use the provided schema and endpoint hints whenever relevant.
2. Preserve field names and types exactly as defined.
3. Populate optional fields only when realistic.
4. Keep generated values internally consistent.
5. IDs should be unique numbers (random).
6. Output VALID JSON ONLY. Do not add ellipsis or other non valid output.

ADDITIONAL CONTEXT:

{{context}}

SIMILAR EXAMPLES:
{{similar_examples_json}}

THE REQUEST:

Timestamp: {{datetime_iso}} 
Method: {{method}}
Path: {{path}}
Query params: {{query_json}}
Body: {{body_json}}
Headers: {{headers_json}}`;

function renderPromptTemplate(
  template: string,
  input: AiGenerateInput,
  now: Date,
): string {
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

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_m, key) => map[key] ?? "",
  );
}

export function buildPrompt(
  input: AiGenerateInput,
  config: AppConfig,
  now: Date,
): string {
  const template = config.aiPromptTemplate?.trim()
    ? config.aiPromptTemplate
    : DEFAULT_PROMPT_TEMPLATE;
  return renderPromptTemplate(template, input, now);
}

function serializeCause(cause: unknown): unknown {
  if (!cause) return undefined;
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
      cause: serializeCause((cause as any).cause),
    };
  }
  if (typeof cause === "object") {
    try {
      return JSON.parse(JSON.stringify(cause));
    } catch {
      return String(cause);
    }
  }
  return cause;
}

function logAiError(event: {
  level?: "warn" | "error";
  reason: string;
  provider: string;
  model?: string;
  method: string;
  path: string;
  error?: unknown;
}) {
  const err = event.error as
    | { message?: string; name?: string; stack?: string; cause?: unknown }
    | undefined;
  const line = {
    level: event.level ?? "error",
    ts: new Date().toISOString(),
    kind: "mock-bff-ai-error",
    reason: event.reason,
    provider: event.provider,
    model: event.model,
    method: event.method,
    path: event.path,
    message: err?.message,
    name: err?.name,
    stack: err?.stack,
    cause: serializeCause(err?.cause),
  };
  process.stderr.write(`${JSON.stringify(line)}\n`);
}

function selectModel(provider: string, model: string, config: AppConfig) {
  if (provider === "openai") {
    const baseURL =
      process.env.OPENAI_BASE_URL ?? config.providerBaseUrls?.openai;
    if (baseURL) return createOpenAI({ baseURL })(model);
    return openai(model);
  }

  if (provider === "anthropic") {
    const baseURL =
      process.env.ANTHROPIC_BASE_URL ?? config.providerBaseUrls?.anthropic;
    if (baseURL) return createAnthropic({ baseURL })(model);
    return anthropic(model);
  }

  if (provider === "ollama") {
    const baseURL =
      process.env.OLLAMA_BASE_URL ??
      config.providerBaseUrls?.ollama ??
      "http://127.0.0.1:11434";

    return createOllama({ baseURL })(model);
  }

  return openai(model);
}

export async function generateMockResponse(
  input: AiGenerateInput,
  config: AppConfig,
): Promise<StoredMock | null> {
  const provider =
    process.env.MOCK_AI_PROVIDER ?? config.aiProvider ?? "openai";
  const now = new Date();
  const prompt = buildPrompt(input, config, now);

  if (provider === "none") return null;

  const providerKeyMissing =
    (provider === "openai" && !process.env.OPENAI_API_KEY) ||
    (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY);

  if (providerKeyMissing) {
    logAiError({
      level: "warn",
      reason: "missing-provider-key",
      provider,
      model: process.env.MOCK_AI_MODEL ?? config.aiModel,
      method: input.method,
      path: input.path,
    });
    return null;
  }

  if (!["openai", "anthropic", "ollama"].includes(provider)) {
    logAiError({
      level: "warn",
      reason: "unsupported-provider",
      provider,
      model: process.env.MOCK_AI_MODEL ?? config.aiModel,
      method: input.method,
      path: input.path,
    });
    return null;
  }

  try {
    const model = selectModel(
      provider,
      process.env.MOCK_AI_MODEL ??
        config.aiModel ??
        (provider === "anthropic"
          ? "claude-3-5-sonnet-latest"
          : provider === "ollama"
            ? "llama3.1:8b"
            : "gpt-5.4-mini"),
      config,
    );

    const result = await generateText({
      model,
      prompt,
      providerOptions:
        config.aiSeed !== undefined
          ? { openai: { seed: config.aiSeed } }
          : undefined,
    });

    process.stderr.write(
      `${JSON.stringify({
        level: "info",
        ts: new Date().toISOString(),
        kind: "mock-bff-ai-result",
        provider,
        model:
          process.env.MOCK_AI_MODEL ??
          config.aiModel ??
          (provider === "anthropic"
            ? "claude-3-5-sonnet-latest"
            : provider === "ollama"
              ? "llama3.1:8b"
              : "gpt-5.4-mini"),
        method: input.method,
        path: input.path,
        finishReason: result.finishReason,
        text: result.text,
      })}\n`,
    );

    const parsedRaw = parseJsonValue(result.text);
    const parsed = z
      .object({
        status: z.number().int().min(200).max(299),
        contentType: z.string().min(1),
        body: z.unknown(),
      })
      .parse(parsedRaw);

    const body = parsed.body;
    const status = parsed.status;
    const headers = {
      "content-type": parsed.contentType || "application/json",
      "x-mock-source": "ai",
    };

    return {
      requestSignature: {
        method: input.method,
        path: input.path,
        queryHash: shortHash(JSON.stringify(input.query)),
        bodyHash: shortHash(JSON.stringify(input.body ?? {})),
      },
      requestSnapshot: { query: input.query, body: input.body },
      response: { status, headers, body },
      meta: {
        source: "ai",
        createdAt: new Date().toISOString(),
        seed: config.aiSeed,
        notes: `vercel-ai-sdk:${provider}`,
        ...(config.aiStorePrompt ? { prompt } : {}),
      },
    };
  } catch (error) {
    logAiError({
      reason: "generateText-failed",
      provider,
      model: process.env.MOCK_AI_MODEL ?? config.aiModel,
      method: input.method,
      path: input.path,
      error,
    });
    return null;
  }
}
