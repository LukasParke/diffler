# Diffler

Self-contained monorepo for generating animated GitHub profile READMEs with live stats collection and Remotion rendering.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@lukasparke/diffler` | [`packages/diffler`](packages/diffler) | CLI and GitHub Action for collecting GitHub stats and rendering profile READMEs from Nunjucks templates. |
| `@lukasparke/diffler-remotion` | [`packages/remotion`](packages/remotion) | Remotion components and renderer for generating animated WebP/GIF assets from collected stats. |
| `@lukasparke/diffler-schemas` | [`packages/schemas`](packages/schemas) | Shared TypeScript and Zod contract for stats producers and consumers. |

## Quick Start

```bash
# Install all workspace dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm build

# Run diffler CLI
pnpm diffler -- collect --config .github/diffler.yml

# Run tests across all packages
pnpm test
```

## Workspaces

This monorepo uses pnpm workspaces. Each package in `packages/` has its own `package.json`, build system, and tests.

```bash
# Build a specific package
pnpm --filter @lukasparke/diffler build
pnpm --filter @lukasparke/diffler-remotion build

# Test a specific package
pnpm --filter @lukasparke/diffler test
pnpm --filter @lukasparke/diffler-remotion test
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
3. **@lukasparke/diffler-remotion** reads the JSON and renders animated profile cards

## GitHub Actions

Workflows are in `.github/workflows/`:

- `ci.yml` — Verifies every pull request and push to `main`
- `release.yml` — Publishes version tags to npm
- `render-video.yml` — Renders WebP/GIF assets and publishes to GitHub Pages
- `update-readme-example.yml` — Updates the README example in this repo

## License

MIT
