# Stats input and merge contracts

`GitHubStatsOutput` is the canonical producer document; `UserStats` is the renderer
model with synchronized display aliases. Zod 4 schemas are the runtime source of truth; v2 producer types are inferred
from those schemas rather than maintained as a second set of shape definitions.
Existing imports remain available from `@lukasparke/diffler-schemas` and the renderer's data
index.

## Boundaries

- `githubStatsOutputSchema` validates the **full canonical** producer output,
  including package metrics. It projects away historical root aliases and `legacy`.
- `githubStatsV2InputSchema` accepts the renderable v2 subset: `schemaVersion: 2`,
  a valid ISO `generatedAt`, the canonical `profile`, and canonical
  `profileContributions` are required. Activity, repository metrics/details,
  collection status, privacy, legacy aliases and presentation may be omitted.
  The contributor and traffic groups within repository metrics may also be
  omitted. Supplied groups/fields must be well-formed; their values are not coerced.
- `legacyStatsInputSchema` explicitly supports **versionless** flat exports.
  `username`, an epoch-millisecond `fetchedAt`, `totalContributions`, and at least
  one of `totalCommits`, `commitCount`, or
  `contributionsCollection.totalCommitContributions` are required. Other legacy
  fields are optional but validated. Language `name`/`bytes` and omitted colors
  or percentages are explicit legacy compatibility forms. A provided legacy
  collection must contain its calendar.
- `githubStatsInputSchema` is the raw v2/legacy union. Error responses, unknown
  schema versions (including `1`, `null` and string `"2"`), invalid dates,
  nonfinite/negative/fractional counts and malformed known fields fail validation.
- `normalizeGithubStats(raw, options?)` validates raw input and projects it to
  `UserStats`. `normalizeUserStats(value, options?)` is the separate boundary for
  already-normalized data. Both reject reported private repository details unless
  `allowPrivateRepositoryDetails` is explicitly `true`. Normalized data has no
  repository records, so its privacy report is the available evidence.

`fetchUserStats(input)` validates unknown props with `sourcePropsSchema`. Supported
props are `stats`, HTTP(S) `statsUrl`, `usernames`, `username`, `userStats`, and the
optional boolean privacy override. Username arrays must be nonempty and unique
(case-insensitively). Selection precedence is:

1. `stats` (raw JSON)
2. `statsUrl`
3. `usernames`
4. `username`
5. `userStats` (already normalized)

All supplied known props are validated, including lower-priority ones. Explicit
sources take precedence over a composition's normalized demo defaults. Missing
sources, bad JSON, network/HTTP errors and validation errors reject; they never
select an implicit account or demo fallback. Root/calculateMetadata can pass its
supplied props directly to `fetchUserStats`, without reading global input props.

## Metric authority and availability

- v2 commits, contribution totals, streaks, peak dates and yearly/monthly history
  come from `profileContributions`, not repository backfill or presentation/legacy
  aliases. Optional repo commit counts describe a different scope.
- Legacy commits prefer collection commit contributions, then `totalCommits`,
  then the explicitly supported older `commitCount` alias.
- Profile-facing repository metrics prefer `repoMetrics.profile`. Historical v2
  records derive the same owned-original scope from repository records. Forks and
  contributed/affiliated repositories cannot inflate original-repository metrics.
  The presentation's top-five language list is never used as a complete language
  dataset. Percentages use the scoped byte total.
- Explicit anonymous private metrics are accepted without opting into private
  repository details. The detail guard checks flags and repository records,
  including historical v2 aliases, before normalization or canonical merging.
- Absent groups retain numeric placeholders required by `UserStats`, but cannot
  yield a complete profile. Coverage counters are preserved when reported. Missing
  groups do **not** fabricate completed, pending, or failed repositories; warnings
  explain unknown coverage. Zero completed/pending/failed coverage with nonzero
  repositories is also unknown, not evidence of measured zero optional metrics.
- `collectionStatus.coverageKnown` carries per-metric unknown coverage across
  merges, so another account's successful sample cannot erase it. Retry queues,
  failures, and retained cache successes can overlap; their counters are displayed
  separately and are never added into a distinct-repository denominator.
- `isComplete` and `collectionStatus.complete` agree and require core completeness,
  no errors/pending/failed metrics, complete package collection, and known optional coverage. Partial calendars
  or language lists also keep `coreComplete` false. Legacy coverage cannot be
  certified and therefore remains incomplete, even for a full flat export.
- Summary and top-level aliases are synchronized from their nested metric groups.
  `linesChanged` aliases `linesOfCodeChanged`. No timestamps use wall-clock fallbacks.

## Multiple profiles

`fetchUserStats` validates and privacy-checks each document first. Full canonical
documents use the shared `mergeStatsOutputs` path, deduplicating repository IDs,
rebuilding profile scope/calendars/presentation, and deduplicating packages by
provider/name. Without per-repository caches, overlapping traffic remains an
explicitly incomplete additive observation. The collector adds account-isolated
cache evidence to produce deduplicated traffic and conservative pending coverage.

Sparse v2, legacy, and already-normalized inputs use `mergeUserStats` below.

`mergeUserStats` returns an independent validated result; no input objects or nested
arrays are mutated. Duplicate profile usernames are rejected rather than treated
as additive snapshots. Profile identity comes from the first source. Generation
and fetch timestamps use the newest source; summary refresh uses the oldest.

Repository counts, language bytes, traffic (including uniques), community counts,
coverage and redaction counts are **additive source totals**, not globally unique
counts. `UserStats` contains no repository/person/visitor IDs, so overlaps cannot
be deduplicated honestly. The output includes a warning documenting this limitation.
Language count is the observed union of names; omitted names in truncated inputs
cannot be inferred or deduplicated. Per-profile formatted cards/highlights are
omitted rather than retained as stale aggregate metrics.

Calendar dates are sorted and summed across distinct profiles. Repeated dates
within one profile (such as contribution-year boundaries) use the maximum observed
count for that profile/day, not an additive count. Merged streaks, peak day and peak
month are recalculated from these observed dates, respecting gaps and UTC day
boundaries. Current streak is measured as of the newest generation date and may
continue through yesterday when today has no contributions. Missing calendar data
is flagged; individual streak summaries are never summed/maxed to invent dates.
Timelines sum each supplied period. Completeness requires every source to be
complete, while warnings/errors and privacy flags are retained from all sources.
Canonical merging preserves reported calendar totals when daily observations are
missing and marks the result incomplete. Generation timestamps are compared as
instants, with calendar cutoffs derived in UTC even for offset-bearing inputs.

## Demo and checks

`demoStats` is an explicitly illustrative, incomplete fixture. `defaultStats` is
its backward-compatible alias. Timestamps are fixed at
`2026-05-29T00:00:00.000Z` / `1780012800000`; neither is an error fallback.

Schema tests live in `packages/schemas/tests/*.test.ts`; the small shared fixture is
in that directory as well. The package test script needs to run those files (a
plain `vitest run` does). They stay outside the schema build's `src` root. Renderer
data tests are colocated `src/data/*.test.ts`. Vitest resolves the shared schema
source; the graphics harness and packed consumer checks exercise built public entries.
The producer compatibility test imports the real collector builder and round-trips
its output through JSON; it performs no network requests and fixes the clock.
