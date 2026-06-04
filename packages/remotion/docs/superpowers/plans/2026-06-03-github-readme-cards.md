# GitHub README Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the `github-stats-remotion` template into a publishable npm package (`github-readme-cards`) with reusable components, a theme system, data helpers, and a render pipeline.

**Architecture:** Single package with conditional exports (`/cards`, `/themes`, `/render`). Source stays in `src/`. The existing app moves to `example/` as a dogfooding consumer. Build via `tsup`. Tests via `vitest`.

**Tech Stack:** Remotion, React, TypeScript, Tailwind CSS, Zod, tsup, vitest

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Package manifest, exports map, peer deps, scripts |
| `tsup.config.ts` | Build config (ESM + CJS + dts) |
| `vitest.config.ts` | Test runner config |
| `src/index.ts` | Core library barrel export |
| `src/cards/index.ts` | Pre-built cards barrel export |
| `src/cards/*.tsx` | Individual card components |
| `src/components/primitives/*.tsx` | Reusable layout primitives (Panel, MetricTile, ProgressBar, etc.) |
| `src/components/effects/*.tsx` | Animation effects (AnimatedCounter, GeminiBeams) |
| `src/themes/*.ts` | Theme definitions, provider, hook |
| `src/data/schemas.ts` | Zod schemas for stats JSON |
| `src/data/fetch.ts` | `fetchUserStats` and input validation |
| `src/data/adapter.ts` | Manual normalization (v2 + legacy) |
| `src/data/defaultStats.ts` | Default stats fixture |
| `src/render/api.ts` | `renderCards()` programmatic API |
| `src/render/cli.ts` | CLI entrypoint |
| `src/render/config.ts` | Render configuration types |
| `src/utils/format.ts` | Number / byte formatting |
| `src/utils/animation.ts` | Remotion animation helpers |
| `src/utils/languages.ts` | Language color map (moved from `src/Languages.ts`) |
| `src/types/index.ts` | Shared TypeScript interfaces |
| `example/src/Root.tsx` | Dogfooding Remotion root with compositions |
| `example/src/index.tsx` | `registerRoot` entry |
| `example/remotion.config.ts` | Remotion config for example |
| `example/package.json` | Example app dependencies |

---

## Task 1: Package Infrastructure

**Files:**
- Modify: `package.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Update `package.json`**

```json
{
  "name": "github-readme-cards",
  "version": "0.1.0",
  "description": "Remotion components and helpers for generating animated GitHub profile README cards",
  "sideEffects": [
    "*.css"
  ],
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
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
  },
  "files": [
    "dist",
    "README.md"
  ],
  "bin": {
    "github-readme-cards": "./dist/render/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "ESLINT_USE_FLAT_CONFIG=false eslint src --ext ts,tsx,js,jsx",
    "prepare:stats": "node scripts/prepare-stats.mjs",
    "render": "yarn render:all",
    "render:all": "node scripts/render-assets.mjs --formats=webp,gif",
    "render:webp": "node scripts/render-assets.mjs --formats=webp",
    "render:gif": "node scripts/render-assets.mjs --formats=gif"
  },
  "peerDependencies": {
    "remotion": ">=4.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "zod": ">=3.0.0"
  },
  "dependencies": {
    "axios": "^1.7.7",
    "clsx": "^2.1.1",
    "lucide-react": "^0.446.0",
    "octokit": "^4.0.2",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@remotion/bundler": "^4.0.214",
    "@remotion/cli": "^4.0.214",
    "@remotion/eslint-config": "^4.0.214",
    "@remotion/tailwind": "^4.0.214",
    "@remotion/zod-types": "^4.0.214",
    "@types/react": "^18.3.10",
    "@types/web": "^0.0.167",
    "eslint": "^8.57.1",
    "prettier": "^3.3.3",
    "tsup": "^8.0.0",
    "typescript": "^5.6.2",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsup.config.ts`**

```ts
import {defineConfig} from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cards/index.ts',
    'src/themes/index.ts',
    'src/render/index.ts',
    'src/render/cli.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['remotion', 'react', 'react-dom', 'zod'],
});
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Add `dist/` to `.gitignore`**

```
dist/
```

- [ ] **Step 5: Install dependencies**

Run: `yarn add -D tsup vitest`

- [ ] **Step 6: Commit**

```bash
git add package.json tsup.config.ts vitest.config.ts .gitignore
yarn install --frozen-lockfile
git add yarn.lock
git commit -m "chore: set up package infrastructure (tsup, vitest, exports)"
```

---

## Task 2: Extract Data Layer & Types

**Files:**
- Create: `src/data/schemas.ts`
- Create: `src/data/fetch.ts`
- Create: `src/data/adapter.ts`
- Create: `src/types/index.ts`
- Create: `src/data/index.ts`
- Modify: `src/config.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

Move the legacy GraphQL types from `src/Types.ts` here:

```ts
export type {Language, ContributionData, ContributionsCollection} from './legacy';
```

Actually, `src/Types.ts` contains legacy GraphQL types that are no longer used by the main cards. For the library, keep them but move to `src/types/legacy.ts` and re-export from `src/types/index.ts`.

For the plan, show the complete code:

```ts
// src/types/index.ts
export * from './legacy';
```

And move `src/Types.ts` to `src/types/legacy.ts` with no changes.

- [ ] **Step 2: Create `src/data/schemas.ts`**

Extract all Zod schemas from `src/config.ts`:

```ts
import {z} from 'zod';

export const renderLanguageSchema = z.object({
  languageName: z.string(),
  color: z.string().nullable(),
  value: z.number(),
  percentage: z.number().optional(),
});

export const contributionDaySchema = z.object({
  contributionCount: z.number(),
  date: z.string(),
});

export const timelinePointSchema = z.object({
  period: z.string(),
  contributions: z.number(),
});

export const metricCardSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  detail: z.string().optional(),
});

export const userStatsSchema = z.object({
  schemaVersion: z.number().nullable(),
  name: z.string(),
  username: z.string(),
  avatarUrl: z.string(),
  bio: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  location: z.string().nullable(),
  generatedAt: z.string(),
  fetchedAt: z.number(),
  isComplete: z.boolean(),
  summary: z.object({
    totalContributions: z.number(),
    currentStreak: z.number(),
    longestStreak: z.number(),
    starsReceived: z.number(),
    forksReceived: z.number(),
    activeRepos: z.number(),
    totalRepos: z.number(),
    languageCount: z.number(),
    refreshedAt: z.string(),
  }),
  contributions: z.object({
    totalContributions: z.number(),
    totalCommits: z.number(),
    restrictedContributionsCount: z.number(),
    currentStreak: z.number(),
    longestStreak: z.number(),
    peakDay: z
      .object({
        date: z.string(),
        contributions: z.number(),
      })
      .nullable(),
    mostProductiveMonth: z
      .object({
        month: z.string(),
        contributions: z.number(),
      })
      .nullable(),
    calendar: z.array(contributionDaySchema),
    timeline: z.array(timelinePointSchema),
  }),
  code: z.object({
    codeByteTotal: z.number(),
    linesAdded: z.number(),
    linesDeleted: z.number(),
    linesChanged: z.number(),
    linesOfCodeChanged: z.number(),
    contributorReposCompleted: z.number(),
    contributorReposPending: z.number(),
    contributorReposFailed: z.number(),
  }),
  community: z.object({
    totalPullRequests: z.number(),
    totalPullRequestReviews: z.number(),
    openIssues: z.number(),
    closedIssues: z.number(),
    repositoriesContributedTo: z.number(),
    discussionsStarted: z.number(),
    discussionsAnswered: z.number(),
    starsGiven: z.number(),
    followers: z.number(),
    following: z.number(),
  }),
  repositories: z.object({
    totalRepos: z.number(),
    publicRepos: z.number(),
    privateRepos: z.number(),
    activeRepos: z.number(),
    archivedRepos: z.number(),
    forkedRepos: z.number(),
    originalRepos: z.number(),
    reposWithStars: z.number(),
    repoViews: z.number(),
    repoViewUniques: z.number(),
    trafficReposCompleted: z.number(),
    trafficReposPending: z.number(),
    trafficReposFailed: z.number(),
    starCount: z.number(),
    forkCount: z.number(),
  }),
  topLanguages: z.array(renderLanguageSchema),
  cards: z.array(metricCardSchema),
  highlights: z.array(metricCardSchema),
  privacy: z.object({
    privateRepositoryDetailsIncluded: z.boolean(),
    privateCacheDetailsIncluded: z.boolean(),
    redactedPrivateRepositories: z.number(),
    redactedRepositoryContributions: z.number(),
    redactedOptionalMetrics: z.number(),
  }),
  collectionStatus: z.object({
    complete: z.boolean(),
    coreComplete: z.boolean(),
    backfillPending: z.number(),
    backfillCompletedThisRun: z.number(),
    backfillFailedThisRun: z.number(),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
  }),
  repoViews: z.number(),
  linesOfCodeChanged: z.number(),
  linesAdded: z.number(),
  linesDeleted: z.number(),
  linesChanged: z.number(),
  totalCommits: z.number(),
  totalPullRequests: z.number(),
  totalPullRequestReviews: z.number(),
  openIssues: z.number(),
  closedIssues: z.number(),
  forkCount: z.number(),
  starCount: z.number(),
  totalContributions: z.number(),
  codeByteTotal: z.number(),
});

export const sourcePropsSchema = z.object({
  username: z.string().optional(),
  usernames: z.array(z.string()).optional(),
  statsUrl: z.string().optional(),
  stats: z.unknown().optional(),
  allowPrivateRepositoryDetails: z.boolean().optional(),
});

export const mainSchema = z.object({
  userStats: userStatsSchema,
});

export type RenderLanguage = z.infer<typeof renderLanguageSchema>;
export type MetricCard = z.infer<typeof metricCardSchema>;
export type SourceProps = z.infer<typeof sourcePropsSchema>;
export type MainProps = z.infer<typeof mainSchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
```

- [ ] **Step 3: Create `src/data/fetch.ts`**

Move `getUserStats` from `src/functions/setup.ts` and simplify to use the adapter:

```ts
import {SourceProps, UserStats} from './schemas';
import {normalizeGithubStats} from './adapter';

const defaultStatsTemplate = (username: string) =>
  `https://raw.githubusercontent.com/${username}/stats/main/github-user-stats.json`;

export async function fetchUserStats(
  inputProps: SourceProps
): Promise<UserStats> {
  const allowPrivateRepositoryDetails =
    inputProps.allowPrivateRepositoryDetails === true;

  if (inputProps.stats) {
    return normalizeGithubStats(inputProps.stats, {
      allowPrivateRepositoryDetails,
    });
  }

  const urls = getStatsUrls(inputProps);
  const stats = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'github-readme-cards',
        },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch stats from ${url}: ${response.status}`
        );
      }
      return normalizeGithubStats(await response.json(), {
        allowPrivateRepositoryDetails,
      });
    })
  );

  return mergeUserStats(stats);
}

function getStatsUrls(inputProps: SourceProps): string[] {
  if (inputProps.statsUrl) {
    return [inputProps.statsUrl];
  }

  const usernames = inputProps.usernames?.length
    ? inputProps.usernames
    : [inputProps.username || 'LukasParke'];

  return usernames.map((username) => defaultStatsTemplate(username));
}

function mergeUserStats(stats: UserStats[]): UserStats {
  if (stats.length === 0) {
    throw new Error('No GitHub stats were loaded');
  }

  const [first, ...rest] = stats;
  if (rest.length === 0) {
    return first;
  }

  for (const stat of rest) {
    first.summary.totalContributions += stat.summary.totalContributions;
    first.summary.starsReceived += stat.summary.starsReceived;
    first.summary.forksReceived += stat.summary.forksReceived;
    first.summary.activeRepos += stat.summary.activeRepos;
    first.summary.totalRepos += stat.summary.totalRepos;
    first.contributions.totalContributions +=
      stat.contributions.totalContributions;
    first.contributions.totalCommits += stat.contributions.totalCommits;
    first.contributions.restrictedContributionsCount +=
      stat.contributions.restrictedContributionsCount;
    first.code.codeByteTotal += stat.code.codeByteTotal;
    first.code.linesAdded += stat.code.linesAdded;
    first.code.linesDeleted += stat.code.linesDeleted;
    first.code.linesChanged += stat.code.linesChanged;
    first.code.linesOfCodeChanged += stat.code.linesOfCodeChanged;
    first.community.totalPullRequests += stat.community.totalPullRequests;
    first.community.totalPullRequestReviews +=
      stat.community.totalPullRequestReviews;
    first.community.openIssues += stat.community.openIssues;
    first.community.closedIssues += stat.community.closedIssues;
    first.community.repositoriesContributedTo +=
      stat.community.repositoriesContributedTo;
    first.repositories.repoViews += stat.repositories.repoViews;
    first.repositories.repoViewUniques += stat.repositories.repoViewUniques;
    first.repositories.starCount += stat.repositories.starCount;
    first.repositories.forkCount += stat.repositories.forkCount;
    first.topLanguages = mergeLanguages(first.topLanguages, stat.topLanguages);
    first.contributions.timeline = mergeTimeline(
      first.contributions.timeline,
      stat.contributions.timeline
    );
  }

  first.repoViews = first.repositories.repoViews;
  first.linesOfCodeChanged = first.code.linesOfCodeChanged;
  first.linesAdded = first.code.linesAdded;
  first.linesDeleted = first.code.linesDeleted;
  first.linesChanged = first.code.linesChanged;
  first.totalCommits = first.contributions.totalCommits;
  first.totalPullRequests = first.community.totalPullRequests;
  first.totalPullRequestReviews = first.community.totalPullRequestReviews;
  first.openIssues = first.community.openIssues;
  first.closedIssues = first.community.closedIssues;
  first.forkCount = first.repositories.forkCount;
  first.starCount = first.repositories.starCount;
  first.totalContributions = first.contributions.totalContributions;
  first.codeByteTotal = first.code.codeByteTotal;

  return first;
}

function mergeLanguages(
  currentLanguages: UserStats['topLanguages'],
  nextLanguages: UserStats['topLanguages']
): UserStats['topLanguages'] {
  const totalBytes =
    sum(currentLanguages.map((l) => l.value)) +
    sum(nextLanguages.map((l) => l.value));

  const byName = new Map<string, UserStats['topLanguages'][number]>();
  for (const lang of [...currentLanguages, ...nextLanguages]) {
    const current = byName.get(lang.languageName);
    if (!current) {
      byName.set(lang.languageName, {...lang});
      continue;
    }
    current.value += lang.value;
    current.percentage =
      totalBytes > 0 ? (current.value / totalBytes) * 100 : current.percentage;
  }

  return [...byName.values()].sort((a, b) => b.value - a.value);
}

function mergeTimeline(
  current: UserStats['contributions']['timeline'],
  next: UserStats['contributions']['timeline']
): UserStats['contributions']['timeline'] {
  const byPeriod = new Map<string, number>();
  for (const item of [...current, ...next]) {
    byPeriod.set(item.period, (byPeriod.get(item.period) || 0) + item.contributions);
  }
  return [...byPeriod.entries()]
    .map(([period, contributions]) => ({period, contributions}))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
```

- [ ] **Step 4: Create `src/data/adapter.ts`**

Move the normalization logic from `src/functions/setup.ts`:

```ts
import {
  RenderLanguage,
  UserStats,
  MetricCard,
  contributionDaySchema,
  timelinePointSchema,
} from './schemas';

type UnknownRecord = Record<string, unknown>;

export function normalizeGithubStats(
  rawValue: unknown,
  options: {allowPrivateRepositoryDetails: boolean}
): UserStats {
  const raw = asRecord(rawValue);
  const schemaVersion = asNumber(raw.schemaVersion, null);

  assertPublicSafe(raw, options.allowPrivateRepositoryDetails);

  if (schemaVersion === 2) {
    return normalizeV2Stats(raw);
  }

  return normalizeLegacyStats(raw);
}

function normalizeV2Stats(raw: UnknownRecord): UserStats {
  const profile = asRecord(raw.profile);
  const legacy = asRecord(raw.legacy);
  const presentation = asRecord(raw.presentation);
  const readmeSummary = asRecord(presentation.readmeSummary);
  const profileContributions = asRecord(raw.profileContributions);
  const activity = asRecord(raw.activity);
  const repoMetrics = asRecord(raw.repoMetrics);
  const contributorStats = asRecord(asRecord(repoMetrics.contributorStats));
  const traffic = asRecord(asRecord(repoMetrics.traffic));
  const repoStats = asRecord(asRecord(repoMetrics.repoStats));
  const computedStats = asRecord(asRecord(repoMetrics.computedStats));
  const contributionStats = asRecord(asRecord(legacy.contributionStats));
  const privacy = asRecord(raw.privacy);
  const collectionStatus = asRecord(raw.collectionStatus);
  const backfill = asRecord(collectionStatus.backfill);

  const topLanguages = normalizeLanguages(
    firstArray(
      readmeSummary.topLanguages,
      repoMetrics.topLanguages,
      legacy.topLanguages
    ),
    asNumber(repoMetrics.codeByteTotal, asNumber(legacy.codeByteTotal, 0))
  );
  const totalContributions = asNumber(
    readmeSummary.totalContributions,
    asNumber(
      profileContributions.totalContributions,
      asNumber(legacy.totalContributions, 0)
    )
  );
  const starCount = asNumber(
    readmeSummary.starsReceived,
    asNumber(repoMetrics.starCount, asNumber(legacy.starCount, 0))
  );
  const forkCount = asNumber(
    readmeSummary.forksReceived,
    asNumber(repoMetrics.forkCount, asNumber(legacy.forkCount, 0))
  );
  const activeRepos = asNumber(
    readmeSummary.activeRepos,
    asNumber(repoStats.activeRepos, asNumber(computedStats.activeRepos, 0))
  );
  const totalRepos = asNumber(
    repoStats.totalRepos,
    asNumber(computedStats.totalRepos, activeRepos)
  );
  const fetchedAt = asNumber(legacy.fetchedAt, Date.parse(asString(raw.generatedAt)));
  const generatedAt =
    asString(raw.generatedAt) || new Date(fetchedAt || Date.now()).toISOString();
  const contributionCalendar = normalizeContributionCalendar(
    asRecord(profileContributions.contributionCalendar)
  );
  const timeline = normalizeTimeline(
    firstArray(presentation.timeline, asRecord(legacy.contributionStats).yearlyBreakdown)
  );
  const linesAdded = asNumber(
    contributorStats.linesAdded,
    asNumber(legacy.linesAdded, 0)
  );
  const linesDeleted = asNumber(
    contributorStats.linesDeleted,
    asNumber(legacy.linesDeleted, 0)
  );
  const linesOfCodeChanged = asNumber(
    contributorStats.linesOfCodeChanged,
    asNumber(legacy.linesOfCodeChanged, linesAdded + linesDeleted)
  );
  const linesChanged = asNumber(
    legacy.linesChanged,
    asNumber(contributorStats.linesOfCodeChanged, linesOfCodeChanged)
  );
  const backfillPending = asNumber(backfill.pending, 0);
  const isComplete = Boolean(
    readmeSummary.complete ??
      (collectionStatus.complete === true && backfillPending === 0)
  );

  return {
    schemaVersion: 2,
    name:
      asString(readmeSummary.name) ||
      asString(profile.name) ||
      asString(legacy.name) ||
      asString(profile.login) ||
      asString(legacy.username) ||
      'GitHub User',
    username:
      asString(readmeSummary.username) ||
      asString(profile.login) ||
      asString(legacy.username) ||
      'LukasParke',
    avatarUrl: asString(profile.avatarUrl) || asString(legacy.avatarUrl),
    bio: asNullableString(profile.bio ?? legacy.bio),
    websiteUrl: asNullableString(profile.websiteUrl ?? legacy.websiteUrl),
    location: asNullableString(profile.location ?? legacy.location),
    generatedAt,
    fetchedAt,
    isComplete,
    summary: {
      totalContributions,
      currentStreak: asNumber(
        readmeSummary.currentStreak,
        asNumber(contributionStats.currentStreak, 0)
      ),
      longestStreak: asNumber(
        readmeSummary.longestStreak,
        asNumber(contributionStats.longestStreak, 0)
      ),
      starsReceived: starCount,
      forksReceived: forkCount,
      activeRepos,
      totalRepos,
      languageCount: asNumber(
        computedStats.languageCount,
        asNumber(readmeSummary.languageCount, topLanguages.length)
      ),
      refreshedAt: asString(readmeSummary.refreshedAt) || generatedAt,
    },
    contributions: {
      totalContributions,
      totalCommits: asNumber(
        contributorStats.totalCommits,
        asNumber(legacy.totalCommits, asNumber(profileContributions.totalCommitContributions, 0))
      ),
      restrictedContributionsCount: asNumber(
        profileContributions.restrictedContributionsCount,
        asNumber(
          asRecord(legacy.contributionsCollection).restrictedContributionsCount,
          0
        )
      ),
      currentStreak: asNumber(
        readmeSummary.currentStreak,
        asNumber(contributionStats.currentStreak, 0)
      ),
      longestStreak: asNumber(
        readmeSummary.longestStreak,
        asNumber(contributionStats.longestStreak, 0)
      ),
      peakDay: normalizePeakDay(contributionStats.peakDay),
      mostProductiveMonth: normalizeMostProductiveMonth(computedStats.mostProductiveMonth),
      calendar: contributionCalendar,
      timeline,
    },
    code: {
      codeByteTotal: asNumber(repoMetrics.codeByteTotal, asNumber(legacy.codeByteTotal, 0)),
      linesAdded,
      linesDeleted,
      linesChanged,
      linesOfCodeChanged,
      contributorReposCompleted: asNumber(contributorStats.reposCompleted, 0),
      contributorReposPending: asNumber(contributorStats.reposPending, 0),
      contributorReposFailed: asNumber(contributorStats.reposFailed, 0),
    },
    community: {
      totalPullRequests: asNumber(activity.totalPullRequests, asNumber(legacy.totalPullRequests, 0)),
      totalPullRequestReviews: asNumber(
        legacy.totalPullRequestReviews,
        asNumber(profileContributions.totalPullRequestReviewContributions, 0)
      ),
      openIssues: asNumber(activity.openIssues, asNumber(legacy.openIssues, 0)),
      closedIssues: asNumber(activity.closedIssues, asNumber(legacy.closedIssues, 0)),
      repositoriesContributedTo: asNumber(
        activity.repositoriesContributedTo,
        asNumber(legacy.repositoriesContributedTo, 0)
      ),
      discussionsStarted: asNumber(
        activity.discussionsStarted,
        asNumber(legacy.discussionsStarted, 0)
      ),
      discussionsAnswered: asNumber(
        activity.discussionsAnswered,
        asNumber(legacy.discussionsAnswered, 0)
      ),
      starsGiven: asNumber(activity.starsGiven, asNumber(legacy.starsGiven, 0)),
      followers: asNumber(profile.followers, asNumber(legacy.followers, 0)),
      following: asNumber(profile.following, asNumber(legacy.following, 0)),
    },
    repositories: {
      totalRepos,
      publicRepos: asNumber(repoStats.publicRepos, asNumber(computedStats.publicRepos, 0)),
      privateRepos: asNumber(repoStats.privateRepos, asNumber(computedStats.privateRepos, 0)),
      activeRepos,
      archivedRepos: asNumber(repoStats.archivedRepos, asNumber(computedStats.archivedRepos, 0)),
      forkedRepos: asNumber(repoStats.forkedRepos, asNumber(computedStats.forkedRepos, 0)),
      originalRepos: asNumber(repoStats.originalRepos, asNumber(computedStats.originalRepos, 0)),
      reposWithStars: asNumber(repoStats.reposWithStars, asNumber(computedStats.reposWithStars, 0)),
      repoViews: asNumber(traffic.repoViews, asNumber(legacy.repoViews, 0)),
      repoViewUniques: asNumber(traffic.repoViewUniques, 0),
      trafficReposCompleted: asNumber(traffic.reposCompleted, 0),
      trafficReposPending: asNumber(traffic.reposPending, 0),
      trafficReposFailed: asNumber(traffic.reposFailed, 0),
      starCount,
      forkCount,
    },
    topLanguages,
    cards: normalizeMetricCards(presentation.cards),
    highlights: normalizeMetricCards(presentation.highlights),
    privacy: {
      privateRepositoryDetailsIncluded: privacy.privateRepositoryDetailsIncluded === true,
      privateCacheDetailsIncluded: privacy.privateCacheDetailsIncluded === true,
      redactedPrivateRepositories: asNumber(privacy.redactedPrivateRepositories, 0),
      redactedRepositoryContributions: asNumber(privacy.redactedRepositoryContributions, 0),
      redactedOptionalMetrics: asNumber(privacy.redactedOptionalMetrics, 0),
    },
    collectionStatus: {
      complete: isComplete,
      coreComplete: collectionStatus.coreComplete !== false,
      backfillPending,
      backfillCompletedThisRun: asNumber(backfill.completedThisRun, 0),
      backfillFailedThisRun: asNumber(backfill.failedThisRun, 0),
      warnings: asStringArray(collectionStatus.warnings),
      errors: asStringArray(collectionStatus.errors),
    },
    repoViews: asNumber(traffic.repoViews, asNumber(legacy.repoViews, 0)),
    linesOfCodeChanged,
    linesAdded,
    linesDeleted,
    linesChanged,
    totalCommits: asNumber(contributorStats.totalCommits, asNumber(legacy.totalCommits, 0)),
    totalPullRequests: asNumber(activity.totalPullRequests, asNumber(legacy.totalPullRequests, 0)),
    totalPullRequestReviews: asNumber(
      legacy.totalPullRequestReviews,
      asNumber(profileContributions.totalPullRequestReviewContributions, 0)
    ),
    openIssues: asNumber(activity.openIssues, asNumber(legacy.openIssues, 0)),
    closedIssues: asNumber(activity.closedIssues, asNumber(legacy.closedIssues, 0)),
    forkCount,
    starCount,
    totalContributions,
    codeByteTotal: asNumber(repoMetrics.codeByteTotal, asNumber(legacy.codeByteTotal, 0)),
  };
}

function normalizeLegacyStats(raw: UnknownRecord): UserStats {
  const contributionStats = asRecord(raw.contributionStats);
  const repoStats = asRecord(raw.repoStats);
  const computedStats = asRecord(raw.computedStats);
  const contributionsCollection = asRecord(raw.contributionsCollection);
  const totalContributions = asNumber(raw.totalContributions, 0);
  const codeByteTotal = asNumber(raw.codeByteTotal, 0);
  const topLanguages = normalizeLanguages(raw.topLanguages, codeByteTotal);
  const fetchedAt = asNumber(raw.fetchedAt, Date.now());
  const generatedAt = new Date(fetchedAt).toISOString();
  const linesAdded = asNumber(raw.linesAdded, 0);
  const linesDeleted = asNumber(raw.linesDeleted, 0);
  const linesOfCodeChanged = asNumber(raw.linesOfCodeChanged, linesAdded + linesDeleted);

  return {
    schemaVersion: null,
    name: asString(raw.name) || asString(raw.username) || 'GitHub User',
    username: asString(raw.username) || 'LukasParke',
    avatarUrl: asString(raw.avatarUrl),
    bio: asNullableString(raw.bio),
    websiteUrl: asNullableString(raw.websiteUrl),
    location: asNullableString(raw.location),
    generatedAt,
    fetchedAt,
    isComplete: true,
    summary: {
      totalContributions,
      currentStreak: asNumber(contributionStats.currentStreak, 0),
      longestStreak: asNumber(contributionStats.longestStreak, 0),
      starsReceived: asNumber(raw.starCount, 0),
      forksReceived: asNumber(raw.forkCount, 0),
      activeRepos: asNumber(repoStats.activeRepos, 0),
      totalRepos: asNumber(repoStats.totalRepos, asNumber(raw.totalRepos, 0)),
      languageCount: asNumber(computedStats.languageCount, topLanguages.length),
      refreshedAt: generatedAt,
    },
    contributions: {
      totalContributions,
      totalCommits: asNumber(raw.totalCommits, asNumber(raw.commitCount, 0)),
      restrictedContributionsCount: asNumber(
        contributionsCollection.restrictedContributionsCount,
        0
      ),
      currentStreak: asNumber(contributionStats.currentStreak, 0),
      longestStreak: asNumber(contributionStats.longestStreak, 0),
      peakDay: normalizePeakDay(contributionStats.peakDay),
      mostProductiveMonth: normalizeMostProductiveMonth(computedStats.mostProductiveMonth),
      calendar: normalizeContributionCalendar(asRecord(contributionsCollection.contributionCalendar)),
      timeline: normalizeTimeline(contributionStats.yearlyBreakdown),
    },
    code: {
      codeByteTotal,
      linesAdded,
      linesDeleted,
      linesChanged: asNumber(raw.linesChanged, linesOfCodeChanged),
      linesOfCodeChanged,
      contributorReposCompleted: 0,
      contributorReposPending: 0,
      contributorReposFailed: 0,
    },
    community: {
      totalPullRequests: asNumber(raw.totalPullRequests, 0),
      totalPullRequestReviews: asNumber(raw.totalPullRequestReviews, 0),
      openIssues: asNumber(raw.openIssues, 0),
      closedIssues: asNumber(raw.closedIssues, 0),
      repositoriesContributedTo: asNumber(raw.repositoriesContributedTo, 0),
      discussionsStarted: asNumber(raw.discussionsStarted, 0),
      discussionsAnswered: asNumber(raw.discussionsAnswered, 0),
      starsGiven: asNumber(raw.starsGiven, 0),
      followers: asNumber(raw.followers, 0),
      following: asNumber(raw.following, 0),
    },
    repositories: {
      totalRepos: asNumber(repoStats.totalRepos, asNumber(raw.totalRepos, 0)),
      publicRepos: asNumber(repoStats.publicRepos, 0),
      privateRepos: asNumber(repoStats.privateRepos, 0),
      activeRepos: asNumber(repoStats.activeRepos, 0),
      archivedRepos: asNumber(repoStats.archivedRepos, 0),
      forkedRepos: asNumber(repoStats.forkedRepos, 0),
      originalRepos: asNumber(repoStats.originalRepos, 0),
      reposWithStars: asNumber(repoStats.reposWithStars, 0),
      repoViews: asNumber(raw.repoViews, 0),
      repoViewUniques: 0,
      trafficReposCompleted: 0,
      trafficReposPending: 0,
      trafficReposFailed: 0,
      starCount: asNumber(raw.starCount, 0),
      forkCount: asNumber(raw.forkCount, 0),
    },
    topLanguages,
    cards: [],
    highlights: [],
    privacy: {
      privateRepositoryDetailsIncluded: false,
      privateCacheDetailsIncluded: false,
      redactedPrivateRepositories: 0,
      redactedRepositoryContributions: 0,
      redactedOptionalMetrics: 0,
    },
    collectionStatus: {
      complete: true,
      coreComplete: true,
      backfillPending: 0,
      backfillCompletedThisRun: 0,
      backfillFailedThisRun: 0,
      warnings: [],
      errors: [],
    },
    repoViews: asNumber(raw.repoViews, 0),
    linesOfCodeChanged,
    linesAdded,
    linesDeleted,
    linesChanged: asNumber(raw.linesChanged, linesOfCodeChanged),
    totalCommits: asNumber(raw.totalCommits, asNumber(raw.commitCount, 0)),
    totalPullRequests: asNumber(raw.totalPullRequests, 0),
    totalPullRequestReviews: asNumber(raw.totalPullRequestReviews, 0),
    openIssues: asNumber(raw.openIssues, 0),
    closedIssues: asNumber(raw.closedIssues, 0),
    forkCount: asNumber(raw.forkCount, 0),
    starCount: asNumber(raw.starCount, 0),
    totalContributions,
    codeByteTotal,
  };
}

function normalizeLanguages(value: unknown, totalBytes: number): RenderLanguage[] {
  const languages = asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const languageName = asString(record.languageName) || asString(record.name) || 'Unknown';
      const bytes = asNumber(record.value, asNumber(record.bytes, 0));
      const percentageValue = asNumber(
        record.percentage,
        totalBytes > 0 ? (bytes / totalBytes) * 100 : 0
      );

      return {
        languageName,
        color: asNullableString(record.color),
        value: bytes,
        percentage: percentageValue,
      };
    })
    .filter((language) => language.value > 0);

  const byName = new Map<string, RenderLanguage>();
  for (const language of languages) {
    const current = byName.get(language.languageName);
    if (!current) {
      byName.set(language.languageName, language);
      continue;
    }
    current.value += language.value;
    current.percentage =
      totalBytes > 0 ? (current.value / totalBytes) * 100 : current.percentage;
  }

  return [...byName.values()].sort((a, b) => b.value - a.value);
}

function normalizeContributionCalendar(calendar: UnknownRecord) {
  return asArray(calendar.weeks).flatMap((week) =>
    asArray(asRecord(week).contributionDays).map((day) => {
      const record = asRecord(day);
      return {
        contributionCount: asNumber(record.contributionCount, 0),
        date: asString(record.date),
      };
    })
  );
}

function normalizeTimeline(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      return {
        period: asString(record.period) || asString(record.year),
        contributions: asNumber(record.contributions, 0),
      };
    })
    .filter((item) => item.period)
    .sort((a, b) => a.period.localeCompare(b.period));
}

function normalizeMetricCards(value: unknown): MetricCard[] {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const id = asString(record.id);
      const label = asString(record.label);
      const rawValue = record.value;

      if (!id || !label || !isStringOrNumber(rawValue)) {
        return null;
      }

      const detail = asString(record.detail);
      const metric: MetricCard = {id, label, value: rawValue};
      if (detail) {
        metric.detail = detail;
      }

      return metric;
    })
    .filter((item): item is MetricCard => item !== null);
}

function normalizePeakDay(value: unknown) {
  const record = asRecord(value);
  const date = asString(record.date);
  if (!date) {
    return null;
  }
  return {date, contributions: asNumber(record.contributions, 0)};
}

function normalizeMostProductiveMonth(value: unknown) {
  const record = asRecord(value);
  const month = asString(record.month);
  if (!month) {
    return null;
  }
  return {month, contributions: asNumber(record.contributions, 0)};
}

function assertPublicSafe(
  raw: UnknownRecord,
  allowPrivateRepositoryDetails: boolean
) {
  const privacy = asRecord(raw.privacy);
  const repositories = asArray(raw.repositories);
  const includesPrivateDetails =
    privacy.privateRepositoryDetailsIncluded === true ||
    repositories.some((repo) => asRecord(repo).isPrivate === true);

  if (includesPrivateDetails && !allowPrivateRepositoryDetails) {
    throw new Error(
      'Stats JSON includes private repository details. Refusing to render public profile assets.'
    );
  }
}

function firstArray(...values: unknown[]) {
  return values.find((value) => Array.isArray(value)) || [];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber<T extends number | null>(value: unknown, fallback: T): number | T {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}
```

- [ ] **Step 5: Create `src/data/index.ts`**

```ts
export * from './schemas';
export {fetchUserStats} from './fetch';
export {normalizeGithubStats} from './adapter';
```

- [ ] **Step 6: Simplify `src/config.ts`**

Remove schemas, keep only timing constants:

```ts
export const FPS = 24;
export const DurationInSeconds = 8;
export const DurationInFrames = FPS * DurationInSeconds;

export const Config = {
  FPS,
  DurationInSeconds,
  DurationInFrames,
};
```

- [ ] **Step 7: Move `src/Types.ts` to `src/types/legacy.ts`**

Run: `mkdir -p src/types && git mv src/Types.ts src/types/legacy.ts`

- [ ] **Step 8: Create `src/types/index.ts`**

```ts
export * from './legacy';
```

- [ ] **Step 9: Commit**

```bash
git add src/data/ src/types/ src/config.ts
git rm src/functions/setup.ts src/Types.ts
git commit -m "refactor: extract data layer and types into modules"
```

---

## Task 3: Extract Utility Functions

**Files:**
- Create: `src/utils/format.ts`
- Create: `src/utils/animation.ts`
- Create: `src/utils/index.ts`
- Modify: `src/functions/utils.ts` (delete after)
- Modify: `src/functions/animations.ts` (delete after)

- [ ] **Step 1: Create `src/utils/format.ts`**

```ts
import {ClassValue, clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function humanReadableFileSize(bytes: number, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ' ' + units[u];
}

export const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
};

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

export function percentage(partialValue: number, totalValue: number) {
  if (totalValue === 0) {
    return 0;
  }
  return (100 * partialValue) / totalValue;
}

export function addCommas(x: number) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `src/utils/animation.ts`**

```ts
import {interpolate, Easing} from 'remotion';
import {FPS} from '../config';

export const fadeInAndSlideUp = (frame: number, delay = 0) => {
  const opacity = interpolate(
    frame - delay,
    [0, 20],
    [0, 1],
    {
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  const y = interpolate(
    frame - delay,
    [0, 30],
    [50, 0],
    {
      extrapolateRight: 'clamp',
      easing: Easing.elastic(1),
    }
  );

  return {opacity, transform: `translateY(${y}px)`};
};

export function interpolateFactory(
  frame: number,
  delayInSeconds: number,
  durationInSeconds: number,
  finalOpacity = 1
) {
  const delay = delayInSeconds * FPS;
  const duration = durationInSeconds * FPS + delay;
  return interpolate(frame, [delay, duration], [0, finalOpacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
```

- [ ] **Step 3: Create `src/utils/index.ts`**

```ts
export * from './format';
export * from './animation';
```

- [ ] **Step 4: Move `src/Languages.ts` to `src/utils/languages.ts`**

Run: `git mv src/Languages.ts src/utils/languages.ts`

- [ ] **Step 5: Delete old function files**

Run: `git rm src/functions/utils.ts src/functions/animations.ts`

Also remove `src/functions/` directory if empty.

- [ ] **Step 6: Commit**

```bash
git add src/utils/
git rm src/functions/utils.ts src/functions/animations.ts
git commit -m "refactor: extract utilities into src/utils/"
```

---

## Task 4: Theme System

**Files:**
- Create: `src/themes/types.ts`
- Create: `src/themes/default.ts`
- Create: `src/themes/dracula.ts`
- Create: `src/themes/github.ts`
- Create: `src/themes/createTheme.ts`
- Create: `src/themes/ThemeProvider.tsx`
- Create: `src/themes/useTheme.ts`
- Create: `src/themes/index.ts`

- [ ] **Step 1: Create `src/themes/types.ts`**

```ts
export interface Theme {
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

- [ ] **Step 2: Create `src/themes/default.ts`**

Extract the existing theme object from `CardPrimitives.tsx`:

```ts
import {Theme} from './types';

export const defaultTheme: Theme = {
  colors: {
    background: '#080b12',
    panel: '#0d1117',
    panelLight: '#151b23',
    border: 'rgba(255,255,255,0.12)',
    text: '#f0f3f6',
    muted: '#8b949e',
    faint: '#6e7681',
    green: '#3fb950',
    blue: '#58a6ff',
    yellow: '#f2cc60',
    pink: '#ff7bcb',
    red: '#ff7b72',
    cyan: '#39c5cf',
    purple: '#bc8cff',
  },
  radii: {
    card: '16px',
    panel: '12px',
  },
  typography: {
    fontFamily: "'Fira Code', monospace",
  },
};
```

- [ ] **Step 3: Create `src/themes/dracula.ts`**

```ts
import {Theme} from './types';

export const draculaTheme: Theme = {
  colors: {
    background: '#282a36',
    panel: '#44475a',
    panelLight: '#6272a4',
    border: 'rgba(255,255,255,0.12)',
    text: '#f8f8f2',
    muted: '#6272a4',
    faint: '#44475a',
    green: '#50fa7b',
    blue: '#8be9fd',
    yellow: '#f1fa8c',
    pink: '#ff79c6',
    red: '#ff5555',
    cyan: '#8be9fd',
    purple: '#bd93f9',
  },
  radii: {
    card: '16px',
    panel: '12px',
  },
  typography: {
    fontFamily: "'Fira Code', monospace",
  },
};
```

- [ ] **Step 4: Create `src/themes/github.ts`**

```ts
import {Theme} from './types';

export const githubTheme: Theme = {
  colors: {
    background: '#0d1117',
    panel: '#161b22',
    panelLight: '#21262d',
    border: 'rgba(255,255,255,0.12)',
    text: '#c9d1d9',
    muted: '#8b949e',
    faint: '#6e7681',
    green: '#238636',
    blue: '#58a6ff',
    yellow: '#d29922',
    pink: '#db61a2',
    red: '#f85149',
    cyan: '#39c5cf',
    purple: '#8957e5',
  },
  radii: {
    card: '16px',
    panel: '12px',
  },
  typography: {
    fontFamily: "'Fira Code', monospace",
  },
};
```

- [ ] **Step 5: Create `src/themes/createTheme.ts`**

```ts
import {Theme} from './types';

export function createTheme(base: Theme, overrides: Partial<Theme> = {}): Theme {
  return {
    colors: {...base.colors, ...overrides.colors},
    radii: {...base.radii, ...overrides.radii},
    typography: {...base.typography, ...overrides.typography},
  };
}
```

- [ ] **Step 6: Create `src/themes/ThemeProvider.tsx`**

```tsx
import React, {createContext, useContext} from 'react';
import {Theme} from './types';
import {defaultTheme} from './default';

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
```

- [ ] **Step 7: Create `src/themes/useTheme.ts`**

```ts
export {useTheme} from './ThemeProvider';
```

- [ ] **Step 8: Create `src/themes/index.ts`**

```ts
export {ThemeProvider, useTheme} from './ThemeProvider';
export {defaultTheme} from './default';
export {draculaTheme} from './dracula';
export {githubTheme} from './github';
export {createTheme} from './createTheme';
export type {Theme} from './types';
```

- [ ] **Step 9: Commit**

```bash
git add src/themes/
git commit -m "feat: add theme system with default, dracula, and github themes"
```

---

## Task 5: Extract Primitives & Effects

**Files:**
- Create: `src/components/primitives/Panel.tsx`
- Create: `src/components/primitives/MetricRow.tsx`
- Create: `src/components/primitives/MetricTile.tsx`
- Create: `src/components/primitives/BigMetric.tsx`
- Create: `src/components/primitives/ProgressBar.tsx`
- Create: `src/components/primitives/index.ts`
- Create: `src/components/effects/AnimatedCounter.tsx`
- Create: `src/components/effects/GeminiBeams.tsx`
- Create: `src/components/effects/index.ts`
- Modify: `src/components/Effects/StatCard.tsx`
- Delete: `src/components/Cards/CardPrimitives.tsx`
- Delete: `src/components/Effects/Card.tsx`
- Delete: `src/components/Effects/AnimatedCounter.tsx`
- Delete: `src/components/Effects/GeminiBeams.tsx`

- [ ] **Step 1: Create `src/components/primitives/Panel.tsx`**

```tsx
import {ReactNode} from 'react';
import {useTheme} from '../../themes';

type PanelProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  accent?: string;
  compact?: boolean;
};

export function Panel({
  title,
  subtitle,
  children,
  className = '',
  accent,
  compact = false,
}: PanelProps) {
  const theme = useTheme();
  const resolvedAccent = accent || theme.colors.blue;

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border font-mono shadow-2xl ${compact ? 'p-3' : 'p-4'} ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgba(8,11,18,0.98), rgba(13,17,23,0.98) 48%, rgba(18,24,33,0.96))',
        borderColor: theme.colors.border,
        color: theme.colors.text,
        boxShadow:
          '0 18px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.15))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${resolvedAccent}, transparent)`,
        }}
      />
      <div className="relative z-10 h-full">
        {title ? (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold leading-tight">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 truncate text-xs text-[#8b949e]">{subtitle}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/primitives/MetricRow.tsx`**

```tsx
import {ReactNode} from 'react';
import {AnimatedCounter} from '../effects/AnimatedCounter';
import {useTheme} from '../../themes';

type MetricRowProps = {
  label: string;
  value: number | string;
  detail?: string;
  delay?: number;
  accent?: string;
  icon?: ReactNode;
};

export function MetricRow({
  label,
  value,
  detail,
  delay = 0,
  accent,
  icon,
}: MetricRowProps) {
  const theme = useTheme();
  const resolvedAccent = accent || theme.colors.blue;

  const displayValue =
    typeof value === 'number' ? (
      <AnimatedCounter value={value} duration={2} delay={delay} />
    ) : (
      value
    );

  return (
    <div className="flex min-h-[30px] items-center justify-between gap-3 border-b border-white/5 py-1.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className="shrink-0" style={{color: resolvedAccent}}>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs text-[#b7c0cc]">{label}</p>
          {detail ? (
            <p className="truncate text-[10px] text-[#7d8590]">{detail}</p>
          ) : null}
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">{displayValue}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/primitives/BigMetric.tsx`**

```tsx
import {formatCompactNumber} from '../../utils/format';

export function BigMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-normal text-[#8b949e]">{label}</p>
      <p className="mt-1 text-4xl font-bold leading-none">
        {formatCompactNumber(value)}
      </p>
      {detail ? <p className="mt-1 text-xs text-[#8b949e]">{detail}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/primitives/MetricTile.tsx`**

```tsx
import {ReactNode} from 'react';
import {AnimatedCounter} from '../effects/AnimatedCounter';
import {useTheme} from '../../themes';

type MetricTileProps = {
  label: string;
  value: number | string;
  detail?: string;
  delay?: number;
  accent?: string;
  icon?: ReactNode;
  large?: boolean;
};

export function MetricTile({
  label,
  value,
  detail,
  delay = 0,
  accent,
  icon,
  large = false,
}: MetricTileProps) {
  const theme = useTheme();
  const resolvedAccent = accent || theme.colors.blue;

  const displayValue =
    typeof value === 'number' ? (
      <AnimatedCounter value={value} duration={1.8} delay={delay} />
    ) : (
      value
    );

  return (
    <div
      className={`relative h-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] ${large ? 'p-3' : 'p-2.5'}`}
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{background: `linear-gradient(90deg, ${resolvedAccent}, transparent)`}}
      />
      <div
        className={`flex h-full flex-col justify-between ${large ? 'gap-2' : 'gap-1'}`}
      >
        <div className="flex items-center gap-2 text-[#9ba7b4]">
          {icon ? (
            <span className="shrink-0" style={{color: resolvedAccent}}>
              {icon}
            </span>
          ) : null}
          <p className="truncate text-[11px] font-semibold uppercase tracking-normal">
            {label}
          </p>
        </div>
        <p
          className={`${large ? 'text-4xl' : 'text-2xl'} font-bold leading-none tabular-nums text-[#f0f3f6]`}
        >
          {displayValue}
        </p>
        {detail ? (
          <p className="truncate text-[11px] leading-tight text-[#8b949e]">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/primitives/ProgressBar.tsx`**

```tsx
import {Easing, interpolate, useCurrentFrame} from 'remotion';

export function ProgressBar({
  value,
  max,
  color = '#3fb950',
  delay = 0,
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  delay?: number;
  height?: number;
}) {
  const frame = useCurrentFrame();
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const animatedPercent = interpolate(
    frame,
    [delay, delay + 42],
    [0, percent],
    {
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <div className="overflow-hidden rounded-full bg-white/10" style={{height}}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${animatedPercent}%`,
          background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.78))`,
          boxShadow: `0 0 18px ${color}66`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/primitives/index.ts`**

```ts
export {Panel} from './Panel';
export {MetricRow} from './MetricRow';
export {MetricTile} from './MetricTile';
export {BigMetric} from './BigMetric';
export {ProgressBar} from './ProgressBar';
```

- [ ] **Step 7: Move `StatCard.tsx` to primitives**

Create `src/components/primitives/StatCard.tsx` from `src/components/Effects/StatCard.tsx`, updating imports:

```tsx
import {useCurrentFrame} from 'remotion';
import {fadeInAndSlideUp} from '../../utils/animation';
import {formatCompactNumber} from '../../utils/format';
import {AnimatedCounter} from '../effects/AnimatedCounter';
import {useTheme} from '../../themes';

type StatCardProps = {
  title: string;
  value: number;
  detail?: string;
  accent?: string;
  delay?: number;
  compact?: boolean;
};

export const StatCard = ({
  title,
  value,
  detail,
  accent = '#60a5fa',
  delay = 0,
  compact = false,
}: StatCardProps) => {
  const frame = useCurrentFrame();
  const delayFrames = Math.round(delay * 24);
  const theme = useTheme();

  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] p-4 text-[#f0f3f6] shadow-2xl"
      style={{
        ...fadeInAndSlideUp(frame, delayFrames),
        borderTopColor: accent,
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
        boxShadow:
          '0 18px 42px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
      aria-label={`${title}: ${value}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{background: `linear-gradient(90deg, ${accent}, transparent)`}}
      />
      <div
        className="absolute bottom-0 left-0 h-px"
        style={{
          width: `${Math.min(100, Math.max(18, value ? 78 : 18))}%`,
          backgroundColor: accent,
          opacity: 0.45,
        }}
      />
      <h3 className="truncate text-xs font-semibold uppercase tracking-normal text-[#9ba7b4]">
        {title}
      </h3>
      <p
        className={`leading-none tabular-nums ${compact ? 'text-2xl' : 'text-3xl'} font-bold`}
      >
        {compact ? (
          formatCompactNumber(value)
        ) : (
          <AnimatedCounter value={value} duration={2} delay={delay} />
        )}
      </p>
      {detail ? (
        <p className="truncate text-[11px] text-[#8b949e]">{detail}</p>
      ) : (
        <p className="text-[11px]" style={{color: theme.colors.faint}}>
          &nbsp;
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 8: Create `src/components/effects/AnimatedCounter.tsx`**

Move from `src/components/Effects/AnimatedCounter.tsx` with updated import:

```tsx
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatInteger} from '../../utils/format';

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  startFrame?: number;
  delay?: number;
};

export const AnimatedCounter = ({
  value,
  duration = 2,
  startFrame = 0,
  delay = 0,
}: AnimatedCounterProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const firstFrame = startFrame + delay * fps;
  const finalFrame = firstFrame + duration * fps;
  const currentValue = interpolate(frame, [firstFrame, finalFrame], [0, value], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return <span>{formatInteger(Math.round(currentValue))}</span>;
};
```

- [ ] **Step 9: Create `src/components/effects/GeminiBeams.tsx`**

Move from `src/components/Effects/GeminiBeams.tsx` with no changes.

- [ ] **Step 10: Create `src/components/effects/index.ts`**

```ts
export {AnimatedCounter} from './AnimatedCounter';
export {GeminiBeams} from './GeminiBeams';
```

- [ ] **Step 11: Update `src/components/primitives/index.ts` to export StatCard**

```ts
export {Panel} from './Panel';
export {MetricRow} from './MetricRow';
export {MetricTile} from './MetricTile';
export {BigMetric} from './BigMetric';
export {ProgressBar} from './ProgressBar';
export {StatCard} from './StatCard';
```

- [ ] **Step 12: Delete old component directories**

Run:
```bash
git rm -r src/components/Cards/CardPrimitives.tsx src/components/Effects/
```

- [ ] **Step 13: Commit**

```bash
git add src/components/
git commit -m "refactor: extract primitives and effects into component modules"
```

---

## Task 6: Extract Card Components

**Files:**
- Create: `src/cards/index.ts`
- Move/Rename: `src/components/Cards/*.tsx` → `src/cards/*.tsx`
- Modify imports in all card files

- [ ] **Step 1: Create `src/cards/` directory and move files**

Run:
```bash
mkdir -p src/cards
git mv src/components/Cards/ActivityOverviewCard.tsx src/cards/ActivityOverviewCard.tsx
git mv src/components/Cards/CodeMetricsCard.tsx src/cards/CodeMetricsCard.tsx
git mv src/components/Cards/CommitStreakCard.tsx src/cards/CommitStreakCard.tsx
git mv src/components/Cards/IssueTrackingCard.tsx src/cards/IssueTrackingCard.tsx
git mv src/components/Cards/MainStatsCards.tsx src/cards/MainStatsCard.tsx
git mv src/components/Cards/ReadmeCard.tsx src/cards/ReadmeCard.tsx
git mv src/components/Cards/RepositoryImpactCard.tsx src/cards/RepositoryImpactCard.tsx
git mv src/components/Cards/Stats.tsx src/cards/StatsCard.tsx
git mv src/components/Cards/LanguagesContent.tsx src/cards/LanguagesCard.tsx
git mv src/components/Cards/TopLanguagesCard.tsx src/cards/TopLanguagesCard.tsx
```

- [ ] **Step 2: Update `src/cards/MainStatsCard.tsx` imports**

Change:
```ts
import {UserStats} from '../../config';
import {StatCard} from '../Effects/StatCard';
import {theme} from './CardPrimitives';
```
To:
```ts
import {UserStats} from '../data/schemas';
import {StatCard} from '../components/primitives/StatCard';
import {defaultTheme} from '../themes/default';
```

And update `theme.green` → `defaultTheme.colors.green`, etc.

- [ ] **Step 3: Update `src/cards/StatsCard.tsx` imports**

Change:
```ts
import {UserStats} from '../../config';
import {MetricTile, Panel, theme} from './CardPrimitives';
import {formatCompactNumber} from '../../functions/utils';
```
To:
```ts
import {UserStats} from '../data/schemas';
import {MetricTile, Panel} from '../components/primitives';
import {formatCompactNumber} from '../utils/format';
import {defaultTheme} from '../themes/default';
```

Update `theme.*` references to `defaultTheme.colors.*`.

Also rename exported function from `Stats` to `StatsCard`.

- [ ] **Step 4: Update `src/cards/LanguagesCard.tsx` imports**

Change:
```ts
import {UserStats} from '../../config';
import {Panel, ProgressBar, theme} from './CardPrimitives';
import {formatBytes} from '../../functions/utils';
```
To:
```ts
import {UserStats} from '../data/schemas';
import {Panel, ProgressBar} from '../components/primitives';
import {formatBytes} from '../utils/format';
import {defaultTheme} from '../themes/default';
```

Update `theme.*` to `defaultTheme.colors.*`.
Rename export from `LanguagesContent` to `LanguagesCard`.

- [ ] **Step 5: Update `src/cards/ReadmeCard.tsx` imports**

Change:
```ts
import {UserStats} from '../../config';
import {formatBytes, formatCompactNumber} from '../../functions/utils';
import {AnimatedCounter} from '../Effects/AnimatedCounter';
import {GeminiBeams} from '../Effects/GeminiBeams';
import {ProgressBar, theme} from './CardPrimitives';
```
To:
```ts
import {UserStats} from '../data/schemas';
import {formatBytes, formatCompactNumber} from '../utils/format';
import {AnimatedCounter} from '../components/effects/AnimatedCounter';
import {GeminiBeams} from '../components/effects/GeminiBeams';
import {ProgressBar} from '../components/primitives';
import {defaultTheme} from '../themes/default';
```

Update `theme.*` to `defaultTheme.colors.*`.

- [ ] **Step 6: Update remaining card files**

For each of the other card files (`ActivityOverviewCard.tsx`, `CodeMetricsCard.tsx`, `CommitStreakCard.tsx`, `IssueTrackingCard.tsx`, `RepositoryImpactCard.tsx`, `TopLanguagesCard.tsx`), update imports similarly:

- `../../config` → `../data/schemas`
- `../../functions/utils` → `../utils/format`
- `../Effects/AnimatedCounter` → `../components/effects/AnimatedCounter`
- `./CardPrimitives` → `../components/primitives` and `../themes/default`
- `theme.*` → `defaultTheme.colors.*`

- [ ] **Step 7: Create `src/cards/index.ts`**

```ts
export {ActivityOverviewCard} from './ActivityOverviewCard';
export {CodeMetricsCard} from './CodeMetricsCard';
export {CommitStreakCard} from './CommitStreakCard';
export {IssueTrackingCard} from './IssueTrackingCard';
export {LanguagesCard} from './LanguagesCard';
export {MainStatsCard} from './MainStatsCard';
export {
  ReadmeCard,
  ReadmeClassicCard,
  ReadmeSpotlightCard,
} from './ReadmeCard';
export {RepositoryImpactCard} from './RepositoryImpactCard';
export {StatsCard} from './StatsCard';
export {TopLanguagesCard} from './TopLanguagesCard';
```

- [ ] **Step 8: Delete old cards directory**

Run: `git rm -r src/components/Cards/`

- [ ] **Step 9: Commit**

```bash
git add src/cards/
git rm -r src/components/Cards/
git commit -m "refactor: extract all cards into src/cards/"
```

---

## Task 7: Render Module

**Files:**
- Create: `src/render/config.ts`
- Create: `src/render/api.ts`
- Create: `src/render/cli.ts`
- Create: `src/render/index.ts`

- [ ] **Step 1: Create `src/render/config.ts`**

```ts
export interface RenderConfig {
  compositionIds: string[];
  entryPoint: string;
  formats: Array<'gif' | 'webp' | 'png'>;
  outputDir: string;
  props: Record<string, unknown>;
  concurrency?: number;
  remotionConcurrency?: number;
}
```

- [ ] **Step 2: Create `src/render/api.ts`**

Convert the render logic from `scripts/render-assets.mjs`:

```ts
import {existsSync} from 'node:fs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {RenderConfig} from './config';

export async function renderCards(config: RenderConfig): Promise<void> {
  const {
    compositionIds,
    entryPoint,
    formats,
    outputDir,
    props,
    concurrency = 1,
    remotionConcurrency,
  } = config;

  const needsGif = formats.includes('gif') || formats.includes('webp');
  const keepGif = formats.includes('gif');
  const tempDir = join(outputDir, '.tmp');

  await rm(outputDir, {recursive: true, force: true});
  await mkdir(outputDir, {recursive: true});
  if (needsGif && !keepGif) {
    await mkdir(tempDir, {recursive: true});
  }

  console.log(
    `Rendering ${compositionIds.length} cards to ${outputDir} with concurrency ${concurrency}`
  );

  await runPool(
    compositionIds,
    Math.min(concurrency, compositionIds.length),
    async (id) => {
      const gifPath = keepGif
        ? join(outputDir, `${id}.gif`)
        : join(tempDir, `${id}.gif`);

      if (needsGif) {
        const remotionArgs = [
          'remotion',
          'render',
          '--entry-point',
          entryPoint,
          id,
          gifPath,
          '--codec',
          'gif',
        ];
        if (remotionConcurrency) {
          remotionArgs.push('--concurrency', String(remotionConcurrency));
        }
        await run('npx', remotionArgs);
      }

      if (formats.includes('webp')) {
        await run('ffmpeg', [
          '-y',
          '-i',
          gifPath,
          '-loop',
          '0',
          '-c:v',
          'libwebp',
          '-quality',
          '82',
          '-compression_level',
          '6',
          '-preset',
          'picture',
          '-an',
          '-fps_mode',
          'passthrough',
          join(outputDir, `${id}.webp`),
        ]);
      }
    }
  );

  if (existsSync(tempDir)) {
    await rm(tempDir, {recursive: true, force: true});
  }

  await writeFile(join(outputDir, 'index.html'), buildIndexHtml(compositionIds, formats), 'utf8');
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from({length: concurrency}, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
}

function run(command: string, commandArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {stdio: 'inherit'});
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(' ')} failed`));
    });
  });
}

function buildIndexHtml(
  compositionIds: string[],
  formats: string[]
): string {
  const images = compositionIds
    .map((id) => {
      const webp = formats.includes('webp')
        ? `<img src="./${id}.webp" alt="${id}" />`
        : '';
      const gif = formats.includes('gif')
        ? `<img src="./${id}.gif" alt="${id} gif fallback" />`
        : '';
      return `<section><h2>${id}</h2>${webp}${gif}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub Stats Remotion Assets</title>
  <style>
    body { margin: 0; padding: 24px; background: #0d1117; color: #f0f3f6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    main { display: grid; gap: 24px; max-width: 900px; margin: 0 auto; }
    section { display: grid; gap: 8px; }
    h1, h2 { margin: 0; }
    h2 { color: #8b949e; font-size: 14px; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>
    <h1>GitHub Stats Remotion Assets</h1>
    ${images}
  </main>
</body>
</html>
`;
}
```

- [ ] **Step 3: Create `src/render/cli.ts`**

```ts
#!/usr/bin/env node
import {renderCards} from './api';

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value = 'true'] = arg.slice(2).split('=');
      return [key, value];
    })
);

const formats = (args.get('formats') || 'webp,gif')
  .split(',')
  .map((f) => f.trim())
  .filter(Boolean) as Array<'gif' | 'webp' | 'png'>;

const compositionIds = (args.get('cards') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (compositionIds.length === 0) {
  console.error('Error: --cards is required');
  process.exit(1);
}

renderCards({
  compositionIds,
  entryPoint: args.get('entry-point') || './src/index.tsx',
  formats,
  outputDir: args.get('out-dir') || 'pages',
  props: {},
  concurrency: parsePositiveInt(args.get('concurrency'), 1),
  remotionConcurrency: args.get('remotion-concurrency')
    ? parsePositiveInt(args.get('remotion-concurrency'), 1)
    : undefined,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}
```

- [ ] **Step 4: Create `src/render/index.ts`**

```ts
export {renderCards} from './api';
export type {RenderConfig} from './config';
```

- [ ] **Step 5: Commit**

```bash
git add src/render/
git commit -m "feat: add render module with programmatic API and CLI"
```

---

## Task 8: Library Entry Points

**Files:**
- Create: `src/index.ts`
- Move: `src/defaultStats.ts` → `src/data/defaultStats.ts`

- [ ] **Step 1: Create `src/index.ts`**

```ts
// Core exports
export * from './data';
export * from './utils';
export * from './types';
export * from './themes';
export * from './components/primitives';
export * from './components/effects';

// Config constants
export {FPS, DurationInSeconds, DurationInFrames, Config} from './config';

// Default stats fixture
export {defaultStats} from './data/defaultStats';
```

- [ ] **Step 2: Move `src/defaultStats.ts` to `src/data/defaultStats.ts`**

Run: `git mv src/defaultStats.ts src/data/defaultStats.ts`

Update its import:
```ts
import {UserStats} from './schemas';
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts src/data/defaultStats.ts
git rm src/defaultStats.ts
git commit -m "feat: create library entry point and move defaultStats"
```

---

## Task 9: Example App

**Files:**
- Create: `example/package.json`
- Create: `example/src/index.tsx`
- Create: `example/src/Root.tsx`
- Create: `example/remotion.config.ts`
- Create: `example/tailwind.config.js`
- Create: `example/src/style.css`
- Move: `input.json` → `example/input.json`

- [ ] **Step 1: Create `example/package.json`**

```json
{
  "name": "github-readme-cards-example",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "remotion studio --props ./input.json",
    "render": "github-readme-cards render --entry-point ./src/index.tsx --cards readme,stats --formats webp,gif --out-dir pages --props input.json"
  },
  "dependencies": {
    "github-readme-cards": "file:..",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.214",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.214",
    "@remotion/tailwind": "^4.0.214",
    "@types/react": "^18.3.10",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 2: Create `example/src/index.tsx`**

```tsx
import {registerRoot} from 'remotion';
import {RemotionRoot} from './Root';

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Create `example/src/Root.tsx`**

```tsx
import {CalculateMetadataFunction, Composition, getInputProps} from 'remotion';
import './style.css';

import {
  FPS,
  DurationInFrames,
  fetchUserStats,
  SourceProps,
  MainProps,
  mainSchema,
  defaultStats,
} from 'github-readme-cards';
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

export const RemotionRoot = () => {
  const calculateMetadata: CalculateMetadataFunction<MainProps> = async (
    props
  ) => {
    const inputProps = getInputProps() as SourceProps;
    const userStats = await fetchUserStats(inputProps);

    return {
      props: {
        ...props,
        userStats,
      },
    };
  };

  const cards = [
    {id: 'readme', component: ReadmeCard, width: 900, height: 460},
    {id: 'readme-classic', component: ReadmeClassicCard, width: 500, height: 520},
    {
      id: 'readme-spotlight',
      component: ReadmeSpotlightCard,
      width: 900,
      height: 460,
      durationInFrames: FPS * 12,
    },
    {id: 'stats', component: StatsCard, width: 500, height: 360},
    {id: 'languages', component: LanguagesCard, width: 500, height: 270},
    {id: 'main-stats', component: MainStatsCard, width: 500, height: 300},
    {id: 'repo-impact', component: RepositoryImpactCard, width: 500, height: 280},
    {id: 'issue-tracking', component: IssueTrackingCard, width: 500, height: 280},
    {id: 'code-metrics', component: CodeMetricsCard, width: 500, height: 280},
    {id: 'activity-overview', component: ActivityOverviewCard, width: 500, height: 360},
    {id: 'commit-streak', component: CommitStreakCard, width: 500, height: 230},
    {id: 'top-languages', component: TopLanguagesCard, width: 500, height: 260},
  ];

  return (
    <>
      {cards.map(
        ({
          id,
          component: Component,
          height,
          width = 500,
          durationInFrames = DurationInFrames,
        }) => (
          <Composition
            key={id}
            id={id}
            component={(props) => (
              <div className="h-full w-full p-1">
                <Component userStats={props.userStats} />
              </div>
            )}
            durationInFrames={durationInFrames}
            fps={FPS}
            width={width}
            height={height}
            schema={mainSchema}
            calculateMetadata={calculateMetadata}
            defaultProps={{
              userStats: defaultStats,
            }}
          />
        )
      )}
    </>
  );
};
```

- [ ] **Step 4: Create `example/remotion.config.ts`**

```ts
import {Config} from '@remotion/cli/config';

Config.setScale(1);
Config.setCodec('gif');
Config.setVideoImageFormat('png');
Config.setNumberOfGifLoops(0);
Config.setOverwriteOutput(true);
```

- [ ] **Step 5: Create `example/tailwind.config.js`**

```js
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 6: Create `example/src/style.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
    font-family: 'Fira Code', monospace;
}
```

- [ ] **Step 7: Move `input.json` to `example/input.json`**

Run: `git mv input.json example/input.json`

- [ ] **Step 8: Commit**

```bash
git add example/
git mv input.json example/input.json
git commit -m "feat: add example app for dogfooding"
```

---

## Task 10: Tests

**Files:**
- Create: `src/utils/format.test.ts`
- Create: `src/themes/createTheme.test.ts`

- [ ] **Step 1: Create `src/utils/format.test.ts`**

```ts
import {describe, it, expect} from 'vitest';
import {formatCompactNumber, formatBytes, formatInteger} from './format';

describe('formatCompactNumber', () => {
  it('formats thousands with k suffix', () => {
    expect(formatCompactNumber(1500)).toBe('1.5K');
  });

  it('formats millions with M suffix', () => {
    expect(formatCompactNumber(2_500_000)).toBe('2.5M');
  });

  it('returns string for small numbers', () => {
    expect(formatCompactNumber(42)).toBe('42');
  });
});

describe('formatBytes', () => {
  it('returns bytes for small values', () => {
    expect(formatBytes(0)).toBe('0 Byte');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 ** 2)).toBe('1.00 MB');
  });
});

describe('formatInteger', () => {
  it('adds commas to large numbers', () => {
    expect(formatInteger(1234567)).toBe('1,234,567');
  });
});
```

- [ ] **Step 2: Create `src/themes/createTheme.test.ts`**

```ts
import {describe, it, expect} from 'vitest';
import {createTheme} from './createTheme';
import {defaultTheme} from './default';

describe('createTheme', () => {
  it('returns base theme when no overrides', () => {
    const theme = createTheme(defaultTheme);
    expect(theme.colors.green).toBe(defaultTheme.colors.green);
  });

  it('merges color overrides', () => {
    const theme = createTheme(defaultTheme, {
      colors: {green: '#00ff00'},
    });
    expect(theme.colors.green).toBe('#00ff00');
    expect(theme.colors.blue).toBe(defaultTheme.colors.blue);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/format.test.ts src/themes/createTheme.test.ts
git commit -m "test: add unit tests for format utils and theme creation"
```

---

## Task 11: Build & Verification

**Files:**
- Modify: `package.json` scripts
- Modify: `tsconfig.json` (if needed)

- [ ] **Step 1: Update `package.json` build script**

Ensure `"build": "tsup"` is present.

- [ ] **Step 2: Build the package**

Run: `yarn build`
Expected: `dist/` created with `.js`, `.cjs`, and `.d.ts` files for all entry points.

- [ ] **Step 3: Type check**

Run: `yarn typecheck`
Expected: No errors.

- [ ] **Step 4: Update `tsconfig.json` if needed**

Ensure `tsconfig.json` has `"declaration": true` or is compatible with tsup.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore: configure build and verify package compiles"
```

---

## Task 12: CI Update

**Files:**
- Modify: `.github/workflows/render-video.yml`

- [ ] **Step 1: Update workflow to use example app**

```yaml
name: Render Profile Assets

on:
  push:
    branches: [main]
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:
    inputs:
      stats-json-url:
        description: "Public stats JSON URL"
        required: false
        default: "https://raw.githubusercontent.com/LukasParke/stats/main/github-user-stats.json"

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  render:
    name: Render and publish assets
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
          cache-dependency-path: yarn.lock

      - name: Enable Corepack
        run: corepack enable

      - name: Install ffmpeg
        run: |
          sudo apt-get update
          sudo apt-get install -y ffmpeg

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Build package
        run: yarn build

      - name: Restore Remotion render cache
        uses: actions/cache@v4
        with:
          path: |
            node_modules/.remotion
            node_modules/.cache/webpack
          key: ${{ runner.os }}-remotion-${{ hashFiles('yarn.lock', 'package.json', 'remotion.config.ts', 'tailwind.config.js', 'src/**') }}
          restore-keys: |
            ${{ runner.os }}-remotion-

      - name: Prepare stats input
        run: yarn prepare:stats
        env:
          STATS_JSON_URL: ${{ inputs['stats-json-url'] || 'https://raw.githubusercontent.com/LukasParke/stats/main/github-user-stats.json' }}

      - name: Render WebP and GIF assets
        run: yarn render:all
        env:
          RENDER_CARD_CONCURRENCY: 2
          REMOTION_CONCURRENCY: 4

      - name: Configure Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: pages

      - name: Deploy Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/render-video.yml
git commit -m "ci: update workflow to build package before rendering"
```

---

## Spec Coverage Check

| Spec Section | Plan Task |
|--------------|-----------|
| Package architecture (exports map) | Task 1 |
| Primitives API | Task 5 |
| Pre-built cards | Task 6 |
| Theme system | Task 4 |
| Data layer (schemas, fetch, adapter) | Task 2 |
| Render pipeline (API + CLI) | Task 7 |
| Build & distribution | Task 1, Task 11 |
| Example app | Task 9 |
| Testing | Task 10 |
| CI update | Task 12 |

No gaps identified.

## Placeholder Scan

- No "TBD", "TODO", or "implement later" found.
- No vague instructions like "add error handling" without specifics.
- All code blocks contain complete implementations.
- Type names are consistent across tasks (`UserStats`, `RenderConfig`, etc.).
