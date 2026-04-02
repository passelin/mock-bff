import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { AdvancedSection } from "../components/AdvancedSection";
import { PillInput } from "../components/PillInput";
import type { AppConfig, ProviderInfo } from "../types";

// ---------------------------------------------------------------------------
// Section wrappers
// ---------------------------------------------------------------------------

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-glow">
      <h2 className="mb-4 text-sm font-semibold text-zinc-100">{props.title}</h2>
      {props.children}
    </section>
  );
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-400">{props.label}</label>
      {props.children}
      {props.hint && <p className="mt-1 text-[11px] text-zinc-500">{props.hint}</p>}
    </div>
  );
}

function SelectField(props: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 pr-8 text-xs text-zinc-100 disabled:opacity-50"
      >
        {props.children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </div>
    </div>
  );
}

const INPUT_CLS = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600";

// ---------------------------------------------------------------------------
// Navigation blocker hook — warns on browser close/refresh when dirty
// (In-app tab navigation cannot be blocked with HashRouter without a data router)
// ---------------------------------------------------------------------------

function useNavigationBlocker(shouldBlock: boolean) {
  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsPage(props: {
  config: AppConfig | null;
  context: string;
  providerInfo: ProviderInfo;
  busy: boolean;
  onSave: (cfg: AppConfig, context: string) => Promise<void>;
  loadProviders: () => void;
  refreshOllamaModels: () => void;
}) {
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [draftContext, setDraftContext] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [savedContext, setSavedContext] = useState("");
  const [mode, setMode] = useState<"form" | "raw">("form");
  const [rawText, setRawText] = useState("");
  const [rawError, setRawError] = useState("");
  const [showPromptHints, setShowPromptHints] = useState(false);

  // Initialize draft from props (only when not dirty)
  const isDirtyRef = useRef(false);

  const isDirty = useMemo(() => {
    if (!draft) return false;
    return JSON.stringify(draft) !== savedSnapshot || draftContext !== savedContext;
  }, [draft, savedSnapshot, draftContext, savedContext]);

  isDirtyRef.current = isDirty;

  useNavigationBlocker(isDirty);

  useEffect(() => {
    if (props.config && !isDirtyRef.current) {
      setDraft(props.config);
      setSavedSnapshot(JSON.stringify(props.config));
      setRawText(JSON.stringify(props.config, null, 2));
    }
  }, [props.config]);

  useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftContext(props.context);
      setSavedContext(props.context);
    }
  }, [props.context]);

  // Mode switching
  function switchToRaw() {
    if (draft) setRawText(JSON.stringify(draft, null, 2));
    setRawError("");
    setMode("raw");
  }

  function switchToForm() {
    try {
      const parsed = JSON.parse(rawText) as AppConfig;
      setDraft(parsed);
      setRawError("");
      setMode("form");
    } catch (e: any) {
      setRawError(`Invalid JSON: ${e.message}`);
    }
  }

  // Save
  async function handleSave() {
    let cfg = draft!;
    if (mode === "raw") {
      try {
        cfg = JSON.parse(rawText) as AppConfig;
      } catch {
        return;
      }
    }
    await props.onSave(cfg, draftContext);
    setSavedSnapshot(JSON.stringify(cfg));
    setSavedContext(draftContext);
    setDraft(cfg);
  }

  // Draft helpers
  function patch(partial: Partial<AppConfig>) {
    setDraft((d) => d ? { ...d, ...partial } : d);
  }

  function patchHar(partial: Partial<AppConfig["har"]>) {
    setDraft((d) => d ? { ...d, har: { ...d.har, ...partial } } : d);
  }

  function patchProxy(partial: Partial<NonNullable<AppConfig["proxy"]>>) {
    setDraft((d) => d ? { ...d, proxy: { enabled: false, targetUrl: "", ...d.proxy, ...partial } } : d);
  }

  function patchBaseUrls(partial: Partial<NonNullable<AppConfig["providerBaseUrls"]>>) {
    setDraft((d) => d ? { ...d, providerBaseUrls: { ...d.providerBaseUrls, ...partial } } : d);
  }

  const rawJsonError = useMemo(() => {
    if (mode !== "raw") return "";
    try { JSON.parse(rawText); return ""; } catch (e: any) { return `Invalid JSON: ${e.message}`; }
  }, [rawText, mode]);

  if (!draft) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Loading settings…
      </div>
    );
  }

  const providerNames = Object.keys(props.providerInfo.providers ?? { openai: {}, anthropic: {}, ollama: {}, none: {} });
  const currentProvider = props.providerInfo.providers?.[draft.aiProvider ?? "openai"];
  const modelOptions = currentProvider?.models ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
          {isDirty && <p className="text-[11px] text-amber-400">Unsaved changes</p>}
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={mode === "raw" ? switchToForm : undefined}
              className={`px-3 py-1.5 transition-colors ${mode === "form" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800"}`}
            >
              Form
            </button>
            <button
              type="button"
              onClick={mode === "form" ? switchToRaw : undefined}
              className={`px-3 py-1.5 transition-colors ${mode === "raw" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800"}`}
            >
              Raw
            </button>
          </div>
          {rawError && <p className="text-xs text-rose-400">{rawError}</p>}
          <button
            onClick={handleSave}
            disabled={!isDirty || props.busy || (mode === "raw" && !!rawJsonError)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      {/* Raw mode */}
      {mode === "raw" && (
        <div className="space-y-2">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="h-[32rem] w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
          />
          {rawJsonError
            ? <p className="text-xs text-rose-400">{rawJsonError}</p>
            : <p className="text-xs text-emerald-400">JSON valid</p>
          }
          {/* Context always visible */}
          <Section title="Context">
            <p className="mb-3 text-[11px] text-zinc-400">
              Augment the AI prompt with special instructions about what you expect in replies — in general or for specific endpoints.
            </p>
            <textarea
              value={draftContext}
              onChange={(e) => setDraftContext(e.target.value)}
              className="h-48 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
            />
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] text-zinc-500 space-y-1.5">
              <p className="text-zinc-400 font-medium mb-1">Examples</p>
              <p>When returning multiple entities, return at least 10 unless a query parameter hints you otherwise.</p>
              <p>For the /api/chat endpoint, don't just repeat the same thing as the assistant. Find a meaningful reply.</p>
            </div>
          </Section>
        </div>
      )}

      {/* Form mode */}
      {mode === "form" && (
        <div className="space-y-4">

          {/* General */}
          <Section title="General">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="App name">
                <input
                  type="text"
                  value={draft.appName}
                  onChange={(e) => patch({ appName: e.target.value })}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="OpenAPI mode" hint="off — ignore spec · assist — use as hint · strict — only allow spec paths">
                <SelectField value={draft.openApiMode} onChange={(v) => patch({ openApiMode: v as AppConfig["openApiMode"] })}>
                  <option value="off">off</option>
                  <option value="assist">assist</option>
                  <option value="strict">strict</option>
                </SelectField>
              </Field>
            </div>
          </Section>

          {/* AI Generation */}
          <Section title="AI Generation">
            <div className="space-y-4">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={draft.aiEnabled}
                  onChange={(e) => patch({ aiEnabled: e.target.checked })}
                />
                Enable AI generation for unmatched requests
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="AI Provider">
                  <SelectField
                    value={draft.aiProvider ?? "openai"}
                    onChange={(v) => patch({ aiProvider: v as AppConfig["aiProvider"] })}
                    disabled={!draft.aiEnabled}
                  >
                    {providerNames.map((p) => (
                      <option key={p} value={p} disabled={props.providerInfo.providers?.[p]?.disabled}>
                        {p}
                      </option>
                    ))}
                  </SelectField>
                </Field>

                <Field label="Model">
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <SelectField
                        value={draft.aiModel ?? ""}
                        onChange={(v) => patch({ aiModel: v })}
                        disabled={!draft.aiEnabled}
                      >
                        {modelOptions.length > 0
                          ? modelOptions.map((m) => <option key={m} value={m}>{m}</option>)
                          : <option value={draft.aiModel ?? ""}>{draft.aiModel ?? "(no models)"}</option>
                        }
                      </SelectField>
                    </div>
                    {draft.aiProvider === "ollama" && (
                      <button
                        onClick={props.refreshOllamaModels}
                        disabled={props.busy}
                        title="Refresh Ollama models"
                        className="rounded-lg border border-zinc-700 px-2 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </Field>
              </div>

              {/* API key status */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-400 space-y-1">
                <div>
                  OpenAI key:{" "}
                  <span className="text-zinc-200">{props.providerInfo.providers?.openai?.apiKeyPreview ?? "not set"}</span>
                  {props.providerInfo.providers?.openai?.apiKeyHint && (
                    <span className="ml-2">{props.providerInfo.providers.openai.apiKeyHint}</span>
                  )}
                </div>
                <div>
                  Anthropic key:{" "}
                  <span className="text-zinc-200">{props.providerInfo.providers?.anthropic?.apiKeyPreview ?? "not set"}</span>
                  {props.providerInfo.providers?.anthropic?.apiKeyHint && (
                    <span className="ml-2">{props.providerInfo.providers.anthropic.apiKeyHint}</span>
                  )}
                </div>
              </div>

              <AdvancedSection label="AI settings">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Seed (optional)" hint="Leave blank for random. Set for deterministic output.">
                    <input
                      type="number"
                      value={draft.aiSeed !== undefined && draft.aiSeed !== null ? String(draft.aiSeed) : ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        patch({ aiSeed: v === "" ? undefined : parseInt(v, 10) });
                      }}
                      placeholder="e.g. 42"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Temperature (optional)" hint="Leave blank for provider default · 0 = deterministic · 0.7 = balanced · 1+ = creative">
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={draft.aiTemperature !== undefined && draft.aiTemperature !== null ? String(draft.aiTemperature) : ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        patch({ aiTemperature: v === "" ? undefined : parseFloat(v) });
                      }}
                      placeholder="e.g. 0.7"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={draft.aiStorePrompt ?? false}
                    onChange={(e) => patch({ aiStorePrompt: e.target.checked })}
                  />
                  Store AI prompt with saved generated variants
                </label>

                <div className="space-y-2">
                  <Field label="OpenAI base URL">
                    <input
                      type="text"
                      value={draft.providerBaseUrls?.openai ?? "https://api.openai.com/v1"}
                      onChange={(e) => patchBaseUrls({ openai: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Anthropic base URL">
                    <input
                      type="text"
                      value={draft.providerBaseUrls?.anthropic ?? "https://api.anthropic.com"}
                      onChange={(e) => patchBaseUrls({ anthropic: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Ollama base URL">
                    <input
                      type="text"
                      value={draft.providerBaseUrls?.ollama ?? "http://127.0.0.1:11434"}
                      onChange={(e) => patchBaseUrls({ ollama: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <button
                    onClick={props.loadProviders}
                    type="button"
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
                  >
                    Refresh provider / model list
                  </button>
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <label className="text-xs text-zinc-400">AI Prompt Template (optional)</label>
                    <button
                      type="button"
                      onClick={() => setShowPromptHints((v) => !v)}
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                    >
                      {showPromptHints ? "Hide hints" : "Hints"}
                    </button>
                  </div>
                  {showPromptHints && (
                    <div className="mb-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-[11px] text-zinc-300 space-y-0.5">
                      {[
                        ["{{method}}", "HTTP method (GET, POST…)"],
                        ["{{path}}", "Request path"],
                        ["{{query_json}}", "Query params as JSON"],
                        ["{{body_json}}", "Request body as JSON"],
                        ["{{headers_json}}", "Request headers as JSON"],
                        ["{{context}}", "Current context text (truncated)"],
                        ["{{similar_examples_json}}", "Similar endpoint examples as JSON"],
                        ["{{datetime_iso}}", "Current ISO datetime"],
                        ["{{date}}", "Current date (YYYY-MM-DD)"],
                      ].map(([token, desc]) => (
                        <div key={token}><code>{token}</code> {desc}</div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={draft.aiPromptTemplate ?? ""}
                    onChange={(e) => patch({ aiPromptTemplate: e.target.value || undefined })}
                    placeholder="Use placeholders like {{method}}, {{path}}, {{context}}…"
                    className="h-36 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
                  />
                </div>
              </AdvancedSection>
            </div>
          </Section>

          {/* Proxy / Record */}
          <Section title="Proxy / Record">
            <div className="space-y-4">
              <Field label="Target URL">
                <input
                  type="url"
                  value={draft.proxy?.targetUrl ?? ""}
                  onChange={(e) => patchProxy({ targetUrl: e.target.value })}
                  placeholder="https://example.com/myapp"
                  className={INPUT_CLS}
                />
              </Field>
              <p className="text-[11px] text-zinc-500">
                All requests are forwarded to the target. API-like requests are recorded using the same filters as HAR upload.
                The target's path prefix is stripped — e.g. target <code>https://example.com/myapp</code> records <code>/api/users</code>, not <code>/myapp/api/users</code>.
                When proxy mode is off, the server resumes normal mock-matching and AI generation.
              </p>
            </div>
          </Section>

          {/* Context */}
          <Section title="Context">
            <p className="mb-3 text-[11px] text-zinc-400">
              Augment the AI prompt with special instructions about what you expect in replies — in general or for specific endpoints.
            </p>
            <textarea
              value={draftContext}
              onChange={(e) => setDraftContext(e.target.value)}
              className="h-48 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
            />
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] text-zinc-500 space-y-1.5">
              <p className="text-zinc-400 font-medium mb-1">Examples</p>
              <p>When returning multiple entities, return at least 10 unless a query parameter hints you otherwise.</p>
              <p>For the /api/chat endpoint, don't just repeat the same thing as the assistant. Find a meaningful reply.</p>
            </div>
          </Section>

          {/* Advanced */}
          <Section title="Advanced">
            <p className="text-[11px] text-zinc-500 mb-2">
              Filtering, matching, and privacy settings for power users.
            </p>

            <AdvancedSection label="matching &amp; privacy">
              <Field label="Ignored query params" hint="Query params stripped before request matching (e.g. cache-busting params).">
                <PillInput
                  value={draft.ignoredQueryParams}
                  onChange={(v) => patch({ ignoredQueryParams: v })}
                />
              </Field>
              <Field label="Redact headers" hint="Header names redacted from stored request snapshots.">
                <PillInput
                  value={draft.redactHeaders}
                  onChange={(v) => patch({ redactHeaders: v })}
                />
              </Field>
              <Field label="Redact body keys" hint="JSON body keys redacted from stored request snapshots.">
                <PillInput
                  value={draft.redactBodyKeys}
                  onChange={(v) => patch({ redactBodyKeys: v })}
                />
              </Field>
            </AdvancedSection>

            <AdvancedSection label="HAR filtering">
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={draft.har.onlyApiCalls}
                    onChange={(e) => patchHar({ onlyApiCalls: e.target.checked })}
                  />
                  Only import API-like calls (skip pages, assets, etc.)
                </label>
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={draft.har.requireJsonResponse}
                    onChange={(e) => patchHar({ requireJsonResponse: e.target.checked })}
                  />
                  Require JSON response (skip non-JSON entries)
                </label>
              </div>

              <Field label="Exclude extensions" hint="File extensions to skip when importing HAR entries.">
                <PillInput
                  value={draft.har.excludeExtensions}
                  onChange={(v) => patchHar({ excludeExtensions: v })}
                />
              </Field>
              <Field label="Exclude MIME types" hint="Response content types to skip when importing.">
                <PillInput
                  value={draft.har.excludeMimeTypes}
                  onChange={(v) => patchHar({ excludeMimeTypes: v })}
                />
              </Field>
              <Field label="Path allowlist" hint="Only import entries whose path matches one of these prefixes. Empty = allow all.">
                <PillInput
                  value={draft.har.pathAllowlist}
                  onChange={(v) => patchHar({ pathAllowlist: v })}
                  placeholder="e.g. /api/"
                />
              </Field>
              <Field label="Path denylist" hint="Skip entries whose path matches one of these prefixes.">
                <PillInput
                  value={draft.har.pathDenylist}
                  onChange={(v) => patchHar({ pathDenylist: v })}
                  placeholder="e.g. /static/"
                />
              </Field>
              <Field label="Ignore patterns" hint="Regex patterns — entries matching any pattern are skipped.">
                <PillInput
                  value={draft.har.ignorePatterns}
                  onChange={(v) => patchHar({ ignorePatterns: v })}
                  placeholder="e.g. /health"
                />
              </Field>
            </AdvancedSection>
          </Section>
        </div>
      )}

    </div>
  );
}
