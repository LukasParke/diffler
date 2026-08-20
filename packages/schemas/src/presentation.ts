import type {
  PresentationData,
  ProfileContributions,
  RepoMetrics,
  UserProfile,
} from "./v2.js";
import { formatBytes, formatNumber } from "./aggregate.js";

// Builds the presentation block of the canonical v2 output from typed v2
// pieces. Shared by the collector (single profile) and mergeStatsOutputs
// (multiple profiles) so both produce identical presentation data.
export function buildPresentationData(params: {
  profile: UserProfile;
  profileContributions: ProfileContributions;
  repoMetrics: RepoMetrics;
  complete: boolean;
  fetchedAt: number;
}): PresentationData {
  const profileMetrics = params.repoMetrics.profile;
  if (!profileMetrics) {
    throw new Error("Profile repository metrics are required for presentation output");
  }
  const topLanguage = profileMetrics.topLanguages[0];
  const contributionStats = params.profileContributions.stats;
  const mostProductiveMonth = params.repoMetrics.computedStats.mostProductiveMonth;
  const peakDay = contributionStats.peakDay;
  const totalContributions = params.profileContributions.totalContributions;

  return {
    readmeSummary: {
      name: params.profile.name,
      username: params.profile.login,
      totalContributions,
      currentStreak: contributionStats.currentStreak,
      longestStreak: contributionStats.longestStreak,
      topLanguages: profileMetrics.topLanguages.slice(0, 5),
      starsReceived: profileMetrics.starsReceived,
      forksReceived: profileMetrics.forksReceived,
      totalRepos: profileMetrics.totalRepos ?? profileMetrics.publicRepos,
      originalRepos: profileMetrics.originalRepos,
      activeRepos: profileMetrics.activeOriginalRepos,
      languageCount: profileMetrics.topLanguages.length,
      codeByteTotal: profileMetrics.codeByteTotal,
      refreshedAt: new Date(params.fetchedAt).toISOString(),
      complete: params.complete,
    },
    cards: [
      {
        id: "total-contributions",
        label: "Total contributions",
        value: formatNumber(totalContributions),
      },
      {
        id: "current-streak",
        label: "Current streak",
        value: `${contributionStats.currentStreak} days`,
      },
      {
        id: "languages",
        label: "Languages",
        value: profileMetrics.topLanguages.length,
        detail: topLanguage ? `${topLanguage.languageName} leads` : undefined,
      },
      {
        id: "code-volume",
        label: "Code volume",
        value: formatBytes(profileMetrics.codeByteTotal),
      },
      {
        id: "stars",
        label: "Stars received",
        value: formatNumber(profileMetrics.starsReceived),
      },
    ],
    timeline: contributionStats.yearlyBreakdown.map((year) => ({
      period: year.year,
      contributions: year.contributions,
    })),
    highlights: [
      ...(peakDay
        ? [
            {
              id: "peak-day",
              label: "Peak day",
              value: peakDay.contributions,
              detail: peakDay.date,
            },
          ]
        : []),
      ...(mostProductiveMonth
        ? [
            {
              id: "top-month",
              label: "Most productive month",
              value: mostProductiveMonth.contributions,
              detail: mostProductiveMonth.month,
            },
          ]
        : []),
      ...(topLanguage
        ? [
            {
              id: "top-language",
              label: "Top language",
              value: topLanguage.languageName,
              detail: `${topLanguage.percentage}%`,
            },
          ]
        : []),
    ],
    remotion: {
      scenes: [
        {
          id: "intro",
          title: params.profile.name || params.profile.login,
          metric: params.profile.login,
          supportingText: "GitHub profile activity",
        },
        {
          id: "contributions",
          title: "Contribution history",
          metric: formatNumber(totalContributions),
          supportingText: `${contributionStats.longestStreak} day longest streak`,
        },
        {
          id: "repositories",
          title: "Repository footprint",
          metric: profileMetrics.totalRepos ?? profileMetrics.publicRepos,
          supportingText: `${profileMetrics.originalRepos} original repositories`,
        },
        {
          id: "languages",
          title: "Language mix",
          metric: topLanguage?.languageName || "N/A",
          supportingText: `${profileMetrics.topLanguages.length} languages detected`,
        },
      ],
    },
  };
}
