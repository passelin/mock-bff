function normalizeModelList(models: string[]): string[] {
  return [...new Set(models)]
    .filter((m) => m)
    .sort((a, b) => a.localeCompare(b));
}

function logProviderError(kind: string, detail: Record<string, unknown>) {
  process.stderr.write(
    `${JSON.stringify({ level: "error", ts: new Date().toISOString(), kind, ...detail })}\n`,
  );
}

export async function listOpenAiModels(
  baseUrl: string | undefined,
  apiKey: string | undefined,
): Promise<{ models: string[]; disabled: boolean }> {
  if (!apiKey) return { models: [], disabled: true };
  const base = (baseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      logProviderError("openai-models-fetch", { status: res.status });
      return { models: [], disabled: true };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (data.data ?? [])
      .map((m) => m.id)
      .filter((id) => /^(gpt-|o\d)/i.test(id));
    return { models: normalizeModelList(ids), disabled: ids.length === 0 };
  } catch (err) {
    logProviderError("openai-models-fetch", { error: String(err) });
    return { models: [], disabled: true };
  }
}

export async function listAnthropicModels(
  baseUrl: string | undefined,
  apiKey: string | undefined,
): Promise<{ models: string[]; disabled: boolean }> {
  if (!apiKey) return { models: [], disabled: true };
  const base = (baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) {
      logProviderError("anthropic-models-fetch", { status: res.status });
      return { models: [], disabled: true };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (data.data ?? []).map((m) => m.id).filter(Boolean);
    return { models: normalizeModelList(ids), disabled: ids.length === 0 };
  } catch (err) {
    logProviderError("anthropic-models-fetch", { error: String(err) });
    return { models: [], disabled: true };
  }
}

function normalizeOllamaBase(base: string): string {
  return base.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function ollamaTagsUrl(base: string): string {
  return `${normalizeOllamaBase(base)}/api/tags`;
}

function ollamaShowUrl(base: string): string {
  return `${normalizeOllamaBase(base)}/api/show`;
}

async function ollamaCapabilities(base: string, model: string): Promise<string[]> {
  try {
    const res = await fetch(ollamaShowUrl(base), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      capabilities?: string[];
      details?: { capabilities?: string[] };
    };
    return data.capabilities ?? data.details?.capabilities ?? [];
  } catch {
    return [];
  }
}

function keepByCapabilities(caps: string[]): boolean {
  if (!caps || caps.length === 0) return true;
  const c = caps.map((x) => x.toLowerCase());
  const hasCompletion =
    c.includes("completion") || c.includes("generate") || c.includes("text");
  const onlyVision = c.includes("vision") && !hasCompletion;
  const onlyFunction =
    (c.includes("tools") || c.includes("function") || c.includes("tool-calling")) &&
    !hasCompletion;
  return !onlyVision && !onlyFunction;
}

export async function listOllamaModels(base: string): Promise<string[]> {
  try {
    const res = await fetch(ollamaTagsUrl(base));
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const names = (data.models ?? [])
      .map((m) => m.name)
      .filter((x): x is string => Boolean(x));
    const results = await Promise.all(
      names.map(async (name) => {
        const caps = await ollamaCapabilities(base, name);
        return keepByCapabilities(caps) ? name : null;
      }),
    );
    return normalizeModelList(results.filter((x): x is string => x !== null));
  } catch {
    return [];
  }
}

export function ollamaFallbackModels(): string[] {
  return normalizeModelList(["llama3.1:8b", "qwen2.5:7b", "mistral:7b"]);
}
