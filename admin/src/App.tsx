import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, ClipboardCheck, FileUp, Gauge, Route as RouteIcon, Settings, Sparkles, Upload } from 'lucide-react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';

type Endpoint = { method: string; path: string; variants: number; hasDefault: boolean };
type VariantMeta = { id: string; file: string; source?: string; status?: number; createdAt?: string };
type ReqLog = { at: string; method: string; path: string; match: string; status: number };

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

function Tab({ to, label, icon }: { to: string; label: string; icon?: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 text-sm border transition ${
          isActive ? 'border-brand-500 bg-brand-500/10 text-brand-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
        }`
      }
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
    </NavLink>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">{children}</span>;
}

export function App() {
  const location = useLocation();

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [requests, setRequests] = useState<ReqLog[]>([]);
  const [misses, setMisses] = useState<any[]>([]);
  const [configText, setConfigText] = useState('');
  const [context, setContext] = useState('');

  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [variantList, setVariantList] = useState<VariantMeta[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [variantEditor, setVariantEditor] = useState('');

  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const [harFile, setHarFile] = useState<File | null>(null);
  const [openApiFile, setOpenApiFile] = useState<File | null>(null);
  const [editorSplit, setEditorSplit] = useState(40);

  useEffect(() => {
    refresh();
    const id = setInterval(loadRequests, 3000);
    return () => clearInterval(id);
  }, []);

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
    await Promise.all([loadEndpoints(), loadRequests(), loadMisses(), loadConfig(), loadContext()]);
  }

  async function loadEndpoints() {
    setEndpoints(await (await fetch('/admin/endpoints')).json());
  }

  async function loadRequests() {
    const data = await (await fetch('/admin/requests?limit=100')).json();
    setRequests(data.rows ?? []);
  }

  async function loadMisses() {
    const data = await (await fetch('/admin/misses')).json();
    setMisses(Array.isArray(data) ? data : []);
  }

  async function loadConfig() {
    setConfigText(JSON.stringify(await (await fetch('/admin/config')).json(), null, 2));
  }

  async function loadContext() {
    const d = await (await fetch('/admin/context')).json();
    setContext(d.context || '');
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
      const res = await fetch(`/admin/endpoint?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}`, { method: 'DELETE' });
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

  async function clearAllEndpoints() {
    const ok = window.confirm('Clear ALL endpoints and variants? This cannot be undone.');
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/admin/endpoints', { method: 'DELETE' });
      if (!res.ok) throw new Error('clear all failed');
      setSelectedMethod('');
      setSelectedPath('');
      setVariantList([]);
      setSelectedVariantId('');
      setVariantEditor('');
      await refresh();
      showToast('All endpoints cleared');
    } catch {
      showToast('Failed to clear all endpoints');
    } finally {
      setBusy(false);
    }
  }

  async function loadVariants(method: string, path: string) {
    setSelectedMethod(method);
    setSelectedPath(path);
    const data = await (await fetch(`/admin/variants?method=${encodeURIComponent(method)}&path=${encodeURIComponent(path)}`)).json();
    setVariantList(data.variants ?? []);
    setSelectedVariantId('');
    setVariantEditor('');
  }

  async function selectVariant(id: string) {
    setSelectedVariantId(id);
    const data = await (
      await fetch(`/admin/variant?method=${encodeURIComponent(selectedMethod)}&path=${encodeURIComponent(selectedPath)}&id=${encodeURIComponent(id)}`)
    ).json();
    setVariantEditor(JSON.stringify(data.mock, null, 2));
  }

  async function saveVariant() {
    setBusy(true);
    try {
      const mock = JSON.parse(variantEditor);
      await fetch('/admin/variant', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: selectedMethod, path: selectedPath, id: selectedVariantId, mock }),
      });
      await loadVariants(selectedMethod, selectedPath);
      showToast('Variant saved');
    } catch {
      showToast('Variant save failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    try {
      const parsed = JSON.parse(configText);
      await fetch('/admin/config', {
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

  async function saveContext() {
    setBusy(true);
    try {
      await fetch('/admin/context', {
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

  function go(route: '#/' | '#/variants' | '#/settings') {
    window.location.hash = route;
  }

  async function copyLink(kind: 'current' | 'dashboard' | 'variants' | 'settings') {
    const hash = kind === 'current' ? window.location.hash || '#/' : kind === 'dashboard' ? '#/' : kind === 'variants' ? '#/variants' : '#/settings';
    const url = `${window.location.origin}/-/admin${hash}`;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    setTimeout(() => setCopied(''), 1000);
  }

  return (
    <main className="mx-auto max-w-7xl p-6 lg:p-8 space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-3"><Sparkles className="h-7 w-7 text-brand-400" />Mock BFF Admin</h1>
            <p className="mt-2 text-sm text-zinc-400">Professional control plane for HAR ingest, variant curation, and AI-backed mocking.</p>
            <p className="mt-1 text-xs text-zinc-500">Route: {location.pathname}{location.hash || '#/'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copyLink('current')} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 inline-flex items-center gap-2">{copied === 'current' ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === 'current' ? 'Copied' : 'Copy current'}</button>
            <button onClick={() => copyLink('dashboard')} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 inline-flex items-center gap-2">{copied === 'dashboard' ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === 'dashboard' ? 'Copied' : 'Copy dashboard'}</button>
            <button onClick={() => copyLink('variants')} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 inline-flex items-center gap-2">{copied === 'variants' ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === 'variants' ? 'Copied' : 'Copy variants'}</button>
            <button onClick={() => copyLink('settings')} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 inline-flex items-center gap-2">{copied === 'settings' ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === 'settings' ? 'Copied' : 'Copy settings'}</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Tab to="/" label="Dashboard" icon={<Gauge className="h-4 w-4" />} />
          <Tab to="/variants" label="Variants" icon={<RouteIcon className="h-4 w-4" />} />
          <Tab to="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} />
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Pill>Endpoints: {stats.endpoints}</Pill>
        <Pill>Variants: {stats.variants}</Pill>
        <Pill>Misses: {stats.misses}</Pill>
        <Pill>Recent req logs: {stats.requests}</Pill>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-zinc-400 mr-2">Quick actions</span>
        <button onClick={refresh} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Refresh data</button>
        <button onClick={() => go('#/variants')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Go to variants</button>
        <button onClick={() => go('#/settings')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Go to settings</button>
      </div>

      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title="Import HAR" subtitle="Upload real traffic captures to generate endpoint variants." tone="highlight" actions={<button disabled={busy || !harFile} onClick={() => uploadFile('/admin/har', harFile, 'HAR imported')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><Upload className="h-4 w-4" />Upload HAR</button>}>
                  <input type="file" accept=".har,.json" onChange={(e) => setHarFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-500" />
                </Card>

                <Card title="Import OpenAPI" subtitle="Upload JSON/YAML contract for validation and guidance." tone="highlight" actions={<button disabled={busy || !openApiFile} onClick={() => uploadFile('/admin/openapi', openApiFile, 'OpenAPI imported')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><FileUp className="h-4 w-4" />Upload OpenAPI</button>}>
                  <input type="file" accept=".json,.yaml,.yml" onChange={(e) => setOpenApiFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500" />
                </Card>
              </div>

              <Card
                title="Endpoints"
                subtitle="Registered endpoint groups currently available for replay."
                actions={<button onClick={clearAllEndpoints} disabled={busy || endpoints.length === 0} className="rounded-xl border border-rose-700 text-rose-300 px-3 py-2 text-xs hover:bg-rose-900/30 disabled:opacity-50">Clear all</button>}
              >
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/60 text-zinc-300"><tr><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Path</th><th className="px-3 py-2 text-left">Variants</th><th className="px-3 py-2 text-left">Default</th><th className="px-3 py-2 text-left"></th></tr></thead>
                    <tbody>
                      {endpoints.map((ep, i) => (
                        <tr key={ep.method + ep.path + i} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="px-3 py-2 font-mono text-brand-300">{ep.method}</td>
                          <td className="px-3 py-2 font-mono">{ep.path}</td>
                          <td className="px-3 py-2">{ep.variants}</td>
                          <td className="px-3 py-2">{ep.hasDefault ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-2"><button onClick={() => clearEndpoint(ep.method, ep.path)} className="rounded-lg border border-rose-700 text-rose-300 px-2 py-1 text-xs hover:bg-rose-900/30">Clear</button></td>
                        </tr>
                      ))}
                      {endpoints.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-sm text-zinc-400">No endpoints yet. Upload a HAR file to get started.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title="Recent Requests" subtitle="In-memory rolling logs (newest first).">
                  {requests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No requests yet. Hit your mock endpoints to populate this feed.</div>
                  ) : (
                    <pre className="max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">{JSON.stringify(requests, null, 2)}</pre>
                  )}
                </Card>
                <Card title="Misses" subtitle="Unmatched requests captured during runtime.">
                  {misses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No misses recorded. Nice coverage so far.</div>
                  ) : (
                    <pre className="max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">{JSON.stringify(misses, null, 2)}</pre>
                  )}
                </Card>
              </div>
            </>
          }
        />

        <Route
          path="/variants"
          element={
            <>
              <Card title="Endpoint Variant Review" subtitle="Select an endpoint then inspect or edit individual variants.">
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/60 text-zinc-300"><tr><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Path</th><th className="px-3 py-2 text-left"></th><th className="px-3 py-2 text-left"></th></tr></thead>
                    <tbody>
                      {endpoints.map((ep, i) => (
                        <tr key={ep.method + ep.path + i} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="px-3 py-2 font-mono text-brand-300">{ep.method}</td>
                          <td className="px-3 py-2 font-mono">{ep.path}</td>
                          <td className="px-3 py-2"><button className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" onClick={() => loadVariants(ep.method, ep.path)}>Review variants</button></td>
                          <td className="px-3 py-2"><button onClick={() => clearEndpoint(ep.method, ep.path)} className="rounded-lg border border-rose-700 text-rose-300 px-2 py-1 text-xs hover:bg-rose-900/30">Clear</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">Pane split</span>
                  <input type="range" min={25} max={65} value={editorSplit} onChange={(e) => setEditorSplit(Number(e.target.value))} className="w-56" />
                  <span className="text-xs text-zinc-500">{editorSplit}% / {100 - editorSplit}%</span>
                </div>
                <div className="grid gap-6" style={{ gridTemplateColumns: `minmax(0, ${editorSplit}fr) minmax(0, ${100 - editorSplit}fr)` }}>
                  <Card title={`Variants ${selectedMethod} ${selectedPath}`} subtitle="Pick a variant to inspect/edit.">
                    <div className="space-y-2 max-h-80 overflow-auto">
                      {variantList.map((v) => (
                        <button key={v.id} onClick={() => selectVariant(v.id)} className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedVariantId === v.id ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                          <div className="font-mono text-xs">{v.id}</div>
                          <div className="text-xs text-zinc-400 mt-1">{v.source} · status {v.status}</div>
                        </button>
                      ))}
                      {variantList.length === 0 ? <p className="text-sm text-zinc-400">No variants loaded.</p> : null}
                    </div>
                  </Card>

                  <Card
                    title="Variant Editor"
                    subtitle={selectedVariantId || 'Select a variant to edit'}
                    actions={<div className="flex gap-2"><button onClick={() => { try { setVariantEditor(JSON.stringify(JSON.parse(variantEditor), null, 2)); } catch {} }} disabled={!selectedVariantId} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs">Format</button><button onClick={saveVariant} disabled={busy || !selectedVariantId || !!variantError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save variant</button></div>}
                  >
                    <textarea value={variantEditor} onChange={(e) => setVariantEditor(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
                    {variantError ? <p className="mt-2 text-xs text-rose-400">{variantError}</p> : selectedVariantId ? <p className="mt-2 text-xs text-emerald-400">JSON valid</p> : null}
                  </Card>
                </div>
              </div>
            </>
          }
        />

        <Route
          path="/settings"
          element={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Runtime Config" subtitle="Live config editor (AI mode, seeds, redaction, openapi mode)." actions={<button onClick={saveConfig} disabled={busy || !!configError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save config</button>}>
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

      {toast ? <div className="fixed bottom-6 right-6 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm shadow-lg">{toast}</div> : null}
    </main>
  );
}
