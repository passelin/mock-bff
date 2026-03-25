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

In Dashboard:

1. Upload a HAR file
2. Optionally upload an OpenAPI file

The server imports API-like calls and stores variants under `mocks/`.

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

- **Endpoints route**: search/select/delete selected endpoint groups
- **Variants route**: create endpoint+variant, pick endpoint, edit variant, delete variant
- If an endpoint has one variant, it auto-selects in editor

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
  - includes `har.ignorePatterns` (e.g. `/.well-known/*`)
- `aiPromptTemplate`: optional template editable in Admin Settings

## 8) Troubleshooting

- 404 for `/favicon.ico` and other assets is expected (non-API requests are rejected)
- If endpoint exists but app misses, verify request method/path/query/body signature
- If browser downloads unexpectedly, ensure stale transport headers are not persisted (handled by current ingest/replay sanitization)
  persisted (handled by current ingest/replay sanitization)
