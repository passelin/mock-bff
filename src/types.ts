export type OpenApiMode = "off" | "assist" | "strict";

export interface AppConfig {
  appName: string;
  openApiMode: OpenApiMode;
  aiEnabled: boolean;
  aiSeed?: number;
  aiTemperature?: number;
  aiProvider?: "openai" | "anthropic" | "ollama" | "none";
  aiModel?: string;
  aiStorePrompt?: boolean;
  providerBaseUrls?: {
    openai?: string;
    anthropic?: string;
    ollama?: string;
  };
  ignoredQueryParams: string[];
  redactHeaders: string[];
  redactBodyKeys: string[];
  har: {
    onlyApiCalls: boolean;
    requireJsonResponse: boolean;
    pathAllowlist: string[];
    pathDenylist: string[];
    ignorePatterns: string[];
    excludeExtensions: string[];
    excludeMimeTypes: string[];
  };
  aiPromptTemplate?: string;
  proxy?: {
    enabled: boolean;
    targetUrl: string;
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
  forcedVariant?: string;
  fuzzyDisabled?: boolean;
}

export interface RequestLogEntry {
  at: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  match: "exact" | "fuzzy" | "default" | "generated" | "generated-invalid" | "proxied" | "none";
  status: number;
  prompt?: string;
  aiError?: string;
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
