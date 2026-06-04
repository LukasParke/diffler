async function githubRest(path: string, token = ""): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && !token.startsWith("${")) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function githubEvents(username: string, token = "", limit = 10): Promise<Array<Record<string, unknown>>> {
  try {
    const data = (await githubRest(`/users/${username}/events/public?per_page=${limit}`, token)) as Array<Record<string, unknown>>;
    return (data || []).slice(0, limit).map((e) => ({
      type: e.type || "Unknown",
      repo: (e.repo as Record<string, string>)?.name || "unknown",
      repo_url: `https://github.com/${(e.repo as Record<string, string>)?.name || ""}`,
      payload: e.payload || {},
      created_at: e.created_at || "",
    }));
  } catch {
    return [];
  }
}

export async function recentStars(username: string, token = "", limit = 10): Promise<Array<Record<string, unknown>>> {
  try {
    const data = (await githubRest(`/users/${username}/starred?per_page=${limit}&sort=created`, token)) as Array<Record<string, unknown>>;
    return (data || []).slice(0, limit).map((r) => ({
      name: r.name || "unknown",
      full_name: r.full_name || "",
      url: r.html_url || "",
      description: r.description || "",
      stars: r.stargazers_count || 0,
      language: r.language || null,
      starred_at: r.starred_at || "",
    }));
  } catch {
    return [];
  }
}

export async function gists(username: string, token = "", limit = 5): Promise<Array<Record<string, unknown>>> {
  try {
    const data = (await githubRest(`/users/${username}/gists?per_page=${limit}`, token)) as Array<Record<string, unknown>>;
    return (data || []).slice(0, limit).map((g) => ({
      id: g.id || "",
      description: g.description || null,
      url: g.html_url || "",
      created_at: g.created_at || "",
      files: Object.keys((g.files as Record<string, unknown>) || {}),
    }));
  } catch {
    return [];
  }
}

export async function releases(username: string, token = "", limit = 5): Promise<Array<Record<string, unknown>>> {
  try {
    const repos = (await githubRest(`/users/${username}/repos?per_page=30&sort=pushed`, token)) as Array<Record<string, unknown>>;
    const results: Array<Record<string, unknown>> = [];
    for (const repo of repos || []) {
      if (results.length >= limit) break;
      const repoName = repo.name as string;
      try {
        const rels = (await githubRest(`/repos/${username}/${repoName}/releases?per_page=1`, token)) as Array<Record<string, unknown>>;
        if (rels && rels.length > 0) {
          const r = rels[0];
          results.push({
            name: r.name || r.tag_name || "unknown",
            tag: r.tag_name || "",
            url: r.html_url || "",
            published_at: r.published_at || "",
            repo: repoName,
            repo_url: repo.html_url || "",
            body: ((r.body as string) || "").slice(0, 200),
          });
        }
      } catch {
        // ignore
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function sponsors(username: string, token = "", limit = 10): Promise<Array<Record<string, unknown>>> {
  if (!token || token.startsWith("${")) return [];
  try {
    const data = (await githubRest(`/users/${username}/sponsorships?per_page=${limit}`, token)) as Array<Record<string, unknown>>;
    return (data || []).slice(0, limit).map((s) => {
      const sponsor = (s.sponsor as Record<string, unknown>) || {};
      return {
        login: sponsor.login || "unknown",
        name: sponsor.name || "",
        url: sponsor.html_url || "",
        avatar_url: sponsor.avatar_url || "",
      };
    });
  } catch {
    return [];
  }
}

export async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch {
    return {};
  }
}
