import { createHash } from "node:crypto";

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const cleaned = pathname.replace(/\/+/g, "/");
  return cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${canonicalize(v)}`);
  return `{${entries.join(",")}}`;
}

export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

export function safePathKey(pathname: string): string {
  return normalizePath(pathname)
    .replace(/^\//, "")
    .replace(/\//g, "__") || "root";
}

export function normalizeQuery(
  query: Record<string, string | string[]>,
  ignoredKeys: string[],
): Record<string, string | string[]> {
  const ignored = new Set(ignoredKeys);
  const out: Record<string, string | string[]> = {};
  for (const key of Object.keys(query).sort((a, b) => a.localeCompare(b))) {
    if (ignored.has(key)) continue;
    out[key] = query[key];
  }
  return out;
}

export function redactHeaders(headers: Record<string, string>, redactList: string[]): Record<string, string> {
  const out = { ...headers };
  const redact = new Set(redactList.map((v) => v.toLowerCase()));
  for (const key of Object.keys(out)) {
    if (redact.has(key.toLowerCase())) out[key] = "[REDACTED]";
  }
  return out;
}

export function redactJsonValue(value: unknown, redactKeys: string[]): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redactJsonValue(v, redactKeys));
  if (typeof value !== "object") return value;

  const redact = new Set(redactKeys.map((k) => k.toLowerCase()));
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    out[key] = redact.has(key.toLowerCase()) ? "[REDACTED]" : redactJsonValue(val, redactKeys);
  }
  return out;
}
