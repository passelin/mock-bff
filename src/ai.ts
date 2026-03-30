import { generateText } from "ai";
import { z } from "zod";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ai-sdk-ollama";
import type { AppConfig, StoredMock } from "./types.js";
import {
  listOpenAiModels,
  listAnthropicModels,
  listOllamaModels,
  ollamaFallbackModels,
} from "./providers.js";

async function resolveModelId(
  provider: string,
  config: AppConfig,
): Promise<string | null> {
  const explicit = process.env.MOCK_AI_MODEL ?? config.aiModel;
  if (explicit) return explicit;

  if (provider === "openai") {
    const { models } = await listOpenAiModels(
      process.env.OPENAI_BASE_URL ?? config.providerBaseUrls?.openai,
      process.env.OPENAI_API_KEY,
    );
    return models[0] ?? null;
  }
  if (provider === "anthropic") {
    const { models } = await listAnthropicModels(
      process.env.ANTHROPIC_BASE_URL ?? config.providerBaseUrls?.anthropic,
      process.env.ANTHROPIC_API_KEY,
    );
    return models[0] ?? null;
  }
  if (provider === "ollama") {
    const base =
      process.env.OLLAMA_BASE_URL ??
      config.providerBaseUrls?.ollama ??
      "http://127.0.0.1:11434";
    const models = await listOllamaModels(base);
    return models[0] ?? ollamaFallbackModels()[0] ?? null;
  }
  return null;
}
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
    contentType?: string;
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

export const SYSTEM_PROMPT = `You are an HTTP server for a Single Page Application.
Read the incoming HTTP request and return the most realistic successful HTTP response for a production-style REST API.

Output requirements:
1. Return exactly one JSON object with these top-level keys:
 - \`status\`: number
 - \`contentType\`: string (mime-type)
 - \`body\`: JSON value or string (depending on content type)
2. Do not include prose, commentary, explanations, or markdown.
3. The response must always be a successful HTTP response (2xx only).

Content negotiation:
1. **Examples override everything else**: If similar examples are provided and they all share the same \`Content-Type\`, use that content type for this response. This takes priority over the \`Accept\` header and all rules below. For example, if every example shows \`Content-Type: text/event-stream\`, return a \`text/event-stream\` response.

2. Inspect the \`Accept\` header to determine the response format (only when no consistent example content-type is available).

3. Default behavior (critical):
 - If the \`Accept\` header resembles a typical browser request (e.g. includes multiple types like \`text/html\`, \`application/xhtml+xml\`, \`application/xml\`, \`image/*\`, \`*/*\`), treat it as NO explicit preference.
 - In these cases, ALWAYS return \`application/json\`.
 - If \`*/*\` is present, treat it as no preference and return JSON.

4. Explicit format selection:
 - Only return a non-JSON format (e.g. \`text/html\`) if:
 - The \`Accept\` header specifies a single clear mime type, OR
 - One mime type has a strictly higher q-value than all others and is not a wildcard.
 - Examples that should return HTML:
 - \`Accept: text/html\`
 - \`Accept: text/html;q=1.0, application/json;q=0.5\`

5. Ambiguous or browser-style headers:
 - If multiple types are listed without a clear single winner (even if ordered), IGNORE ordering and return JSON.

6. If the requested type is unsupported or unclear, default to \`application/json\`.

7. For non-JSON responses, return a realistic representation as a string in the \`body\` field (e.g. full HTML document, SSE event stream as \`data: ...\n\n\` lines).

8. Always set the \`Content-Type\` header accordingly.

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
6. When \`body\` is a JSON value, it must be strictly valid JSON. Never abbreviate arrays or objects with ellipsis (\`...\`), comments, or any other non-JSON token — always emit the full value.
7. When \`body\` is a string (e.g. SSE stream, HTML), write the raw content as-is.`;

export const DEFAULT_PROMPT_TEMPLATE = `ADDITIONAL CONTEXT:
{{context}}

SIMILAR EXAMPLES:
{{similar_examples_json}}
{{response_format_hint}}
THE REQUEST:
Timestamp: {{datetime_iso}}
Method: {{method}}
Path: {{path}}
Query params: {{query_json}}
Body: {{body_json}}
Headers: {{headers_json}}`;

function isBinaryContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const ct = contentType.split(";")[0].trim().toLowerCase();
  return (
    ct.startsWith("image/") ||
    ct.startsWith("audio/") ||
    ct.startsWith("video/") ||
    ct.startsWith("font/") ||
    ct === "application/octet-stream" ||
    ct === "application/pdf"
  );
}

function formatNearbyExamples(
  examples: AiGenerateInput["nearbyExamples"],
): string {
  return examples
    .slice(0, 6)
    .map((ex, i) => {
      const header = [
        `### Example ${i + 1}${ex.label ? `: ${ex.label}` : ""}`,
        `${ex.method} ${ex.path}`,
        `Content-Type: ${ex.contentType ?? "unknown"}`,
      ].join("\n");

      const ct = ex.contentType?.split(";")[0].trim().toLowerCase() ?? "";

      if (isBinaryContentType(ct)) {
        let encoded: string;
        if (typeof ex.responseBody === "string") {
          encoded = Buffer.from(ex.responseBody, "binary").toString("base64");
        } else if (ex.responseBody instanceof Buffer) {
          encoded = (ex.responseBody as Buffer).toString("base64");
        } else {
          encoded = Buffer.from(JSON.stringify(ex.responseBody)).toString("base64");
        }
        return `${header}\n\n\`\`\`\n[binary base64: ${ct}]\n${encoded}\n\`\`\``;
      }

      const isEmpty =
        ex.responseBody === null ||
        ex.responseBody === undefined ||
        (typeof ex.responseBody === "object" &&
          !Array.isArray(ex.responseBody) &&
          Object.keys(ex.responseBody as object).length === 0);

      if (isEmpty) return `${header}\n\n[no body captured]`;

      const lang = ct.includes("json") ? "json" : "";
      const MAX = 4000;
      const raw =
        typeof ex.responseBody === "string"
          ? ex.responseBody
          : JSON.stringify(ex.responseBody, null, 2);
      const body = raw.length > MAX ? `${raw.slice(0, MAX)}\n… [truncated]` : raw;

      return `${header}\n\n\`\`\`${lang}\n${body}\n\`\`\``;
    })
    .join("\n\n");
}

function inferContentTypeFromExamples(
  examples: AiGenerateInput["nearbyExamples"],
): string | undefined {
  // Only use same-endpoint examples to infer content-type, not similar-path ones
  const sameEndpoint = examples.filter((e) => e.label?.startsWith("same-endpoint:"));
  if (sameEndpoint.length === 0) return undefined;
  const types = sameEndpoint
    .map((e) => e.contentType?.split(";")[0].trim().toLowerCase())
    .filter((ct): ct is string => Boolean(ct));
  if (types.length === 0) return undefined;
  const dominant = types[0];
  if (types.every((ct) => ct === dominant)) return dominant;
  return undefined;
}

function renderPromptTemplate(
  template: string,
  input: AiGenerateInput,
  now: Date,
): string {
  const inferredCt = inferContentTypeFromExamples(input.nearbyExamples);
  const responseFormatHint = inferredCt
    ? `\nREQUIRED: You MUST set contentType to "${inferredCt}" and format the body accordingly. All existing examples for this endpoint use this content-type. Ignore the Accept header.\n`
    : "";

  const map: Record<string, string> = {
    datetime_iso: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    method: input.method,
    path: input.path,
    query_json: JSON.stringify(input.query),
    body_json: JSON.stringify(input.body),
    headers_json: JSON.stringify(input.requestHeaders ?? {}),
    context: input.context.slice(-4000),
    similar_examples_json: formatNearbyExamples(input.nearbyExamples),
    response_format_hint: responseFormatHint,
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
    const rawBase =
      process.env.ANTHROPIC_BASE_URL ?? config.providerBaseUrls?.anthropic;
    if (rawBase) {
      const normalized = rawBase.replace(/\/+$/, "").replace(/\/v1$/, "");
      return createAnthropic({ baseURL: `${normalized}/v1` })(model);
    }
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

export type GenerateSuccess = { ok: true; mock: StoredMock };
export type GenerateFailure = { ok: false; reason: string };

export async function generateMockResponse(
  input: AiGenerateInput,
  config: AppConfig,
): Promise<GenerateSuccess | GenerateFailure> {
  const provider =
    process.env.MOCK_AI_PROVIDER ?? config.aiProvider ?? "openai";
  const now = new Date();
  const prompt = buildPrompt(input, config, now);

  if (provider === "none") return { ok: false, reason: "provider-none" };

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
    return { ok: false, reason: "missing-provider-key" };
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
    return { ok: false, reason: "unsupported-provider" };
  }

  const modelId = await resolveModelId(provider, config);
  if (!modelId) {
    return { ok: false, reason: "no-model-available" };
  }

  try {
    const model = selectModel(provider, modelId, config);

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt,
      ...(config.aiTemperature !== undefined
        ? { temperature: config.aiTemperature }
        : {}),
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
        model: modelId,
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

    return {
      ok: true,
      mock: {
        requestSignature: {
          method: input.method,
          path: input.path,
          queryHash: shortHash(JSON.stringify(input.query)),
          bodyHash: shortHash(JSON.stringify(input.body ?? {})),
        },
        requestSnapshot: { query: input.query, body: input.body },
        response: {
          status: parsed.status,
          headers: {
            "content-type": parsed.contentType || "application/json",
            "x-mock-source": "ai",
          },
          body: parsed.body,
        },
        meta: {
          source: "ai",
          createdAt: new Date().toISOString(),
          seed: config.aiSeed,
          notes: `vercel-ai-sdk:${provider}`,
          ...(config.aiStorePrompt ? { prompt } : {}),
        },
      },
    };
  } catch (error) {
    const err = error as Error | undefined;
    logAiError({
      reason: "generateText-failed",
      provider,
      model: modelId,
      method: input.method,
      path: input.path,
      error,
    });
    return { ok: false, reason: err?.message ?? "generateText-failed" };
  }
}
