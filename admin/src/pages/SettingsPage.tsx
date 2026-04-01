import { ChevronDown, RefreshCw } from "lucide-react";
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
  aiSeed: string;
  setAiSeed: (v: string) => void;
  aiTemperature: string;
  setAiTemperature: (v: string) => void;
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
  proxyEnabled: boolean;
  setProxyEnabled: (v: boolean) => void;
  proxyTargetUrl: string;
  setProxyTargetUrl: (v: string) => void;
  saveProxyConfig: () => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Runtime Config" subtitle="Live config editor (AI mode, seeds, redaction, openapi mode)." actions={<button onClick={props.saveConfig} disabled={props.busy || !!props.configError} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save config</button>}>
        <label className="mb-3 inline-flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={props.getAiStorePrompt()} onChange={(e) => props.setAiStorePrompt(e.target.checked)} />
          Store AI generation prompt with saved generated variants (off by default)
        </label>

        <div className="mb-3 grid grid-cols-1 gap-3">
          <div>
            <p className="mb-1 text-xs text-zinc-400">AI Provider</p>
            <div className="relative">
              <select value={props.providerName} onChange={(e) => props.setProviderName(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 pr-8 text-xs text-zinc-100">
                {Object.entries(props.providerInfo.providers ?? { openai: {}, anthropic: {}, ollama: {}, none: {} }).map(([p, info]) => (
                  <option key={p} value={p} disabled={info.disabled}>{p}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-400">Model</p>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <select value={props.providerModel} onChange={(e) => props.setProviderModel(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 pr-8 text-xs text-zinc-100">
                  {(props.providerInfo.providers?.[props.providerName]?.models ?? []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                </div>
              </div>
              {props.providerName === "ollama" && (
                <button onClick={props.refreshOllamaModels} disabled={props.busy} title="Refresh Ollama models" className="rounded-xl border border-zinc-700 px-2 hover:bg-zinc-800 disabled:opacity-50">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400">
              Seed (optional)
              <input
                type="number"
                value={props.aiSeed}
                onChange={(e) => props.setAiSeed(e.target.value)}
                placeholder="e.g. 42"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs"
              />
            </label>
            <div className="mt-1 text-[11px] text-zinc-500">
              Leave blank for random
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400">
              Temperature (optional)
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={props.aiTemperature}
                onChange={(e) => props.setAiTemperature(e.target.value)}
                placeholder="e.g. 0.7"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs"
              />
            </label>
            <div className="mt-1 text-[11px] text-zinc-500">
              Leave blank for provider default · 0 = deterministic · 0.7 = balanced · 1+ = creative
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
      <Card
        title="Proxy / Record"
        subtitle="Forward requests to an upstream server and record matching responses."
        actions={
          <button
            onClick={props.saveProxyConfig}
            disabled={props.busy}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Save
          </button>
        }
      >
        {props.proxyEnabled && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Proxy mode is active — incoming requests are being forwarded and recorded.
          </div>
        )}
        <label className="mb-4 flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={props.proxyEnabled}
            onChange={(e) => props.setProxyEnabled(e.target.checked)}
          />
          Enable proxy / record mode
        </label>
        <label className="text-xs text-zinc-400">
          Target URL
          <input
            type="url"
            value={props.proxyTargetUrl}
            onChange={(e) => props.setProxyTargetUrl(e.target.value)}
            placeholder="https://example.com/myapp"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs"
          />
        </label>
        <p className="mt-2 text-[11px] text-zinc-500">
          All requests are forwarded to the target. API-like requests are recorded to storage using the same filters as HAR upload. The target's path prefix is stripped from recorded paths — e.g. a target of <code>https://example.com/myapp</code> records <code>/api/users</code>, not <code>/myapp/api/users</code>.
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          When proxy mode is off, the server resumes normal mock-matching and AI generation.
        </p>
      </Card>
    </div>
  );
}
