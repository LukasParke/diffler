# Diffler — Agent Guide

## Project Overview

Diffler is a Node.js/TypeScript CLI for generating GitHub profile READMEs from Nunjucks templates, with live data collection from the GitHub API.

It now fully incorporates the **stats-action** collection engine, providing:
- Sophisticated two-tier caching (stable + volatile with ETags)
- Runtime budget and rate-limit-aware request scheduling
- Resumable backfill queue for expensive REST operations
- Complete v2 JSON output schema matching stats-action

## Tech Stack

- **Runtime**: Node.js 20+ (ESM, `"type": "module"`)
- **Language**: TypeScript 5.7, strict mode
- **Build**: `tsc` → `dist/`
- **Tests**: Vitest (`npm test`)
- **Template Engine**: Nunjucks (Jinja2-compatible)
- **Config**: YAML with Zod validation, `.env` auto-loading, `${VAR}` resolution

## Key Commands

```bash
# Build
npm run build

# Tests
npm test

# CLI usage
node dist/cli.js init                    # Scaffold project
node dist/cli.js render                  # Render README
node dist/cli.js collect                 # Collect stats JSON (stats-action mode)
node dist/cli.js validate                # Validate config + templates
node dist/cli.js update                  # Render and commit
node dist/cli.js cache-clear             # Clear local cache
node dist/cli.js export-remotion         # Generate remotion input.json
```

## Architecture

### `src/stats/` — Stats-Action Engine (NEW)

This module ports all logic from the `stats-action` GitHub Action:

| File | Purpose |
|------|---------|
| `types.ts` | Complete v2 schema types (`GitHubStatsOutput`, `StableCache`, `VolatileCache`, etc.) |
| `cache.ts` | Two-tier cache with schema versioning, privacy sanitization, backfill state |
| `scheduler.ts` | `RequestScheduler` with runtime budget, rate-limit tracking, concurrency limits |
| `github.ts` | Collection engine: profile, repos, contributions, backfill queue |
| `aggregate.ts` | Stats computation: streaks, languages, repo stats, computed metrics |
| `output.ts` | `buildOutput()` — assembles v2 JSON with legacy aliases, presentation data, privacy report |
| `index.ts` | Main entry: `runStatsCollection()` orchestrates the full pipeline |

### `src/collectors/` — Legacy Collectors (DEPRECATED)

The original 14 individual collectors are retained for backward compatibility but will be removed in a future release. New code should use `src/stats/`.

### `src/core/` — Template Engine

- `engine.ts` — `Engine` class: render, validate, update
- `renderer.ts` — Nunjucks setup with custom helpers
- `context.ts` — `ContextBuilder`: runs collectors and builds template context

### `src/helpers/` — Nunjucks Helpers

- `badges.ts`, `filters.ts`, `integrations.ts`, `layout.ts`, `sources.ts`, `timefmt.ts`
- `remotion.ts` — Remotion GIF renderer integration

## Config Schema

```yaml
version: "1"

github:
  username: "your-username"
  token: "${GITHUB_TOKEN}"
  # Multi-profile support:
  # profiles:
  #   - username: "personal"
  #     token: "${GITHUB_TOKEN_PERSONAL}"
  #   - username: "work"
  #     token: "${GITHUB_TOKEN_WORK}"

templates:
  main: "profile.md.j2"
  directory: ".github/diffler"
  builtins: true

cache:
  enabled: true
  ttl: 3600

# Stats-action configuration
statsAction:
  outputPath: "github-user-stats.json"
  cachePath: ".github-profile-stats/cache.json"
  volatileCachePath: ".github-profile-stats/volatile-cache.json"
  maxRuntimeSeconds: 480
  graphqlConcurrency: 2
  restConcurrency: 4
  minGraphqlRemaining: 500
  minRestRemaining: 750
  includeTraffic: true
  includeRestRepoStats: true
  includePrivateRepositoryDetails: false
  includePrivateCacheDetails: false
  backfillMode: "resume"  # resume | refresh | off
```

Environment variable overrides (stats-action compatibility):
- `STATS_OUTPUT_PATH`, `STATS_CACHE_PATH`, `STATS_VOLATILE_CACHE_PATH`
- `STATS_MAX_RUNTIME_SECONDS`, `STATS_GRAPHQL_CONCURRENCY`, `STATS_REST_CONCURRENCY`
- `STATS_MIN_GRAPHQL_REMAINING`, `STATS_MIN_REST_REMAINING`
- `STATS_INCLUDE_TRAFFIC`, `STATS_INCLUDE_REST_REPO_STATS`
- `STATS_INCLUDE_PRIVATE_REPOSITORY_DETAILS`, `STATS_INCLUDE_PRIVATE_CACHE_DETAILS`
- `STATS_BACKFILL_MODE`

## Testing

```bash
npm test                    # Run all tests
npm test -- --reporter=verbose   # Verbose output
```

Tests are in `tests/` and `tests/stats/`.

## Important Notes

- **Nunjucks vs Jinja2**: ~95% compatible. Differences: `tojson` → `dump`, `~` string concat → `+`, no built-in `selectattr`/`list` filters.
- **All async**: Collectors, engine methods, and CLI handlers are async.
- **Rate limit skipping**: Optional collectors are skipped when `rateLimitRemaining < 500`.
- **Cache**: Two-tier — volatile `Map` + stable JSON file on disk.
- **Private repos**: Use `includePrivateRepositoryDetails: true` to include private repo metadata in output. Use `includePrivateCacheDetails: true` to cache private repo identifiers.
