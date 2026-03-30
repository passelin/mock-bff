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

const DROPPED_INGEST_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  // let Fastify CORS plugin own these at runtime
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-max-age",
  "access-control-request-method",
  "access-control-request-headers",
  "vary",
]);

function toHeaderMap(headers: Array<{ name: string; value: string }> = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) {
    const key = h.name.toLowerCase();
    if (DROPPED_INGEST_HEADERS.has(key)) continue;
    out[key] = h.value;
  }
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

function maybeParseBody(text?: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function isApiLikeRequest(args: {
  method: string;
  pathname: string;
  config: AppConfig;
  responseMimeType?: string;
  requireJsonResponse?: boolean;
}): boolean {
  const method = args.method.toUpperCase();
  const pathname = normalizePath(args.pathname).toLowerCase();
  const mime = (args.responseMimeType ?? '').toLowerCase();
  const requireJson = args.requireJsonResponse ?? args.config.har.requireJsonResponse;

  if (!args.config.har.onlyApiCalls) return true;

  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  if (args.config.har.excludeExtensions.some((ext) => pathname.endsWith(ext.toLowerCase()))) return false;

  if (args.config.har.pathAllowlist.length > 0 && !args.config.har.pathAllowlist.some((p) => pathname.includes(p.toLowerCase()))) {
    return false;
  }

  if (args.config.har.pathDenylist.some((p) => pathname.includes(p.toLowerCase()))) return false;

  if (args.config.har.ignorePatterns.some((g) => globToRegExp(g).test(pathname))) return false;

  if (requireJson && !mime.includes("application/json")) return false;

  return true;
}

function shouldKeepEntry(entry: HarEntry, config: AppConfig): boolean {
  const url = entry._urlObj ?? new URL(entry.request.url);
  return isApiLikeRequest({
    method: entry.request.method,
    pathname: url.pathname,
    config,
    responseMimeType: entry.response.content?.mimeType,
    requireJsonResponse: config.har.requireJsonResponse,
  });
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
    const resBody = redactJsonValue(maybeParseBody(e.response.content?.text), config.redactBodyKeys);
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
