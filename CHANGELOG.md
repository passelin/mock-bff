# Changelog

## [0.5.2] - 2026-03-29

### Changed
- `DEFAULT_PROMPT_TEMPLATE` exported from `ai.ts` and reused in `storage.ts`, removing the duplicate hardcoded copy from the default config

## [0.5.1] - 2026-03-28

### Fixed
- Variant rename on save no longer applies to manually-named variants (e.g. `v1`, `default_manual`); only auto-generated hash ids (`q_…__b_…`) are renamed when the request snapshot changes

## [0.5.0] - 2026-03-28

### Added
- Force variant: pin a specific variant per endpoint to always be returned regardless of request shape, with toggle UI in the variants panel
- AI generation seed and temperature are now configurable in the settings UI; both default to the provider's own default when left blank
- Endpoints table now shows a "Hits" column with the count from recent request logs

### Changed
- Static AI system instructions moved to a hardcoded system prompt, separate from the user-configurable prompt template
- Variant editor strips `requestSignature` and `meta` (read-only fields); server preserves and rebuilds them on save, renaming the variant file when the request snapshot changes
- Logs tab moved after OpenAPI in the navigation

## [0.4.6] - 2026-03-26

### Fixed
- Regenerated `package-lock.json` with `--legacy-peer-deps` to match CI install strategy and fix `npm ci` failure in publish workflow

## [0.4.5] - 2026-03-26

### Fixed
- Regenerated `package-lock.json` to fix `npm ci` failure in publish workflow

## [0.4.4] - 2026-03-26

### Changed
- Settings UI: AI Provider and Model selects each on their own full-width row
- Settings UI: improved select appearance with custom aligned caret icon

## [0.4.3] - 2026-03-26

### Fixed
- Served admin UI from packaged `admin/dist` when running via `npx` and the selected `--root` does not contain an admin build

## [0.4.2] - 2026-03-26

### Fixed
- Synced `package-lock.json` with `package.json` to fix `npm ci` failure in the publish workflow

## [0.4.1] - 2026-03-26

### Added
- Automated npm publish via GitHub Actions on release
- `prebuild` script to clean `dist/` before every build

### Changed
- Hover animation on candy heart logo
- Improved `npm run dev` workflow: admin UI auto-rebuilds via `vite build --watch`
- Added `dev:server` script for backend-only development

## [0.4.0] - 2026-03-25

### Changed
- Renamed package to `@passelin/mock-bff`
- Moved frontend-only dependencies (`react`, `react-dom`, `react-router-dom`, `lucide-react`, `swagger-ui-react`) to `devDependencies` — they are bundled into `admin/dist/` at build time and are not needed at runtime
- `npm run dev` now starts the backend and Vite in watch mode concurrently — admin UI rebuilds automatically on source changes

### Added
- `dev:server` script to run only the backend server during development

### Removed
- Deleted dead code: `src/admin-ui.ts` (legacy CDN-based admin UI, unused since v0.2.0)

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
- Publishable npm package (`@passelin/mock-bff`) with CLI bin (`mock-bff`)
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
- Confirm package name availability on npm (`@passelin/mock-bff`).
- Run:
  - `npm run build`
  - `npm test`
  - `npm run pack:check`
  - `npm publish --access public`
