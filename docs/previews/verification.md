# Verification record

Verified locally on **2026-09-09**, on macOS arm64. The feature is based on
`origin/main` at `f682b3f`; reviewed implementation commits are `d2529a5` and
`57bbe54`. Tool versions and per-file SHA-256 hashes are recorded in
[`animation-report.json`](animation-report.json).

## Automated checks

| Check | Result |
| --- | --- |
| `pnpm build` | Passed, including the consumer example bundle |
| `pnpm test` | **681 passed**: 42 schema, 334 CLI/collection, 305 renderer/harness tests |
| `pnpm typecheck` | Passed across all workspaces |
| `pnpm lint` | Zero errors; six nonblocking complexity/parameter-count warnings |
| `pnpm smoke:render` | Passed packed ESM/CJS exports, declarations, CLI CWD, themes, CSS/fonts, example bundle, repeated PNGs, and default 2× API dimensions |
| Action bundle build | Passed; committed bundle rebuilt from current source |
| Bundled Action smoke | Help, scaffolded built-in template, static render/validation, consumer CWD, and safe configuration projection passed |
| Visual harness typecheck | Passed |
| Full rendered matrix | **234/234**: 13 cards × 6 scenarios × 3 frames; public-API PNG parity passed |
| Historical comparison key frames | **18/18**: three flagship cards at 0, 30, 78, 120, 240, and their final frame |
| Animation decoding | **26/26** full GIF/WebP animations passed |

The matrix includes normal, empty, sparse, long-text, large-total, and
pending/failed-metric fixtures. Controls verify that the geometry probe detects
clipping failures, requires full accessibility text for ellipsis, loads the local
font, and mounts its DOM measurement root. Native refs resolve the Remotion
4.0.509 / React 18 `AbsoluteFill` ref-forwarding issue found during verification.

After the final coverage fix, the full matrix was repeated: 216 PNGs remained
byte-identical; the 18 expected code-metrics frames changed. The code-metrics
animation was then rendered and decoded again. Flagship frames were unchanged.

## Encoded media

All 13 compositions were rendered for their **full 10- or 12-second duration**,
at 30 source frames per second and native pixel scale. PNG, GIF, and WebP were
produced through the public CLI/API. Both animation formats read the original PNG
sequence. FFmpeg 6.0 provided `libwebp_anim`; Gifsicle 1.96 applied lossless GIF
optimization afterward.

Pillow 12.3.0 decoded every encoded frame and checked:

- Correct file format and registry dimensions, nonempty frames, and transparent
  outer gutters.
- Complete duration within one source frame of the nominal duration: GIF
  10.010/12.010s, WebP 9.999/11.999s.
- Deliberate playback metadata: Classic/supporting GIFs omit the loop extension;
  their WebPs have loop count 1. Signature/Spotlight use 0 (infinite) in both.
- Settled-frame agreement with PNG posters. WebP had zero visible pixel error;
  GIF quantization stayed below 0.181 average 8-bit channel levels.
- Small loop-boundary deltas for Signature/Spotlight. The Classic intro is
  intentionally single-play and is not evaluated as a seamless loop.
- Identical decoded GIF pixel timelines before/after optimization, including
  coalesced holds. Each optimized native GIF is below 3 MiB; the flagship GIFs are
  227–321 KiB.

## Visual inspection

Reviewed the recovered article GIF's decoded contact sheets, the current full
card family, long/large/pending layouts, profile key frames, native encoded
samples, and decoded GIF/WebP contact sheets on dark and white mattes at 360px.
Also inspected a Chrome screenshot of the offline HTML gallery.

Classic's greeting and nine-row rhythm remain clear through the staggered intro;
its final values hold while the filaments finish drawing. Signature/Spotlight keep
foreground text stable during their ambient cycles. Fonts, fine colored strokes,
corners, value alignment, and coverage labels remain readable in the delivered
formats. Long source labels intentionally ellipsize; published images should be
accompanied by a text summary, as in this gallery.

## Standards review

Initial review found three contract issues and one related duplication judgement:

1. Canonical merging discarded detected source incompleteness and could reduce
   reported totals when calendar observations were missing.
2. The consumer example independently selected sources, bypassing validation and
   the private-detail guard for some inputs.
3. Timestamp string ordering/cutoffs could discard a valid UTC contribution day.
4. The example's duplicate source selector was the related design concern.

All were fixed in `57bbe54`. Follow-up review replayed the original cases against
the built packages and confirmed no unresolved findings: incomplete calendars
retain reported totals/warnings, the example delegates to the shared boundary,
and offset-bearing timestamps use their actual UTC instants.

## Spec review

Initial review found two functional issues:

1. Unknown traffic coverage from one account could be hidden by another account's
   completed sample during canonical merging.
2. Retry failures/pending work and retained cache successes overlapped, so adding
   their counts invented a distinct-repository denominator.

Both were fixed in `57bbe54`, with regressions that failed before the changes.
Per-metric `coverageKnown` flags now survive merging. Coverage displays independent
status counts, and the code card shows a completion meter only for complete
coverage. Follow-up review confirmed both fixes and found no concrete regression.

**Review summary:** Standards — zero unresolved; Spec — zero unresolved.

## Local evidence

Exhaustive artifacts are intentionally git-ignored:

- `packages/remotion/visual/.artifacts/graphics/review-default-IWkRtU/`
- `packages/remotion/visual/.artifacts/graphics/review-default-vcHJqE/`
- `artifacts/graphics/animations-gaTzPS/` (raw renders, optimized GIFs, decoded
  samples/contact sheets, and the inspection report)
- `artifacts/consumer-smoke/`

The historical downloads remain under `docs/design/reference/`. The committed
gallery contains only the compact preview assets, fixture, and verification
record.
