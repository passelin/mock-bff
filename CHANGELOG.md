# Changelog

## [0.3.0] - 2026-03-22

### Added
- Anthropic and Ollama provider support alongside OpenAI/none
- Provider base URL overrides for OpenAI, Anthropic, and Ollama (env + CLI flags)
- UX upgrades: top navigation + responsive hamburger menu
- Endpoints bulk selection with delete-selected flow
- Variant/editor UX improvements (auto-select single variant, inline trash icons, endpoint subtitle ellipsis)
- Logs table with fixed headers and optional prompt dialog

### Changed
- Admin APIs moved under /-/api/* and mock runtime at root /*
- Context writing now records meaningful endpoint-family insights only

### Fixed
- HAR/replay header handling for transport/CORS safety
- Non-API requests (e.g. assets) return 404 instead of polluting misses

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-03-22

### Added
- Publishable npm package (`mock-bff`) with CLI bin (`mock-bff`)
- First-class admin app at `/-/admin` with routing
- Variant review/editor workflow
- Endpoint search + scrollable tables + clear endpoint/all actions
- HAR import filtering to API-like calls (XHR/fetch-style)
- OpenAPI assist/strict validation
- AI fallback generation via Vercel AI SDK (`@ai-sdk/openai`)
- GitHub Actions CI + Dependabot config

### CLI

```bash
mock-bff --help
mock-bff --port 8787 --provider openai --model gpt-5.4-mini
mock-bff --provider none
```

### Release checklist
- Set `repository`, `homepage`, and `bugs` fields in `package.json` after creating the GitHub repo.
- Confirm package name availability on npm (`mock-bff`).
- Run:
  - `npm run build`
  - `npm test`
  - `npm run pack:check`
  - `npm publish --access public`
