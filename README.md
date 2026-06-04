# Diffler Monorepo

Self-contained monorepo for generating animated GitHub profile READMEs with live stats collection and Remotion rendering.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `diffler` | [`packages/diffler`](packages/diffler) | CLI tool for collecting GitHub stats and rendering profile READMEs from Nunjucks templates. Includes the full stats-action collection engine. |
| `@diffler/remotion` | [`packages/remotion`](packages/remotion) | Remotion components and renderer for generating animated WebP/GIF assets from collected stats. |

## Quick Start

```bash
# Install all workspace dependencies
npm install --legacy-peer-deps

# Build all packages
npm run build

# Run diffler CLI
npm run diffler -- collect --config packages/diffler/.github/diffler.yml

# Run tests across all packages
npm test
```

## Workspaces

This monorepo uses npm workspaces. Each package in `packages/` has its own `package.json`, build system, and tests.

```bash
# Build a specific package
npm run build -w packages/diffler
npm run build -w packages/remotion

# Test a specific package
npm test -w packages/diffler
npm test -w packages/remotion
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   diffler CLI   │────▶│  github-user-    │────▶│  @diffler/      │
│  (stats-action  │     │  stats.json      │     │  remotion       │
│   engine)       │     │  (v2 schema)     │     │  (WebP/GIF)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **diffler** collects comprehensive GitHub stats via GraphQL + REST, with caching, rate-limit budgeting, and resumable backfill
2. The collected stats are written as JSON conforming to the v2 schema
3. **@diffler/remotion** reads the JSON and renders animated profile cards

## GitHub Actions

Workflows are in `.github/workflows/`:

- `diffler.yml` — Renders profile README daily
- `diffler-remotion.yml` — Renders README + generates remotion input
- `render-video.yml` — Renders WebP/GIF assets and publishes to GitHub Pages
- `update-readme-example.yml` — Updates the README example in this repo

## License

MIT
