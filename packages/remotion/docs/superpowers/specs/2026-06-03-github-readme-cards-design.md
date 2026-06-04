# GitHub README Cards — Design Spec

**Date:** 2026-06-03  
**Approach:** B — Publishable NPM Library  
**Package name:** `github-readme-cards`

---

## 1. Goal

Transform the current `github-stats-remotion` template into a publishable npm package that provides first-class components, helpers, and a render pipeline for generating animated GitHub profile README cards (WebP / GIF).

A consumer should be able to:

```bash
npm install github-readme-cards remotion react react-dom zod
```

…and compose their own cards with minimal boilerplate.

---

## 2. Package Architecture

Single package, multiple entry points via Node.js conditional exports. Peer dependencies on `remotion`, `react`, `react-dom`, and `zod`.

```
src/
  index.ts                 # Core API: primitives, types, data, utils
  cards/                   # Pre-built card components
    index.ts
    ReadmeCard.tsx
    StatsCard.tsx
    LanguagesCard.tsx
    ...
  components/
    primitives/            # Panel, MetricRow, MetricTile, ProgressBar, etc.
    effects/               # AnimatedCounter, GeminiBeams
  themes/
    index.ts
    default.ts
    dracula.ts
    github.ts
    createTheme.ts
    ThemeProvider.tsx
  data/
    index.ts
    schemas.ts             # Zod schemas for stats-action JSON
    adapter.ts             # normalize / validate incoming data
    fetch.ts               # fetchUserStats, useUserStats
  render/
    index.ts
    api.ts                 # renderCard(), renderCards()
    cli.ts                 # CLI entrypoint
    config.ts              # RenderConfig types
  utils/
    index.ts
    format.ts              # formatCompactNumber, formatBytes, formatInteger
    animation.ts           # Remotion easing / interpolation helpers
  types/
    index.ts               # Shared TypeScript interfaces
```

### 2.1 Exports Map

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./cards": {
      "types": "./dist/cards/index.d.ts",
      "import": "./dist/cards/index.js",
      "require": "./dist/cards/index.cjs"
    },
    "./themes": {
      "types": "./dist/themes/index.d.ts",
      "import": "./dist/themes/index.js",
      "require": "./dist/themes/index.cjs"
    },
    "./render": {
      "types": "./dist/render/index.d.ts",
      "import": "./dist/render/index.js",
      "require": "./dist/render/index.cjs"
    }
  }
}
```

---

## 3. Public API Surface

### 3.1 Primitives

Drop-in styled building blocks for custom cards:

```tsx
import {
  Panel,
  MetricRow,
  MetricTile,
  BigMetric,
  ProgressBar,
  AnimatedCounter,
} from 'github-readme-cards';
```

All primitives accept standard props plus theme-aware styling. They are self-contained Remotion components.

### 3.2 Pre-built Cards

Ready-to-use card components that accept `userStats: UserStats`:

```tsx
import {
  ReadmeCard,
  ReadmeClassicCard,
  ReadmeSpotlightCard,
  StatsCard,
  LanguagesCard,
  MainStatsCard,
  RepositoryImpactCard,
  IssueTrackingCard,
  CodeMetricsCard,
  ActivityOverviewCard,
  CommitStreakCard,
  TopLanguagesCard,
} from 'github-readme-cards/cards';
```

Each card is a pure component: `({ userStats }: { userStats: UserStats }) => JSX.Element`. No side effects.

### 3.3 Themes

```tsx
import {
  ThemeProvider,
  defaultTheme,
  draculaTheme,
  githubTheme,
  createTheme,
} from 'github-readme-cards/themes';
```

`ThemeProvider` wraps a card tree. Components read colors, radii, and typography from context. `createTheme(base, overrides)` merges partial overrides into a base theme.

### 3.4 Data Layer

```tsx
import {
  userStatsSchema,
  fetchUserStats,
  useUserStats,
  type UserStats,
  type SourceProps,
} from 'github-readme-cards';
```

- `userStatsSchema` — Zod schema for the stats-action JSON shape.
- `fetchUserStats(source: SourceProps)` — async fetch + validate. Intended for use inside Remotion `calculateMetadata` or any async setup step.
- `createSourceProps(input: unknown)` — validates and returns typed `SourceProps`.

### 3.5 Render Pipeline

**Programmatic API:**

```ts
import { renderCards, renderCard } from 'github-readme-cards/render';

await renderCards({
  compositionIds: ['readme', 'stats'],
  entryPoint: './src/index.tsx',
  formats: ['webp', 'gif'],
  outputDir: 'pages',
  props: { userStats },
  concurrency: 2,
});
```

**CLI:**

```bash
npx github-readme-cards render \
  --cards readme,stats \
  --formats webp,gif \
  --out-dir pages \
  --props input.json \
  --concurrency 2
```

The CLI is a thin wrapper around the programmatic API plus `remotion` + `ffmpeg` spawning.

### 3.6 Utilities

```ts
import {
  formatCompactNumber,
  formatBytes,
  formatInteger,
  interpolateWithEasing,
} from 'github-readme-cards';
```

---

## 4. Theme System

### 4.1 Interface

```ts
interface Theme {
  colors: {
    background: string;
    panel: string;
    panelLight: string;
    border: string;
    text: string;
    muted: string;
    faint: string;
    green: string;
    blue: string;
    yellow: string;
    pink: string;
    red: string;
    cyan: string;
    purple: string;
  };
  radii: {
    card: string;
    panel: string;
  };
  typography: {
    fontFamily: string;
  };
}
```

### 4.2 Built-in Themes

- `defaultTheme` — current dark theme (matches existing `#0c0f17` palette).
- `draculaTheme` — Dracula color palette.
- `githubTheme` — GitHub Primer-inspired light/dark palette.

### 4.3 Provider

```tsx
<ThemeProvider theme={draculaTheme}>
  <ReadmeCard userStats={userStats} />
</ThemeProvider>
```

If no provider is present, components fall back to `defaultTheme`.

---

## 5. Data Layer

### 5.1 Schema

The existing Zod schema (`userStatsSchema`, `sourcePropsSchema`, `mainSchema`) is extracted and exported. It remains the canonical shape for `stats-action` output.

### 5.2 Adapter

A `normalizeStats(raw: unknown): UserStats` function validates via Zod and returns the typed object. Legacy alias fields are preserved for backwards compatibility.

### 5.3 Extensibility

Consumers with custom data sources can map their data into the `UserStats` shape manually. The library does **not** attempt to support arbitrary schemas — it provides one well-typed schema and expects consumers to adapt.

---

## 6. Render Pipeline

### 6.1 Programmatic API

`renderCards(config: RenderConfig)` assumes the consumer has a Remotion entry point (e.g., `src/index.tsx`) that registers `Composition`s for the cards they want to render. The helper iterates over composition IDs, spawns `remotion render` for GIF, then optionally runs `ffmpeg` to produce WebP. It reuses the existing concurrency pool logic.

```ts
interface RenderConfig {
  compositionIds: string[];
  entryPoint: string;          // path to the Remotion entry point
  formats: Array<'gif' | 'webp' | 'png'>;
  outputDir: string;
  props: Record<string, unknown>;
  concurrency?: number;
  remotionConcurrency?: number;
}
```

### 6.2 CLI

The CLI parses arguments with the same semantics as the current `render-assets.mjs`:

- `--cards` — comma-separated ids (default: all registered cards).
- `--formats` — `webp`, `gif`, or both (default: `webp,gif`).
- `--out-dir` — output directory (default: `pages`).
- `--props` — path to JSON props file.
- `--concurrency` — card-level concurrency.
- `--remotion-concurrency` — Remotion render concurrency.

Exit codes match the current behavior: non-zero if any render fails.

---

## 7. Build & Distribution

### 7.1 Tooling

- **Builder:** `tsup`
- **Outputs:** ESM (`*.js`), CJS (`*.cjs`), TypeScript declarations (`*.d.ts`)
- **Target:** `es2020`
- **External:** `remotion`, `react`, `react-dom`, `zod` (peer deps)

### 7.2 Peer Dependencies

```json
{
  "peerDependencies": {
    "remotion": ">=4.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "zod": ">=3.0.0"
  }
}
```

### 7.3 Dev Workspace

The existing repo becomes the development workspace:

- `package.json` name changes to `github-readme-cards`.
- Source code lives in `src/` as the package source.
- An `example/` directory contains a dogfooding Remotion app that imports from the local package (relative imports during dev, package name in published docs).
- `scripts/` are replaced by the `render/` module inside the package.

---

## 8. Dogfooding / Example

An `example/` folder contains:

```
example/
  src/
    Root.tsx          # Imports cards from 'github-readme-cards/cards'
    index.tsx         # registerRoot
  input.json
  package.json        # local dependency: "github-readme-cards": "file:.."
  remotion.config.ts
```

`example/src/Root.tsx` demonstrates:
- Using `calculateMetadata` with `fetchUserStats`.
- Registering multiple `Composition`s with pre-built cards.
- Wrapping cards in `ThemeProvider`.

This proves the API works and gives users a starter template.

---

## 9. Testing Strategy

- **Type checking:** `tsc --noEmit` on the package and example.
- **Linting:** ESLint with the existing `@remotion/eslint-config`.
- **Render smoke test:** A CI step that renders one low-resolution card to verify the pipeline does not crash.
- **No unit tests for UI components** (Remotion components are hard to unit test in isolation; visual regression is out of scope for v1).

---

## 10. Migration Plan (High-level)

1. Reorganize `src/` into the package structure above.
2. Extract primitives from existing cards into `components/primitives/`.
3. Extract existing card code into `cards/` with consistent prop interfaces.
4. Build theme system and wrap existing components.
5. Move render logic from `scripts/` into `render/` as a module.
6. Set up `tsup` build and exports map.
7. Create `example/` dogfooding app.
8. Update CI workflow to build package + render example.
9. Publish v0.1.0 to npm (or GitHub Packages).

---

## 11. Out of Scope

- Server-side rendering (SSR) or edge functions.
- Real-time data streaming into cards.
- Arbitrary data schema support (only `stats-action` schema is first-class).
- Visual regression testing.
- A web-based GUI or config editor.
