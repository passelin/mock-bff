# CLAUDE.md

Agent instructions for working on this project.

## Project

`@passelin/mock-bff` — a CLI mock server for frontend development. Replays HAR recordings and generates AI fallback responses. Published to npm under the `@passelin` scope.

## Common commands

```bash
npm run dev          # Start backend + Vite watch (admin auto-rebuilds on change)
npm run dev:server   # Backend only
npm run build        # Clean build (clears dist/, compiles TS, builds admin)
npm test             # Run tests (vitest)
npm run pack:check   # Dry-run npm pack to verify tarball contents
```

## Release process

1. **Bump version** — use `npm version minor` or `npm version patch` (do not use `npm version major` without checking with the user)
   ```bash
   npm version minor --no-git-tag-version
   ```

2. **Update CHANGELOG.md** — add an entry under the new version with date `YYYY-MM-DD`

3. **Commit**
   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore(release): cut vX.Y.Z"
   ```

4. **Tag and push**
   ```bash
   git tag vX.Y.Z
   git push && git push origin vX.Y.Z
   ```

5. **Create a GitHub release** at https://github.com/passelin/mock-bff/releases pointing at the tag — the `publish.yml` workflow triggers automatically and publishes to npm.

> Do not run `npm publish` manually. Publishing is handled by GitHub Actions on release.

## Package notes

- The CLI binary is `mock-bff` (the bin key), the npm package name is `@passelin/mock-bff`
- Frontend deps (`react`, `react-dom`, etc.) are in `devDependencies` — they are bundled into `admin/dist/` at build time
- `dist/` and `admin/dist/` are gitignored but included in the npm package via the `files` field
- The `prebuild` script clears both `dist/` directories before every build to prevent stale artifacts
