import { Pin, PinOff, Plus, Replace, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card } from "../components/Card";
import type { Endpoint, VariantMeta } from "../types";

export function VariantsPage(props: {
  busy: boolean;

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
  selectedMethod: string;
  selectedPath: string;
  openCreateDialog: () => void;
  loadVariants: (method: string, path: string) => void;
  clearSelectedEndpoints: () => void;
  clearEndpoint: (method: string, path: string) => void;

  variantList: VariantMeta[];
  forcedVariantId: string | undefined;
  forceVariant: (id: string | null) => void;
  fuzzyDisabled: boolean;
  toggleFuzzy: () => void;
  selectedVariantId: string;
  selectVariant: (id: string) => void;
  deleteVariant: (id: string) => void;

  variantEditor: string;
  setVariantEditor: (v: string) => void;
  saveVariant: () => void;
  variantError: string;
}) {
  const selectedCount = props.filteredEndpoints.filter(
    (ep) => props.selectedEndpointKeys[`${ep.method} ${ep.path}`],
  ).length;

  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");

  const matchCount =
    showSearch && searchTerm
      ? (props.variantEditor.split(searchTerm).length - 1)
      : 0;

  function replaceAll() {
    if (!searchTerm) return;
    props.setVariantEditor(props.variantEditor.split(searchTerm).join(replaceTerm));
  }

  return (
    <>
      <div className="space-y-6">
        <Card
          title="Endpoints"
          subtitle="Pick an endpoint to load variants or create a new endpoint and variant."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={props.openCreateDialog}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-xs font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
              <button
                onClick={props.clearSelectedEndpoints}
                disabled={props.busy || selectedCount === 0}
                className="rounded-xl border border-rose-700 px-3 py-2 text-xs text-rose-300 hover:bg-rose-900/30 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          }
        >
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={props.allFilteredSelected}
                onChange={(e) =>
                  props.setAllFilteredSelection(e.target.checked)
                }
              />
              <span className="text-xs text-zinc-400">
                Select or deselect all shown
              </span>
            </div>
            <input
              value={props.endpointSearch}
              onChange={(e) => props.setEndpointSearch(e.target.value)}
              placeholder="Search endpoints..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs md:max-w-sm"
            />
          </div>
          <div className="max-h-[24rem] space-y-2 overflow-auto">
            {props.filteredEndpoints.map((ep, i) => (
              <div
                key={ep.method + ep.path + i}
                className={`w-full rounded-lg border px-3 py-2 ${props.selectedMethod === ep.method && props.selectedPath === ep.path ? "border-brand-500 bg-brand-500/10" : "border-zinc-700 hover:bg-zinc-800"}`}
              >
                <div className="flex items-center gap-3">
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
                    className="shrink-0"
                  />
                  <button
                    onClick={() => props.loadVariants(ep.method, ep.path)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="font-mono text-xs text-brand-300">
                      {ep.method}
                    </div>
                    <div className="mt-1 break-all font-mono text-xs">
                      {ep.path}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400">
                      {ep.variants} variant{ep.variants === 1 ? "" : "s"}
                    </span>
                    <button
                      onClick={() => props.clearEndpoint(ep.method, ep.path)}
                      className="self-center rounded p-1.5 text-rose-300 hover:bg-rose-900/30"
                      aria-label="Delete endpoint"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {props.filteredEndpoints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-400">
                No matching endpoints.
              </div>
            ) : null}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(22rem,32rem)_minmax(0,1fr)]">
          <Card
            title="Variants"
            subtitle={
              props.selectedMethod && props.selectedPath
                ? `Endpoint: ${props.selectedMethod} ${props.selectedPath}`
                : "Select an endpoint from the list above first."
            }
            actions={
              props.selectedMethod && props.selectedPath ? (
                <button
                  onClick={props.toggleFuzzy}
                  title={props.fuzzyDisabled ? "Fuzzy matching disabled — click to enable" : "Fuzzy matching enabled — click to disable"}
                  className={`rounded-xl border px-3 py-2 text-xs ${props.fuzzyDisabled ? "border-amber-600 bg-amber-500/10 text-amber-400" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}
                >
                  {props.fuzzyDisabled ? "Fuzzy off" : "Fuzzy on"}
                </button>
              ) : null
            }
          >
            <div className="space-y-2 max-h-80 overflow-auto">
              {props.variantList.map((v) => {
                const isForced = props.forcedVariantId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`w-full rounded-lg border px-3 py-2 transition ${props.selectedVariantId === v.id ? "border-brand-500 bg-brand-500/10" : isForced ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 hover:bg-zinc-800"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => props.selectVariant(v.id)}
                        className="flex-1 text-left"
                      >
                        <div
                          className="font-mono text-xs"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={v.displayLabel || v.id}
                        >
                          {v.displayLabel || v.id}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                          {v.source} · status {v.status}
                          {v.updatedAt && (
                            <span title={v.updatedAt}>
                              · {new Date(v.updatedAt).toLocaleString()}
                            </span>
                          )}
                          {isForced && (
                            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                              forced
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 self-center">
                        <button
                          onClick={() =>
                            props.forceVariant(isForced ? null : v.id)
                          }
                          title={isForced ? "Clear forced variant" : "Force this variant"}
                          className={`rounded p-1.5 ${isForced ? "text-amber-400 hover:bg-amber-900/30" : "text-zinc-500 hover:bg-zinc-700 hover:text-amber-400"}`}
                        >
                          {isForced ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => props.deleteVariant(v.id)}
                          disabled={props.variantList.length <= 1}
                          className="rounded p-1.5 text-rose-300 hover:bg-rose-900/30 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {props.selectedMethod &&
            props.selectedPath &&
            props.variantList.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-400">
                No variants found for the selected endpoint.
              </p>
            ) : null}
          </Card>

          <Card
            title="Variant Editor"
            subtitle={props.selectedVariantId || "Select a variant to edit"}
            actions={
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSearch((s) => !s)}
                  disabled={!props.selectedVariantId}
                  title="Search / replace"
                  className={`rounded-xl border px-3 py-2 text-xs ${showSearch ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <Replace className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    try {
                      props.setVariantEditor(
                        JSON.stringify(
                          JSON.parse(props.variantEditor),
                          null,
                          2,
                        ),
                      );
                    } catch {}
                  }}
                  disabled={!props.selectedVariantId}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-xs"
                >
                  Format
                </button>
                <button
                  onClick={props.saveVariant}
                  disabled={
                    props.busy ||
                    !props.selectedVariantId ||
                    !!props.variantError
                  }
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Save variant
                </button>
              </div>
            }
          >
            {showSearch && (
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search…"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs"
                  />
                  <span className="min-w-[3rem] text-right text-xs text-zinc-500">
                    {searchTerm ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    placeholder="Replace with…"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs"
                  />
                  <button
                    onClick={replaceAll}
                    disabled={!searchTerm || matchCount === 0}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Replace all
                  </button>
                </div>
              </div>
            )}
            <textarea
              value={props.variantEditor}
              onChange={(e) => props.setVariantEditor(e.target.value)}
              className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs"
            />
            {props.variantError ? (
              <p className="mt-2 text-xs text-rose-400">{props.variantError}</p>
            ) : props.selectedVariantId ? (
              <p className="mt-2 text-xs text-emerald-400">JSON valid</p>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
