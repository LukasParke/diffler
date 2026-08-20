# Diffler

Self-contained monorepo for generating animated GitHub profile READMEs with live stats collection and Remotion rendering.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@lukasparke/diffler` | [`packages/diffler`](packages/diffler) | CLI and GitHub Action for collecting GitHub stats and rendering profile READMEs from Nunjucks templates. |
| `@lukasparke/diffler-remotion` | [`packages/remotion`](packages/remotion) | Remotion components and renderer for generating animated WebP assets, with optional GIF output, from collected stats. |
| `@lukasparke/diffler-schemas` | [`packages/schemas`](packages/schemas) | Shared TypeScript and Zod contract for stats producers and consumers. |

## Quick Start

```bash
# Install all workspace dependencies
pnpm install --frozen-lockfile

# Run tests (resolves workspace sources directly; no build needed)
pnpm test

# Build all packages
pnpm build

# Run diffler CLI
pnpm diffler -- collect --config .github/diffler.yml
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
│   engine)       │     │  (v2 schema)     │     │    (WebP)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **diffler** collects comprehensive GitHub stats via GraphQL + REST and package install stats through registry adapters, writing the canonical v2 schema defined in `@lukasparke/diffler-schemas`
2. Provider-specific package data is normalized alongside GitHub data in the v2 JSON schema; multi-profile outputs are merged by the shared `mergeStatsOutputs` in the schemas package
3. **@lukasparke/diffler-remotion** validates the JSON against the shared Zod schema and renders animated profile cards

## Using the GitHub Action

The action runs a committed single-file bundle (`packages/diffler/dist-action/`), so consumer workflows need no install or build step. Because the action commits and pushes README updates, the consuming workflow needs:

```yaml
permissions:
  contents: write
```

The bundle is verified against its sources in CI; run `pnpm --filter @lukasparke/diffler build:action` after CLI changes and commit the result.

## Releasing

Package versions move in lockstep (enforced by `scripts/publish-release.mjs`):

```bash
node scripts/bump-version.mjs 1.0.0   # bumps all packages + refreshes the lockfile
git commit -am "release: v1.0.0" && git tag v1.0.0 && git push --tags
```

Pushing a `v*` tag runs the release workflow, which publishes all packages to npm.

## GitHub Actions

Workflows are in `.github/workflows/`:

- `ci.yml` — Verifies every pull request and push to `main`
- `release.yml` — Publishes version tags to npm
- `render-video.yml` — Renders WebP assets and publishes to GitHub Pages
- `update-readme-example.yml` — Updates the README example in this repo

## License

MIT
