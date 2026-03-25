import { FileUp, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { StatCard } from "../components/StatCard";

export function DashboardPage(props: {
  stats: { endpoints: number; variants: number; misses: number; requests: number };
  refresh: () => void;
  setHash: (h: string) => void;
  busy: boolean;
  harFile: File | null;
  setHarFile: (f: File | null) => void;
  openApiFile: File | null;
  setOpenApiFile: (f: File | null) => void;
  uploadFile: (route: string, file: File | null, successMsg: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Endpoints" value={props.stats.endpoints} />
        <StatCard label="Variants" value={props.stats.variants} />
        <StatCard label="Misses" value={props.stats.misses} />
        <StatCard label="Recent Req Logs" value={props.stats.requests} />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-zinc-400 mr-2">Quick actions</span>
        <button onClick={props.refresh} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Refresh data</button>
        <button onClick={() => props.setHash('#/endpoints')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Manage endpoints</button>
        <button onClick={() => props.setHash('#/variants')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Edit variants</button>
        <button onClick={() => props.setHash('#/logs')} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">View logs</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Import HAR" subtitle="Upload real traffic captures to generate endpoint variants." tone="highlight" actions={<button disabled={props.busy || !props.harFile} onClick={() => props.uploadFile('/-/api/har', props.harFile, 'HAR imported')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><Upload className="h-4 w-4" />Upload HAR</button>}>
          <input type="file" accept=".har,.json" onChange={(e) => props.setHarFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-500" />
        </Card>

        <Card title="Import OpenAPI" subtitle="Upload JSON/YAML contract for validation and guidance." tone="highlight" actions={<button disabled={props.busy || !props.openApiFile} onClick={() => props.uploadFile('/-/api/openapi', props.openApiFile, 'OpenAPI imported')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"><FileUp className="h-4 w-4" />Upload OpenAPI</button>}>
          <input type="file" accept=".json,.yaml,.yml" onChange={(e) => props.setOpenApiFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500" />
        </Card>
      </div>
    </>
  );
}
