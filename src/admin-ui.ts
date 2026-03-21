export const ADMIN_HTML = `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mock BFF Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: { brand: { 500: '#8b5cf6', 600: '#7c3aed' } },
          boxShadow: { glow: '0 0 0 1px rgba(139,92,246,.35), 0 8px 40px rgba(0,0,0,.45)' }
        }
      }
    }
  </script>
</head>
<body class="min-h-screen bg-zinc-950 text-zinc-100">
  <div id="root"></div>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <script type="text/babel">
    const { useEffect, useState } = React;

    function Card({ title, subtitle, children, actions }) {
      return (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-glow backdrop-blur p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {subtitle ? <p className="text-sm text-zinc-400 mt-1">{subtitle}</p> : null}
            </div>
            {actions}
          </div>
          {children}
        </section>
      );
    }

    function StatusPill({ ok, text }) {
      return (
        <span className={
          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ' +
          (ok ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-amber-950/50 border-amber-800 text-amber-300')
        }>{text}</span>
      );
    }

    function App() {
      const [health, setHealth] = useState(null);
      const [configText, setConfigText] = useState('');
      const [configError, setConfigError] = useState('');
      const [endpoints, setEndpoints] = useState([]);
      const [misses, setMisses] = useState([]);
      const [requests, setRequests] = useState([]);
      const [context, setContext] = useState('');
      const [busy, setBusy] = useState(false);
      const [toast, setToast] = useState('');

      const [selectedMethod, setSelectedMethod] = useState('');
      const [selectedPath, setSelectedPath] = useState('');
      const [variantList, setVariantList] = useState([]);
      const [selectedVariantId, setSelectedVariantId] = useState('');
      const [variantEditor, setVariantEditor] = useState('');

      useEffect(() => {
        refreshAll();
        const id = setInterval(() => loadRequests(), 3000);
        return () => clearInterval(id);
      }, []);

      function showToast(text) {
        setToast(text);
        setTimeout(() => setToast(''), 2200);
      }

      async function refreshAll() {
        await Promise.all([loadHealth(), loadConfig(), loadEndpoints(), loadMisses(), loadRequests(), loadContext()]);
      }

      async function loadHealth() { setHealth(await (await fetch('/admin/health')).json()); }
      async function loadConfig() { setConfigText(JSON.stringify(await (await fetch('/admin/config')).json(), null, 2)); }
      async function loadEndpoints() { setEndpoints(await (await fetch('/admin/endpoints')).json()); }
      async function loadMisses() { const d = await (await fetch('/admin/misses')).json(); setMisses(Array.isArray(d) ? d : []); }
      async function loadRequests() { const d = await (await fetch('/admin/requests?limit=100')).json(); setRequests(Array.isArray(d.rows) ? d.rows : []); }
      async function loadContext() { const d = await (await fetch('/admin/context')).json(); setContext(d.context || ''); }

      async function saveConfig() {
        setBusy(true); setConfigError('');
        try {
          const parsed = JSON.parse(configText);
          const res = await fetch('/admin/config', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(parsed) });
          if (!res.ok) throw new Error('Failed to save config');
          await loadConfig(); showToast('Config saved');
        } catch (err) { setConfigError(String(err.message || err)); }
        finally { setBusy(false); }
      }

      async function saveContext() {
        setBusy(true);
        try {
          const res = await fetch('/admin/context', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ context }) });
          if (!res.ok) throw new Error('Failed to save context');
          showToast('Context saved');
        } catch { showToast('Save failed'); }
        finally { setBusy(false); }
      }

      async function uploadFile(route, file, okMessage) {
        if (!file) return;
        setBusy(true);
        try {
          const fd = new FormData(); fd.append('file', file);
          const res = await fetch(route, { method: 'POST', body: fd });
          if (!res.ok) throw new Error('Upload failed');
          await refreshAll(); showToast(okMessage);
        } catch { showToast('Upload failed'); }
        finally { setBusy(false); }
      }

      async function loadVariantsForEndpoint(method, path) {
        setSelectedMethod(method); setSelectedPath(path);
        const data = await (await fetch('/admin/variants?method=' + encodeURIComponent(method) + '&path=' + encodeURIComponent(path))).json();
        const variants = Array.isArray(data.variants) ? data.variants : [];
        setVariantList(variants);
        setSelectedVariantId('');
        setVariantEditor('');
      }

      async function loadVariant(id) {
        if (!selectedMethod || !selectedPath || !id) return;
        const data = await (await fetch('/admin/variant?method=' + encodeURIComponent(selectedMethod) + '&path=' + encodeURIComponent(selectedPath) + '&id=' + encodeURIComponent(id))).json();
        setSelectedVariantId(id);
        setVariantEditor(JSON.stringify(data.mock, null, 2));
      }

      async function saveVariant() {
        if (!selectedMethod || !selectedPath || !selectedVariantId) return;
        setBusy(true);
        try {
          const mock = JSON.parse(variantEditor);
          const res = await fetch('/admin/variant', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ method: selectedMethod, path: selectedPath, id: selectedVariantId, mock })
          });
          if (!res.ok) throw new Error('Failed to save variant');
          showToast('Variant saved');
          await loadVariantsForEndpoint(selectedMethod, selectedPath);
        } catch (e) {
          showToast('Variant save failed');
        } finally {
          setBusy(false);
        }
      }

      return (
        <main className="mx-auto max-w-7xl p-6 lg:p-10 space-y-6">
          <header className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-glow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-400">Mock BFF</p>
                <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
                <p className="text-zinc-400 mt-2">Dark-mode UI for HAR ingest, OpenAPI validation, and runtime diagnostics.</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill ok={!!health?.ok} text={health?.ok ? 'Server healthy' : 'Loading…'} />
                <button onClick={refreshAll} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 transition">Refresh</button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Upload HAR" subtitle="Import recorded SPA traffic and build replay variants.">
              <input type="file" accept=".har,.json" className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-500"
                onChange={(e) => uploadFile('/admin/har', e.target.files?.[0], 'HAR imported')} />
            </Card>
            <Card title="Upload OpenAPI" subtitle="Used in assist/strict modes to validate generated responses.">
              <input type="file" accept=".json,.yaml,.yml" className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500"
                onChange={(e) => uploadFile('/admin/openapi', e.target.files?.[0], 'OpenAPI uploaded')} />
            </Card>
          </div>

          <Card title="Endpoints" subtitle="Click an endpoint to review and edit its variants.">
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800/60 text-zinc-300">
                  <tr><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Path</th><th className="px-3 py-2 text-left">Variants</th><th className="px-3 py-2 text-left">Default</th><th className="px-3 py-2 text-left"></th></tr>
                </thead>
                <tbody>
                  {endpoints.map((ep, idx) => (
                    <tr key={ep.method + ep.path + idx} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 font-mono text-brand-300">{ep.method}</td>
                      <td className="px-3 py-2 font-mono text-zinc-200">{ep.path}</td>
                      <td className="px-3 py-2">{ep.variants}</td>
                      <td className="px-3 py-2">{ep.hasDefault ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2"><button className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800" onClick={() => loadVariantsForEndpoint(ep.method, ep.path)}>Review variants</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Variant List" subtitle={selectedMethod && selectedPath ? selectedMethod + ' ' + selectedPath : 'Select an endpoint first.'}>
              <div className="space-y-2 max-h-72 overflow-auto">
                {variantList.map((v) => (
                  <button key={v.id} onClick={() => loadVariant(v.id)} className={
                    'w-full text-left rounded-xl border px-3 py-2 transition ' +
                    (selectedVariantId === v.id ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 hover:bg-zinc-800')
                  }>
                    <div className="font-mono text-xs text-zinc-200">{v.id}</div>
                    <div className="text-xs text-zinc-400 mt-1">{v.source} · status {v.status}</div>
                  </button>
                ))}
                {variantList.length === 0 ? <p className="text-sm text-zinc-400">No variants loaded.</p> : null}
              </div>
            </Card>

            <Card title="Variant Editor" subtitle={selectedVariantId || 'Select a variant to edit'} actions={<button disabled={busy || !selectedVariantId} onClick={saveVariant} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-50">Save Variant</button>}>
              <textarea value={variantEditor} onChange={(e) => setVariantEditor(e.target.value)} className="h-72 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Config" subtitle="Edit live server behavior." actions={<button disabled={busy} onClick={saveConfig} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-50">Save</button>}>
              <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} className="h-72 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {configError ? <p className="mt-2 text-sm text-rose-400">{configError}</p> : null}
            </Card>
            <Card title="Context" subtitle="Used to guide generation." actions={<button disabled={busy} onClick={saveContext} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">Save</button>}>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} className="h-72 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </Card>
          </div>

          <Card title="Recent Requests" subtitle="In-memory rolling request logs (newest first)." actions={<button onClick={loadRequests} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 transition">Refresh</button>}>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-xs">
                <thead className="bg-zinc-800/60 text-zinc-300"><tr><th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Path</th><th className="px-3 py-2 text-left">Match</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
                <tbody>
                  {requests.map((r, i) => (
                    <tr key={r.at + r.path + i} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-400">{new Date(r.at).toLocaleTimeString()}</td>
                      <td className="px-3 py-2 font-mono text-brand-300">{r.method}</td>
                      <td className="px-3 py-2 font-mono text-zinc-200">{r.path}</td>
                      <td className="px-3 py-2">{r.match}</td>
                      <td className="px-3 py-2">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Misses" subtitle="Unmatched requests captured during runtime.">
            <pre className="max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">{JSON.stringify(misses, null, 2)}</pre>
          </Card>

          {toast ? <div className="fixed bottom-6 right-6 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100 border border-zinc-700 shadow-lg">{toast}</div> : null}
        </main>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>
`;
