import { useEffect, useMemo, useState } from "react";
import { FileJson, Gauge, ListTree, Logs, Menu, Route as RouteIcon, Settings, Sparkles, X } from "lucide-react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Card } from "./components/Card";
import { Tab } from "./components/Tab";
import { PromptDialog } from "./components/PromptDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EndpointsPage } from "./pages/EndpointsPage";
import { LogsPage } from "./pages/LogsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VariantsPage } from "./pages/VariantsPage";
import { OpenApiPage } from "./pages/OpenApiPage";
import { useAdminData } from "./hooks/useAdminData";
import type { VariantMeta } from "./types";

const DEFAULT_PROMPT_TEMPLATE = `You are an HTTP server for a Single Page Application.
Read the incoming HTTP request and return the most realistic successful HTTP response for a production-style REST API.

Output requirements:
1. Return exactly one JSON object with these top-level keys:
 - \`status\`: number
 - \`contentType\`: string (mime-type)
 - \`body\`: JSON value or string (depending on content type)
2. Do not include prose, commentary, explanations, or markdown.
3. The response must always be a successful HTTP response (2xx only).

Content negotiation:
1. Inspect the \`Accept\` header to determine the response format.

2. Default behavior (critical):
 - If the \`Accept\` header resembles a typical browser request (e.g. includes multiple types like \`text/html\`, \`application/xhtml+xml\`, \`application/xml\`, \`image/*\`, \`*/*\`), treat it as NO explicit preference.
 - In these cases, ALWAYS return \`application/json\`.
 - If \`*/*\` is present, treat it as no preference and return JSON.

3. Explicit format selection:
 - Only return a non-JSON format (e.g. \`text/html\`) if:
 - The \`Accept\` header specifies a single clear mime type, OR
 - One mime type has a strictly higher q-value than all others and is not a wildcard.

4. Ambiguous or browser-style headers:
 - If multiple types are listed without a clear single winner (even if ordered), IGNORE ordering and return JSON.

5. If the requested type is unsupported or unclear, default to \`application/json\`.

6. For non-JSON responses (only when explicitly required), return a realistic representation (e.g. full HTML document as a string).

7. Always set the \`Content-Type\` header accordingly.

Response behavior:
1. Follow standard REST conventions:
 - \`POST\` creates a resource and returns the created entity.
 - \`GET /collection\` returns an array.
 - \`GET /collection/:id\` returns a single entity.
 - \`PATCH\` partially updates fields and returns the updated entity.
 - \`PUT\` replaces the entity and returns the replaced entity.
 - \`DELETE\` returns \`204\` with \`body: null\` or a confirmation object.
2. Support nested resources such as \`/users/:id/comments/:commentId\`.
3. IDs must be unique and realistic.
4. Timestamps must be realistic ISO-8601 strings.
5. Prefer realistic defaults when information is missing.

Conflict resolution:
1. Always return a successful response (2xx). Never return 4xx or 5xx.
2. If format expectations conflict, prioritize explicit \`Accept\` rules, otherwise default to JSON.

Data modeling rules:
1. Use the provided schema and endpoint hints whenever relevant.
2. Preserve field names and types exactly as defined.
3. Populate optional fields only when realistic.
4. Keep generated values internally consistent.
5. IDs should be unique numbers (random).
6. Output VALID JSON ONLY. Do not add ellipsis or other non valid output.

ADDITIONAL CONTEXT:
{{context}}

SIMILAR EXAMPLES:
{{similar_examples_json}}

THE REQUEST:
Timestamp: {{datetime_iso}}
Method: {{method}}
Path: {{path}}
Query params: {{query_json}}
Body: {{body_json}}
Headers: {{headers_json}}`;

export function App() {
  const data = useAdminData(DEFAULT_PROMPT_TEMPLATE);
  const {
    endpoints,
    requests,
    misses,
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
    stats,
    configError,
    refresh,
    loadEndpoints,
    loadRequests,
    loadMisses,
    clearLogs,
    clearMisses,
    loadProviders,
    uploadFile,
    setAiStorePrompt,
    getAiStorePrompt,
    saveConfig,
    saveContext,
    loadConfig,
    loadContext,
    openApiDoc,
    loadOpenApiDoc,
  } = data;

  const location = useLocation();

  const [selectedMethod, setSelectedMethod] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [variantList, setVariantList] = useState<VariantMeta[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantEditor, setVariantEditor] = useState("");
  const [createMethod, setCreateMethod] = useState("GET");
  const [createPath, setCreatePath] = useState("");
  const [createVariantId, setCreateVariantId] = useState("default_manual");
  const [createStatus, setCreateStatus] = useState(200);
  const [createBody, setCreateBody] = useState('{\n  "ok": true\n}');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const editorSplit = 40;
  const [endpointSearch, setEndpointSearch] = useState("");
  const [selectedEndpointKeys, setSelectedEndpointKeys] = useState<Record<string, boolean>>({});
  const [liveConnected, setLiveConnected] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    resolve?: (v: boolean) => void;
  }>({ open: false, message: "" });

  const filteredEndpoints = useMemo(() => {
    const q = endpointSearch.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((ep) => `${ep.method} ${ep.path}`.toLowerCase().includes(q));
  }, [endpoints, endpointSearch]);

  const allFilteredSelected =
    filteredEndpoints.length > 0 &&
    filteredEndpoints.every((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]);

  const variantError = useMemo(() => {
    if (!selectedVariantId) return "";
    if (!variantEditor.trim()) return "Variant body is empty";
    try {
      JSON.parse(variantEditor);
      return "";
    } catch (e: any) {
      return `Invalid JSON: ${e.message}`;
    }
  }, [variantEditor, selectedVariantId]);

  useEffect(() => {
    const path = location.pathname;
    if (path === "/") {
      refresh();
      return;
    }
    if (path === "/endpoints") {
      loadEndpoints();
      return;
    }
    if (path === "/variants") {
      loadEndpoints();
      if (selectedMethod && selectedPath) {
        loadVariants(selectedMethod, selectedPath);
      }
      return;
    }
    if (path === "/logs") {
      Promise.all([loadRequests(), loadMisses()]);
      return;
    }
    if (path === "/openapi") {
      loadOpenApiDoc();
      return;
    }
    if (path === "/settings") {
      Promise.all([loadConfig(), loadProviders(), loadContext()]);
    }
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    const es = new EventSource("/-/api/events");

    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);
    es.addEventListener("ready", () => setLiveConnected(true));

    if (path === "/logs") {
      const refreshLogs = () => {
        loadRequests();
        loadMisses();
      };
      es.addEventListener("request", refreshLogs);
      es.addEventListener("miss", refreshLogs);
      es.addEventListener("requests-cleared", refreshLogs);
      es.addEventListener("misses-cleared", refreshLogs);
    }

    if (path === "/endpoints" || path === "/variants") {
      const refreshEndpoints = () => {
        loadEndpoints();
        if (path === "/variants" && selectedMethod && selectedPath) {
          loadVariants(selectedMethod, selectedPath);
        }
      };
      es.addEventListener("endpoints-updated", refreshEndpoints);
      es.addEventListener("variants-updated", refreshEndpoints);
    }

    if (path === "/openapi") {
      const refreshOpenApi = () => loadOpenApiDoc();
      es.addEventListener("openapi-updated", refreshOpenApi);
    }

    return () => {
      es.close();
      setLiveConnected(false);
    };
  }, [location.pathname, selectedMethod, selectedPath]);

  function confirmAction(message: string, title?: string, confirmLabel?: string): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmState({ open: true, title, message, confirmLabel, resolve });
    });
  }

  async function clearEndpoint(method: string, path: string) {
    const ok = await confirmAction(`Clear endpoint ${method} ${path}? This removes all its variants.`, "Delete endpoint", "Delete");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/-/api/endpoint?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("clear failed");
      if (selectedMethod === method && selectedPath === path) {
        setSelectedMethod("");
        setSelectedPath("");
        setVariantList([]);
        setSelectedVariantId("");
        setVariantEditor("");
      }
      await refresh();
      showToast("Endpoint cleared");
    } catch {
      showToast("Failed to clear endpoint");
    } finally {
      setBusy(false);
    }
  }

  function toggleEndpointSelection(method: string, path: string, checked: boolean) {
    const key = `${method} ${path}`;
    setSelectedEndpointKeys((prev) => ({ ...prev, [key]: checked }));
  }

  function setAllFilteredSelection(checked: boolean) {
    setSelectedEndpointKeys((prev) => {
      const next = { ...prev };
      for (const ep of filteredEndpoints) next[`${ep.method} ${ep.path}`] = checked;
      return next;
    });
  }

  async function clearSelectedEndpoints() {
    const selected = filteredEndpoints.filter((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]);
    if (selected.length === 0) return showToast("No endpoints selected");
    const ok = await confirmAction(`Delete ${selected.length} selected endpoint(s) and all their variants?`, "Delete selected endpoints", "Delete");
    if (!ok) return;
    setBusy(true);
    try {
      for (const ep of selected) {
        const res = await fetch(`/-/api/endpoint?method=${encodeURIComponent(ep.method)}&path=${encodeURIComponent(ep.path)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
      }
      setSelectedMethod("");
      setSelectedPath("");
      setVariantList([]);
      setSelectedVariantId("");
      setVariantEditor("");
      setSelectedEndpointKeys({});
      await refresh();
      showToast("Selected endpoints deleted");
    } catch {
      showToast("Failed to delete selected endpoints");
    } finally {
      setBusy(false);
    }
  }

  async function loadVariants(method: string, path: string) {
    setSelectedMethod(method);
    setSelectedPath(path);
    const data = await (await fetch(`/-/api/variants?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}`)).json();
    const variants = data.variants ?? [];
    setVariantList(variants);

    if (variants.length === 1) {
      const onlyId = variants[0].id;
      setSelectedVariantId(onlyId);
      const one = await (await fetch(`/-/api/variant?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}&id=${encodeURIComponent(onlyId)}`)).json();
      setVariantEditor(JSON.stringify(one.mock, null, 2));
    } else {
      setSelectedVariantId("");
      setVariantEditor("");
    }
  }

  async function selectVariant(id: string) {
    setSelectedVariantId(id);
    const data = await (await fetch(`/-/api/variant?method=${encodeURIComponent(selectedMethod)}&path=${encodeURIComponent(selectedPath)}&id=${encodeURIComponent(id)}`)).json();
    setVariantEditor(JSON.stringify(data.mock, null, 2));
  }

  async function deleteVariant(id: string) {
    if (!selectedMethod || !selectedPath) return;
    if (variantList.length <= 1) return showToast("Cannot delete the last variant. Delete the endpoint instead.");
    const ok = await confirmAction(`Delete variant ${id} for ${selectedMethod} ${selectedPath}?`, "Delete variant", "Delete");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/-/api/variant?method=${encodeURIComponent(selectedMethod)}&path=${encodeURIComponent(selectedPath)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "delete failed");
      }
      if (selectedVariantId === id) {
        setSelectedVariantId("");
        setVariantEditor("");
      }
      await loadEndpoints();
      await loadVariants(selectedMethod, selectedPath);
      showToast("Variant deleted");
    } catch (e: any) {
      showToast(e?.message || "Failed to delete variant");
    } finally {
      setBusy(false);
    }
  }

  async function saveVariant() {
    setBusy(true);
    try {
      const mock = JSON.parse(variantEditor);
      await fetch("/-/api/variant", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: selectedMethod, path: selectedPath, id: selectedVariantId, mock }),
      });
      await loadVariants(selectedMethod, selectedPath);
      await loadEndpoints();
      showToast("Variant saved");
    } catch {
      showToast("Variant save failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearLogsWithConfirm() {
    const ok = await confirmAction("Clear all request logs?", "Clear request logs", "Clear");
    if (!ok) return;
    await clearLogs();
  }

  async function clearMissesWithConfirm() {
    const ok = await confirmAction("Clear all misses?", "Clear misses", "Clear");
    if (!ok) return;
    await clearMisses();
  }

  async function createVariant() {
    setBusy(true);
    try {
      const body = JSON.parse(createBody);
      const method = createMethod.toUpperCase();
      const path = createPath.startsWith("/") ? createPath : `/${createPath}`;
      const id = createVariantId.trim() || "default_manual";
      const mock = {
        requestSignature: { method, path, queryHash: "manual", bodyHash: "manual" },
        requestSnapshot: { query: {}, body: {} },
        response: { status: Number(createStatus) || 200, headers: { "content-type": "application/json" }, body },
        meta: { source: "manual", createdAt: new Date().toISOString(), notes: "created-from-admin-ui" },
      };
      const res = await fetch("/-/api/variant", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, path, id, mock }),
      });
      if (!res.ok) throw new Error("create failed");
      await loadEndpoints();
      await loadVariants(method, path);
      setSelectedVariantId(id);
      showToast("Endpoint/variant created");
    } catch {
      showToast("Create failed (check JSON/path)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand-400" />
            <div>
              <h1 className="text-sm sm:text-base font-semibold tracking-tight">Mock BFF Admin</h1>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <span className={`inline-block h-2 w-2 rounded-full ${liveConnected ? "bg-emerald-400" : "bg-rose-400"}`} />
                {liveConnected ? "Live connected" : "Live disconnected"}
              </div>
            </div>
          </div>
          <button className="lg:hidden rounded-lg border border-zinc-700 p-2" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <nav className="hidden lg:flex items-center gap-2">
            <Tab to="/" label="Dashboard" icon={<Gauge className="h-4 w-4" />} />
            <Tab to="/endpoints" label="Endpoints" icon={<ListTree className="h-4 w-4" />} />
            <Tab to="/variants" label="Variants" icon={<RouteIcon className="h-4 w-4" />} />
            <Tab to="/logs" label="Logs" icon={<Logs className="h-4 w-4" />} />
            <Tab to="/openapi" label="OpenAPI" icon={<FileJson className="h-4 w-4" />} />
            <Tab to="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} />
          </nav>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/60" onClick={() => setMobileMenuOpen(false)}>
          <aside className="absolute right-0 top-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 p-4 pt-20" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-sm font-semibold">Navigation</div>
            <div className="flex flex-col gap-2">
              <Tab to="/" label="Dashboard" icon={<Gauge className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
              <Tab to="/endpoints" label="Endpoints" icon={<ListTree className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
              <Tab to="/variants" label="Variants" icon={<RouteIcon className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
              <Tab to="/logs" label="Logs" icon={<Logs className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
              <Tab to="/openapi" label="OpenAPI" icon={<FileJson className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
              <Tab to="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl p-6 lg:p-8 space-y-6">
        <Routes>
          <Route path="/" element={<DashboardPage stats={stats} refresh={refresh} setHash={(h) => (window.location.hash = h)} busy={busy} harFile={harFile} setHarFile={setHarFile} openApiFile={openApiFile} setOpenApiFile={setOpenApiFile} uploadFile={uploadFile} />} />
          <Route path="/endpoints" element={<EndpointsPage filteredEndpoints={filteredEndpoints} endpointSearch={endpointSearch} setEndpointSearch={setEndpointSearch} allFilteredSelected={allFilteredSelected} setAllFilteredSelection={setAllFilteredSelection} selectedEndpointKeys={selectedEndpointKeys} toggleEndpointSelection={toggleEndpointSelection} clearEndpoint={clearEndpoint} clearSelectedEndpoints={clearSelectedEndpoints} busy={busy} />} />
          <Route
            path="/variants"
            element={
              <VariantsPage
                busy={busy}
                createMethod={createMethod}
                setCreateMethod={setCreateMethod}
                createPath={createPath}
                setCreatePath={setCreatePath}
                createVariantId={createVariantId}
                setCreateVariantId={setCreateVariantId}
                createStatus={createStatus}
                setCreateStatus={setCreateStatus}
                createBody={createBody}
                setCreateBody={setCreateBody}
                createVariant={createVariant}
                filteredEndpoints={filteredEndpoints}
                endpointSearch={endpointSearch}
                setEndpointSearch={setEndpointSearch}
                allFilteredSelected={allFilteredSelected}
                setAllFilteredSelection={setAllFilteredSelection}
                selectedEndpointKeys={selectedEndpointKeys}
                toggleEndpointSelection={toggleEndpointSelection}
                selectedMethod={selectedMethod}
                selectedPath={selectedPath}
                loadVariants={loadVariants}
                clearSelectedEndpoints={clearSelectedEndpoints}
                clearEndpoint={clearEndpoint}
                editorSplit={editorSplit}
                variantList={variantList}
                selectedVariantId={selectedVariantId}
                selectVariant={selectVariant}
                deleteVariant={deleteVariant}
                variantEditor={variantEditor}
                setVariantEditor={setVariantEditor}
                saveVariant={saveVariant}
                variantError={variantError}
              />
            }
          />
          <Route path="/logs" element={<LogsPage requests={requests} misses={misses} loadRequests={loadRequests} clearLogs={clearLogsWithConfirm} loadMisses={loadMisses} clearMisses={clearMissesWithConfirm} setPromptDialog={setPromptDialog} />} />
          <Route path="/openapi" element={<OpenApiPage busy={busy} openApiFile={openApiFile} setOpenApiFile={setOpenApiFile} uploadFile={uploadFile} openApiDoc={openApiDoc} loadOpenApiDoc={loadOpenApiDoc} />} />
          <Route path="/settings" element={<SettingsPage busy={busy} configError={configError} saveConfig={saveConfig} getAiStorePrompt={getAiStorePrompt} setAiStorePrompt={setAiStorePrompt} providerInfo={providerInfo} providerName={providerName} setProviderName={setProviderName} providerModel={providerModel} setProviderModel={setProviderModel} openaiBaseUrl={openaiBaseUrl} setOpenaiBaseUrl={setOpenaiBaseUrl} anthropicBaseUrl={anthropicBaseUrl} setAnthropicBaseUrl={setAnthropicBaseUrl} ollamaBaseUrl={ollamaBaseUrl} setOllamaBaseUrl={setOllamaBaseUrl} loadProviders={loadProviders} showPromptHints={showPromptHints} setShowPromptHints={setShowPromptHints} promptTemplate={promptTemplate} setPromptTemplate={setPromptTemplate} configText={configText} setConfigText={setConfigText} context={context} setContext={setContext} saveContext={saveContext} />} />
        </Routes>

        {promptDialog ? <PromptDialog prompt={promptDialog} onClose={() => setPromptDialog(null)} showToast={showToast} /> : null}
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => {
            confirmState.resolve?.(false);
            setConfirmState({ open: false, message: "" });
          }}
          onConfirm={() => {
            confirmState.resolve?.(true);
            setConfirmState({ open: false, message: "" });
          }}
        />
        {toast ? <div className="fixed bottom-6 right-6 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm shadow-lg">{toast}</div> : null}
      </div>
    </main>
  );
}
