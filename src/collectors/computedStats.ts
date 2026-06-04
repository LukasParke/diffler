import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

function parseTimestamp(iso: string): number {
  try {
    return new Date(iso).getTime();
  } catch {
    return 0;
  }
}

interface LanguageEntry {
  name: string;
  color: string | null;
  size: number;
  percentage: number;
}

export const computedStatsCollector: Collector = {
  name: "computed_stats",
  templateRefs: new Set(["computedStats", "stats"]),
  dependencies: new Set(["repositories", "contributions", "multi_year_contributions"]),
  optional: true,

  collect(ctx: CollectorContext): Record<string, unknown> {
    const repos = (ctx.get("repositories") as Record<string, unknown>[]) ?? [];
    const contributions = (ctx.get("contributions") as Record<string, number>) ?? {};
    const multiYear = (ctx.get("multi_year_contributions") as Record<string, number>) ?? {};

    const now = Date.now();
    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(currentYear, 0, 1).getTime();

    // Language stats across all repos
    const langBytes: Record<string, number> = {};
    for (const repo of repos) {
      const languages = (repo.languages as LanguageEntry[]) ?? [];
      for (const lang of languages) {
        if (lang.name) {
          langBytes[lang.name] = (langBytes[lang.name] ?? 0) + lang.size;
        }
      }
    }

    const sortedLangs = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
    const primaryLanguage = sortedLangs[0]?.[0] ?? null;

    // Language stats for repos active this year
    const langBytesThisYear: Record<string, number> = {};
    for (const repo of repos) {
      const pushed = parseTimestamp(repo.pushed_at as string);
      if (pushed >= currentYearStart) {
        const languages = (repo.languages as LanguageEntry[]) ?? [];
        for (const lang of languages) {
          if (lang.name) {
            langBytesThisYear[lang.name] = (langBytesThisYear[lang.name] ?? 0) + lang.size;
          }
        }
      }
    }

    const sortedThisYear = Object.entries(langBytesThisYear).sort((a, b) => b[1] - a[1]);
    const primaryThisYear = sortedThisYear[0]?.[0] ?? null;

    const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0);
    const topLanguages = sortedLangs.slice(0, 10).map(([name, bytesCount]) => ({
      languageName: name,
      value: bytesCount,
      percentage: totalBytes > 0 ? Math.round((bytesCount / totalBytes) * 10000) / 100 : 0,
    }));

    const topThisYear = sortedThisYear.slice(0, 10).map(([name, bytesCount]) => {
      const total = Object.values(langBytesThisYear).reduce((a, b) => a + b, 0);
      return {
        languageName: name,
        value: bytesCount,
        percentage: total > 0 ? Math.round((bytesCount / total) * 10000) / 100 : 0,
      };
    });

    // Topic aggregation
    const allTopics = new Set<string>();
    const topicCounts: Record<string, number> = {};
    for (const repo of repos) {
      const topics = (repo.topics as string[]) ?? [];
      for (const topic of topics) {
        if (topic) {
          allTopics.add(topic);
          topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
        }
      }
    }

    const totalContributions = contributions.totalContributions ?? 0;
    const lastYearContributions = multiYear.lastYearContributions ?? 0;
    let yoy = 0;
    if (lastYearContributions > 0) {
      yoy = Math.round(((totalContributions - lastYearContributions) / lastYearContributions) * 1000) / 10;
    }

    return {
      totalRepos: repos.length,
      publicRepos: repos.filter((r) => !r.is_private).length,
      privateRepos: repos.filter((r) => r.is_private).length,
      archivedRepos: repos.filter((r) => r.is_archived).length,
      forkedRepos: repos.filter((r) => r.is_fork).length,
      originalRepos: repos.filter((r) => !r.is_fork).length,
      activeRepos: repos.filter((r) => parseTimestamp(r.pushed_at as string) > now - 90 * 24 * 60 * 60 * 1000).length,
      reposWithStars: repos.filter((r) => (r.stars as number) > 0).length,
      reposCreatedThisYear: repos.filter((r) => new Date(r.created_at as string).getFullYear() === currentYear).length,
      averageStarsPerRepo: repos.length > 0 ? Math.round((repos.reduce((a, r) => a + ((r.stars as number) ?? 0), 0) / repos.length) * 10) / 10 : 0,
      languageCount: Object.keys(langBytes).length,
      primaryLanguage,
      primaryLanguageThisYear: primaryThisYear,
      topLanguages,
      topLanguagesThisYear: topThisYear,
      contributionsThisYear: totalContributions,
      contributionsLastYear: lastYearContributions,
      yearOverYearGrowth: yoy,
      totalTopics: allTopics.size,
      topTopics: Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([topic, count]) => ({ topic, count })),
      allTopics: Array.from(allTopics).sort(),
    };
  },
};
