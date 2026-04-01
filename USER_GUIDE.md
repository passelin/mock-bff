# mock-bff User Guide

A practical guide for running and using `mock-bff` for UI development.

## 1) Start the server

```bash
npm install
npm run build
mock-bff --port 8787
```

Admin UI:

- `http://localhost:8787/-/admin`

## 2) Import data

You have two options for populating mocks:

### Option A — HAR upload

In Dashboard:

1. Upload a HAR file
2. Optionally upload an OpenAPI file

The server imports API-like calls and stores variants under `mocks/`.

### Option B — Proxy / record mode

Skip the HAR export entirely and capture live traffic directly:

1. Open Admin → **Settings** → **Proxy / Record** card
2. Enter the **Target URL** of the real upstream server, including any path prefix (e.g. `https://api.example.com/myapp`)
3. Click **Save**
4. Click the **Record** button in the top bar — it turns red and pulses while active
5. Use your frontend normally — every API-like response is saved as a variant in real time
6. Click **Recording** to stop; the server resumes normal mock-matching and AI generation

**Path prefix stripping:** the target's path prefix is removed from recorded paths. With target `https://api.example.com/myapp`, a request arriving at `/api/users` is forwarded to `https://api.example.com/myapp/api/users` but stored as `/api/users` — matching how your frontend calls mock-bff directly.

The **Record** button only appears in the top bar when a target URL is configured. Requests proxied in record mode appear in the **Logs** route with a red `proxied` badge.

## 3) Point your frontend to mock-bff

Use the mock-bff base URL directly:

```txt
http://localhost:8787
```

Example endpoint:

- `GET /api/user/plans` -> `http://localhost:8787/api/user/plans`

Admin APIs are under:

- `/-/api/*`

## 4) Manage endpoints and variants

- **Endpoints route**: search/select/delete endpoint groups; import a HAR file directly from this page
- **Variants route**: create endpoint+variant, pick endpoint, edit variant, delete variant
- If an endpoint has one variant, it auto-selects in editor

### Variant editor — search and replace

Click the **replace icon** (⇄) in the Variant Editor card header to open a search/replace bar. Type a search string to see the match count, enter a replacement string and click **Replace all** to apply. Useful for bulk-editing IDs, hostnames, or field values across a large JSON body.

### Force a variant

Pin a specific variant so it is always returned for an endpoint regardless of the incoming request body or query:

1. Open the **Variants** route and select an endpoint
2. Click the **pin** icon on any variant row — the row highlights in amber and a "forced" badge appears
3. Click the **pin-off** icon on a forced variant to clear it

API: `PUT /-/api/variant/force` `{ method, path, id }` — pass `id: null` to clear.

Only one variant per endpoint can be forced at a time.

### Disable fuzzy matching for an endpoint

By default, if no exact variant matches an incoming request, mock-bff tries a fuzzy match (body-key overlap ≥ 40%). To require an exact match instead (falling back to default/AI generation on misses):

1. Select an endpoint in the **Variants** route
2. Click the **Fuzzy on** button in the Variants card header — it turns amber and reads **Fuzzy off**

Useful when you have many variants with similar body shapes and want AI to generate fresh responses for new inputs rather than returning a close-but-wrong variant.

API: `PUT /-/api/endpoint/fuzzy` `{ method, path, disabled: true|false }`

## 5) Logs and misses

- **Logs route** shows request table with fixed headers
- Misses are shown in separate panel
- When `aiStorePrompt=true`, generated rows include a prompt-view icon

## 6) AI providers

### OpenAI

```bash
export OPENAI_API_KEY=...
# optional
export OPENAI_BASE_URL=https://api.openai.com/v1
mock-bff --provider openai --model gpt-5.4-mini
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=...
# optional
export ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
mock-bff --provider anthropic --model claude-3-5-sonnet-latest
```

### Ollama

```bash
# optional (defaults to http://127.0.0.1:11434)
export OLLAMA_BASE_URL=http://localhost:11434
mock-bff --provider ollama --model llama3.1:8b
# optional CLI override
mock-bff --provider ollama --model llama3.1:8b --ollama-base-url http://localhost:11434
```

### None (deterministic fallback only)

```bash
mock-bff --provider none
```

## 7) Useful settings in admin config

- `aiEnabled`: enable/disable generation
- `aiProvider`: `openai | anthropic | ollama | none`
- `aiModel`: provider model string
- `aiStorePrompt`: store prompt with generated variants (default false)
- `openApiMode`: `off | assist | strict`
- `har.*`: import/runtime filtering controls
  - `har.ignorePatterns`: glob-like path patterns to exclude (e.g. `/.well-known/*`)
  - `har.excludeMimeTypes`: response content-types to skip (default: `["text/html"]`)
  - `har.excludeExtensions`, `har.pathAllowlist`, `har.pathDenylist`, `har.onlyApiCalls`
- `proxy.enabled`: toggle proxy / record mode on or off
- `proxy.targetUrl`: upstream URL to proxy to (enables the **Record** button in the top bar)
- `aiPromptTemplate`: optional template editable in Admin Settings

## 8) Troubleshooting

- 404 for `/favicon.ico` and other assets is expected (non-API requests are rejected)
- If endpoint exists but app misses, verify request method/path/query/body signature
- If browser downloads unexpectedly, ensure stale transport headers are not persisted (handled by current ingest/replay sanitization)
- **Proxy returns 502**: the upstream URL is unreachable — check the target URL and network connectivity
- **Proxy records nothing**: the upstream responses may be filtered out by `har.excludeMimeTypes`, `har.excludeExtensions`, or `har.requireJsonResponse` — check the filters in Settings and watch the Logs route for `proxied` entries
