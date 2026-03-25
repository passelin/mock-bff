import { lazy, Suspense, useMemo, useState } from "react";
import { FileUp } from "lucide-react";
import "swagger-ui-react/swagger-ui.css";
import "../styles/swagger-dark.css";
import { load as yamlLoad } from "js-yaml";
import { Card } from "../components/Card";

const SwaggerUI = lazy(() => import("swagger-ui-react"));

export function OpenApiPage(props: {
  busy: boolean;
  openApiFile: File | null;
  setOpenApiFile: (f: File | null) => void;
  uploadFile: (route: string, file: File | null, successMsg: string) => void;
  openApiDoc: { exists: boolean; format?: string; raw?: string };
  loadOpenApiDoc: () => void;
}) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  const parsedSpec = useMemo(() => {
    if (!props.openApiDoc.exists || !props.openApiDoc.raw) return undefined;
    try {
      const base =
        props.openApiDoc.format === "yaml"
          ? (yamlLoad(props.openApiDoc.raw) as Record<string, unknown>)
          : (JSON.parse(props.openApiDoc.raw) as Record<string, unknown>);

      return {
        ...base,
        servers: [{ url: window.location.origin }],
      } as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }, [props.openApiDoc]);

  return (
    <div className="space-y-6">
      <Card
        title="OpenAPI Contract"
        subtitle="Upload or inspect the currently loaded OpenAPI file."
        tone="highlight"
        actions={
          <button
            disabled={props.busy || !props.openApiFile}
            onClick={() => props.uploadFile("/-/api/openapi", props.openApiFile, "OpenAPI imported")}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            <FileUp className="h-4 w-4" />
            Upload OpenAPI
          </button>
        }
      >
        <div className="mb-3 flex items-center gap-2">
          <input
            type="file"
            accept=".json,.yaml,.yml"
            onChange={(e) => props.setOpenApiFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500"
          />
          <button onClick={props.loadOpenApiDoc} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">Refresh</button>
        </div>

        {!props.openApiDoc.exists ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No OpenAPI contract uploaded yet.</div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-zinc-400">Loaded format: <span className="text-zinc-200">{props.openApiDoc.format}</span></p>
              <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden">
                <button onClick={() => setViewMode("rendered")} className={`px-3 py-1.5 text-xs ${viewMode === "rendered" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400"}`}>Rendered Docs</button>
                <button onClick={() => setViewMode("raw")} className={`px-3 py-1.5 text-xs ${viewMode === "raw" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400"}`}>Raw Contract</button>
              </div>
            </div>

            {viewMode === "rendered" ? (
              parsedSpec ? (
                <div className="swagger-dark rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                  <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading API docs viewer…</div>}>
                    <SwaggerUI spec={parsedSpec as any} />
                  </Suspense>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">Could not parse OpenAPI contract for rendering.</div>
              )
            ) : (
              <pre className="max-h-[65vh] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs whitespace-pre-wrap">
                {props.openApiDoc.raw}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
