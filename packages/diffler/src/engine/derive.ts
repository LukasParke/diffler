import type { GitHubStatsOutput } from "@lukasparke/diffler-schemas";
import type { DifflerConfig } from "../config.js";

export interface DerivedContext {
  config: DifflerConfig;
  github: {
    user: {
      login: string;
      name: string;
      bio: string | null;
      company: string | null;
      location: string | null;
      website_url: string | null;
      twitter_username: string | null;
      email: string | null;
      created_at: string | null;
      followers: number;
      following: number;
      starred_repositories: number;
      repositories: unknown[];
      pinned_repositories: unknown[];
      contributions: {
        total: number;
        commits: number;
        issues: number;
        pull_requests: number;
        reviews: number;
        calendar: unknown[];
      };
    };
  };
  stats: GitHubStatsOutput;
  profile: Record<string, unknown>;
  profiles: Record<string, unknown>[];
  contributions: Record<string, unknown>;
  repositories: unknown[];
  gists: unknown[];
  traffic: Record<string, unknown>;
  contributor_stats: unknown[];
  activity: Record<string, unknown>;
  discussions: Record<string, unknown>;
  stars_given: unknown[];
  repo_contributions: Record<string, unknown>;
  repo_stats: Record<string, unknown>;
  computed_stats: Record<string, unknown>;
  collection_status: Record<string, unknown>;
  multi_profile: boolean;
}

export function deriveContext(
  output: GitHubStatsOutput,
  config: DifflerConfig,
  extra: {
    organizations?: Record<string, unknown>[];
    gists?: Record<string, unknown>[];
  } = {},
  multiProfile = false
): DerivedContext {
  const profile = output.profile;
  const contributions = output.profileContributions;
  const repos = output.repositories as unknown[];
  const activity = output.activity;

  return {
    config,
    github: {
      user: {
        login: profile.login || config.github.username || "unknown",
        name: profile.name || config.github.username || "unknown",
        bio: profile.bio ?? null,
        company: profile.company ?? null,
        location: profile.location ?? null,
        website_url: profile.websiteUrl ?? null,
        twitter_username: profile.twitterUsername ?? null,
        email: profile.email ?? null,
        created_at: profile.createdAt ?? null,
        followers: profile.followers ?? 0,
        following: profile.following ?? 0,
        starred_repositories: 0, // Not in v2 output directly
        repositories: repos,
        pinned_repositories: [],
        contributions: {
          total: contributions.totalContributions ?? 0,
          commits: contributions.totalCommitContributions ?? 0,
          issues: contributions.totalIssueContributions ?? 0,
          pull_requests: contributions.totalPullRequestContributions ?? 0,
          reviews: contributions.totalPullRequestReviewContributions ?? 0,
          calendar: contributions.contributionCalendar.weeks ?? [],
        },
      },
    },
    stats: output,
    profile: profile as Record<string, unknown>,
    profiles: [],
    contributions: contributions as unknown as Record<string, unknown>,
    repositories: repos,
    gists: extra.gists ?? [],
    traffic: output.repoMetrics.traffic as Record<string, unknown> ?? {},
    contributor_stats: output.repoMetrics.contributorStats
      ? [output.repoMetrics.contributorStats]
      : [],
    activity: activity as Record<string, unknown>,
    discussions: {
      started: activity.discussionsStarted ?? 0,
      answered: activity.discussionsAnswered ?? 0,
    },
    stars_given: [], // Not in v2 output directly; could fetch separately
    repo_contributions: {},
    repo_stats: output.repoMetrics.repoStats as Record<string, unknown> ?? {},
    computed_stats: output.repoMetrics.computedStats as Record<string, unknown> ?? {},
    collection_status: output.collectionStatus as unknown as Record<string, unknown>,
    multi_profile: multiProfile,
  };
}

export function buildStubContext(config: DifflerConfig): DerivedContext {
  const username = config.github.username || "unknown";
  return {
    config,
    github: {
      user: {
        login: username,
        name: username,
        bio: null,
        company: null,
        location: null,
        website_url: null,
        twitter_username: null,
        email: null,
        created_at: null,
        followers: 0,
        following: 0,
        starred_repositories: 0,
        repositories: [],
        pinned_repositories: [],
        contributions: {
          total: 0,
          commits: 0,
          issues: 0,
          pull_requests: 0,
          reviews: 0,
          calendar: [],
        },
      },
    },
    stats: {} as GitHubStatsOutput,
    profile: {},
    profiles: [],
    contributions: {},
    repositories: [],
    gists: [],
    traffic: {},
    contributor_stats: [],
    activity: {},
    discussions: {},
    stars_given: [],
    repo_contributions: {},
    repo_stats: {},
    computed_stats: {},
    collection_status: {},
    multi_profile: false,
  };
}
