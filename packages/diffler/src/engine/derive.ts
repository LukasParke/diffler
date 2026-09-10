import type { GitHubStatsOutput } from "@lukasparke/diffler-schemas";
import type { DifflerConfig } from "../config.js";
import { buildStatsActionConfig, getProfiles } from "../config.js";
import { emptyContributionsCollection } from "../stats/aggregate.js";
import { createEmptyStableCache } from "../stats/cache.js";
import { buildOutput } from "../stats/output.js";
import type { CollectionExtras } from "./unified.js";

export function publicConfig(config: DifflerConfig) {
  return {
    version: config.version,
    templates: config.templates,
    assets: config.assets,
    github: {
      username: config.github.username,
      usernames: config.github.usernames,
      profiles: config.github.profiles.map(({ username }) => ({ username })),
      includeOrgs: config.github.includeOrgs,
      largeRepoMode: config.github.largeRepoMode,
    },
  };
}

export function deriveContext(
  output: GitHubStatsOutput,
  config: DifflerConfig,
  extras: CollectionExtras = {},
  multiProfile = false
) {
  const profile = output.profile;
  const contributions = output.profileContributions;
  const activity = output.activity;
  const username = profile.login || getProfiles(config.github)[0]?.username || "unknown";
  const organizations = extras.organizations ?? [];

  return {
    config: publicConfig(config),
    github: {
      user: {
        login: username,
        name: profile.name || username,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        website_url: profile.websiteUrl,
        twitter_username: profile.twitterUsername,
        email: profile.email,
        created_at: profile.createdAt || null,
        followers: profile.followers,
        following: profile.following,
        starred_repositories: activity.starsGiven,
        repositories: output.repositories,
        pinned_repositories: extras.pinnedRepositories ?? null,
        contributions: {
          total: contributions.totalContributions,
          commits: contributions.totalCommitContributions,
          issues: contributions.totalIssueContributions,
          pull_requests: contributions.totalPullRequestContributions,
          reviews: contributions.totalPullRequestReviewContributions,
          calendar: contributions.contributionCalendar.weeks,
        },
      },
    },
    stats: output,
    profile,
    profiles: extras.profiles ?? [profile],
    extras,
    contributions: { ...contributions, ...contributions.stats },
    calendar: contributions.contributionCalendar.weeks,
    streak: contributions.stats,
    repositories: output.repositories,
    repos: output.repositories,
    organizations,
    orgs: organizations,
    traffic: output.repoMetrics.traffic,
    contributor_stats: [output.repoMetrics.contributorStats],
    activity,
    discussions: {
      started: activity.discussionsStarted,
      answered: activity.discussionsAnswered,
    },
    stars_given: activity.starsGiven,
    repo_contributions: contributions.repositoryContributions,
    repo_stats: output.repoMetrics.repoStats,
    computed_stats: output.repoMetrics.computedStats,
    collection_status: output.collectionStatus,
    multi_profile: multiProfile,
  };
}

export type DerivedContext = ReturnType<typeof deriveContext>;

export function buildStubContext(config: DifflerConfig): DerivedContext {
  const username = getProfiles(config.github)[0]?.username || "unknown";
  const now = Date.now();
  const statsConfig = buildStatsActionConfig(config);
  const output = buildOutput({
    profile: {
      login: username,
      name: username,
      bio: null,
      company: null,
      location: null,
      websiteUrl: null,
      twitterUsername: null,
      email: null,
      avatarUrl: "",
      createdAt: new Date(0).toISOString(),
      followers: 0,
      following: 0,
    },
    activity: {
      totalPullRequests: 0,
      openIssues: 0,
      closedIssues: 0,
      repositoriesContributedTo: 0,
      discussionsStarted: 0,
      discussionsAnswered: 0,
      starsGiven: 0,
    },
    contributions: {
      collection: emptyContributionsCollection(),
      repositoryContributions: [],
      repositories: [],
      yearsFetched: [],
      yearsFromCache: [],
      missingYears: [],
    },
    repositories: [],
    cache: createEmptyStableCache(now),
    config: statsConfig,
    collectionStatus: {
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      complete: false,
      coreComplete: false,
      cache: {
        stablePath: "",
        volatilePath: "",
        contributionYearsFromCache: 0,
        contributionYearsFetched: 0,
        repositoriesFromCache: 0,
        repositoriesFetched: 0,
      },
      backfill: {
        enabled: false,
        completedThisRun: 0,
        pending: 0,
        failedThisRun: 0,
        skippedThisRun: 0,
      },
      rateLimit: { graphql: null, rest: null },
      warnings: ["GitHub data was not collected."],
      errors: [],
    },
    fetchedAt: now,
  });
  const context = deriveContext({
    ...output,
    profileContributions: {
      ...output.profileContributions,
      completeness: { ...output.profileContributions.completeness, complete: false },
    },
  }, config, { profiles: [] });
  return {
    ...context,
    github: { user: { ...context.github.user, created_at: null } },
  };
}
