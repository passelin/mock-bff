import { Eye } from "lucide-react";
import { Card } from "../components/Card";

export function LogsPage(props: {
  requests: any[];
  misses: any[];
  loadRequests: () => void;
  clearLogs: () => void;
  loadMisses: () => void;
  clearMisses: () => void;
  setPromptDialog: (text: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card
        title="Recent Requests"
        subtitle="In-memory rolling logs (newest first)."
        actions={
          <div className="flex gap-2">
            <button
              onClick={props.clearLogs}
              className="rounded-lg border border-rose-700 text-rose-300 px-3 py-2 text-xs"
            >
              Clear
            </button>
          </div>
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
                  <th className="px-3 py-2 text-left">Time</th>
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
                  <tr
                    key={`${r.at}-${i}`}
                    className="border-b border-zinc-800/70 hover:bg-zinc-800/20"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                      {new Date(r.at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-brand-300">{r.method}</td>
                    <td className="px-3 py-2 font-mono break-all">{r.path}</td>
                    <td className="px-3 py-2">{r.match}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.aiError ? (
                        <span className="text-rose-400 font-mono">{r.aiError}</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
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

      <Card
        title="Misses"
        subtitle="Unmatched requests captured during runtime."
        actions={
          <div className="flex gap-2">
            <button
              onClick={props.clearMisses}
              className="rounded-lg border border-rose-700 text-rose-300 px-3 py-2 text-xs"
            >
              Clear
            </button>
          </div>
        }
      >
        {props.misses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
            No misses recorded. Nice coverage so far.
          </div>
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
                {props.misses.map((m: any, i: number) => (
                  <tr
                    key={`${m.at}-${i}`}
                    className="border-b border-zinc-800/70 hover:bg-zinc-800/20"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                      {m.at ? new Date(m.at).toLocaleTimeString() : "—"}
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
  );
}
