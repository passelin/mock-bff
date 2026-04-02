import { Eye, FileUp } from "lucide-react";
import { Card } from "../components/Card";
import { FileDropZone } from "../components/FileDropZone";
import { HarUploadCard } from "../components/HarUploadCard";
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
  requests: any[];
  misses: any[];
  clearLogs: () => void;
  clearMisses: () => void;
  setPromptDialog: (text: string | null) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Endpoints" value={props.stats.endpoints} />
        <StatCard label="Variants" value={props.stats.variants} />
        <StatCard label="Misses" value={props.stats.misses} />
        <StatCard label="Recent Req Logs" value={props.stats.requests} />
      </div>

      {/* Requests log — full width */}
      <Card
        title="Recent Requests"
        subtitle="In-memory rolling logs, newest first."
        actions={
          <button onClick={props.clearLogs} className="rounded-lg border border-rose-700 text-rose-300 px-3 py-2 text-xs">
            Clear
          </button>
        }
      >
        {props.requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
            No requests yet. Hit your endpoints to populate this feed.
          </div>
        ) : (
          <div className="max-h-[34rem] overflow-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-300 border-b border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Time</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Path</th>
                  <th className="px-3 py-2 text-left">Match</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">AI Error</th>
                  <th className="px-3 py-2 text-left">Prompt</th>
                </tr>
              </thead>
              <tbody>
                {props.requests.map((r: any, i: number) => (
                  <tr key={`${r.at}-${i}`} className="border-b border-zinc-800/70 hover:bg-zinc-800/20">
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                      {new Date(r.at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-brand-300">{r.method}</td>
                    <td className="px-3 py-2 font-mono break-all">{r.path}</td>
                    <td className="px-3 py-2">
                      {r.match === "proxied" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 px-2 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-rose-700/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          proxied
                        </span>
                      ) : (
                        r.match
                      )}
                    </td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.aiError
                        ? <span className="text-rose-400 font-mono">{r.aiError}</span>
                        : <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.prompt ? (
                        <button
                          onClick={() => props.setPromptDialog(r.prompt)}
                          className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800 inline-flex items-center gap-1"
                        >
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

      {/* Bottom row: misses (1/2) + uploads (1/2 split into two) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Misses — 2/4 = half width */}
        <div className="xl:col-span-2">
          <Card
            title="Misses"
            subtitle="Unmatched requests captured during runtime."
            actions={
              <button onClick={props.clearMisses} className="rounded-lg border border-rose-700 text-rose-300 px-3 py-2 text-xs">
                Clear
              </button>
            }
          >
            {props.misses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
                No misses recorded. Nice coverage so far.
              </div>
            ) : (
              <div className="max-h-[20rem] overflow-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-900 text-zinc-300 border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Time</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Path</th>
                      <th className="px-3 py-2 text-left">Resolved By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.misses.map((m: any, i: number) => (
                      <tr key={`${m.at}-${i}`} className="border-b border-zinc-800/70 hover:bg-zinc-800/20">
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                          {m.at ? new Date(m.at).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-brand-300">{m.method ?? "—"}</td>
                        <td className="px-3 py-2 font-mono break-all">{m.path ?? "—"}</td>
                        <td className="px-3 py-2">{m.resolvedBy ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Upload panels — each 1/4 width */}
        <HarUploadCard busy={props.busy} harFile={props.harFile} setHarFile={props.setHarFile} uploadFile={props.uploadFile} />
        <Card title="Import OpenAPI" subtitle="Upload JSON/YAML contract for validation and guidance.">
          <FileDropZone
            file={props.openApiFile}
            onFile={props.setOpenApiFile}
            accept=".json,.yaml,.yml"
            label="Click or drag a .json / .yaml file here"
          />
          <button
            disabled={props.busy || !props.openApiFile}
            onClick={() => props.uploadFile('/-/api/openapi', props.openApiFile, 'OpenAPI imported')}
            className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            <FileUp className="h-4 w-4" />
            Upload OpenAPI
          </button>
        </Card>
      </div>
    </>
  );
}
