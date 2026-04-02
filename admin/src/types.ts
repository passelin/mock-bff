export type Endpoint = {
  method: string;
  path: string;
  variants: number;
  hasDefault: boolean;
  forcedVariant?: string;
  fuzzyDisabled?: boolean;
};

export type VariantMeta = {
  id: string;
  file: string;
  source?: string;
  status?: number;
  createdAt?: string;
  updatedAt?: string;
  displayLabel?: string;
};

export type ReqLog = {
  at: string;
  method: string;
  path: string;
  match: string;
  status: number;
};

export type OpenApiMode = "off" | "assist" | "strict";

export type AppConfig = {
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
};

export type ProviderInfo = {
  current?: { provider?: string; model?: string };
  providers?: Record<
    string,
    {
      models?: string[];
      disabled?: boolean;
      baseUrl?: string | null;
      apiKeyPreview?: string | null;
      apiKeyHint?: string;
    }
  >;
};
