function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function primaryLanguage(repo: Record<string, unknown>): string | null {
  if (repo.primaryLanguage === null) return null;
  return stringValue(repo.primaryLanguage) ?? stringValue(repo.primary_language) ??
    stringValue(repo.language) ?? null;
}

function languageColor(repo: Record<string, unknown>, language: string | null): string | null {
  if (Array.isArray(repo.languages)) {
    const languages: unknown[] = repo.languages;
    const match = languages.find((entry) => isRecord(entry) && entry.languageName === language);
    if (isRecord(match)) return stringValue(match.color) ?? null;
  }
  return stringValue(repo.primary_language_color) ?? stringValue(repo.language_color) ?? null;
}

function stars(repo: Record<string, unknown>): number {
  return numberValue(repo.stars) ?? numberValue(repo.stargazers_count) ?? 0;
}

function normalize(repo: Record<string, unknown>) {
  const language = primaryLanguage(repo);
  return {
    name: stringValue(repo.name) ?? "",
    full_name: stringValue(repo.nameWithOwner) ?? stringValue(repo.full_name) ?? "",
    description: stringValue(repo.description) ?? null,
    url: stringValue(repo.url) ?? stringValue(repo.html_url) ?? "",
    stars: stars(repo),
    forks: numberValue(repo.forks) ?? numberValue(repo.forks_count) ?? 0,
    language,
    language_color: languageColor(repo, language),
    is_fork: typeof repo.isFork === "boolean" ? repo.isFork : repo.is_fork === true,
    is_archived: typeof repo.isArchived === "boolean" ? repo.isArchived : repo.is_archived === true,
  };
}

export function filterRepos(
  repos: ReadonlyArray<Record<string, unknown>>,
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
): Array<ReturnType<typeof normalize>> {
  let result = repos.map(normalize);

  if (options.exclude_forks) result = result.filter((repo) => !repo.is_fork);
  if (options.exclude_archived) result = result.filter((repo) => !repo.is_archived);
  if (options.language) {
    const language = options.language.toLowerCase();
    result = result.filter((repo) => repo.language?.toLowerCase() === language);
  }
  const minStars = options.min_stars;
  const maxStars = options.max_stars;
  if (minStars !== undefined) result = result.filter((repo) => repo.stars >= minStars);
  if (maxStars !== undefined) result = result.filter((repo) => repo.stars <= maxStars);
  if (options.search) {
    const term = options.search.toLowerCase();
    result = result.filter((repo) =>
      repo.name.toLowerCase().includes(term) ||
      (repo.description ?? "").toLowerCase().includes(term) ||
      repo.full_name.toLowerCase().includes(term)
    );
  }

  const sortDesc = options.sort_desc !== false;
  const sortKey = (repo: ReturnType<typeof normalize>): string | number => {
    switch (options.sort_by) {
      case "forks": return repo.forks;
      case "name": return repo.name.toLowerCase();
      case "language": return (repo.language ?? "").toLowerCase();
      default: return repo.stars;
    }
  };
  result.sort((a, b) => {
    const av = sortKey(a);
    const bv = sortKey(b);
    if (av < bv) return sortDesc ? 1 : -1;
    if (av > bv) return sortDesc ? -1 : 1;
    return 0;
  });

  return options.limit === undefined ? result : result.slice(0, options.limit);
}

export function reposByLanguage<T extends Record<string, unknown>>(
  repos: readonly T[]
): Record<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const repo of repos) {
    const language = primaryLanguage(repo) || "Unknown";
    const group = groups.get(language) ?? [];
    group.push(repo);
    groups.set(language, group);
  }
  for (const group of groups.values()) group.sort((a, b) => stars(b) - stars(a));
  return Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b)));
}

export function languageBreakdown(repos: ReadonlyArray<Record<string, unknown>>) {
  const stats = new Map<string, {
    language: string;
    count: number;
    total_stars: number;
    color: string | null;
  }>();
  for (const repo of repos) {
    const language = primaryLanguage(repo) || "Unknown";
    const summary = stats.get(language) ?? {
      language,
      count: 0,
      total_stars: 0,
      color: languageColor(repo, language),
    };
    summary.count += 1;
    summary.total_stars += stars(repo);
    summary.color ??= languageColor(repo, language);
    stats.set(language, summary);
  }
  return [...stats.values()].sort((a, b) =>
    b.total_stars - a.total_stars || a.language.localeCompare(b.language)
  );
}
