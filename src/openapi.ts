import { readFile } from "node:fs/promises";
import { load } from "js-yaml";
import AjvImport, { ErrorObject } from "ajv";

export interface OpenApiValidationResult {
  ok: boolean;
  errors: string[];
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
}

interface OpenApiDoc {
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

const AjvCtor: any = (AjvImport as any).default ?? (AjvImport as any);
const ajv = new AjvCtor({ allErrors: true, strict: false });

function getByPointer(root: unknown, pointer: string): unknown {
  const parts = pointer.replace(/^#\//, '').split('/').filter(Boolean).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: any = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveRefs(schema: unknown, root: unknown, seen = new Set<string>()): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map((x) => resolveRefs(x, root, seen));

  const obj = schema as Record<string, unknown>;
  if (typeof obj.$ref === 'string' && obj.$ref.startsWith('#/')) {
    const ref = obj.$ref;
    if (seen.has(ref)) return schema;
    const target = getByPointer(root, ref);
    if (!target) return schema;
    const nextSeen = new Set(seen);
    nextSeen.add(ref);
    const resolved = resolveRefs(target, root, nextSeen);
    const merged = { ...resolved as Record<string, unknown>, ...Object.fromEntries(Object.entries(obj).filter(([k]) => k !== '$ref')) };
    return resolveRefs(merged, root, nextSeen);
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'nullable' && v === true) continue;
    out[k] = resolveRefs(v, root, seen);
  }

  if (obj.nullable === true && typeof out.type === 'string') {
    out.type = [out.type, 'null'];
  }

  return out;
}

export async function loadOpenApiFile(filePath: string): Promise<OpenApiDoc | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) return load(raw) as OpenApiDoc;
    return JSON.parse(raw) as OpenApiDoc;
  } catch {
    return undefined;
  }
}

function normalizePath(pathname: string): string {
  return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
}

export function findPathKey(doc: OpenApiDoc, runtimePath: string): string | undefined {
  if (!doc.paths) return undefined;
  const target = normalizePath(runtimePath);
  for (const key of Object.keys(doc.paths)) {
    const re = new RegExp(`^${key.replace(/\{[^/]+\}/g, "[^/]+")}$`);
    if (re.test(target)) return key;
  }
  return undefined;
}

export function buildOpenApiHint(args: {
  doc?: OpenApiDoc;
  method: string;
  path: string;
}): string | undefined {
  if (!args.doc?.paths) return undefined;
  const matchedPath = findPathKey(args.doc, args.path);
  if (!matchedPath) return undefined;
  const methodDef = args.doc.paths[matchedPath]?.[args.method.toLowerCase()];
  if (!methodDef) return undefined;

  const schema =
    methodDef.responses?.["200"]?.content?.["application/json"]?.schema ??
    methodDef.responses?.["201"]?.content?.["application/json"]?.schema ??
    methodDef.responses?.default?.content?.["application/json"]?.schema;

  const resolved = schema ? resolveRefs(schema, args.doc) : undefined;
  const schemaPreview = resolved ? JSON.stringify(resolved).slice(0, 3000) : "";

  return [
    `OpenAPI matched path: ${matchedPath}`,
    methodDef.summary ? `OpenAPI summary: ${methodDef.summary}` : "",
    methodDef.description ? `OpenAPI description: ${methodDef.description}` : "",
    schemaPreview ? `OpenAPI response schema (application/json): ${schemaPreview}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function validateResponseWithOpenApi(args: {
  doc?: OpenApiDoc;
  method: string;
  path: string;
  status: number;
  responseBody: unknown;
}): OpenApiValidationResult {
  if (!args.doc?.paths) return { ok: true, errors: [] };

  const matchedPath = findPathKey(args.doc, args.path);
  if (!matchedPath) return { ok: true, errors: [] };

  const pathDef = args.doc.paths[matchedPath];
  const methodDef = pathDef?.[args.method.toLowerCase()];
  if (!methodDef) return { ok: true, errors: [] };

  const statusKey = String(args.status);
  const resDef = methodDef.responses?.[statusKey] ?? methodDef.responses?.default;
  const schema = resDef?.content?.["application/json"]?.schema;
  if (!schema || typeof schema !== "object") return { ok: true, errors: [] };

  const resolvedSchema = resolveRefs(schema, args.doc);
  const validate = ajv.compile(resolvedSchema as object);
  const ok = validate(args.responseBody);
  if (ok) return { ok: true, errors: [] };
  const errors = (validate.errors ?? []).map((e: ErrorObject) => `${e.instancePath || "$"} ${e.message ?? "invalid"}`);
  return { ok: false, errors };
}
