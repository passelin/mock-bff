# Changelog

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
