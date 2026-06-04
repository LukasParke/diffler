export function remotionInput(stats: Record<string, unknown>): Record<string, unknown> {
  const profile = (stats.profile as Record<string, unknown>) || {};
  const contributions = (stats.profileContributions as Record<string, unknown>) || {};
  const calendar = (contributions.contributionCalendar as Record<string, unknown>) || {};
  const statsBlock = (contributions.stats as Record<string, unknown>) || {};
  const repoMetrics = (stats.repoMetrics as Record<string, unknown>) || {};

  return {
    username: profile.login || stats.username,
    name: profile.name || stats.name,
    avatarUrl: profile.avatarUrl || stats.avatarUrl,
    totalContributions: contributions.totalContributions || 0,
    currentStreak: statsBlock.currentStreak || 0,
    longestStreak: statsBlock.longestStreak || 0,
    publicRepos: repoMetrics.publicRepoCount || 0,
    totalStars: repoMetrics.starCount || 0,
    totalForks: repoMetrics.forkCount || 0,
    topLanguages: ((repoMetrics.topLanguages as Array<Record<string, unknown>>) || [])
      .slice(0, 10)
      .map((lang) => ({
        name: lang.languageName,
        percentage: lang.percentage || 0,
        color: lang.color,
      })),
    calendar: calendar.weeks || [],
  };
}

export function remotionSceneConfig(scene: string, stats: Record<string, unknown>): Record<string, unknown> {
  const base = remotionInput(stats);
  const configs: Record<string, Record<string, unknown>> = {
    readme: { ...base, scene: "readme", duration: 300 },
    stats: { ...base, scene: "stats", duration: 300, showBreakdown: true },
    languages: {
      ...base,
      scene: "languages",
      duration: 240,
      languages: (base.topLanguages as Array<Record<string, unknown>>).slice(0, 6),
    },
    "activity-overview": { ...base, scene: "activity-overview", duration: 300, calendar: base.calendar },
    "commit-streak": {
      ...base,
      scene: "commit-streak",
      duration: 240,
      currentStreak: base.currentStreak,
      longestStreak: base.longestStreak,
    },
  };
  return configs[scene] || { scene, ...base };
}

export function remotionSceneManifest(
  stats: Record<string, unknown>,
  sceneTemplate?: string
): Record<string, unknown> {
  if (sceneTemplate) {
    // Nunjucks template rendering would happen here
    // For now, return parsed JSON if valid
    try {
      return JSON.parse(sceneTemplate);
    } catch {
      // fall through
    }
  }

  const repoMetrics = (stats.repoMetrics as Record<string, unknown>) || {};
  const contributions = (stats.profileContributions as Record<string, unknown>) || {};
  const activity = (stats.activity as Record<string, unknown>) || {};
  const computed = (stats.computedStats as Record<string, unknown>) || {};
  const streak = ((contributions.stats as Record<string, unknown>)?.currentStreak as number) || 0;
  const langCount = ((repoMetrics.topLanguages as Array<unknown>) || []).length;

  const scenes: Array<Record<string, unknown>> = [
    { id: "readme", durationInFrames: 192, enabled: true },
    { id: "stats", durationInFrames: 192, enabled: true },
  ];

  if (langCount >= 2) {
    scenes.push({ id: "languages", durationInFrames: 240, enabled: true });
    scenes.push({ id: "top-languages", durationInFrames: 240, enabled: true });
  }

  if (streak >= 3) {
    scenes.push({ id: "commit-streak", durationInFrames: 240, enabled: true });
  }

  if ((activity.repositoriesContributedTo as number) > 0) {
    scenes.push({ id: "repo-impact", durationInFrames: 192, enabled: true });
  }

  scenes.push({ id: "activity-overview", durationInFrames: 192, enabled: true });

  if ((computed.yearOverYearGrowth as number) > 0) {
    scenes.push({ id: "code-metrics", durationInFrames: 192, enabled: true });
  }

  return {
    scenes,
    theme: {
      primaryColor: "#3b82f6",
      backgroundGradient: ["#0f172a", "#1e293b"],
    },
  };
}
