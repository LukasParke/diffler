# Monorepo Review: Organization & Orchestration

## Executive Summary

The monorepo successfully houses both packages under one roof, but it currently operates more like two repos sharing a `package.json` than a unified system. The most critical issue is **two independent stats collection engines** that fetch the same GitHub APIs with different implementations, caching strategies, and output shapes. Below is a prioritized list of problems and concrete recommendations.

---

## 🔴 Critical Issues

### 1. Two Parallel Stats Collection Engines

You have **completely separate** implementations that hit the same GitHub GraphQL/REST endpoints:

| Aspect | `src/collectors/` (template pipeline) | `src/stats/` (stats-action pipeline) |
|--------|--------------------------------------|--------------------------------------|
| **Profile fetch** | `profileCollector` — basic query | `collectProfile()` — full query + activity counts |
| **Contributions** | `contributionsCollector` — 1 year | `collectContributionYears()` — multi-year with cache reuse |
| **Repositories** | `repositoriesCollector` — basic list | `collectRepositoryUniverse()` — 2-phase discovery + materialization |
| **Caching** | `StatsCache` (simple Map + JSON file) | Two-tier stable + volatile cache with privacy sanitization |
| **Rate limiting** | Hardcoded `ctx.rateLimitRemaining < 500` | `RequestScheduler` with runtime budgets, retry logic, concurrency pools |
| **Backfill** | None | `buildBackfillQueue()` + `processBackfillQueue()` for REST metrics |
| **Output** | Flat context object for Nunjucks | `GitHubStatsOutput` v2 schema with legacy aliases |

**The pain:** Any bug fix, API change, or new data source requires changes in both places. The stats-action engine is significantly more robust (multi-year cache, rate limit budgeting, resumable backfill), but the template pipeline doesn't benefit from any of it.

**Recommendation:**
- Make `src/stats/` the **single source of truth** for all GitHub data collection.
- Refactor `ContextBuilder` to call `runStatsCollection()` and extract the flat context it needs from the v2 output.
- Deprecate and eventually delete the individual collectors (or turn them into thin wrappers that read from the unified output).
- This also eliminates the need for `src/collectors/v2Output.ts`, which is a second, incomplete implementation of the v2 schema builder.

### 2. Duplicate / Stale Lock Files

- `packages/diffler/package-lock.json` — **should not exist** in an npm workspace
- `packages/remotion/yarn.lock` — **leftover** from when remotion was a standalone yarn repo

In npm workspaces, the root `package-lock.json` is the only lockfile. The presence of `yarn.lock` causes confusion and potential resolution conflicts.

**Recommendation:**
```bash
rm packages/diffler/package-lock.json
rm packages/remotion/yarn.lock
rm packages/remotion/example/yarn.lock  # also stale
git add -A && git commit -m "chore: remove stale lockfiles"
```

### 3. Zod Version Conflict Forces `--legacy-peer-deps`

- `diffler` depends on `zod: ^3.24.0`
- `@diffler/remotion` depends on `zod: ^4.4.3` (and peerDepends `>=3.0.0`)

npm cannot satisfy both without `--legacy-peer-deps`, which masks real dependency problems.

**Recommendation:** Either:
- **A)** Upgrade diffler to zod 4 (zod 4 has a migration guide, mostly additive)
- **B)** Downgrade remotion to zod 3 (if remotion doesn't use v4-specific features)
- **C)** Move all shared schemas into a new `packages/schemas` package that uses zod 3, and have remotion import from there (remotion's zod usage is mostly for `@remotion/zod-types` which may require v4)

Option A is cleanest long-term.

### 4. Committed `.env` File

`packages/diffler/.env` is tracked in git. Environment files should never be committed.

**Recommendation:**
```bash
git rm --cached packages/diffler/.env
echo "packages/diffler/.env" >> .gitignore
```

---

## 🟡 Architectural Issues

### 5. No Shared Schema / Types Package

The v2 stats schema is defined in:
- `packages/diffler/src/stats/types.ts` (~576 lines, source of truth)
- `packages/remotion/src/data/schemas.ts` (~160 lines, Zod validation)
- `packages/remotion/src/data/adapter.ts` (~545 lines of defensive coercion to bridge the gap)

**The pain:** Any schema change (new field, renamed field) requires coordinated updates across three files in two packages. The adapter is 545 lines of `asNumber()`, `asString()`, `asRecord()` because the contract isn't type-safe.

**Recommendation:**
Create `packages/schemas` (or `packages/types`):
```
packages/
  schemas/
    src/
      index.ts          # Re-export everything
      v2.ts             # Core v2 schema types (shared between diffler + remotion)
      zod.ts            # Zod schemas for runtime validation
    package.json
```

Both `diffler` and `@diffler/remotion` add `"@diffler/schemas": "*"` as a dependency. This eliminates the adapter entirely — remotion receives already-validated, typed data.

### 6. ContextBuilder Mutates Config (Side Effects)

In `src/core/context.ts`:
```typescript
this.config.github.username = profile.username;  // MUTATION
this.config.github.token = profile.token;        // MUTATION
```

This is dangerous in concurrent or multi-profile scenarios.

**Recommendation:** Pass profile credentials as parameters instead of mutating shared state:
```typescript
private async buildSingleUser(templateSource: string, profile: GitHubProfileConfig): Promise<...> {
  const ctx = new CollectorContext(this.config, profile, this.cache);
  // ...
}
```

### 7. Engine Violates Single Responsibility

`Engine` currently does:
- **Orchestration**: `render()` calls ContextBuilder + Renderer
- **Git operations**: `update()` calls `commitAndPush()`
- **Validation**: `validate()` runs templates

**Recommendation:** Split into focused classes:
```typescript
// Orchestrator — pure business logic
class ProfileOrchestrator {
  async render(): Promise<string> { /* build context + render template */ }
  async validate(): Promise<void> { /* validate without side effects */ }
}

// Git driver — I/O side effects
class GitDriver {
  async commit(message: string, paths: string[]): Promise<void> {}
  hasChanges(path: string): boolean {}
}
```

### 8. Three Similar Remotion Export Commands

`diffler export-remotion`, `export-remotion-scenes`, `export-remotion-input` all:
1. Load config
2. Build renderer + engine
3. Build context
4. Extract stats
5. Write JSON

**Recommendation:** Unify into one command:
```bash
diffler export --target remotion  # writes input.json, scenes.json, etc.
diffler export --target remotion --format json
```

Or better: remove the CLI commands entirely and have the composite action call a single internal function that generates all remotion artifacts at once.

### 9. Unused Remotion Nunjucks Templates

`packages/diffler/templates/remotion/cards.json.j2` and `scenes.json.j2` exist but the actual generation is done in `src/helpers/remotion.ts`. These templates are dead code.

**Recommendation:** Delete them, or — if you want template-driven remotion config — actually use them via the Renderer and delete the TypeScript helpers. Pick one approach.

---

## 🟠 Tooling & DX Issues

### 10. Package Manager Schizophrenia

- Root uses **npm** (workspaces)
- `packages/remotion/package.json` has `yarn render:all`
- `packages/remotion/scripts/render-assets.mjs` calls `await run('yarn', [...])`
- `packages/remotion/README.md` says `yarn install --frozen-lockfile`
- `packages/remotion/example/package.json` references yarn

**Recommendation:** Standardize on npm everywhere:
```javascript
// render-assets.mjs
await run('npx', ['remotion', 'render', ...]);
```
```json
// remotion/package.json
"render:all": "node scripts/render-assets.mjs --formats=webp,gif"
```

### 11. Inconsistent TypeScript Configurations

| | diffler | remotion |
|--|---------|----------|
| target | ES2022 | ES2018 |
| module | NodeNext | commonjs |
| jsx | — | react-jsx |
| outDir | dist/ | dist/ |
| noEmit | false | true |

Since root `package.json` has `"type": "module"`, remotion's `commonjs` module target is inconsistent. Its `tsup` build produces ESM/CJS dual output, but the TypeScript checker is configured for CommonJS.

**Recommendation:** Align remotion's `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

### 12. Vitest Version Mismatch

- diffler: `vitest: ^3.0.0`
- remotion: `vitest: ^2.0.0`

**Recommendation:** Hoist a single vitest version to root devDependencies:
```json
// root/package.json
"devDependencies": {
  "vitest": "^3.0.0",
  "typescript": "^5.7.0"
}
```
Remove vitest from individual package devDependencies (or keep them as `"vitest": "*"` to use the workspace version).

### 13. No Shared Linting / Formatting Config

- diffler has no ESLint/Prettier config
- remotion has `.eslintrc` and `.prettierrc`
- Root has neither

**Recommendation:** Add root-level configs and extend in each package:
```
.eslintrc.json        # root
.prettierrc           # root
packages/diffler/.eslintrc.json  # { "extends": ["../../.eslintrc.json"] }
```

### 14. Consider Task Orchestration (Optional)

`npm run build --workspaces` works, but for larger monorepos consider:
- **Turborepo**: Caching, parallel execution, pipeline definitions
- **Nx**: Similar, more powerful but heavier

For this size, npm workspaces is fine. But if you add a third package (e.g., `packages/schemas`, `packages/web`), Turborepo becomes valuable.

---

## 🟢 Organizational / Cleanup Issues

### 15. README Still References Python

`packages/diffler/README.md`:
- "`pip install diffler`"
- "Python entry points"
- "Pydantic validation"
- "`diffler_plugins/` directory"

This is the old Python version's README. The current diffler is TypeScript/Node.

**Recommendation:** Rewrite the diffler README to reflect the actual TypeScript CLI, or at minimum add a prominent notice that the Python version has been superseded.

### 16. Hardcoded Usernames and URLs

Scattered throughout:
- `LukasParke` in `packages/remotion/scripts/prepare-stats.mjs`
- `LukasParke` in `packages/remotion/src/data/fetch.ts`
- `LukasParke/stats/main/github-user-stats.json` in workflows
- `LukasParke` fallback in `packages/remotion/src/data/adapter.ts`

**Recommendation:** Make these configurable via environment variables or derive from the diffler config. A hardcoded username makes the repo non-portable.

### 17. Remotion `example/` Directory

`packages/remotion/example/` contains a full sub-project with its own `package.json`, `yarn.lock`, `tsconfig.json`, and `remotion.config.ts`. This is either:
- A standalone example app (should be in `examples/` at root)
- Dead code from the standalone repo days

**Recommendation:** Move to `examples/remotion-usage/` at root, or delete if unused. If kept, it should use workspace references (`"@diffler/remotion": "*"`) not independent installs.

### 18. Empty `AGENTS.md`

`packages/diffler/AGENTS.md` is completely empty. Either populate it with agent-specific guidance or delete it.

### 19. Composite Action Uses Shell Conditionals for Monorepo Detection

In `packages/diffler/action.yml`:
```bash
if [ -f "package.json" ] && grep -q '"workspaces"' package.json; then
  npm install --legacy-peer-deps
  npm run build -w packages/diffler
```

This is fragile. If someone runs the action in a consumer repo that happens to have a `package.json` with `"workspaces"`, it will try to build locally and fail.

**Recommendation:** Add an explicit input:
```yaml
inputs:
  monorepo-build:
    description: "Build diffler from local workspace instead of npm"
    default: "false"
```

---

## 📋 Recommended Action Plan

### Phase 1: Cleanup (1-2 hours)
1. Delete `packages/diffler/package-lock.json`, `packages/remotion/yarn.lock`, `packages/remotion/example/yarn.lock`
2. Remove committed `.env`
3. Delete empty `packages/diffler/AGENTS.md`
4. Delete unused remotion templates: `templates/remotion/*.j2`
5. Standardize all `yarn` references to `npm`/`npx`
6. Add shared ESLint/Prettier configs at root

### Phase 2: Schema Unification (1 day)
1. Create `packages/schemas` with shared v2 TypeScript types
2. Move Zod schemas there (resolve zod version first)
3. Update `diffler` to export types from `@diffler/schemas`
4. Update `remotion` to import from `@diffler/schemas` and delete `normalizeGithubStats` adapter

### Phase 3: Collection Engine Unification (2-3 days)
1. Refactor `ContextBuilder` to call `runStatsCollection()` instead of individual collectors
2. Derive the flat Nunjucks context from the v2 output (a pure transform function)
3. Delete `src/collectors/` directory (or keep as thin compatibility layer)
4. Delete `src/collectors/v2Output.ts`
5. Verify all existing templates still render correctly

### Phase 4: Tooling Alignment (2-3 hours)
1. Align remotion TypeScript config to ES2022/NodeNext
2. Hoist vitest to root, unify versions
3. Resolve zod version conflict (upgrade diffler to v4 recommended)
4. Remove `--legacy-peer-deps` requirement from all scripts and CI

### Phase 5: Documentation (1 hour)
1. Rewrite diffler README (remove Python references)
2. Update remotion README (remove old repo name references)
3. Document the unified data flow: CLI → v2 JSON → remotion renderer

---

## Architecture Target State

```
packages/
  diffler/              # CLI + template engine + unified collection
    src/
      cli.ts            # Commander CLI (collect, render, update, export)
      config.ts         # YAML + env config loading
      core/
        engine.ts       # Orchestrator (pure)
        renderer.ts     # Nunjucks wrapper
        context.ts      # Derives template context from v2 output
      stats/
        index.ts        # runStatsCollection() — single collection entry
        github.ts       # GraphQL + REST collection engine
        cache.ts        # Two-tier cache
        scheduler.ts    # Rate limit + concurrency manager
        output.ts       # buildOutput() — v2 schema assembler
      helpers/          # Nunjucks globals
    action.yml          # Composite GitHub Action

  remotion/             # Remotion renderer (consumes v2 JSON)
    src/
      data/
        fetch.ts        # Fetch + validate v2 JSON (uses @diffler/schemas)
      cards/            # React card components
      themes/           # Theme system
      render/           # Rendering API + CLI
    scripts/
      render-assets.mjs # Asset pipeline

  schemas/              # NEW: Shared types + Zod schemas
    src/
      v2.ts             # TypeScript interfaces
      zod.ts            # Runtime validators
```

**Data flow:**
```
GitHub API ──▶ diffler/stats ──▶ github-user-stats.json (v2 schema)
                                      │
                                      ▼
                              @diffler/schemas (types)
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
            diffler/templates                    @diffler/remotion
            (README.md render)                   (WebP/GIF cards)
```

This eliminates the dual collection engines, removes the massive remotion adapter, and establishes a single contract (`github-user-stats.json` v2) between all consumers.
