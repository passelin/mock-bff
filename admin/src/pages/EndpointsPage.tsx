import { useMemo } from "react";
import { Card } from "../components/Card";
import type { Endpoint, ReqLog } from "../types";

export function EndpointsPage(props: {
  filteredEndpoints: Endpoint[];
  endpointSearch: string;
  setEndpointSearch: (v: string) => void;
  allFilteredSelected: boolean;
  setAllFilteredSelection: (v: boolean) => void;
  selectedEndpointKeys: Record<string, boolean>;
  toggleEndpointSelection: (
    method: string,
    path: string,
    checked: boolean,
  ) => void;
  clearEndpoint: (method: string, path: string) => void;
  clearSelectedEndpoints: () => void;
  busy: boolean;
  requests: ReqLog[];
}) {
  const hitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of props.requests) {
      const key = `${r.method} ${r.path}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [props.requests]);

  const selectedCount = props.filteredEndpoints.filter(
    (ep) => props.selectedEndpointKeys[`${ep.method} ${ep.path}`],
  ).length;

  return (
    <Card
      title="Endpoint Management"
      subtitle="Search, review and clear endpoint groups."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={props.clearSelectedEndpoints}
            disabled={props.busy || selectedCount === 0}
            className="rounded-xl border border-rose-700 text-rose-300 px-3 py-2 text-xs hover:bg-rose-900/30 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      }
    >
      <div className="mb-3">
        <input
          value={props.endpointSearch}
          onChange={(e) => props.setEndpointSearch(e.target.value)}
          placeholder="Search endpoints (method or path)…"
          className="w-full md:w-96 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500"
        />
      </div>
      <div className="overflow-y-auto overflow-x-hidden max-h-[32rem] rounded-xl border border-zinc-800">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-zinc-800/60 text-zinc-300">
            <tr>
              <th className="w-10 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={props.allFilteredSelected}
                  onChange={(e) =>
                    props.setAllFilteredSelection(e.target.checked)
                  }
                />
              </th>
              <th className="w-24 px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Path</th>
              <th className="w-20 px-3 py-2 text-left">Variants</th>
              <th className="w-16 px-3 py-2 text-left">Hits</th>
              <th className="w-24 px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {props.filteredEndpoints.map((ep, i) => (
              <tr
                key={ep.method + ep.path + i}
                className="border-t border-zinc-800 hover:bg-zinc-800/30"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(
                      props.selectedEndpointKeys[`${ep.method} ${ep.path}`],
                    )}
                    onChange={(e) =>
                      props.toggleEndpointSelection(
                        ep.method,
                        ep.path,
                        e.target.checked,
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2 font-mono text-brand-300 whitespace-nowrap">
                  {ep.method}
                </td>
                <td className="px-3 py-2 font-mono break-all">{ep.path}</td>
                <td className="px-3 py-2 whitespace-nowrap">{ep.variants}</td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                  {hitCounts[`${ep.method} ${ep.path}`] ?? 0}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => props.clearEndpoint(ep.method, ep.path)}
                    className="rounded-lg border border-rose-700 text-rose-300 px-2 py-1 text-xs hover:bg-rose-900/30 whitespace-nowrap"
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
            {props.filteredEndpoints.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-sm text-zinc-400">
                  No matching endpoints.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
