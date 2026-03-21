# Mock BFF Server (Single-App v1)

A local Fastify server to replay SPA HTTP calls from HAR recordings, with optional OpenAPI validation and AI gap-filling.

## v1 capabilities

- Single-app runtime (no multi-app registry)
- HAR upload/import to filesystem-backed mock storage
- Layered matching: exact -> fuzzy -> default -> miss
- Query normalization (ignore configured params like cache-busters)
- Redaction pipeline on HAR ingest (headers + JSON keys)
- Miss logging (`mocks/_meta/misses.log.jsonl`)
- AI fallback generation on miss (auto-save generated variant)
- OpenAPI upload + configurable modes (validated with AJV):
  - `off`: no OpenAPI checks
  - `assist`: save response and annotate warnings
  - `strict`: reject invalid generated response (502)
- Local admin UI at `/admin`

## Tech stack

- Fastify
- TypeScript
- Vitest
- React + Tailwind (bundled admin app via Vite)
- Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- js-yaml + AJV (OpenAPI parsing + validation)

## Storage layout

```txt
mocks/
  _meta/
    app.config.json
    index.json
    context.md
    misses.log.jsonl
    openapi.json | openapi.yaml
  GET|POST|PUT|DELETE|.../
    <normalized-path>/
      default.json
      variants/
        q_<hash>__b_<hash>.json
```

Each stored variant includes:
- `requestSignature` (method/path/query/body hashes)
- `requestSnapshot` (normalized query + redacted body)
- response payload
- metadata (`source`, timestamp, notes)

## Install and run

```bash
cd ~/openclaw-code/mock-bff
npm install
npm run build:admin
npm run dev
```

Defaults:
- Port: `8787`
- Root dir: current working directory
- App name: `local-app`
- In-memory request log cap: `500` (override with `MOCK_MAX_REQUEST_LOGS`)

Override:

```bash
PORT=3001 MOCK_ROOT_DIR=/path/to/repo MOCK_APP_NAME=my-ui npm run dev
```

## API reference

### Admin routes

- `GET /admin` (bundled React admin app; run `npm run build:admin` first)
- `GET /admin/health`
- `GET /admin/config`
- `PATCH /admin/config`
- `POST /admin/har` (multipart `file`)
- `POST /admin/openapi` (multipart `file`)
- `GET /admin/endpoints`
- `GET /admin/variants?method=GET&path=/api/orders`
- `GET /admin/variant?method=GET&path=/api/orders&id=q_...__b_...`
- `PUT /admin/variant`
- `GET /admin/diagnostics?method=GET&path=/api/orders`
- `GET /admin/requests?limit=100` (in-memory rolling request logs)
- `GET /admin/misses`
- `GET /admin/context`
- `PUT /admin/context`
- `POST /admin/reindex`

### Runtime route

- `ALL /mock/*`

Runtime responses include `x-mock-match` to explain behavior:
- `exact`
- `fuzzy`
- `default`
- `generated`
- `generated-invalid`

## Config (`/admin/config`)

Example:

```json
{
  "appName": "demo-ui",
  "openApiMode": "assist",
  "aiEnabled": true,
  "aiSeed": 42,
  "aiModel": "gpt-4o-mini",
  "ignoredQueryParams": ["_", "cacheBust", "timestamp"],
  "redactHeaders": ["authorization", "cookie", "set-cookie", "x-api-key"],
  "redactBodyKeys": ["password", "token", "secret", "apiKey"]
}
```

## AI behavior

- Uses **Vercel AI SDK** (`generateText` + `@ai-sdk/openai`) for response generation
- Provider setup for OpenAI:
  - `OPENAI_API_KEY=...`
  - optional config: `aiModel` (default `gpt-5.4-mini`)
- If no key (or provider call fails): deterministic fallback generator returns stable synthetic JSON
- Generated response is auto-saved as a new variant

## Typical workflow

1. Start server
2. Open `http://localhost:8787/admin`
3. Upload HAR + optional OpenAPI contract
4. Point SPA API base URL to `http://localhost:8787/mock`
5. Exercise UI
6. Review misses and generated responses
7. Commit `mocks/` with your codebase

## Tests

Run:

```bash
npm test
```

Test coverage includes:
- HAR import + exact replay
- ignored query params matching behavior
- AI fallback generate-once autosave replay
- AI disabled miss behavior
- strict OpenAPI rejection behavior

## Notes / next iteration ideas

- Replace built-in admin HTML with richer React UI
- Add endpoint-level manual edit tools in admin
- Add optional scenario/stateful mocking mode
- Add request/response latency profiles and error injection
