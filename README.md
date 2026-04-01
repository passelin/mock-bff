# mock-bff

<img src="./admin/src/assets/bff_candy_heart.svg" alt="Mock BFF logo" width="180" />

Mock BFF server for UI development. Run frontend apps against realistic HTTP API responses without standing up backend environments.

Feed it a HAR recording, point it at a live upstream to record traffic in proxy mode, or upload an OpenAPI contract — it replays stored mocks and can generate realistic fallback responses using an AI provider.

## Features

- Replay HTTP API responses from HAR recordings
- **Proxy / record mode** — forward live traffic to an upstream and record API responses on the fly
- Filesystem-based mock storage (commit-friendly)
- Admin UI at `/-/admin` for managing endpoints and variants
- OpenAPI validation (assist and strict modes)
- AI fallback generation via OpenAI, Anthropic, or Ollama
- Live request/miss observability via SSE

## Install

```bash
npx @passelin/mock-bff
```

Or install globally:

```bash
npm install -g @passelin/mock-bff
mock-bff --help
```

## Quick start

```bash
# Start with no AI (pure HAR replay)
mock-bff --provider none

# Start with OpenAI fallback
export OPENAI_API_KEY=your_key
mock-bff --provider openai --model gpt-4o

# Start on a custom port
mock-bff --port 3001 --provider none
```

Then open `http://localhost:8787/-/admin` to import a HAR file and manage mocks.

## CLI options

```
-p, --port <number>              Server port (default: 8787)
-H, --host <host>                Server host (default: 0.0.0.0)
-r, --root <path>                Project root directory (default: cwd)
-a, --app-name <name>            App name label (default: local-app)
    --provider <name>            AI provider: openai|anthropic|ollama|none (default: openai)
    --model <id>                 AI model id (provider-specific)
    --openai-base-url <url>      OpenAI-compatible base URL override
    --anthropic-base-url <url>   Anthropic base URL override
    --ollama-base-url <url>      Ollama base URL (default: http://127.0.0.1:11434)
-h, --help                       Show help
```

## AI provider setup

### OpenAI

```bash
export OPENAI_API_KEY=your_key
mock-bff --provider openai --model gpt-4o
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=your_key
mock-bff --provider anthropic --model claude-3-5-sonnet-latest
```

### Ollama (local)

```bash
# default base URL is http://127.0.0.1:11434
mock-bff --provider ollama --model llama3.1:8b

# override base URL
mock-bff --provider ollama --model llama3.1:8b --ollama-base-url http://localhost:11434
```

### Disable AI generation

```bash
mock-bff --provider none
```

## Environment variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Required when using `--provider openai` |
| `ANTHROPIC_API_KEY` | Required when using `--provider anthropic` |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible base URL override |
| `ANTHROPIC_BASE_URL` | Optional Anthropic base URL override |
| `OLLAMA_BASE_URL` | Optional Ollama base URL override |
| `MOCK_MAX_UPLOAD_BYTES` | Upload size limit in bytes (default: 250MB) |
| `MOCK_MAX_REQUEST_LOGS` | Max request log entries kept in memory (default: 500) |

## Admin UI

Open `http://localhost:8787/-/admin` to:

- Import HAR files and OpenAPI contracts
- Browse and search endpoints
- Review and edit response variants
- Monitor live requests and misses
- Configure AI provider and prompt template

## Mock storage

Mocks are stored as JSON files under a `mocks/` directory in the project root (the directory where you run `mock-bff`). This makes them easy to commit alongside your frontend code.

```
mocks/
├── _meta/
│   ├── app.config.json     # Server configuration
│   ├── index.json          # Endpoint/variant index
│   └── context.md          # Optional AI context hints
├── GET/
│   └── api__orders/
│       └── default.json
└── POST/
    └── api__users/
        └── q_abc123__b_def456.json
```

## Proxy / record mode

Point mock-bff at a real upstream server to capture live traffic directly into mock storage, without exporting a HAR file from the browser.

1. Open Admin → **Settings** → **Proxy / Record** card
2. Enter the **Target URL** (e.g. `https://api.example.com/myapp`)
3. Click **Save**, then click **Record** in the top bar (or toggle *Enable proxy / record mode*)
4. Use your frontend normally — every API-like response is saved as a variant
5. Click **Recording** in the top bar to stop; mock-bff resumes normal mock-matching

**Path prefix stripping:** the target's path is removed from recorded paths. With target `https://api.example.com/myapp`, a request to `/api/users` is forwarded to `https://api.example.com/myapp/api/users` but recorded as `/api/users`.

The same HAR import filters apply — extensions, mime type deny list, path allow/deny lists, etc. Non-API traffic (e.g. HTML pages, images) is proxied but not recorded.

## Config highlights

Configuration is managed via the Admin UI Settings page or by editing `mocks/_meta/app.config.json` directly.

- `har.ignorePatterns`: glob-like path patterns to skip during HAR import and proxy recording (e.g. `/.well-known/*`)
- `har.onlyApiCalls`: skip non-API requests (assets, fonts, etc.) during import
- `har.excludeMimeTypes`: response content-types to skip (default: `["text/html"]`)
- `proxy.enabled`: activate proxy / record mode
- `proxy.targetUrl`: upstream URL to forward requests to
- `openApiMode`: `off` | `assist` | `strict` — controls OpenAPI validation behavior
- `aiPromptTemplate`: customize the AI generation prompt using placeholders:
  - `{{method}}`, `{{path}}`, `{{query_json}}`, `{{body_json}}`, `{{headers_json}}`
  - `{{context}}`, `{{similar_examples_json}}`, `{{datetime_iso}}`

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/-/api/health` | Server health and version |
| `GET` | `/-/api/config` | Read configuration |
| `PATCH` | `/-/api/config` | Update configuration |
| `GET` | `/-/api/providers` | List available AI providers and models |
| `POST` | `/-/api/har` | Import HAR file |
| `GET` | `/-/api/openapi` | Get current OpenAPI spec |
| `POST` | `/-/api/openapi` | Upload OpenAPI spec |
| `DELETE` | `/-/api/openapi` | Remove OpenAPI spec |
| `GET` | `/-/api/endpoints` | List all endpoints |
| `DELETE` | `/-/api/endpoint` | Delete a single endpoint (`?method=GET&path=/api/x`) |
| `DELETE` | `/-/api/endpoints` | Delete all endpoints |
| `GET` | `/-/api/variants` | List variants for an endpoint |
| `GET` | `/-/api/variant` | Get a single variant |
| `PUT` | `/-/api/variant` | Create or update a variant |
| `DELETE` | `/-/api/variant` | Delete a variant |
| `GET` | `/-/api/requests` | Request log |
| `DELETE` | `/-/api/requests` | Clear request log |
| `GET` | `/-/api/misses` | Unmatched request log |
| `DELETE` | `/-/api/misses` | Clear misses log |
| `GET` | `/-/api/context` | Get AI context |
| `PUT` | `/-/api/context` | Update AI context |
| `GET` | `/-/api/events` | SSE stream for live UI updates |

## Development

```bash
git clone https://github.com/passelin/mock-bff.git
cd mock-bff
npm install
npm run build:admin
npm test
npm run dev
```

## License

MIT
