# Rendered graphics checks

This test-only entry imports the **built public card registry and CSS**, not replacement cards or React string snapshots. Build `@lukasparke/diffler-schemas` and `@lukasparke/diffler-remotion` first; rerun after changing/building production cards. No dependencies, browsers, avatars, or fonts are downloaded by this harness.

From the repository root:

```sh
pnpm --filter @lukasparke/diffler-remotion exec tsc --noEmit -p visual/tsconfig.json
pnpm --filter @lukasparke/diffler-remotion exec vitest run visual/harness.test.ts

# Quick actual browser render, including public renderCards() PNG parity.
node packages/remotion/scripts/profile-graphics.mjs --cards readme --scenarios normal --frames settled

# Full registry × six fixtures × first/key/settled frames.
node packages/remotion/scripts/profile-graphics.mjs

# Historical comparison times, with synthetic data/local initials (not recovered media).
node packages/remotion/scripts/profile-graphics.mjs \
  --cards readme,readme-classic,readme-spotlight --scenarios normal \
  --frames 0,30,78,120,240,settled --theme default
```

Use `--browser-executable '/path/to/chrome'` or `REMOTION_BROWSER_EXECUTABLE` when Chrome is not in a common macOS/Linux location. A sandbox must allow Chrome's local sockets/processes. `--help` and `--list` describe selectors. `--theme github` / `dracula` exercise those public providers without changing production defaults.

The default, git-ignored destination is `packages/remotion/visual/.artifacts/graphics/review-<theme>-<unique>/`. `--out-dir PATH` selects another artifact root, relative to the caller; choose an ignored directory. Every invocation creates its own directory. Only its temporary bundle directory is removed, never existing output or unrelated files.

Outputs:

- `index.html`: offline review gallery; native/360px preview and dark/white matte toggles.
- `<scenario>--<card>--f<frame>.png`: real Remotion/Chrome renders, retained even when geometry fails.
- `baseline-<scenario>-{dark,light}.png`, `key-frames-{dark,light}.png`: PNG contact sheets made from those exact renders, at 360px preview width.
- `report.json`: frame attestation, checked node counts, clipping diagnostics, intentional ellipses, PNG SHA-256/bytes, informational render timings, browser path, and public-API parity result.
- `api-smoke/`: one repeat PNG through `@lukasparke/diffler-remotion/render`'s `renderCards()`, compared byte-for-byte with the direct render.
- `probe-control-*.png`: real browser controls for plain text, certified ellipsis, missing titles, vertical clipping, outer overflow, SVG stroke overflow, and ignored `aria-hidden` decoration.

## What passes mean

Fixtures derive from typed `defaultStats` with a fixed UTC timestamp and use public normalization: normal, empty, sparse, long identities/languages, large totals, and pending/failed optional metrics. The owned bundle is served on one loopback-only ephemeral port for the run; a page CSP rejects nonlocal resources. Fonts must actually load before measurement.

A test-only layout effect measures text-node ranges (including invisible intro rows) and meaningful image/SVG/meter geometry against the composition and rectangular overflow ancestors, with **1 logical pixel** of rounding tolerance. Horizontal CSS ellipsis is accepted only with a matching full title/accessibility value; it never excuses vertical or outer clipping. Public Remotion `Artifact` reports preserve failing PNGs without production hooks or browser-private APIs. Any missing probe report, render error, failed control, geometry issue, or repeat-PNG mismatch exits **1**, with no automatic retry.

**This is not visual approval.** Text-only tools cannot judge the PNGs' beauty, glyph appearance, beam crossings, contrast, overlap, rounded/clip-path masks, or readability after resizing. Review the actual PNG/contact sheets with an image-capable tool. This small harness does not encode or validate GIF/WebP, prove every animation frame, or replace useful alt text for exported images. SHA equality is checked within one run/browser/build, not claimed across browser/platform versions. Concurrent builds can legitimately invalidate that comparison.

An optional package script can simply invoke `node scripts/profile-graphics.mjs`; no manifest changes are needed for direct use.
