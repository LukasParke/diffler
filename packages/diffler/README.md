# Diffler

GitHub stats collection and Nunjucks-based profile READMEs, with a shared data contract for animated [Remotion cards](../remotion).

## Requirements and installation

The workspace requires **Node >=22.12.0**, **pnpm 10.34.5**, and **Zod 4.4.3**. CI uses Node 24.

For a released CLI package:

```sh
pnpm add -g @lukasparke/diffler
```

For a source checkout, run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@lukasparke/diffler...' build
pnpm diffler --help
```

The trailing `...` in the filter builds `@lukasparke/diffler-schemas` before Diffler. A package-only build is not sufficient on a fresh clone. Root `pnpm diffler` invokes the absolute-in-workspace JS entrypoint without changing the command's CWD.

## Start a profile project

From the **consumer project directory**, with the installed binary:

```sh
diffler init --username octocat --asset-base-url ./assets
diffler validate
diffler render --output README.md
```

`init` creates `.github/diffler.yml` and a profile template without overwriting existing files. For live collection, supply `GITHUB_TOKEN` securely in the environment or use `${ENVIRONMENT_VARIABLE}` references in the configuration. Do not place literal credentials in templates, renderer props, generated READMEs, or public stats files.

```sh
diffler collect --output-path .diffler/stats.json
diffler export-remotion --output remotion-input.json
# Review changes before committing/pushing:
diffler update --dry-run
```

`render` writes to stdout unless `--output` is supplied. `update` performs the profile update/commit operation; use `--dry-run` for review. All relative config, template, cache, and output paths are interpreted from the **caller's working directory**, not from where Diffler is installed.

## Configuration

Default discovery uses `.github/diffler.yml`. Missing default configuration can fall back to environment settings; malformed configuration and a missing explicitly requested `--config` file are errors.

```yaml
version: "1"
github:
  username: "octocat"
  token: "${GITHUB_TOKEN}"
templates:
  main: "profile.md.j2"
  directory: ".github/diffler"
assets:
  baseUrl: "./assets"
cache:
  enabled: true
  ttl: 3600
statsAction:
  backfillMode: "resume"
  includePrivateRepositoryMetrics: false
  includePrivateRepositoryDetails: false
  includePrivateCacheDetails: false
```

File configuration is authoritative. Environment-only projects can use `DIFFLER_GITHUB_USERNAME`, `DIFFLER_TEMPLATE_DIRECTORY`, `DIFFLER_TEMPLATE_MAIN`, and `DIFFLER_ASSET_BASE_URL`. To parameterize a config file, explicitly reference an environment variable in it. `STATS_*` settings configure collection; explicit CLI flags take precedence.

The collection engine shares GitHub access, caching, budgets, and backfill state across the template and export flows. Public outputs exclude private repository details by default. Multi-profile credentials belong only in configuration/environment; renderer input contains stats, not tokens.

### Collection and coverage

`github.profiles` accepts `{username, token}` entries; `github.usernames` uses the shared token. Stable, volatile, and extras caches are isolated by GitHub host and account. `cache-clear --config FILE` clears those configured caches while preserving published stats snapshots.

The collector writes canonical v2 JSON (`profile`, `profileContributions`, `activity`, `repositories`, `repoMetrics`, `packageMetrics`, `presentation`, `privacy`, `collectionStatus`). Legacy flat JSON remains an accepted renderer input. Template aliases such as `contributions` and `repo_stats` refer to the canonical data; collected gists live under `extras.gists` so the `gists()` helper remains callable.

Templates select optional traffic/contributor requests through their expressions, including method-call arguments and nested paths. Explicit `collect` and renderer exports collect the configured metric set. Required collection failures reject; pending HTTP 202 work and missing years remain resumable and visibly incomplete.

Multi-profile collection deduplicates repository metadata and traffic by repository ID, sums contributor metrics per account, and rebuilds calendars, streaks, and presentation. Known cached metrics survive missing account caches, with pending coverage retained. Display identity and follower counts belong to the first profile. Anonymous private aggregates cannot be deduplicated after repository records have been redacted; that aggregate is marked incomplete and reports visible repository metrics.

Profile-facing counts use `repoMetrics.profile`: owned repositories, with stars/forks/languages/code volume/activity restricted to owned originals. Broader discovery totals remain in `repoMetrics.repoStats`. Use `--include-private-metrics` for anonymous private aggregates, or `--include-private` for details and cache records.

### Package statistics

Configure `statsAction.packageSources: [{provider: npm, packages: [example]}]`, `STATS_NPM_PACKAGES`, or `collect --npm-packages example,@scope/package`. npm reports day/week/month/year/all-time downloads and latest release metadata through the provider adapter. Registry failures preserve known results and incomplete coverage. The `package-impact` card uses these metrics.

## Renderer export

```sh
diffler export-remotion --config .github/diffler.yml --output remotion-input.json
```

The output is typed inline renderer `SourceProps`, including a `stats` object. `export-remotion --scenes FILE` also writes card metadata in the same collection pass. `export-remotion-input --target FILE` and `export-remotion-scenes` remain compatibility commands. Filesystem inputs are supplied through `stats` or `--stats-file`; `statsUrl` is an HTTP(S) URL.

Copy the consumer entry from [examples/remotion-usage](../../examples/remotion-usage), import `@lukasparke/diffler-remotion/styles.css`, and use the exported card registry. Then, from that consumer project:

```sh
pnpm exec github-readme-cards --entry-point src/index.tsx \
  --props remotion-input.json --cards readme,stats \
  --formats png,webp,gif --out-dir assets
```

See the [renderer guide](../remotion/README.md) for supported versions, local fonts, FFmpeg requirements, and publishing to Pages. Never publish exports made with `--allow-private` to a public profile without reviewing them.

## GitHub Actions

Initialize the consuming repository first, then add a workflow. Pin the action to a reviewed full commit SHA in production; `main` below identifies the repository/subdirectory, not a promised versioned release.

```yaml
name: Update Profile
on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  profile:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: LukasParke/diffler/packages/diffler@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          config: .github/diffler.yml
          remotion-output: remotion-input.json
          dry-run: "true" # Review first; set false to commit and push.
```

The action runs its committed `dist-action/index.js` bundle from the **consumer** CWD. CI rebuilds this bundle and checks that it matches the source, so consumer runs need no dependency installation or compilation.

Use `working-directory` for a nested consumer project. `username` and `template-dir` inputs provide environment fallbacks; configured projects can reference `${DIFFLER_GITHUB_USERNAME}` and `${DIFFLER_TEMPLATE_DIRECTORY}` explicitly. The action commits generated README/Remotion files with the bot identity and rejects unrelated pre-staged changes.

Add a schedule to the workflow when you want recurring profile updates.

## Template example

```jinja2
# {{ profile.name }}

{{ profile.bio }}

| Metric | Value |
| --- | --- |
| Contributions | {{ contributions.totalContributions }} |
| Stars | {{ stats.repoMetrics.starCount }} |

{% for language in stats.repoMetrics.topLanguages[:5] %}
- {{ language.languageName }} — {{ language.percentage }}%
{% endfor %}
```

The snapshot below is illustrative, not a freshness guarantee. The repository's README-example workflow updates this section from its configured GitHub identity.

<!-- DIFFLER_EXAMPLE_START -->

<div align="center">

# Luke Parke

*Hi 👋  I'm a Software Engineer, passionate about Identity and Developer Experience.

I love Svelte, Tailwind, TypeScript, and GO*

</div>

## 📊 Stats

| Metric | Value |
|--------|-------|
| Contributions | 2050 |
| Current Streak | 1 days |
| Repositories | 134 |
| Stars Earned | 498 |
| PRs | 139 |
| Issues Closed | 25 |

## 🏆 Top Languages

- **Python** — 50.69%
- **Java** — 20.45%
- **TypeScript** — 14.69%
- **Go** — 5.87%
- **C#** — 4.56%


## 🎯 Highlights

- ⭐ Popular: 498 stars
- 🌐 Contributor: 19 repos
- 📈 Growth: +12.9%

<!-- DIFFLER_EXAMPLE_END -->

## Development

From the repository root, after `pnpm build`:

```sh
pnpm --filter @lukasparke/diffler test
pnpm --filter @lukasparke/diffler typecheck
pnpm --filter @lukasparke/diffler lint
pnpm smoke:consumer
```

Published npm files contain compiled code/declarations, built-in templates, and documentation. The Action and its bundle are distributed from GitHub. The packed consumer checks cover the CLI's ESM dependency graph and the renderer's ESM/CommonJS schema imports.

License: MIT.
