import type { AppConfig, StoredMock } from "./types.js";
import { buildVariantName } from "./matcher.js";
import { normalizePath, normalizeQuery, redactHeaders, redactJsonValue, shortHash } from "./utils.js";

interface Har {
  log?: {
    entries?: HarEntry[];
  };
}

interface HarEntry {
  request: {
    method: string;
    url: string;
    queryString?: Array<{ name: string; value: string }>;
    postData?: { text?: string };
    headers?: Array<{ name: string; value: string }>;
  };
  response: {
    status: number;
    headers?: Array<{ name: string; value: string }>;
    content?: { text?: string; mimeType?: string };
  };
}

function toHeaderMap(headers: Array<{ name: string; value: string }> = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) out[h.name.toLowerCase()] = h.value;
  return out;
}

function maybeJson(text?: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function parseHar(
  input: string,
  config: AppConfig,
): Array<{ method: string; path: string; variant: string; mock: StoredMock }> {
  const data = JSON.parse(input) as Har;
  const entries = data.log?.entries ?? [];

  return entries.map((e) => {
    const url = new URL(e.request.url);
    const method = e.request.method.toUpperCase();
    const path = normalizePath(url.pathname);

    const rawQuery = Object.fromEntries((e.request.queryString ?? []).map((q) => [q.name, q.value]));
    const queryObj = normalizeQuery(rawQuery, config.ignoredQueryParams);

    const reqBody = redactJsonValue(maybeJson(e.request.postData?.text), config.redactBodyKeys);
    const resBody = redactJsonValue(maybeJson(e.response.content?.text), config.redactBodyKeys);
    const resHeaders = redactHeaders(toHeaderMap(e.response.headers), config.redactHeaders);

    const variant = buildVariantName(queryObj, reqBody);

    return {
      method,
      path,
      variant,
      mock: {
        requestSignature: {
          method,
          path,
          queryHash: shortHash(JSON.stringify(queryObj)),
          bodyHash: shortHash(JSON.stringify(reqBody)),
        },
        requestSnapshot: { query: queryObj, body: reqBody },
        response: { status: e.response.status, headers: resHeaders, body: resBody },
        meta: { source: "har", createdAt: new Date().toISOString() },
      },
    };
  });
}
