import { useEffect, useMemo, useState } from 'react';
import { Eye, FileUp, Gauge, ListTree, Logs, Menu, RefreshCcw, Route as RouteIcon, Settings, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { NavLink, Route, Routes } from 'react-router-dom';

type Endpoint = { method: string; path: string; variants: number; hasDefault: boolean };
type VariantMeta = { id: string; file: string; source?: string; status?: number; createdAt?: string };
type ReqLog = { at: string; method: string; path: string; match: string; status: number };
type ProviderInfo = {
  current?: { provider?: string; model?: string };
  providers?: Record<string, { models?: string[]; baseUrl?: string | null; apiKeyPreview?: string | null; apiKeyHint?: string }>;
};

const DEFAULT_PROMPT_TEMPLATE = [
  'You generate realistic mock API response bodies.',
  'Return ONLY a valid JSON object (no markdown, no prose).',
  'Current datetime (ISO): {{datetime_iso}}',
  'Current date (YYYY-MM-DD): {{date}}',
  'Endpoint: {{method}} {{path}}',
  'Query: {{query_json}}',
  'Request body: {{body_json}}',
  'Request headers: {{headers_json}}',
  'Context (truncated): {{context}}',
  'Similar request examples (replicate structure when relevant): {{similar_examples_json}}',
].join('\n\n');

function Card(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'default' | 'highlight';
}) {
  const toneClass = props.tone === 'highlight' ? 'border-brand-500/40 bg-gradient-to-b from-zinc-900 to-zinc-950' : 'border-zinc-800 bg-zinc-900/70';
  return (
    <section className={`rounded-2xl border ${toneClass} shadow-glow p-5`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{props.title}</h2>
          {props.subtitle ? <p className="mt-1 text-sm text-zinc-400">{props.subtitle}</p> : null}
        </div>
        {props.actions}
      </div>
      {props.children}
    </section>
  );
}

function Tab({ to, label, icon, onClick }: { to: string; label: string; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition border-b-2 ${
          isActive ? 'border-brand-400 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function App() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [requests, setRequests] = useState<ReqLog[]>([]);
  const [misses, setMisses] = useState<any[]>([]);
  const [configText, setConfigText] = useState('');
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({});
  const [providerName, setProviderName] = useState('openai');
  const [providerModel, setProviderModel] = useState('gpt-5.4-mini');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState('https://api.anthropic.com');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://127.0.0.1:11434/v1');
  const [context, setContext] = useState('');

  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [variantList, setVariantList] = useState<VariantMeta[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [variantEditor, setVariantEditor] = useState('');

  const [createMethod, setCreateMethod] = useState('GET');
  const [createPath, setCreatePath] = useState('');
  const [createVariantId, setCreateVariantId] = useState('default_manual');
  const [createStatus, setCreateStatus] = useState(200);
  const [createBody, setCreateBody] = useState('{\n  "ok": true\n}');

  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [promptDialog, setPromptDialog] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [harFile, setHarFile] = useState<File | null>(null);
  const [openApiFile, setOpenApiFile] = useState<File | null>(null);
  const [editorSplit, setEditorSplit] = useState(40);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [selectedEndpointKeys, setSelectedEndpointKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    refresh();
    const id = setInterval(loadRequests, 3000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const totalVariants = endpoints.reduce((acc, e) => acc + e.variants, 0);
    return { endpoints: endpoints.length, variants: totalVariants, misses: misses.length, requests: requests.length };
  }, [endpoints, misses, requests]);

  const filteredEndpoints = useMemo(() => {
    const q = endpointSearch.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((ep) => `${ep.method} ${ep.path}`.toLowerCase().includes(q));
  }, [endpoints, endpointSearch]);

  const allFilteredSelected =
    filteredEndpoints.length > 0 && filteredEndpoints.every((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]);

  const configError = useMemo(() => {
    if (!configText.trim()) return 'Config cannot be empty';
    try {
      JSON.parse(configText);
      return '';
    } catch (e: any) {
      return `Invalid JSON: ${e.message}`;
    }
  }, [configText]);

  const variantError = useMemo(() => {
    if (!selectedVariantId) return '';
    if (!variantEditor.trim()) return 'Variant body is empty';
    try {
      JSON.parse(variantEditor);
      return '';
    } catch (e: any) {
      return `Invalid JSON: ${e.message}`;
    }
  }, [variantEditor, selectedVariantId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  async function refresh() {
    await Promise.all([loadEndpoints(), loadRequests(), loadMisses(), loadConfig(), loadProviders(), loadContext()]);
  }

  async function loadEndpoints() {
    setEndpoints(await (await fetch('/-/api/endpoints')).json());
  }
  async function loadRequests() {
    const data = await (await fetch('/-/api/requests?limit=100')).json();
    setRequests(data.rows ?? []);
  }
  async function loadMisses() {
    const data = await (await fetch('/-/api/misses')).json();
    setMisses(Array.isArray(data) ? data : []);
  }

  async function clearLogs() {
    const ok = window.confirm('Clear all request logs?');
    if (!ok) return;
    await fetch('/-/api/requests', { method: 'DELETE' });
    await loadRequests();
    showToast('Request logs cleared');
  }

  async function clearMisses() {
    const ok = window.confirm('Clear all misses?');
    if (!ok) return;
    await fetch('/-/api/misses', { method: 'DELETE' });
    await loadMisses();
    showToast('Misses cleared');
  }
  async function loadConfig() {
    const cfg = await (await fetch('/-/api/config')).json();
    setConfigText(JSON.stringify(cfg, null, 2));
    setPromptTemplate(cfg.aiPromptTemplate && String(cfg.aiPromptTemplate).trim() ? cfg.aiPromptTemplate : DEFAULT_PROMPT_TEMPLATE);
    setProviderName(cfg.aiProvider ?? 'openai');
    setProviderModel(cfg.aiModel ?? 'gpt-5.4-mini');
    setOpenaiBaseUrl(cfg.providerBaseUrls?.openai ?? 'https://api.openai.com/v1');
    setAnthropicBaseUrl(cfg.providerBaseUrls?.anthropic ?? 'https://api.anthropic.com');
    setOllamaBaseUrl(cfg.providerBaseUrls?.ollama ?? 'http://127.0.0.1:11434/v1');
  }

  async function loadProviders() {
    const data = await (await fetch('/-/api/providers')).json();
    setProviderInfo(data ?? {});
  }
  async function loadContext() {
    const d = await (await fetch('/-/api/context')).json();
    setContext(d.context || '');
  }

  function ellipsize(text: string, max = 72): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  async function uploadFile(route: string, file: File | null, successMsg: string) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(route, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      await refresh();
      showToast(successMsg);
    } catch {
      showToast('Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function clearEndpoint(method: string, path: string) {
    const ok = window.confirm(`Clear endpoint ${method} ${path}? This removes all its variants.`);
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/-/api/endpoint?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('clear failed');
      if (selectedMethod === method && selectedPath === path) {
        setSelectedMethod('');
        setSelectedPath('');
        setVariantList([]);
        setSelectedVariantId('');
        setVariantEditor('');
      }
      await refresh();
      showToast('Endpoint cleared');
    } catch {
      showToast('Failed to clear endpoint');
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
      for (const ep of filteredEndpoints) {
        next[`${ep.method} ${ep.path}`] = checked;
      }
      return next;
    });
  }

  async function clearSelectedEndpoints() {
    const selected = filteredEndpoints.filter((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]);
    if (selected.length === 0) {
      showToast('No endpoints selected');
      return;
    }

    const ok = window.confirm(`Delete ${selected.length} selected endpoint(s) and all their variants?`);
    if (!ok) return;

    setBusy(true);
    try {
      for (const ep of selected) {
        const res = await fetch(`/-/api/endpoint?method=${encodeURIComponent(ep.method)}&path=${encodeURIComponent(ep.path)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
      }

      setSelectedMethod('');
      setSelectedPath('');
      setVariantList([]);
      setSelectedVariantId('');
      setVariantEditor('');
      setSelectedEndpointKeys({});

      await refresh();
      showToast('Selected endpoints deleted');
    } catch {
      showToast('Failed to delete selected endpoints');
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
      const one = await (
        await fetch(`/-/api/variant?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}&id=${encodeURIComponent(onlyId)}`)
      ).json();
      setVariantEditor(JSON.stringify(one.mock, null, 2));
    } else {
      setSelectedVariantId('');
      setVariantEditor('');
    }
  }

  async function selectVariant(id: string) {
    setSelectedVariantId(id);
    const data = await (
      await fetch(`/-/api/variant?method=${encodeURIComponent(selectedMethod)}&path=${encodeURIComponent(selectedPath)}&id=${encodeURIComponent(id)}`)
    ).json();
    setVariantEditor(JSON.stringify(data.mock, null, 2));
  }

  async function deleteVariant(id: string) {
    if (!selectedMethod || !selectedPath) return;
    if (variantList.length <= 1) {
      showToast('Cannot delete the last variant. Delete the endpoint instead.');
      return;
    }

    const ok = window.confirm(`Delete variant ${id} for ${selectedMethod} ${selectedPath}?`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/-/api/variant?method=${encodeURIComponent(selectedMethod)}&path=${encodeURIComponent(selectedPath)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'delete failed');
      }

      if (selectedVariantId === id) {
        setSelectedVariantId('');
        setVariantEditor('');
      }
      await loadEndpoints();
      await loadVariants(selectedMethod, selectedPath);
      showToast('Variant deleted');
    } catch (e: any) {
      showToast(e?.message || 'Failed to delete variant');
    } finally {
      setBusy(false);
    }
  }

  async function saveVariant() {
    setBusy(true);
    try {
      const mock = JSON.parse(variantEditor);
      await fetch('/-/api/variant', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: selectedMethod, path: selectedPath, id: selectedVariantId, mock }),
      });
      await loadVariants(selectedMethod, selectedPath);
      await loadEndpoints();
      showToast('Variant saved');
    } catch {
      showToast('Variant save failed');
    } finally {
      setBusy(false);
    }
  }

  async function createVariant() {
    setBusy(true);
    try {
      const body = JSON.parse(createBody);
      const method = createMethod.toUpperCase();
      const path = createPath.startsWith('/') ? createPath : `/${createPath}`;
      const id = createVariantId.trim() || 'default_manual';

      const mock = {
        requestSignature: { method, path, queryHash: 'manual', bodyHash: 'manual' },
        requestSnapshot: { query: {}, body: {} },
        response: { status: Number(createStatus) || 200, headers: { 'content-type': 'application/json' }, body },
        meta: { source: 'manual', createdAt: new Date().toISOString(), notes: 'created-from-admin-ui' },
      };

      const res = await fetch('/-/api/variant', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, path, id, mock }),
      });
      if (!res.ok) throw new Error('create failed');

      await loadEndpoints();
      await loadVariants(method, path);
      setSelectedVariantId(id);
      showToast('Endpoint/variant created');
    } catch {
      showToast('Create failed (check JSON/path)');
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
      parsed.providerBaseUrls = {
        ...(parsed.providerBaseUrls ?? {}),
        openai: openaiBaseUrl,
        anthropic: anthropicBaseUrl,
        ollama: ollamaBaseUrl,
      };
      await fetch('/-/api/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      showToast('Config saved');
    } catch {
      showToast('Config invalid');
    } finally {
      setBusy(false);
    }
  }

  function setAiStorePrompt(enabled: boolean) {
    try {
      const parsed = JSON.parse(configText || '{}');
      parsed.aiStorePrompt = enabled;
      setConfigText(JSON.stringify(parsed, null, 2));
    } catch {}
  }

  function getAiStorePrompt(): boolean {
    try {
      const parsed = JSON.parse(configText || '{}');
      return Boolean(parsed.aiStorePrompt);
    } catch {
      return false;
    }
  }

  async function saveContext() {
    setBusy(true);
    try {
      await fetch('/-/api/context', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context }),
      });
      showToast('Context saved');
    } catch {
      showToast('Context save failed');
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
              <p className="hidden sm:block text-[11px] text-zinc-400">Turn HAR traffic into a clean, editable mock backend for rapid UI development.</p>
            </div>
          </div>

          <button
            className="lg:hidden rounded-lg border border-zinc-700 p-2"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
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
          <aside className="absolute right-0 top-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 p-4" onClick={(e) => e.stopPropagation()}>
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
        <Route
          path="/"
          element={
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Endpoints" value={stats.endpoints} />
                <StatCard label="Variants" value={stats.variants} />
                <StatCard label="Misses" value={stats.misses} />
                <StatCard label="Recent Req Logs" value={stats.requests} />
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-wrap gap-2 items-center">
                <span className="text-xs text-zinc-400 mr-2">Quick actions</span>
                <button onClick={refresh} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Refresh data</button>
                <button onClick={() => (window.location.hash = '#/endpoints')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Manage endpoints</button>
                <button onClick={() => (window.location.hash = '#/variants')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Edit variants</button>
                <button onClick={() => (window.location.hash = '#/logs')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">View logs</button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title="Import HAR" subtitle="Upload real traffic captures to generate endpoint variants." tone="highlight" actions={<button disabled={busy || !harFile} onClick={() => uploadFile('/-/api/har', harFile, 'HAR imported')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><Upload className="h-4 w-4" />Upload HAR</button>}>
                  <input type="file" accept=".har,.json" onChange={(e) => setHarFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-500" />
                </Card>

                <Card title="Import OpenAPI" subtitle="Upload JSON/YAML contract for validation and guidance." tone="highlight" actions={<button disabled={busy || !openApiFile} onClick={() => uploadFile('/-/api/openapi', openApiFile, 'OpenAPI imported')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><FileUp className="h-4 w-4" />Upload OpenAPI</button>}>
                  <input type="file" accept=".json,.yaml,.yml" onChange={(e) => setOpenApiFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500" />
                </Card>
              </div>
            </>
          }
        />

        <Route
          path="/endpoints"
          element={
            <Card
              title="Endpoint Management"
              subtitle="Search, review and clear endpoint groups."
              actions={<div className="flex items-center gap-2"><button onClick={loadEndpoints} className="rounded-xl border border-zinc-700 p-2 text-xs inline-flex items-center" aria-label="Refresh endpoints" title="Refresh endpoints"><RefreshCcw className="h-3.5 w-3.5" /></button><button onClick={clearSelectedEndpoints} disabled={busy || filteredEndpoints.filter((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]).length === 0} className="rounded-xl border border-rose-700 text-rose-300 px-3 py-2 text-xs hover:bg-rose-900/30 disabled:opacity-50">Delete selected</button></div>}
            >
              <div className="mb-3">
                <input value={endpointSearch} onChange={(e) => setEndpointSearch(e.target.value)} placeholder="Search endpoints (method or path)…" className="w-full md:w-96 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500" />
              </div>
              <div className="overflow-y-auto overflow-x-hidden max-h-[32rem] rounded-xl border border-zinc-800">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-zinc-800/60 text-zinc-300">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input type="checkbox" checked={allFilteredSelected} onChange={(e) => setAllFilteredSelection(e.target.checked)} />
                      </th>
                      <th className="w-24 px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Path</th>
                      <th className="w-20 px-3 py-2 text-left">Variants</th>
                      <th className="w-20 px-3 py-2 text-left">Default</th>
                      <th className="w-24 px-3 py-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEndpoints.map((ep, i) => (
                      <tr key={ep.method + ep.path + i} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                        <td className="px-3 py-2"><input type="checkbox" checked={Boolean(selectedEndpointKeys[`${ep.method} ${ep.path}`])} onChange={(e) => toggleEndpointSelection(ep.method, ep.path, e.target.checked)} /></td>
                        <td className="px-3 py-2 font-mono text-brand-300 whitespace-nowrap">{ep.method}</td>
                        <td className="px-3 py-2 font-mono break-all">{ep.path}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{ep.variants}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{ep.hasDefault ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2"><button onClick={() => clearEndpoint(ep.method, ep.path)} className="rounded-lg border border-rose-700 text-rose-300 px-2 py-1 text-xs hover:bg-rose-900/30 whitespace-nowrap">Clear</button></td>
                      </tr>
                    ))}
                    {filteredEndpoints.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-sm text-zinc-400">No matching endpoints.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          }
        />

        <Route
          path="/variants"
          element={
            <>
              <Card title="Create endpoint / variant" subtitle="Manually add new endpoints and variants directly from the UI." actions={<button onClick={createVariant} disabled={busy || !createPath.trim()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Create</button>}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <select value={createMethod} onChange={(e) => setCreateMethod(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
                  </select>
                  <input value={createPath} onChange={(e) => setCreatePath(e.target.value)} placeholder="/api/new-endpoint" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                  <input value={createVariantId} onChange={(e) => setCreateVariantId(e.target.value)} placeholder="variant id" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                  <input type="number" value={createStatus} onChange={(e) => setCreateStatus(Number(e.target.value))} placeholder="status" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                </div>
                <textarea value={createBody} onChange={(e) => setCreateBody(e.target.value)} className="h-40 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-4 space-y-3">
                  <Card
                    title="Endpoints"
                    subtitle="Pick endpoint to load variants."
                    actions={<div className="flex items-center gap-2"><button onClick={loadEndpoints} className="rounded-xl border border-zinc-700 p-2 text-xs inline-flex items-center" aria-label="Refresh endpoints" title="Refresh endpoints"><RefreshCcw className="h-3.5 w-3.5" /></button><button onClick={clearSelectedEndpoints} disabled={busy || filteredEndpoints.filter((ep) => selectedEndpointKeys[`${ep.method} ${ep.path}`]).length === 0} className="rounded-xl border border-rose-700 text-rose-300 px-3 py-2 text-xs hover:bg-rose-900/30 disabled:opacity-50">Delete selected</button></div>}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <input type="checkbox" checked={allFilteredSelected} onChange={(e) => setAllFilteredSelection(e.target.checked)} />
                      <span className="text-xs text-zinc-400">Select / deselect all shown</span>
                    </div>
                    <input value={endpointSearch} onChange={(e) => setEndpointSearch(e.target.value)} placeholder="Search endpoints..." className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                    <div className="max-h-[28rem] overflow-auto space-y-2">
                      {filteredEndpoints.map((ep, i) => (
                        <div key={ep.method + ep.path + i} className={`w-full rounded-lg border px-3 py-2 ${selectedMethod===ep.method && selectedPath===ep.path ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <input type="checkbox" checked={Boolean(selectedEndpointKeys[`${ep.method} ${ep.path}`])} onChange={(e) => toggleEndpointSelection(ep.method, ep.path, e.target.checked)} className="shrink-0" />
                            <button onClick={() => loadVariants(ep.method, ep.path)} className="flex-1 text-left">
                              <div className="font-mono text-xs text-brand-300">{ep.method}</div>
                              <div className="font-mono text-xs break-all mt-1">{ep.path}</div>
                            </button>
                            <button onClick={() => clearEndpoint(ep.method, ep.path)} className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30 shrink-0" aria-label="Delete endpoint" title="Delete endpoint">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="xl:col-span-8 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">Pane split</span>
                    <input type="range" min={25} max={65} value={editorSplit} onChange={(e) => setEditorSplit(Number(e.target.value))} className="w-56" />
                    <span className="text-xs text-zinc-500">{editorSplit}% / {100 - editorSplit}%</span>
                  </div>
                  <div className="grid gap-6" style={{ gridTemplateColumns: `minmax(0, ${editorSplit}fr) minmax(0, ${100 - editorSplit}fr)` }}>
                    <Card
                      title="Variants"
                      subtitle={
                        selectedMethod && selectedPath
                          ? `Endpoint: ${ellipsize(`${selectedMethod} ${selectedPath}`, 80)}`
                          : 'Select an endpoint from the left list first.'
                      }
                    >
                      <div className="space-y-2 max-h-80 overflow-auto">
                        {!selectedMethod || !selectedPath ? <p className="text-sm text-zinc-400">Select an endpoint from the left list first.</p> : null}
                        {variantList.map((v) => (
                          <div key={v.id} className={`w-full rounded-lg border px-3 py-2 transition ${selectedVariantId === v.id ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <button onClick={() => selectVariant(v.id)} className="flex-1 text-left">
                                <div className="font-mono text-xs">{v.id}</div>
                                <div className="text-xs text-zinc-400 mt-1">{v.source} · status {v.status}</div>
                              </button>
                              <button
                                onClick={() => deleteVariant(v.id)}
                                disabled={variantList.length <= 1}
                                className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Delete variant"
                                title={variantList.length <= 1 ? 'Delete endpoint to remove the last variant' : 'Delete variant'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {selectedMethod && selectedPath && variantList.length === 0 ? <p className="text-sm text-zinc-400">No variants loaded.</p> : null}
                      </div>
                    </Card>

                    <Card title="Variant Editor" subtitle={selectedVariantId || 'Select a variant to edit'} actions={<div className="flex gap-2"><button onClick={() => { try { setVariantEditor(JSON.stringify(JSON.parse(variantEditor), null, 2)); } catch {} }} disabled={!selectedVariantId} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs">Format</button><button onClick={saveVariant} disabled={busy || !selectedVariantId || !!variantError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save variant</button></div>}>
                      <textarea value={variantEditor} onChange={(e) => setVariantEditor(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
                      {variantError ? <p className="mt-2 text-xs text-rose-400">{variantError}</p> : selectedVariantId ? <p className="mt-2 text-xs text-emerald-400">JSON valid</p> : null}
                    </Card>
                  </div>
                </div>
              </div>
            </>
          }
        />

        <Route
          path="/logs"
          element={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card
                title="Recent Requests"
                subtitle="In-memory rolling logs (newest first)."
                actions={<div className="flex gap-2"><button onClick={loadRequests} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">Refresh</button><button onClick={clearLogs} className="rounded-lg border border-rose-700 text-rose-300 px-3 py-2 text-xs">Clear</button></div>}
              >
                {requests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No requests yet. Hit your endpoints to populate this feed.</div>
                ) : (
                  <div className="max-h-[34rem] overflow-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-900 text-zinc-300 border-b border-zinc-800">
                        <tr>
                          <th className="px-3 py-2 text-left">Time</th>
                          <th className="px-3 py-2 text-left">Method</th>
                          <th className="px-3 py-2 text-left">Path</th>
                          <th className="px-3 py-2 text-left">Match</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Prompt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((r: any, i: number) => (
                          <tr key={`${r.at}-${i}`} className="border-b border-zinc-800/70 hover:bg-zinc-800/20">
                            <td className="px-3 py-2 whitespace-nowrap text-zinc-400">{new Date(r.at).toLocaleTimeString()}</td>
                            <td className="px-3 py-2 font-mono text-brand-300">{r.method}</td>
                            <td className="px-3 py-2 font-mono break-all">{r.path}</td>
                            <td className="px-3 py-2">{r.match}</td>
                            <td className="px-3 py-2">{r.status}</td>
                            <td className="px-3 py-2">
                              {r.prompt ? (
                                <button onClick={() => setPromptDialog(r.prompt)} className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800 inline-flex items-center gap-1">
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </button>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              <Card
                title="Misses"
                subtitle="Unmatched requests captured during runtime."
                actions={<div className="flex gap-2"><button onClick={loadMisses} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">Refresh</button><button onClick={clearMisses} className="rounded-lg border border-rose-700 text-rose-300 px-3 py-2 text-xs">Clear</button></div>}
              >
                {misses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No misses recorded. Nice coverage so far.</div>
                ) : (
                  <div className="max-h-[34rem] overflow-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-900 text-zinc-300 border-b border-zinc-800">
                        <tr>
                          <th className="px-3 py-2 text-left">Time</th>
                          <th className="px-3 py-2 text-left">Method</th>
                          <th className="px-3 py-2 text-left">Path</th>
                          <th className="px-3 py-2 text-left">Resolved By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {misses.map((m: any, i: number) => (
                          <tr key={`${m.at}-${i}`} className="border-b border-zinc-800/70 hover:bg-zinc-800/20">
                            <td className="px-3 py-2 whitespace-nowrap text-zinc-400">{m.at ? new Date(m.at).toLocaleTimeString() : '—'}</td>
                            <td className="px-3 py-2 font-mono text-brand-300">{m.method ?? '—'}</td>
                            <td className="px-3 py-2 font-mono break-all">{m.path ?? '—'}</td>
                            <td className="px-3 py-2">{m.resolvedBy ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          }
        />

        <Route
          path="/settings"
          element={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Runtime Config" subtitle="Live config editor (AI mode, seeds, redaction, openapi mode)." actions={<button onClick={saveConfig} disabled={busy || !!configError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save config</button>}>
                <label className="mb-3 inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={getAiStorePrompt()} onChange={(e) => setAiStorePrompt(e.target.checked)} />
                  Store AI generation prompt with saved generated variants (off by default)
                </label>

                <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs text-zinc-400">AI Provider</p>
                    <select value={providerName} onChange={(e) => setProviderName(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
                      {Object.keys(providerInfo.providers ?? { openai: {}, anthropic: {}, ollama: {}, none: {} }).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-400">Model</p>
                    <select
                      value={(providerInfo.providers?.[providerName]?.models ?? []).includes(providerModel) ? providerModel : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') setProviderModel(e.target.value);
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs"
                    >
                      {(providerInfo.providers?.[providerName]?.models ?? []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="__custom__">Custom model…</option>
                    </select>
                    {((providerInfo.providers?.[providerName]?.models ?? []).length === 0 || !(providerInfo.providers?.[providerName]?.models ?? []).includes(providerModel)) ? (
                      <input
                        value={providerModel}
                        onChange={(e) => setProviderModel(e.target.value)}
                        placeholder="Enter model id"
                        className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2">
                  <label className="text-xs text-zinc-400">OpenAI Base URL
                    <input value={openaiBaseUrl} onChange={(e) => setOpenaiBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-zinc-400">Anthropic Base URL
                    <input value={anthropicBaseUrl} onChange={(e) => setAnthropicBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-zinc-400">Ollama Base URL
                    <input value={ollamaBaseUrl} onChange={(e) => setOllamaBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                  </label>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-400 space-y-1">
                    <div>OpenAI key: <span className="text-zinc-200">{providerInfo.providers?.openai?.apiKeyPreview ?? 'not set'}</span></div>
                    <div>{providerInfo.providers?.openai?.apiKeyHint ?? 'Set OPENAI_API_KEY in your shell before starting dev.'}</div>
                    <div className="pt-1">Anthropic key: <span className="text-zinc-200">{providerInfo.providers?.anthropic?.apiKeyPreview ?? 'not set'}</span></div>
                    <div>{providerInfo.providers?.anthropic?.apiKeyHint ?? 'Set ANTHROPIC_API_KEY in your shell before starting dev.'}</div>
                  </div>
                  <div>
                    <button onClick={loadProviders} type="button" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">Refresh provider/model list</button>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="mb-1 text-xs text-zinc-400">AI Prompt Template (optional)</p>
                  <textarea
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    placeholder={"Use placeholders like {{method}}, {{path}}, {{query_json}}, {{body_json}}, {{headers_json}}, {{context}}, {{similar_examples_json}}, {{datetime_iso}}, {{date}}"}
                    className="h-36 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs"
                  />
                </div>

                <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
                {configError ? <p className="mt-2 text-xs text-rose-400">{configError}</p> : <p className="mt-2 text-xs text-emerald-400">JSON valid</p>}
              </Card>
              <Card title="Context" subtitle="Continuously updated generation context." actions={<button onClick={saveContext} disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save context</button>}>
                <textarea value={context} onChange={(e) => setContext(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
              </Card>
            </div>
          }
        />
      </Routes>

      {promptDialog ? (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Stored AI Prompt</h3>
              <button onClick={() => setPromptDialog(null)} className="rounded border border-zinc-700 px-2 py-1 text-xs">Close</button>
            </div>
            <pre className="max-h-[70vh] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs whitespace-pre-wrap">{promptDialog}</pre>
          </div>
        </div>
      ) : null}

      {toast ? <div className="fixed bottom-6 right-6 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm shadow-lg">{toast}</div> : null}
      </div>
    </main>
  );
}
