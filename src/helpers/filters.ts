interface Repo {
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  language_color: string | null;
  is_fork: boolean;
  is_archived: boolean;
}

function normalize(repo: Record<string, unknown>): Repo {
  return {
    name: (repo.name as string) || "",
    full_name: (repo.full_name as string) || "",
    description: (repo.description as string) || null,
    url: (repo.url as string) || "",
    stars: (repo.stars as number) || 0,
    forks: (repo.forks as number) || 0,
    language: (repo.primary_language as string) || null,
    language_color: (repo.primary_language_color as string) || null,
    is_fork: (repo.is_fork as boolean) || false,
    is_archived: (repo.is_archived as boolean) || false,
  };
}

export function filterRepos(
  repos: Array<Record<string, unknown>>,
  options: {
    language?: string;
    min_stars?: number;
    max_stars?: number;
    exclude_forks?: boolean;
    exclude_archived?: boolean;
    search?: string;
    sort_by?: string;
    sort_desc?: boolean;
    limit?: number;
  } = {}
): Array<Record<string, unknown>> {
  const normalized = repos.map(normalize);
  let result = [...normalized];

  if (options.exclude_forks) {
    result = result.filter((r) => !r.is_fork);
  }
  if (options.exclude_archived) {
    result = result.filter((r) => !r.is_archived);
  }
  if (options.language) {
    const lang = options.language.toLowerCase();
    result = result.filter((r) => r.language && r.language.toLowerCase() === lang);
  }
  if (options.min_stars !== undefined) {
    result = result.filter((r) => r.stars >= options.min_stars!);
  }
  if (options.max_stars !== undefined) {
    result = result.filter((r) => r.stars <= options.max_stars!);
  }
  if (options.search) {
    const term = options.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.description || "").toLowerCase().includes(term) ||
        r.full_name.toLowerCase().includes(term)
    );
  }

  const sortBy = options.sort_by || "stars";
  const sortDesc = options.sort_desc !== false;

  const sortKey = (r: Repo): string | number => {
    if (sortBy === "stars") return r.stars;
    if (sortBy === "forks") return r.forks;
    if (sortBy === "name") return r.name.toLowerCase();
    if (sortBy === "language") return (r.language || "").toLowerCase();
    return r.stars;
  };

  result.sort((a, b) => {
    const av = sortKey(a);
    const bv = sortKey(b);
    if (av < bv) return sortDesc ? 1 : -1;
    if (av > bv) return sortDesc ? -1 : 1;
    return 0;
  });

  if (options.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return result as unknown as Array<Record<string, unknown>>;
}

export function reposByLanguage(
  repos: Array<Record<string, unknown>>
): Record<string, Array<Record<string, unknown>>> {
  const groups: Record<string, Array<Record<string, unknown>>> = {};
  for (const repo of repos) {
    const lang = (repo.primary_language as string) || "Unknown";
    groups[lang] = groups[lang] || [];
    groups[lang].push(repo);
  }
  for (const lang of Object.keys(groups)) {
    groups[lang].sort((a, b) => ((b.stars as number) || 0) - ((a.stars as number) || 0));
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

export function languageBreakdown(repos: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const stats: Record<string, { language: string; count: number; total_stars: number; color: string | null }> = {};
  for (const repo of repos) {
    const lang = (repo.primary_language as string) || "Unknown";
    const color = (repo.primary_language_color as string) || null;
    if (!stats[lang]) {
      stats[lang] = { language: lang, count: 0, total_stars: 0, color };
    }
    stats[lang].count += 1;
    stats[lang].total_stars += (repo.stars as number) || 0;
  }
  return Object.values(stats).sort((a, b) => b.total_stars - a.total_stars);
}
