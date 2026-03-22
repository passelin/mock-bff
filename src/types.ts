export type OpenApiMode = "off" | "assist" | "strict";

export interface AppConfig {
  appName: string;
  openApiMode: OpenApiMode;
  aiEnabled: boolean;
  aiSeed?: number;
  aiProvider?: "openai" | "none";
  aiModel?: string;
  aiStorePrompt?: boolean;
  ignoredQueryParams: string[];
  redactHeaders: string[];
  redactBodyKeys: string[];
  har: {
    onlyApiCalls: boolean;
    requireJsonResponse: boolean;
    pathAllowlist: string[];
    pathDenylist: string[];
    excludeExtensions: string[];
  };
}

export interface RequestSignature {
  method: string;
  path: string;
  queryHash: string;
  bodyHash: string;
}

export interface RequestSnapshot {
  query: Record<string, string | string[]>;
  body: unknown;
}

export interface StoredMock {
  requestSignature: RequestSignature;
  requestSnapshot?: RequestSnapshot;
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  meta: {
    source: "har" | "ai" | "manual";
    createdAt: string;
    seed?: number;
    notes?: string;
    prompt?: string;
  };
}

export interface IndexEntry {
  method: string;
  path: string;
  variants: string[];
  defaultVariant?: string;
}

export interface MissLogEntry {
  at: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  body: unknown;
  resolvedBy: "none" | "ai";
}

export interface MatchResult {
  type: "exact" | "fuzzy" | "default" | "miss";
  mock?: StoredMock;
}
