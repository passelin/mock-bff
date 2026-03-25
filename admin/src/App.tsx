import { useEffect, useMemo, useState } from "react";
import {
  Gauge,
  ListTree,
  Logs,
  Menu,
  RefreshCcw,
  Route as RouteIcon,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Card } from "./components/Card";
import { Tab } from "./components/Tab";
import { PromptDialog } from "./components/PromptDialog";
import { EndpointsPage } from "./pages/EndpointsPage";
import { LogsPage } from "./pages/LogsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
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
  const [editorSplit, setEditorSplit] = useState(40);
  const [endpointSearch, setEndpointSearch] = useState("");
  const [selectedEndpointKeys, setSelectedEndpointKeys] = useState<Record<string, boolean>>({});

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
    if (path === "/settings") {
      Promise.all([loadConfig(), loadProviders(), loadContext()]);
    }
  }, [location.pathname]);

  async function clearEndpoint(method: string, path: string) {
    const ok = window.confirm(`Clear endpoint ${method} ${path}? This removes all its variants.`);
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
    const ok = window.confirm(`Delete ${selected.length} selected endpoint(s) and all their variants?`);
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
    const ok = window.confirm(`Delete variant ${id} for ${selectedMethod} ${selectedPath}?`);
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
              <Tab to="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} onClick={() => setMobileMenuOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl p-6 lg:p-8 space-y-6">
        <Routes>
          <Route path="/" element={<DashboardPage stats={stats} refresh={refresh} setHash={(h) => (window.location.hash = h)} busy={busy} harFile={harFile} setHarFile={setHarFile} openApiFile={openApiFile} setOpenApiFile={setOpenApiFile} uploadFile={uploadFile} />} />
          <Route path="/endpoints" element={<EndpointsPage filteredEndpoints={filteredEndpoints} endpointSearch={endpointSearch} setEndpointSearch={setEndpointSearch} allFilteredSelected={allFilteredSelected} setAllFilteredSelection={setAllFilteredSelection} selectedEndpointKeys={selectedEndpointKeys} toggleEndpointSelection={toggleEndpointSelection} clearEndpoint={clearEndpoint} loadEndpoints={loadEndpoints} clearSelectedEndpoints={clearSelectedEndpoints} busy={busy} />} />
          <Route
            path="/variants"
            element={
              <>
                <Card title="Create endpoint / variant" subtitle="Manually add new endpoints and variants directly from the UI." actions={<button onClick={createVariant} disabled={busy || !createPath.trim()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Create</button>}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <select value={createMethod} onChange={(e) => setCreateMethod(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select>
                    <input value={createPath} onChange={(e) => setCreatePath(e.target.value)} placeholder="/api/new-endpoint" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    <input value={createVariantId} onChange={(e) => setCreateVariantId(e.target.value)} placeholder="variant id" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    <input type="number" value={createStatus} onChange={(e) => setCreateStatus(Number(e.target.value))} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                  </div>
                  <textarea value={createBody} onChange={(e) => setCreateBody(e.target.value)} className="h-40 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
                </Card>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-4 space-y-3">
                    <Card title="Endpoints" subtitle="Pick endpoint to load variants." actions={<div className="flex items-center gap-2"><button onClick={loadEndpoints} className="rounded-xl border border-zinc-700 p-2 text-xs inline-flex items-center"><RefreshCcw className="h-3.5 w-3.5" /></button><button onClick={clearSelectedEndpoints} disabled={busy || filteredEndpoints.filter((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]).length === 0} className="rounded-xl border border-rose-700 text-rose-300 px-3 py-2 text-xs hover:bg-rose-900/30 disabled:opacity-50">Delete</button></div>}>
                      <div className="mb-3 flex items-center gap-2"><input type="checkbox" checked={allFilteredSelected} onChange={(e) => setAllFilteredSelection(e.target.checked)} /><span className="text-xs text-zinc-400">Select / deselect all shown</span></div>
                      <input value={endpointSearch} onChange={(e) => setEndpointSearch(e.target.value)} placeholder="Search endpoints..." className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                      <div className="max-h-[28rem] overflow-auto space-y-2">
                        {filteredEndpoints.map((ep, i) => (
                          <div key={ep.method + ep.path + i} className={`w-full rounded-lg border px-3 py-2 ${selectedMethod === ep.method && selectedPath === ep.path ? "border-brand-500 bg-brand-500/10" : "border-zinc-700 hover:bg-zinc-800"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <input type="checkbox" checked={Boolean(selectedEndpointKeys[`${ep.method} ${ep.path}`])} onChange={(e) => toggleEndpointSelection(ep.method, ep.path, e.target.checked)} className="shrink-0" />
                              <button onClick={() => loadVariants(ep.method, ep.path)} className="flex-1 text-left"><div className="font-mono text-xs text-brand-300">{ep.method}</div><div className="font-mono text-xs break-all mt-1">{ep.path}</div></button>
                              <button onClick={() => clearEndpoint(ep.method, ep.path)} className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30 shrink-0" aria-label="Delete endpoint"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                  <div className="xl:col-span-8 space-y-3">
                    <div className="flex items-center gap-3"><span className="text-xs text-zinc-400">Pane split</span><input type="range" min={25} max={65} value={editorSplit} onChange={(e) => setEditorSplit(Number(e.target.value))} className="w-56" /><span className="text-xs text-zinc-500">{editorSplit}% / {100 - editorSplit}%</span></div>
                    <div className="grid gap-6" style={{ gridTemplateColumns: `minmax(0, ${editorSplit}fr) minmax(0, ${100 - editorSplit}fr)` }}>
                      <Card title="Variants" subtitle={selectedMethod && selectedPath ? `Endpoint: ${selectedMethod} ${selectedPath}` : "Select an endpoint from the left list first."}>
                        <div className="space-y-2 max-h-80 overflow-auto">
                          {variantList.map((v) => (
                            <div key={v.id} className={`w-full rounded-lg border px-3 py-2 transition ${selectedVariantId === v.id ? "border-brand-500 bg-brand-500/10" : "border-zinc-700 hover:bg-zinc-800"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <button onClick={() => selectVariant(v.id)} className="flex-1 text-left"><div className="font-mono text-xs" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }} title={v.displayLabel || v.id}>{v.displayLabel || v.id}</div><div className="text-xs text-zinc-400 mt-1">{v.source} · status {v.status}</div></button>
                                <button onClick={() => deleteVariant(v.id)} disabled={variantList.length <= 1} className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30 shrink-0 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                      <Card title="Variant Editor" subtitle={selectedVariantId || "Select a variant to edit"} actions={<div className="flex gap-2"><button onClick={() => { try { setVariantEditor(JSON.stringify(JSON.parse(variantEditor), null, 2)); } catch {} }} disabled={!selectedVariantId} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs">Format</button><button onClick={saveVariant} disabled={busy || !selectedVariantId || !!variantError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save variant</button></div>}>
                        <textarea value={variantEditor} onChange={(e) => setVariantEditor(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
                        {variantError ? <p className="mt-2 text-xs text-rose-400">{variantError}</p> : selectedVariantId ? <p className="mt-2 text-xs text-emerald-400">JSON valid</p> : null}
                      </Card>
                    </div>
                  </div>
                </div>
              </>
            }
          />
          <Route path="/logs" element={<LogsPage requests={requests} misses={misses} loadRequests={loadRequests} clearLogs={clearLogs} loadMisses={loadMisses} clearMisses={clearMisses} setPromptDialog={setPromptDialog} />} />
          <Route path="/settings" element={<SettingsPage busy={busy} configError={configError} saveConfig={saveConfig} getAiStorePrompt={getAiStorePrompt} setAiStorePrompt={setAiStorePrompt} providerInfo={providerInfo} providerName={providerName} setProviderName={setProviderName} providerModel={providerModel} setProviderModel={setProviderModel} openaiBaseUrl={openaiBaseUrl} setOpenaiBaseUrl={setOpenaiBaseUrl} anthropicBaseUrl={anthropicBaseUrl} setAnthropicBaseUrl={setAnthropicBaseUrl} ollamaBaseUrl={ollamaBaseUrl} setOllamaBaseUrl={setOllamaBaseUrl} loadProviders={loadProviders} showPromptHints={showPromptHints} setShowPromptHints={setShowPromptHints} promptTemplate={promptTemplate} setPromptTemplate={setPromptTemplate} configText={configText} setConfigText={setConfigText} context={context} setContext={setContext} saveContext={saveContext} />} />
        </Routes>

        {promptDialog ? <PromptDialog prompt={promptDialog} onClose={() => setPromptDialog(null)} showToast={showToast} /> : null}
        {toast ? <div className="fixed bottom-6 right-6 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm shadow-lg">{toast}</div> : null}
      </div>
    </main>
  );
}
