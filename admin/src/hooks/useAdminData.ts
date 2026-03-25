import { useEffect, useMemo, useState } from "react";
import type { Endpoint, ProviderInfo, ReqLog } from "../types";

export function useAdminData(defaultPromptTemplate: string) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [requests, setRequests] = useState<ReqLog[]>([]);
  const [misses, setMisses] = useState<any[]>([]);
  const [configText, setConfigText] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(defaultPromptTemplate);
  const [showPromptHints, setShowPromptHints] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({});
  const [providerName, setProviderName] = useState("openai");
  const [providerModel, setProviderModel] = useState("gpt-5.4-mini");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("https://api.openai.com/v1");
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState("https://api.anthropic.com");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [context, setContext] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptDialog, setPromptDialog] = useState<string | null>(null);
  const [harFile, setHarFile] = useState<File | null>(null);
  const [openApiFile, setOpenApiFile] = useState<File | null>(null);
  const [openApiDoc, setOpenApiDoc] = useState<{ exists: boolean; format?: string; raw?: string }>({ exists: false });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  async function loadEndpoints() {
    const rows = (await (await fetch("/-/api/endpoints")).json()) as Endpoint[];
    rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
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
    setConfigText(JSON.stringify(cfg, null, 2));
    setPromptTemplate(cfg.aiPromptTemplate && String(cfg.aiPromptTemplate).trim() ? cfg.aiPromptTemplate : defaultPromptTemplate);
    setProviderName(cfg.aiProvider ?? "openai");
    setProviderModel(cfg.aiModel ?? "gpt-5.4-mini");
    setOpenaiBaseUrl(cfg.providerBaseUrls?.openai ?? "https://api.openai.com/v1");
    setAnthropicBaseUrl(cfg.providerBaseUrls?.anthropic ?? "https://api.anthropic.com");
    setOllamaBaseUrl(cfg.providerBaseUrls?.ollama ?? "http://127.0.0.1:11434");
  }
  async function loadProviders() {
    const data = await (await fetch("/-/api/providers")).json();
    setProviderInfo(data ?? {});
  }
  async function loadContext() {
    const d = await (await fetch("/-/api/context")).json();
    setContext(d.context || "");
  }

  async function loadOpenApiDoc() {
    const d = await (await fetch('/-/api/openapi')).json();
    setOpenApiDoc(d ?? { exists: false });
  }

  async function refresh() {
    await Promise.all([loadEndpoints(), loadRequests(), loadMisses(), loadConfig(), loadProviders(), loadContext(), loadOpenApiDoc()]);
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
    return { endpoints: endpoints.length, variants: totalVariants, misses: misses.length, requests: requests.length };
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

  async function uploadFile(route: string, file: File | null, successMsg: string) {
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

  async function saveConfig() {
    setBusy(true);
    try {
      const parsed = JSON.parse(configText);
      parsed.aiPromptTemplate = promptTemplate;
      parsed.aiProvider = providerName;
      parsed.aiModel = providerModel;
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
    endpoints, requests, misses,
    configText, setConfigText,
    promptTemplate, setPromptTemplate,
    showPromptHints, setShowPromptHints,
    providerInfo, providerName, setProviderName, providerModel, setProviderModel,
    openaiBaseUrl, setOpenaiBaseUrl, anthropicBaseUrl, setAnthropicBaseUrl, ollamaBaseUrl, setOllamaBaseUrl,
    context, setContext,
    toast, showToast,
    busy, setBusy,
    promptDialog, setPromptDialog,
    harFile, setHarFile, openApiFile, setOpenApiFile, openApiDoc,
    stats, configError,
    refresh, loadEndpoints, loadRequests, loadMisses, loadConfig, loadProviders, loadContext, loadOpenApiDoc,
    clearLogs, clearMisses, uploadFile, setAiStorePrompt, getAiStorePrompt, saveConfig, saveContext,
  };
}
