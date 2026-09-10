# @lukasparke/diffler-remotion

Animated GitHub profile cards, theme-aware primitives, and a Node render API for public Diffler stats. The visual system uses Fira Code, compact profile panels, language graphics, and frame-driven animation. PNG stills, animated WebP, and GIF fallbacks can be published to GitHub Pages without committing media into source history.

## Supported versions

- Node **>=22.12.0** (Node 24 in CI)
- React and React DOM **18.3.1**
- Every Remotion package **4.0.509**
- Zod **4.4.3**

CLI, bundler, renderer, React, and Zod versions are verified together through packed consumer checks. Keep every Remotion package at the same version.

## Consumer setup

In a project using the published packages:

```sh
pnpm add @lukasparke/diffler-remotion react@18.3.1 react-dom@18.3.1 remotion@4.0.509 zod@4.4.3
pnpm add -D @remotion/cli@4.0.509 @types/react@18 @types/react-dom@18 typescript
```

During development in this repository, use the [workspace consumer example](../../examples/remotion-usage) instead. Build the libraries before starting it:

```sh
# Repository-root CWD
pnpm install --frozen-lockfile
pnpm --filter '@lukasparke/diffler-remotion...' build
pnpm --filter remotion-usage-example start
```

Import the public entries and **import the stylesheet once** in your composition root:

```tsx
import {defaultStats, FPS, DurationInFrames} from '@lukasparke/diffler-remotion';
import {cards} from '@lukasparke/diffler-remotion/cards';
import {ThemeProvider, createTheme} from '@lukasparke/diffler-remotion/themes';
import '@lukasparke/diffler-remotion/styles.css';
```

Use `cards` to register compositions; do not copy a table of dimensions into the consumer. The [example root](../../examples/remotion-usage/src/Root.tsx) shows registry-driven composition registration and metadata resolving the render's input props.

### Themes and styles

Wrap a card inside its registered composition:

```tsx
const theme = createTheme({colors: {purple: '#b39df3', background: '#141321'}});

// Inside a Remotion composition; userStats is validated renderer data.
<ThemeProvider theme={theme}>
  <StatsCard userStats={userStats} />
</ThemeProvider>
```

`StatsCard` is exported by `@lukasparke/diffler-remotion/cards`. Root primitives, `/cards`, and `/themes` share emitted chunks in both ESM and CommonJS, so providers propagate across public entries. There is no global context singleton.

The build processes `src/style.css`, compiles any library Tailwind utilities from library source, and emits `dist/styles.css`. Current card layouts are scoped and primarily inline. Consumers need **no Tailwind dependency, plugin, source alias, or scan of the installed library**. The published stylesheet includes local Fira Code WOFF2 files at weights 400/500/600/700, with relative URLs and the SIL OFL license. No Google Fonts request is needed. Keep the stylesheet and its emitted font assets together when deploying a bundle.

ESM and CommonJS are supported for `.`, `/cards`, `/themes`, and `/render`. The CSS entry is intended for bundlers, not Node's native CSS loader.

## Input data

Prefer the typed inline export from the CLI:

```sh
# Repository-root CWD; provide GITHUB_TOKEN securely in the environment.
pnpm diffler export-remotion --config .github/diffler.yml \
  --output artifacts/profile/input.json
```

That file is renderer `SourceProps` containing `stats`. It contains no GitHub credentials. `export-remotion-input --target FILE` remains a compatibility wrapper.

Alternatively, use a public JSON URL:

```json
{
  "username": "octocat",
  "statsUrl": "https://raw.githubusercontent.com/octocat/stats/main/github-user-stats.json"
}
```

Replace the URL with a real public stats source. `statsUrl` is a browser-fetchable HTTP(S) URL, **not a local filesystem path**. To use raw local stats, prepare them in Node or put the parsed object in `stats`. The renderer accepts v2 output and supported legacy input through its shared validation boundary. Invalid or missing live data is not silently replaced with demo data. Private repository details require an explicit opt-in and should not be published to public Pages.

## Rendering

### Card family and playback

| ID | Logical size | Duration | Default playback |
| --- | --- | --- | --- |
| `readme` (Signature) | 560×390 | 10 seconds | Loop; text stays visible |
| `readme-classic` | 500×350 | 10 seconds | Once; nine-row staggered intro |
| `readme-spotlight` | 560×440 | 12 seconds | Loop; text stays visible |

See the [committed preview gallery](../../docs/previews/README.md) for posters and encoded animations. Supporting cards cover repository impact, contribution history, languages, code, issues, streaks, and package downloads. Their default playback is single-play.

Output defaults to **2×** logical dimensions. `--scale 1` produces native-size assets; integer scales 1–4 are supported. `--playback once|loop` overrides the registry choice. The API accepts matching `scale` and `playback` fields. GIF single-play omits a loop extension; WebP single-play uses a loop count of 1. Looping variants use 0 (infinite) in both formats.

PNG is a settled poster by default; `--still-frame N` selects a different frame. Both animation codecs read the original PNG sequence. A failed render/encode preserves existing output assets, and successful subset renders preserve other cards and formats.

### CLI from a consumer directory

The installed binary is named `github-readme-cards`; the npm package is `@lukasparke/diffler-remotion`:

```sh
pnpm exec github-readme-cards --entry-point src/index.tsx \
  --props input.json --cards readme,stats \
  --formats png,webp,gif --out-dir pages
```

There is **no `render` positional argument**. Use `--help` for frame ranges, concurrency limits, executable paths, and other options. All paths are relative to the caller's CWD. FFmpeg with `libwebp` must be on `PATH` for animations; it is never installed via `npx`. PNG-only rendering does not require FFmpeg. Remotion needs Chrome/Chromium; use `--browser-executable` if supplying your own installation.

### Programmatic API

```ts
import {readFile} from 'node:fs/promises';
import {renderCards} from '@lukasparke/diffler-remotion/render';

await renderCards({
  entryPoint: 'src/index.tsx',
  compositionIds: ['readme', 'stats'],
  formats: ['png', 'webp', 'gif'],
  outputDir: 'pages',
  props: JSON.parse(await readFile('input.json', 'utf8')),
  concurrency: 1,
  remotionConcurrency: 2,
});
```

`@remotion/bundler` and `@remotion/renderer` are declared runtime dependencies of this package. Consumers do not need a globally installed Remotion CLI for this API. Library imports and rendering are separate: a browser entry imports cards/styles, while Node imports `/render`.

### Repository asset pipeline

From the repository root:

```sh
pnpm --filter '@lukasparke/diffler-remotion...' build
pnpm --filter @lukasparke/diffler-remotion prepare:stats --stats-file /absolute/path/to/public-stats.json
pnpm render:assets
```

Those package scripts run in `packages/remotion`. Prepared props default to `packages/remotion/input.generated.json`; assets default to `packages/remotion/pages/`. You can also prepare a real remote source with `--stats-url` or `STATS_JSON_URL`. Use root `pnpm render --entry-point … --props …` when paths should instead stay relative to the repository root.

## Publishing and verification

```md
<picture>
  <source srcset="https://USERNAME.github.io/REPOSITORY/readme.webp" type="image/webp" />
  <img src="https://USERNAME.github.io/REPOSITORY/readme.gif" alt="GitHub profile statistics" />
</picture>
```

For a reduced-motion option, place a PNG source first:

```html
<source media="(prefers-reduced-motion: reduce)" srcset="readme.png" type="image/png" />
```

Keep a text stats summary and useful alt text alongside the image. Collection and optional-metric coverage labels distinguish unavailable data from measured zeroes.

Available IDs are exported in `cards`: `readme`, `readme-classic`, `readme-spotlight`, `stats`, `languages`, `main-stats`, `repo-impact`, `issue-tracking`, `code-metrics`, `activity-overview`, `commit-streak`, `top-languages`, and `package-impact`.

The root commands `pnpm smoke:consumer` and `pnpm smoke:render` test installed tarballs, not source aliases. They verify ESM/CJS exports and theme propagation, declaration resolution, font files and loading, a consumer bundle without Tailwind configuration, and repeatable PNG output. Render evidence is saved under `artifacts/consumer-smoke/`.

Package code: MIT. Bundled Fira Code: SIL OFL 1.1 (`dist/fonts/LICENSE.txt`). Check [Remotion's license](https://www.remotion.dev/license) for your usage.
