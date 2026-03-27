export type Endpoint = {
  method: string;
  path: string;
  variants: number;
  hasDefault: boolean;
};

export type VariantMeta = {
  id: string;
  file: string;
  source?: string;
  status?: number;
  createdAt?: string;
  displayLabel?: string;
};

export type ReqLog = {
  at: string;
  method: string;
  path: string;
  match: string;
  status: number;
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
