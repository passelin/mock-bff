import { RefreshCw } from "lucide-react";
import { Card } from "../components/Card";
import type { ProviderInfo } from "../types";

export function SettingsPage(props: {
  busy: boolean;
  configError: string;
  saveConfig: () => void;
  getAiStorePrompt: () => boolean;
  setAiStorePrompt: (v: boolean) => void;
  providerInfo: ProviderInfo;
  providerName: string;
  setProviderName: (v: string) => void;
  providerModel: string;
  setProviderModel: (v: string) => void;
  openaiBaseUrl: string;
  setOpenaiBaseUrl: (v: string) => void;
  anthropicBaseUrl: string;
  setAnthropicBaseUrl: (v: string) => void;
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (v: string) => void;
  loadProviders: () => void;
  refreshOllamaModels: () => void;
  showPromptHints: boolean;
  setShowPromptHints: (v: boolean) => void;
  promptTemplate: string;
  setPromptTemplate: (v: string) => void;
  configText: string;
  setConfigText: (v: string) => void;
  context: string;
  setContext: (v: string) => void;
  saveContext: () => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Runtime Config" subtitle="Live config editor (AI mode, seeds, redaction, openapi mode)." actions={<button onClick={props.saveConfig} disabled={props.busy || !!props.configError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save config</button>}>
        <label className="mb-3 inline-flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={props.getAiStorePrompt()} onChange={(e) => props.setAiStorePrompt(e.target.checked)} />
          Store AI generation prompt with saved generated variants (off by default)
        </label>

        <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-zinc-400">AI Provider</p>
            <select value={props.providerName} onChange={(e) => props.setProviderName(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
              {Object.entries(props.providerInfo.providers ?? { openai: {}, anthropic: {}, ollama: {}, none: {} }).map(([p, info]) => (
                <option key={p} value={p} disabled={info.disabled}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-400">Model</p>
            <div className="flex gap-1">
              <select value={props.providerModel} onChange={(e) => props.setProviderModel(e.target.value)} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
                {(props.providerInfo.providers?.[props.providerName]?.models ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {props.providerName === "ollama" && (
                <button onClick={props.refreshOllamaModels} disabled={props.busy} title="Refresh Ollama models" className="rounded-xl border border-zinc-700 px-2 hover:bg-zinc-800 disabled:opacity-50">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2">
          <label className="text-xs text-zinc-400">OpenAI Base URL
            <input value={props.openaiBaseUrl} onChange={(e) => props.setOpenaiBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
          </label>
          <label className="text-xs text-zinc-400">Anthropic Base URL
            <input value={props.anthropicBaseUrl} onChange={(e) => props.setAnthropicBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
          </label>
          <label className="text-xs text-zinc-400">Ollama Base URL
            <input value={props.ollamaBaseUrl} onChange={(e) => props.setOllamaBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
          </label>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-400 space-y-1">
            <div>OpenAI key: <span className="text-zinc-200">{props.providerInfo.providers?.openai?.apiKeyPreview ?? 'not set'}</span></div>
            <div>{props.providerInfo.providers?.openai?.apiKeyHint ?? 'Set OPENAI_API_KEY in your shell before starting dev.'}</div>
            <div className="pt-1">Anthropic key: <span className="text-zinc-200">{props.providerInfo.providers?.anthropic?.apiKeyPreview ?? 'not set'}</span></div>
            <div>{props.providerInfo.providers?.anthropic?.apiKeyHint ?? 'Set ANTHROPIC_API_KEY in your shell before starting dev.'}</div>
          </div>
          <div>
            <button onClick={props.loadProviders} type="button" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">Refresh provider/model list</button>
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-xs text-zinc-400">AI Prompt Template (optional)</p>
            <button type="button" onClick={() => props.setShowPromptHints(!props.showPromptHints)} className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800">
              {props.showPromptHints ? 'Hide hints' : 'Hint'}
            </button>
          </div>

          {props.showPromptHints ? (
            <div className="mb-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-[11px] text-zinc-300 space-y-1">
              <div><code>{'{{method}}'}</code> HTTP method (e.g. GET, POST)</div>
              <div><code>{'{{path}}'}</code> Request path</div>
              <div><code>{'{{query_json}}'}</code> Query parameters as JSON</div>
              <div><code>{'{{body_json}}'}</code> Request body as JSON</div>
              <div><code>{'{{headers_json}}'}</code> Request headers as JSON</div>
              <div><code>{'{{context}}'}</code> Current context text (truncated)</div>
              <div><code>{'{{similar_examples_json}}'}</code> Similar endpoint examples as JSON</div>
              <div><code>{'{{datetime_iso}}'}</code> Current ISO datetime</div>
              <div><code>{'{{date}}'}</code> Current date (YYYY-MM-DD)</div>
            </div>
          ) : null}

          <textarea value={props.promptTemplate} onChange={(e) => props.setPromptTemplate(e.target.value)} placeholder={"Use placeholders like {{method}}, {{path}}, {{query_json}}, {{body_json}}, {{headers_json}}, {{context}}, {{similar_examples_json}}, {{datetime_iso}}, {{date}}"} className="h-36 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
        </div>

        <textarea value={props.configText} onChange={(e) => props.setConfigText(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
        {props.configError ? <p className="mt-2 text-xs text-rose-400">{props.configError}</p> : <p className="mt-2 text-xs text-emerald-400">JSON valid</p>}
      </Card>
      <Card title="Context" subtitle="Continuously updated generation context." actions={<button onClick={props.saveContext} disabled={props.busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save context</button>}>
        <textarea value={props.context} onChange={(e) => props.setContext(e.target.value)} className="h-80 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs" />
      </Card>
    </div>
  );
}
