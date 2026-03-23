# mock-bff

Mock BFF server for UI modernization.

Use HAR recordings + optional OpenAPI contracts to run frontend apps without standing up backend environments.

## Features

- Replay HTTP API responses from HAR
- Store mocks on filesystem (commit-friendly)
- Admin UI at `/-/admin` (React + Tailwind)
- Variant review/edit workflow
- Request/miss observability
- AI fallback generation via Vercel AI SDK (OpenAI provider)
- OpenAPI assist/strict validation modes

## Install

```bash
npm install
npm run build
```

Run locally:

```bash
npm start
# or
npm run dev
```

## CLI

After building, use the bin:

```bash
mock-bff --help
```

### CLI options

```txt
-p, --port <number>         Server port (default: 8787)
-H, --host <host>           Server host (default: 0.0.0.0)
-r, --root <path>           Project root directory (default: cwd)
-a, --app-name <name>       App name label (default: local-app)
    --provider <name>       AI provider: openai|none (default: openai)
    --model <id>            AI model id (default: gpt-5.4-mini)
-h, --help                  Show help
```

Examples:

```bash
mock-bff --port 8787 --provider openai --model gpt-5.4-mini
mock-bff --provider none
```

## AI provider setup

### OpenAI (via Vercel AI SDK)

```bash
export OPENAI_API_KEY=your_key
mock-bff --provider openai --model gpt-5.4-mini
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=your_key
mock-bff --provider anthropic --model claude-3-5-sonnet-latest
```

### Ollama (local)

```bash
# default base URL is http://127.0.0.1:11434/v1
mock-bff --provider ollama --model llama3.1:8b

# override with env var or CLI flag
export OLLAMA_BASE_URL=http://localhost:11434/v1
mock-bff --provider ollama --model llama3.1:8b
# or
mock-bff --provider ollama --model llama3.1:8b --ollama-base-url http://localhost:11434/v1
```

### Disable AI generation

```bash
mock-bff --provider none
```

## Admin UI

- URL: `http://localhost:8787/-/admin`
- Upload HAR/OpenAPI
- Browse endpoints
- Review/edit variants
- Clear single/all endpoints (with confirmation)

## Config highlights

- `har.ignorePatterns`: glob-like path patterns to skip (example: `/.well-known/*`)
- `aiPromptTemplate`: optional prompt template with placeholders:
  - `{{method}}`, `{{path}}`, `{{query_json}}`, `{{body_json}}`, `{{headers_json}}`, `{{context}}`, `{{similar_examples_json}}`, `{{datetime_iso}}`, `{{date}}`

## API endpoints

- `POST /-/api/har`
- `POST /-/api/openapi`
- `GET /-/api/endpoints`
- `DELETE /-/api/endpoint?method=GET&path=/api/orders`
- `DELETE /-/api/endpoints`
- `GET /-/api/variants?method=GET&path=/api/orders`
- `GET /-/api/variant?method=GET&path=/api/orders&id=q_...__b_...`
- `PUT /-/api/variant`
- `GET /-/api/requests?limit=100`
- `GET /-/api/misses`
- `ALL /*`

## Development

```bash
npm install
npm run build:admin
npm test
npm run dev
```

## Publish checklist

- `npm run build`
- `npm test`
- `npm pack`
- tag release + publish

## License

MIT
