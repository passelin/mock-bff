import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';

type Endpoint = { method: string; path: string; variants: number; hasDefault: boolean };
type VariantMeta = { id: string; file: string; source?: string; status?: number; createdAt?: string };
type ReqLog = { at: string; method: string; path: string; match: string; status: number };

function Card(props: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-glow p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.actions}
      </div>
      {props.children}
    </section>
  );
}

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm border ${isActive ? 'border-brand-500 bg-brand-500/10 text-brand-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`
      }
    >
      {label}
    </NavLink>
  );
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

  useEffect(() => {
    refresh();
    const id = setInterval(loadRequests, 3000);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    await Promise.all([loadEndpoints(), loadRequests(), loadMisses(), loadConfig(), loadContext()]);
  }

  async function loadEndpoints() { setEndpoints(await (await fetch('/admin/endpoints')).json()); }
  async function loadRequests() { const data = await (await fetch('/admin/requests?limit=100')).json(); setRequests(data.rows ?? []); }
  async function loadMisses() { const data = await (await fetch('/admin/misses')).json(); setMisses(Array.isArray(data) ? data : []); }
  async function loadConfig() { setConfigText(JSON.stringify(await (await fetch('/admin/config')).json(), null, 2)); }
  async function loadContext() { const d = await (await fetch('/admin/context')).json(); setContext(d.context || ''); }

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
    const mock = JSON.parse(variantEditor);
    await fetch('/admin/variant', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: selectedMethod, path: selectedPath, id: selectedVariantId, mock }),
    });
    await loadVariants(selectedMethod, selectedPath);
  }

  async function saveConfig() {
    const parsed = JSON.parse(configText);
    await fetch('/admin/config', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed),
    });
  }

  async function saveContext() {
    await fetch('/admin/context', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ context }),
    });
  }

  async function copyLink(kind: 'current' | 'dashboard' | 'variants' | 'settings') {
    const hash =
      kind === 'current'
        ? window.location.hash || '#/'
        : kind === 'dashboard'
          ? '#/'
          : kind === 'variants'
            ? '#/variants'
            : '#/settings';

    const url = `${window.location.origin}/-/admin${hash}`;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    setTimeout(() => setCopied(''), 1200);
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Mock BFF Admin</h1>
            <p className="mt-2 text-xs text-zinc-400">Route: {location.pathname}{location.hash || '#/'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copyLink('current')} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800">{copied==='current' ? 'Copied current' : 'Copy current link'}</button>
            <button onClick={() => copyLink('dashboard')} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800">{copied==='dashboard' ? 'Copied dashboard' : 'Copy dashboard'}</button>
            <button onClick={() => copyLink('variants')} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800">{copied==='variants' ? 'Copied variants' : 'Copy variants'}</button>
            <button onClick={() => copyLink('settings')} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800">{copied==='settings' ? 'Copied settings' : 'Copy settings'}</button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Tab to="/" label="Dashboard" />
          <Tab to="/variants" label="Variants" />
          <Tab to="/settings" label="Settings" />
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <>
              <Card title="Endpoints">
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/60"><tr><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Path</th><th className="px-3 py-2">Variants</th></tr></thead>
                    <tbody>
                      {endpoints.map((ep, i) => (
                        <tr key={ep.method + ep.path + i} className="border-t border-zinc-800">
                          <td className="px-3 py-2 font-mono text-brand-300">{ep.method}</td>
                          <td className="px-3 py-2 font-mono">{ep.path}</td>
                          <td className="px-3 py-2">{ep.variants}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Recent Requests">
                <pre className="max-h-80 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">{JSON.stringify(requests, null, 2)}</pre>
              </Card>

              <Card title="Misses">
                <pre className="max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">{JSON.stringify(misses, null, 2)}</pre>
              </Card>
            </>
          }
        />

        <Route
          path="/variants"
          element={
            <>
              <Card title="Endpoints (select one to review variants)">
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/60"><tr><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Path</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody>
                      {endpoints.map((ep, i) => (
                        <tr key={ep.method + ep.path + i} className="border-t border-zinc-800">
                          <td className="px-3 py-2 font-mono text-brand-300">{ep.method}</td>
                          <td className="px-3 py-2 font-mono">{ep.path}</td>
                          <td className="px-3 py-2"><button className="rounded-lg border border-zinc-700 px-2 py-1" onClick={() => loadVariants(ep.method, ep.path)}>Review</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title={`Variants ${selectedMethod} ${selectedPath}`}>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {variantList.map(v => (
                      <button key={v.id} onClick={() => selectVariant(v.id)} className={'w-full rounded-lg border px-3 py-2 text-left ' + (selectedVariantId===v.id ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700')}>
                        <div className="font-mono text-xs">{v.id}</div>
                        <div className="text-xs text-zinc-400">{v.source} · {v.status}</div>
                      </button>
                    ))}
                  </div>
                </Card>
                <Card title="Variant Editor" actions={<button onClick={saveVariant} disabled={!selectedVariantId} className="rounded-lg bg-brand-600 px-3 py-2 disabled:opacity-50">Save</button>}>
                  <textarea value={variantEditor} onChange={e => setVariantEditor(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
                </Card>
              </div>
            </>
          }
        />

        <Route
          path="/settings"
          element={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Config" actions={<button onClick={saveConfig} className="rounded-lg bg-brand-600 px-3 py-2">Save</button>}>
                <textarea value={configText} onChange={e => setConfigText(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
              </Card>
              <Card title="Context" actions={<button onClick={saveContext} className="rounded-lg bg-indigo-600 px-3 py-2">Save</button>}>
                <textarea value={context} onChange={e => setContext(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
              </Card>
            </div>
          }
        />
      </Routes>
    </main>
  );
}
