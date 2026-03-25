import { Trash2 } from "lucide-react";
import { Card } from "../components/Card";
import type { Endpoint, VariantMeta } from "../types";

export function VariantsPage(props: {
  busy: boolean;
  createMethod: string;
  setCreateMethod: (v: string) => void;
  createPath: string;
  setCreatePath: (v: string) => void;
  createVariantId: string;
  setCreateVariantId: (v: string) => void;
  createStatus: number;
  setCreateStatus: (v: number) => void;
  createBody: string;
  setCreateBody: (v: string) => void;
  createVariant: () => void;

  filteredEndpoints: Endpoint[];
  endpointSearch: string;
  setEndpointSearch: (v: string) => void;
  allFilteredSelected: boolean;
  setAllFilteredSelection: (v: boolean) => void;
  selectedEndpointKeys: Record<string, boolean>;
  toggleEndpointSelection: (method: string, path: string, checked: boolean) => void;
  selectedMethod: string;
  selectedPath: string;
  loadVariants: (method: string, path: string) => void;
  clearSelectedEndpoints: () => void;
  clearEndpoint: (method: string, path: string) => void;

  editorSplit: number;
  variantList: VariantMeta[];
  selectedVariantId: string;
  selectVariant: (id: string) => void;
  deleteVariant: (id: string) => void;

  variantEditor: string;
  setVariantEditor: (v: string) => void;
  saveVariant: () => void;
  variantError: string;
}) {
  return (
    <>
      <Card
        title="Create endpoint / variant"
        subtitle="Manually add new endpoints and variants directly from the UI."
        actions={
          <button
            onClick={props.createVariant}
            disabled={props.busy || !props.createPath.trim()}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Create
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <select value={props.createMethod} onChange={(e) => props.setCreateMethod(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
            <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
          </select>
          <input value={props.createPath} onChange={(e) => props.setCreatePath(e.target.value)} placeholder="/api/new-endpoint" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input value={props.createVariantId} onChange={(e) => props.setCreateVariantId(e.target.value)} placeholder="variant id" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input type="number" value={props.createStatus} onChange={(e) => props.setCreateStatus(Number(e.target.value))} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        </div>
        <textarea value={props.createBody} onChange={(e) => props.setCreateBody(e.target.value)} className="h-40 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-3">
          <Card
            title="Endpoints"
            subtitle="Pick endpoint to load variants."
            actions={<div className="flex items-center gap-2"><button onClick={props.clearSelectedEndpoints} disabled={props.busy || props.filteredEndpoints.filter((ep) => props.selectedEndpointKeys[`${ep.method} ${ep.path}`]).length === 0} className="rounded-xl border border-rose-700 text-rose-300 px-3 py-2 text-xs hover:bg-rose-900/30 disabled:opacity-50">Delete</button></div>}
          >
            <div className="mb-3 flex items-center gap-2"><input type="checkbox" checked={props.allFilteredSelected} onChange={(e) => props.setAllFilteredSelection(e.target.checked)} /><span className="text-xs text-zinc-400">Select / deselect all shown</span></div>
            <input value={props.endpointSearch} onChange={(e) => props.setEndpointSearch(e.target.value)} placeholder="Search endpoints..." className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
            <div className="max-h-[28rem] overflow-auto space-y-2">
              {props.filteredEndpoints.map((ep, i) => (
                <div key={ep.method + ep.path + i} className={`w-full rounded-lg border px-3 py-2 ${props.selectedMethod === ep.method && props.selectedPath === ep.path ? "border-brand-500 bg-brand-500/10" : "border-zinc-700 hover:bg-zinc-800"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <input type="checkbox" checked={Boolean(props.selectedEndpointKeys[`${ep.method} ${ep.path}`])} onChange={(e) => props.toggleEndpointSelection(ep.method, ep.path, e.target.checked)} className="shrink-0" />
                    <button onClick={() => props.loadVariants(ep.method, ep.path)} className="flex-1 text-left"><div className="font-mono text-xs text-brand-300">{ep.method}</div><div className="font-mono text-xs break-all mt-1">{ep.path}</div></button>
                    <button onClick={() => props.clearEndpoint(ep.method, ep.path)} className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30 shrink-0" aria-label="Delete endpoint"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-8 space-y-3">
          <div className="flex items-center gap-3"><span className="text-xs text-zinc-400">Layout</span><span className="text-xs text-zinc-500">40% / 60%</span></div>
          <div className="grid gap-6" style={{ gridTemplateColumns: `minmax(0, ${props.editorSplit}fr) minmax(0, ${100 - props.editorSplit}fr)` }}>
            <Card title="Variants" subtitle={props.selectedMethod && props.selectedPath ? `Endpoint: ${props.selectedMethod} ${props.selectedPath}` : "Select an endpoint from the left list first."}>
              <div className="space-y-2 max-h-80 overflow-auto">
                {props.variantList.map((v) => (
                  <div key={v.id} className={`w-full rounded-lg border px-3 py-2 transition ${props.selectedVariantId === v.id ? "border-brand-500 bg-brand-500/10" : "border-zinc-700 hover:bg-zinc-800"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => props.selectVariant(v.id)} className="flex-1 text-left"><div className="font-mono text-xs" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }} title={v.displayLabel || v.id}>{v.displayLabel || v.id}</div><div className="text-xs text-zinc-400 mt-1">{v.source} · status {v.status}</div></button>
                      <button onClick={() => props.deleteVariant(v.id)} disabled={props.variantList.length <= 1} className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30 shrink-0 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Variant Editor" subtitle={props.selectedVariantId || "Select a variant to edit"} actions={<div className="flex gap-2"><button onClick={() => { try { props.setVariantEditor(JSON.stringify(JSON.parse(props.variantEditor), null, 2)); } catch {} }} disabled={!props.selectedVariantId} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs">Format</button><button onClick={props.saveVariant} disabled={props.busy || !props.selectedVariantId || !!props.variantError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save variant</button></div>}>
              <textarea value={props.variantEditor} onChange={(e) => props.setVariantEditor(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
              {props.variantError ? <p className="mt-2 text-xs text-rose-400">{props.variantError}</p> : props.selectedVariantId ? <p className="mt-2 text-xs text-emerald-400">JSON valid</p> : null}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
