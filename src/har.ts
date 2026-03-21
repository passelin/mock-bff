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
  _urlObj?: URL;
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

function shouldKeepEntry(entry: HarEntry, config: AppConfig): boolean {
  const method = entry.request.method.toUpperCase();
  const url = entry._urlObj ?? new URL(entry.request.url);
  const pathname = normalizePath(url.pathname).toLowerCase();
  const mime = (entry.response.content?.mimeType ?? '').toLowerCase();

  if (!config.har.onlyApiCalls) return true;

  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  if (config.har.excludeExtensions.some((ext) => pathname.endsWith(ext.toLowerCase()))) return false;

  if (config.har.pathAllowlist.length > 0 && !config.har.pathAllowlist.some((p) => pathname.includes(p.toLowerCase()))) {
    return false;
  }

  if (config.har.pathDenylist.some((p) => pathname.includes(p.toLowerCase()))) return false;

  if (config.har.requireJsonResponse && !mime.includes("application/json")) return false;

  return true;
}

export function parseHar(
  input: string,
  config: AppConfig,
): Array<{ method: string; path: string; variant: string; mock: StoredMock }> {
  const data = JSON.parse(input) as Har;
  const entries = (data.log?.entries ?? []).map((e) => ({ ...e, _urlObj: new URL(e.request.url) }));
  const filtered = entries.filter((e) => shouldKeepEntry(e, config));

  return filtered.map((e) => {
    const url = e._urlObj ?? new URL(e.request.url);
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
