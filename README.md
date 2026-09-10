# Diffler

Collect GitHub stats, generate a profile README, and render animated profile cards with Remotion. The cards use a shared registry, theme-aware components, and locally bundled Fira Code.

[**Preview the cards**](docs/previews/README.md) · [Design and historical reference](docs/design/original-profile.md)

## Workspace

| Package | Purpose |
| --- | --- |
| [`@lukasparke/diffler`](packages/diffler) | GitHub collection, caching, Nunjucks README templates, and renderer-input export |
| [`@lukasparke/diffler-schemas`](packages/schemas) | Shared v2 stats and renderer contracts, with Zod validation and ESM/CJS exports |
| [`@lukasparke/diffler-remotion`](packages/remotion) | Cards, themes, styles/fonts, and programmatic PNG/WebP/GIF rendering |
| [`remotion-usage-example`](examples/remotion-usage) | A real package consumer; imports the published exports and card registry |

## Prerequisites

- **Node.js 22.12 or newer** for the workspace toolchain; Node 24 is used in CI.
- **pnpm 10.34.5**, pinned by `packageManager`. Use Corepack or install that pnpm version.
- **FFmpeg with libwebp** on `PATH` for GIF/WebP animation output. PNG stills do not need FFmpeg. Rendering also needs Chrome/Chromium; Remotion can download its managed browser on first use.

The workspace pins **React/React DOM 18.3.1**, **Remotion 4.0.509**, and **Zod 4.4.3**. Keep every Remotion package at the same version and run the consumer checks when updating peers.

## Fresh clone

Run these commands **at the repository root**:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm smoke:consumer
# Optional locally; required in CI. No GitHub token or live stats needed:
pnpm smoke:render
```

`pnpm-lock.yaml` is tracked. Dependency updates must update it deliberately; CI never repairs it. `pnpm build` builds schemas first, then their dependents, then bundles the consumer example. To build only a package **and its dependencies**:

```sh
pnpm --filter '@lukasparke/diffler...' build
pnpm --filter '@lukasparke/diffler-remotion...' build
```

No task framework or global renderer CLI is required.

## Collect → export → render

Supply `GITHUB_TOKEN` through your shell's secret manager or GitHub Actions secrets, not a template or JSON input. From the repository root:

```sh
# Creates an isolated example config/templates; does not replace this README.
pnpm diffler init --username octocat \
  --config .diffler/demo/diffler.yml --dir .diffler/demo/templates
pnpm diffler render --config .diffler/demo/diffler.yml \
  --output artifacts/profile/README.md
pnpm diffler export-remotion --config .diffler/demo/diffler.yml \
  --output artifacts/profile/input.json
pnpm render --entry-point examples/remotion-usage/src/index.tsx \
  --props artifacts/profile/input.json --cards readme,stats \
  --formats png,webp,gif --out-dir artifacts/profile/assets
```

`export-remotion` writes typed inline source props: a `stats` object, not a local filename in `statsUrl`. Private repository details are excluded by default. A browser cannot read an arbitrary Node filesystem path as a URL.

**Paths follow the command's working directory:**

- Root `pnpm diffler …` and `pnpm render …` preserve the repository-root CWD.
- `pnpm --filter remotion-usage-example start` / `render` run **inside the example** and read its `input.json`.
- `pnpm --filter @lukasparke/diffler-remotion prepare:stats` and `pnpm render:assets` run **inside `packages/remotion`**. Their default output is `packages/remotion/pages/`, not root `pages/`.
- An installed `diffler` or `github-readme-cards` binary uses the consuming project's CWD.

See the [CLI guide](packages/diffler/README.md), [renderer guide](packages/remotion/README.md), and [consumer example](examples/remotion-usage/README.md) for configuration and library usage.

## Published consumer contract

```tsx
import {cards} from '@lukasparke/diffler-remotion/cards';
import {ThemeProvider, defaultTheme} from '@lukasparke/diffler-remotion/themes';
import '@lukasparke/diffler-remotion/styles.css';
```

Import the stylesheet once in your Remotion entry/root. It contains the library's built styles and local font URLs; consumers need no Tailwind scan of the library. Root, `/cards`, and `/themes` share emitted modules, so a provider imported from `/themes` reaches cards imported from `/cards`. Both ESM and CommonJS consumers are checked.

The consumer smoke packs all three libraries, installs the tarballs outside the workspace, and checks exports, declarations, CLI paths, fonts, themes, and an unmodified example bundle. The render smoke uses a fixed fixture and data-URI avatar, compares two renders of the same frame, and checks actual font loading and cross-entry theme propagation in Chromium. PNG evidence is written to ignored `artifacts/consumer-smoke/`.

## GitHub Actions

- [`ci.yml`](.github/workflows/ci.yml): frozen install, build, tests, lint, typecheck, tarball consumer smoke, deterministic render smoke. No collection credentials.
- [`render-video.yml`](.github/workflows/render-video.yml): renders public stats and publishes assets to Pages. Configure your stats URL and enable Pages before use.
- [`update-readme-example.yml`](.github/workflows/update-readme-example.yml): refreshes only the generated example section of the CLI package README.

The [composite action](packages/diffler/action.yml) runs the committed CLI bundle from its checked-out revision in the **consumer directory**. CI checks bundle freshness. See the [workflow example](packages/diffler/README.md#github-actions); write access requires `permissions: contents: write`.

## Releases

The three public packages are versioned together. Run `node scripts/bump-version.mjs VERSION`, review the manifest/lockfile changes, and rebuild the Action with `pnpm --filter @lukasparke/diffler build:action`. After verification, a `vVERSION` tag triggers the [release workflow](.github/workflows/release.yml). `pnpm test:package` is the compatibility entry point for the packed consumer checks.

## Licenses

Diffler's package code is MIT. Bundled Fira Code is **SIL OFL 1.1**; its license is shipped in `@lukasparke/diffler-remotion/dist/fonts/LICENSE.txt`. Remotion has [its own license terms](https://www.remotion.dev/license), including commercial-use requirements.
