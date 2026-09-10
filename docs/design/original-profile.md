# Profile cards: recovered evidence and design decisions

The [preview gallery](../previews/README.md) contains the current synthetic-data
renders. This note records the historical evidence and the choices behind Classic,
Signature, and Spotlight.

## Recovered article media

[The Next Generation of GitHub Profile Stats][post] was published on
**2024-06-14** and later edited. Its Markdown points to a now-missing GitHub GIF;
the article HTML still exposes a working [Dev.to upload][upload]. That upload was
recovered on **2026-09-09** through public GET requests.

| Evidence | Measured result |
| --- | --- |
| Recovered GIF | 1000×700, 300 frames, 10.00 seconds, 19,461,412 bytes |
| GIF SHA-256 | `1a06fb17217ef72f9381669d389988d0c606ed8b768cf184ab3e0939cc002960` |
| Dev.to optimized WebP | 600×420, 216 frames, 10.00 seconds, 209,612 bytes |
| Playback | GIF has no NETSCAPE loop extension; WebP loop count is 1 |
| Alpha | Decoded GIF alpha is binary; opaque bounds are `(8,8)` to `(992,692)` |
| Settled hold | Decoded frames 250–299 are identical |

The upload's HTTP `Last-Modified` is **2026-01-15**. It is recovered
article-associated media; publication-day byte identity cannot be established.
Visual inspection of decoded contact sheets confirms a nine-row ledger, a
40-pixel logical avatar, five curved blue/pastel filaments, and changing digits
during the intro. The final visible values include 460 stars, 87 forks, 5,504
commits, and 5,485 contributions.

The full recovered GIF, proxy WebP, source excerpts, extraction logs, per-frame
hashes, and contact sheets remain in the ignored `docs/design/reference/`
research directory. The public history carries this compact provenance record
and newly rendered previews.

## Two source baselines

- **March 2024:** [`c3c981e`][march], the latest README-card source change before
  publication. It specifies 500×350, nine unboxed rows, fixed comma-grouped values,
  0.2-second row staggers with one-second linear fades, and beams positioned at
  top 80px with −69° rotation. The font was the system monospace stack.
- **November 2024:** [`1acd58d`][november] keeps the ledger while moving beams to
  top 144px / −105° and introducing nondeterministic digit scrambling. The
  recovered upload's visible animation includes this later-style treatment.

The source dates and the current upload therefore describe different historical
evidence. Classic is a modern remake of the recovered visual family, with the
specific refinements below.

## Current compositions

| Composition | Logical canvas | Motion contract |
| --- | --- | --- |
| Classic (`readme-classic`) | 500×350 | Ten-second, single-play ledger intro |
| Signature (`readme`) | 560×390 | Ten-second ambient filament loop; text remains visible |
| Spotlight (`readme-spotlight`) | 560×440 | Twelve-second ambient loop; contribution total is the focal point |

Output defaults to 2× logical dimensions. The committed preview animations use
1× to keep delivery compact, and include PNG posters.

### Classic

- Four-pixel transparent gutter; 492×342 panel; 12px radius and padding.
- Forty-pixel avatar/initials and one regular personal greeting.
- Nine unboxed rows, 20px high with 8px gaps; one right-aligned value column.
- Original five Bézier traces and ink colors: `#FFB7C5`, `#FFDDB7`, `#B1C5FF`,
  `#4FABFF`, `#076EFF`; recovered-family top 144px / −105° placement.
- Final values are present throughout each row's fade. Random digit scrambling
  is replaced by deterministic rendering. Rows finish their entrance at 2.6s;
  beam drawing settles before the final hold.

### Signature and Spotlight

Signature keeps a compact identity, a seven-row core ledger, a small language
signature, and a collection-status note. Spotlight emphasizes the contribution
total with four supporting metrics. Optional traffic/line metrics have dedicated
supporting cards and remain in Classic's full ledger.

The looping variants keep text stable at the loop boundary and animate only the
filaments. Explicit layering places the panel surface below the effect and the
content above it. All variants use locally bundled **Fira Code**, with full
identity text available through accessible labels/tooltips when visually clipped.

## Metric meaning and availability

- Profile stars/forks/languages/code volume describe **owned original
  repositories**; public repository count also includes owned forks.
- Commits come from profile contribution history, not optional contributor
  backfill. Contributions cover collected years; missing history is reported.
- “Open issues” means currently open issues. “Repo views (2 wks)” is GitHub's
  14-day traffic window. Lines changed means **additions + deletions**, correcting
  the historical collector's addition of commit counts to that unit.
- Pending/failed/unknown optional coverage remains visible. Known cached values
  are retained; missing data does not become a verified zero.
- Preview identities, package names, and metrics are synthetic. Remote avatars
  are not required; initials provide the offline fallback.

The rendered-layout harness checks actual foreground text/graphics, certified
ellipsis, font loading, composition bounds, and public-API PNG parity. Its
controls exercise clipping failures as well as clean layouts. Native DOM refs
avoid Remotion 4.0.509's React-18 `AbsoluteFill` ref-forwarding issue. Pixel and
encoded-animation review are recorded separately in the preview verification
results.

## Attribution

The article credits **Luke Parke**; its original image alt text names **Luke
Hagar**. Linked repositories are now available under `LukasParke`. The earlier
SVG lineage credits [jstrieb/github-stats][jstrieb]. Historical downloads are
research evidence; the committed previews are newly generated from synthetic
data. Fira Code's SIL OFL license is bundled with the renderer; Remotion retains
[its own license terms](https://www.remotion.dev/license).

[post]: https://dev.to/lukeparke/the-next-generation-of-github-profile-stats-1nh8
[upload]: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/4edjg0n7e21ieex6he10.gif
[march]: https://github.com/LukasParke/github-stats-remotion/blob/c3c981e2078d43310867023cc0fbf2fcfb1343ed/src/components/ReadmeContent.tsx
[november]: https://github.com/LukasParke/github-stats-remotion/blob/1acd58df737b05c701bad61700c431d844dd90d5/src/components/Cards/ReadmeCard.tsx
[jstrieb]: https://github.com/jstrieb/github-stats
