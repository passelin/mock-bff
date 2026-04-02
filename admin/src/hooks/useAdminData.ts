import { useEffect, useMemo, useState } from "react";
import type { AppConfig, Endpoint, ProviderInfo, ReqLog } from "../types";

export function useAdminData(defaultPromptTemplate: string) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [requests, setRequests] = useState<ReqLog[]>([]);
  const [misses, setMisses] = useState<any[]>([]);
  const [serverVersion, setServerVersion] = useState("unknown");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configText, setConfigText] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(defaultPromptTemplate);
  const [showPromptHints, setShowPromptHints] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({});
  const [providerName, setProviderName] = useState("openai");
  const [providerModel, setProviderModel] = useState("gpt-5.4-mini");
  const [aiSeed, setAiSeed] = useState("");
  const [aiTemperature, setAiTemperature] = useState("");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(
    "https://api.openai.com/v1",
  );
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState(
    "https://api.anthropic.com",
  );
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [context, setContext] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptDialog, setPromptDialog] = useState<string | null>(null);
  const [harFile, setHarFile] = useState<File | null>(null);
  const [openApiFile, setOpenApiFile] = useState<File | null>(null);
  const [openApiDoc, setOpenApiDoc] = useState<{
    exists: boolean;
    format?: string;
    raw?: string;
  }>({ exists: false });
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyTargetUrl, setProxyTargetUrl] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  async function loadEndpoints() {
    const rows = (await (await fetch("/-/api/endpoints")).json()) as Endpoint[];
    rows.sort(
      (a, b) =>
        a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
    );
    setEndpoints(rows);
  }
  async function loadRequests() {
    const data = await (await fetch("/-/api/requests?limit=100")).json();
    setRequests(data.rows ?? []);
  }
  async function loadMisses() {
    const data = await (await fetch("/-/api/misses")).json();
    setMisses(Array.isArray(data) ? data : []);
  }
  async function loadConfig() {
    const cfg = await (await fetch("/-/api/config")).json();
    setConfig(cfg);
    setConfigText(JSON.stringify(cfg, null, 2));
    setPromptTemplate(
      cfg.aiPromptTemplate && String(cfg.aiPromptTemplate).trim()
        ? cfg.aiPromptTemplate
        : defaultPromptTemplate,
    );
    setProviderName(cfg.aiProvider ?? "openai");
    setProviderModel(cfg.aiModel ?? "gpt-5.4-mini");
    setAiSeed(cfg.aiSeed !== undefined && cfg.aiSeed !== null ? String(cfg.aiSeed) : "");
    setAiTemperature(cfg.aiTemperature !== undefined && cfg.aiTemperature !== null ? String(cfg.aiTemperature) : "");
    setOpenaiBaseUrl(
      cfg.providerBaseUrls?.openai ?? "https://api.openai.com/v1",
    );
    setAnthropicBaseUrl(
      cfg.providerBaseUrls?.anthropic ?? "https://api.anthropic.com",
    );
    setOllamaBaseUrl(cfg.providerBaseUrls?.ollama ?? "http://127.0.0.1:11434");
    setProxyEnabled(cfg.proxy?.enabled ?? false);
    setProxyTargetUrl(cfg.proxy?.targetUrl ?? "");
  }
  async function loadHealth() {
    const data = await (await fetch("/-/api/health")).json();
    setServerVersion(data.version || "unknown");
  }
  async function loadProviders() {
    const data = await (await fetch("/-/api/providers")).json();
    setProviderInfo(data ?? {});
  }
  async function refreshOllamaModels() {
    await fetch("/-/api/providers/ollama/refresh", { method: "POST" });
    await loadProviders();
  }
  async function loadContext() {
    const d = await (await fetch("/-/api/context")).json();
    setContext(d.context || "");
  }

  async function loadOpenApiDoc() {
    const d = await (await fetch("/-/api/openapi")).json();
    setOpenApiDoc(d ?? { exists: false });
  }

  async function deleteOpenApiDoc() {
    setBusy(true);
    try {
      const res = await fetch("/-/api/openapi", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setOpenApiFile(null);
      await loadOpenApiDoc();
      showToast("OpenAPI contract deleted");
    } catch {
      showToast("Failed to delete OpenAPI contract");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    await Promise.all([
      loadEndpoints(),
      loadRequests(),
      loadMisses(),
      loadConfig(),
      loadHealth(),
      loadProviders(),
      loadContext(),
      loadOpenApiDoc(),
    ]);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const models = providerInfo.providers?.[providerName]?.models ?? [];
    if (models.length === 0) return;
    if (!models.includes(providerModel)) setProviderModel(models[0]);
  }, [providerInfo, providerName, providerModel]);

  const stats = useMemo(() => {
    const totalVariants = endpoints.reduce((acc, e) => acc + e.variants, 0);
    return {
      endpoints: endpoints.length,
      variants: totalVariants,
      misses: misses.length,
      requests: requests.length,
    };
  }, [endpoints, misses, requests]);

  const configError = useMemo(() => {
    if (!configText.trim()) return "Config cannot be empty";
    try {
      JSON.parse(configText);
      return "";
    } catch (e: any) {
      return `Invalid JSON: ${e.message}`;
    }
  }, [configText]);

  async function clearLogs() {
    await fetch("/-/api/requests", { method: "DELETE" });
    await loadRequests();
    showToast("Request logs cleared");
  }

  async function clearMisses() {
    await fetch("/-/api/misses", { method: "DELETE" });
    await loadMisses();
    showToast("Misses cleared");
  }

  async function uploadFile(
    route: string,
    file: File | null,
    successMsg: string,
  ) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(route, { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      await refresh();
      showToast(successMsg);
    } catch {
      showToast("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function setAiStorePrompt(enabled: boolean) {
    try {
      const parsed = JSON.parse(configText || "{}");
      parsed.aiStorePrompt = enabled;
      setConfigText(JSON.stringify(parsed, null, 2));
    } catch {}
  }

  function getAiStorePrompt(): boolean {
    try {
      const parsed = JSON.parse(configText || "{}");
      return Boolean(parsed.aiStorePrompt);
    } catch {
      return false;
    }
  }

  async function saveFullConfig(cfg: AppConfig, ctx: string): Promise<void> {
    setBusy(true);
    try {
      await fetch("/-/api/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      await fetch("/-/api/context", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
      setConfig(cfg);
      setConfigText(JSON.stringify(cfg, null, 2));
      setContext(ctx);
      showToast("Settings saved");
    } catch {
      showToast("Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    try {
      const parsed = JSON.parse(configText);
      parsed.aiPromptTemplate = promptTemplate;
      parsed.aiProvider = providerName;
      parsed.aiModel = providerModel;
      const seedNum = aiSeed.trim() !== "" ? parseInt(aiSeed, 10) : undefined;
      if (seedNum !== undefined && !isNaN(seedNum)) {
        parsed.aiSeed = seedNum;
      } else {
        delete parsed.aiSeed;
      }
      const tempNum = aiTemperature.trim() !== "" ? parseFloat(aiTemperature) : undefined;
      if (tempNum !== undefined && !isNaN(tempNum)) {
        parsed.aiTemperature = tempNum;
      } else {
        delete parsed.aiTemperature;
      }
      parsed.providerBaseUrls = {
        ...(parsed.providerBaseUrls ?? {}),
        openai: openaiBaseUrl,
        anthropic: anthropicBaseUrl,
        ollama: ollamaBaseUrl,
      };
      await fetch("/-/api/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      showToast("Config saved");
    } catch {
      showToast("Config invalid");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProxy(enabled: boolean) {
    setProxyEnabled(enabled);
    setBusy(true);
    try {
      await fetch("/-/api/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proxy: { enabled, targetUrl: proxyTargetUrl },
        }),
      });
    } catch {
      // best-effort
    } finally {
      setBusy(false);
    }
  }

  async function saveProxyConfig() {
    setBusy(true);
    try {
      await fetch("/-/api/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proxy: { enabled: proxyEnabled, targetUrl: proxyTargetUrl },
        }),
      });
      showToast(
        proxyEnabled ? "Proxy mode enabled" : "Proxy mode disabled",
      );
    } catch {
      showToast("Failed to save proxy config");
    } finally {
      setBusy(false);
    }
  }

  async function saveContext() {
    setBusy(true);
    try {
      await fetch("/-/api/context", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context }),
      });
      showToast("Context saved");
    } catch {
      showToast("Context save failed");
    } finally {
      setBusy(false);
    }
  }

  return {
    endpoints,
    requests,
    misses,
    serverVersion,
    config,
    configText,
    setConfigText,
    promptTemplate,
    setPromptTemplate,
    showPromptHints,
    setShowPromptHints,
    providerInfo,
    providerName,
    setProviderName,
    providerModel,
    setProviderModel,
    aiSeed,
    setAiSeed,
    aiTemperature,
    setAiTemperature,
    openaiBaseUrl,
    setOpenaiBaseUrl,
    anthropicBaseUrl,
    setAnthropicBaseUrl,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    context,
    setContext,
    toast,
    showToast,
    busy,
    setBusy,
    promptDialog,
    setPromptDialog,
    harFile,
    setHarFile,
    openApiFile,
    setOpenApiFile,
    openApiDoc,
    stats,
    configError,
    refresh,
    loadEndpoints,
    loadRequests,
    loadMisses,
    loadConfig,
    loadHealth,
    loadProviders,
    refreshOllamaModels,
    loadContext,
    loadOpenApiDoc,
    clearLogs,
    clearMisses,
    uploadFile,
    deleteOpenApiDoc,
    setAiStorePrompt,
    getAiStorePrompt,
    saveConfig,
    saveFullConfig,
    saveContext,
    proxyEnabled,
    setProxyEnabled,
    proxyTargetUrl,
    setProxyTargetUrl,
    saveProxyConfig,
    toggleProxy,
  };
}
