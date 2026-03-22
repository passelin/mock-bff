import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { AppConfig, StoredMock } from "./types.js";
import { shortHash } from "./utils.js";

export interface AiGenerateInput {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  body: unknown;
  context: string;
  nearbyExamples: Array<{ method: string; path: string; responseBody: unknown }>;
}

function fallbackResponse(input: AiGenerateInput, config: AppConfig): StoredMock {
  const seedPart = config.aiSeed ?? 0;
  const signature = shortHash(JSON.stringify({ ...input, seedPart }));
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
      headers: { "content-type": "application/json", "x-mock-source": "ai-fallback" },
      body: { generated: true, endpoint: `${input.method} ${input.path}`, signature, note: "Deterministic fallback" },
    },
    meta: { source: "ai", createdAt: new Date().toISOString(), seed: config.aiSeed, notes: "fallback" },
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
  if (provider === "none") return fallbackResponse(input, config);

  if (provider !== "openai") {
    const fallback = fallbackResponse(input, config);
    return {
      ...fallback,
      meta: {
        ...fallback.meta,
        notes: `unsupported-provider:${provider}`,
      },
    };
  }

  if (!process.env.OPENAI_API_KEY) return fallbackResponse(input, config);

  try {
    const prompt = [
      "You generate realistic mock API response bodies.",
      "Return ONLY a valid JSON object (no markdown, no prose).",
      `Endpoint: ${input.method} ${input.path}`,
      `Query: ${JSON.stringify(input.query)}`,
      `Request body: ${JSON.stringify(input.body)}`,
      `Context (truncated): ${input.context.slice(-4000)}`,
      `Nearby examples: ${JSON.stringify(input.nearbyExamples.slice(0, 4))}`,
    ].join("\n\n");

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
      meta: { source: "ai", createdAt: new Date().toISOString(), seed: config.aiSeed, notes: "vercel-ai-sdk" },
    };
  } catch {
    return fallbackResponse(input, config);
  }
}
