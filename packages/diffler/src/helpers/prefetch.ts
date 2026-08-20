import type { GitHubClient } from "../github/client.js";

// Helpers that previously returned promises from Nunjucks globals. Nunjucks
// does not await promises, so every one of these rendered as nothing. They are
// now synchronous readers over data prefetched into a SourceStore before the
// template renders.
export const SOURCE_HELPER_NAMES = [
  "github_events",
  "recent_stars",
  "gists",
  "releases",
  "sponsors",
  "devto_posts",
  "rss_feed",
  "fetch_json",
] as const;

export type SourceHelperName = (typeof SOURCE_HELPER_NAMES)[number];

const SOURCE_HELPER_SET = new Set<string>(SOURCE_HELPER_NAMES);

// Prefetch a generous fixed window; helpers slice down to the requested limit.
const PREFETCH_LIMIT = 30;

export type SourceSeed = {
  defaultUsername: string;
  variables: Record<string, unknown>;
};

export class SourceStore {
  private data = new Map<string, Map<string, unknown>>();

  constructor(public readonly defaultUsername: string = "unknown") {}

  set(name: SourceHelperName, key: string, value: unknown): void {
    let byKey = this.data.get(name);
    if (!byKey) {
      byKey = new Map();
      this.data.set(name, byKey);
    }
    byKey.set(key, value);
  }

  get(name: SourceHelperName, key: string | undefined): unknown {
    return this.data.get(name)?.get(this.resolveKey(name, key));
  }

  slice(name: SourceHelperName, key: string | undefined, limit: number): Array<Record<string, unknown>> {
    const value = this.get(name, key);
    if (!Array.isArray(value)) return [];
    return value.slice(0, Math.max(0, limit)) as Array<Record<string, unknown>>;
  }

  private resolveKey(name: SourceHelperName, key: string | undefined): string {
    if (name === "rss_feed" || name === "fetch_json") return key ?? "";
    return key && key.trim() ? key : this.defaultUsername;
  }
}

export type HelperCall = { name: string; args: string[] };

export function buildSourceSeed(login: string): SourceSeed {
  return {
    defaultUsername: login,
    variables: {
      github: { user: { login, name: login, username: login } },
      profile: { login, name: login, username: login },
      user: { login, name: login, username: login },
      username: login,
      login,
    },
  };
}

export function extractHelperCalls(templateSource: string): HelperCall[] {
  const calls: HelperCall[] = [];
  const identifier = /[a-zA-Z_][a-zA-Z0-9_]*/g;

  let match: RegExpExecArray | null;
  while ((match = identifier.exec(templateSource)) !== null) {
    const name = match[0];
    if (!SOURCE_HELPER_SET.has(name)) continue;

    let cursor = match.index + name.length;
    while (templateSource[cursor] === " " || templateSource[cursor] === "\t") cursor++;
    if (templateSource[cursor] !== "(") continue;

    const closing = scanBalancedParens(templateSource, cursor);
    if (closing === -1) continue;

    calls.push({
      name,
      args: splitTopLevel(templateSource.slice(cursor + 1, closing)),
    });
  }

  return calls;
}

export function resolveCallArgs(call: HelperCall, seed: SourceSeed): unknown[] {
  return call.args.map((token) => resolveArgToken(token, seed));
}

export type PrefetchClient = { username: string; client: GitHubClient };

export async function prefetchSources(
  templateSource: string,
  clients: PrefetchClient[],
  defaultUsername: string,
  store: SourceStore
): Promise<void> {
  const calls = extractHelperCalls(templateSource);
  if (calls.length === 0) return;

  const seed = buildSourceSeed(defaultUsername);
  const clientByUser = new Map(clients.map((entry) => [entry.username, entry.client]));
  const fallbackClient = clients[0]?.client;

  await Promise.all(
    calls.map(async (call) => {
      const args = resolveCallArgs(call, seed);
      try {
        const value = await runPrefetch(call.name as SourceHelperName, args, {
          clientByUser,
          fallbackClient,
          defaultUsername,
        });
        if (value !== undefined) {
          store.set(call.name as SourceHelperName, primaryKey(call.name, args, defaultUsername), value);
        }
      } catch (error) {
        console.warn(
          `Diffler helper prefetch failed for ${call.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );
}

function primaryKey(name: string, args: unknown[], defaultUsername: string): string {
  const first = args[0];
  if (name === "rss_feed" || name === "fetch_json") {
    return typeof first === "string" ? first : "";
  }
  return typeof first === "string" && first.trim() ? first : defaultUsername;
}

type PrefetchContext = {
  clientByUser: Map<string, GitHubClient>;
  fallbackClient: GitHubClient | undefined;
  defaultUsername: string;
};

async function runPrefetch(
  name: SourceHelperName,
  args: unknown[],
  ctx: PrefetchContext
): Promise<unknown> {
  const first = args[0];
  const limit = typeof args[args.length - 1] === "number" ? (args[args.length - 1] as number) : undefined;

  switch (name) {
    case "github_events":
    case "recent_stars":
    case "gists":
    case "releases":
    case "sponsors":
    case "devto_posts": {
      const username =
        typeof first === "string" && first.trim() ? first : ctx.defaultUsername;
      return fetchByName(name, username, ctx, limit);
    }
    case "rss_feed": {
      if (typeof first !== "string" || !first) return undefined;
      const response = await fetch(first, { redirect: "follow" });
      if (!response.ok) return [];
      return parseFeedEntries(await response.text(), limit);
    }
    case "fetch_json": {
      if (typeof first !== "string" || !first) return undefined;
      const response = await fetch(first);
      if (!response.ok) return {};
      return response.json();
    }
  }
}

function clientFor(username: string, ctx: PrefetchContext): GitHubClient | undefined {
  return ctx.clientByUser.get(username) ?? ctx.fallbackClient;
}

async function fetchByName(
  name: SourceHelperName,
  username: string,
  ctx: PrefetchContext,
  limit?: number
): Promise<unknown[]> {
  const capped = Math.min(Math.max(limit ?? PREFETCH_LIMIT, 1), PREFETCH_LIMIT);
  switch (name) {
    case "github_events": {
      const client = clientFor(username, ctx);
      if (!client) return [];
      const data = (await client.restGet(`/users/${username}/events/public`, {
        per_page: PREFETCH_LIMIT,
      })) as Array<Record<string, unknown>>;
      return (data || []).slice(0, capped).map((event) => ({
        type: event.type || "Unknown",
        repo: (event.repo as Record<string, string>)?.name || "unknown",
        repo_url: `https://github.com/${(event.repo as Record<string, string>)?.name || ""}`,
        payload: event.payload || {},
        created_at: event.created_at || "",
      }));
    }
    case "recent_stars": {
      const client = clientFor(username, ctx);
      if (!client) return [];
      const data = (await client.restGet(`/users/${username}/starred`, {
        per_page: PREFETCH_LIMIT,
        sort: "created",
      })) as Array<Record<string, unknown>>;
      return (data || []).slice(0, capped).map((repo) => ({
        name: repo.name || "unknown",
        full_name: repo.full_name || "",
        url: repo.html_url || "",
        description: repo.description || "",
        stars: repo.stargazers_count || 0,
        language: repo.language || null,
        starred_at: repo.starred_at || "",
      }));
    }
    case "gists": {
      const client = clientFor(username, ctx);
      if (!client) return [];
      const data = (await client.restGet(`/users/${username}/gists`, {
        per_page: PREFETCH_LIMIT,
      })) as Array<Record<string, unknown>>;
      return (data || []).slice(0, capped).map((gist) => ({
        id: gist.id || "",
        description: gist.description || null,
        url: gist.html_url || "",
        created_at: gist.created_at || "",
        files: Object.keys((gist.files as Record<string, unknown>) || {}),
      }));
    }
    case "releases": {
      const client = clientFor(username, ctx);
      if (!client) return [];
      return fetchReleases(client, username, capped);
    }
    case "sponsors": {
      const client = clientFor(username, ctx);
      if (!client) return [];
      const data = (await client.restGet(`/users/${username}/sponsorships`, {
        per_page: PREFETCH_LIMIT,
      })) as Array<Record<string, unknown>>;
      return (data || []).slice(0, capped).map((sponsorship) => {
        const sponsor = (sponsorship.sponsor as Record<string, unknown>) || {};
        return {
          login: sponsor.login || "unknown",
          name: sponsor.name || "",
          url: sponsor.html_url || "",
          avatar_url: sponsor.avatar_url || "",
        };
      });
    }
    case "devto_posts": {
      const response = await fetch(
        `https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=${PREFETCH_LIMIT}`
      );
      if (!response.ok) return [];
      const articles = (await response.json()) as Array<Record<string, unknown>>;
      return (articles || []).slice(0, capped).map((article) => ({
        title: article.title || "Untitled",
        url: article.url || "#",
        published_at: article.published_at || "",
        tags: article.tag_list || [],
      }));
    }
    default:
      return [];
  }
}

async function fetchReleases(
  client: GitHubClient,
  username: string,
  limit: number
): Promise<unknown[]> {
  const repos = (await client.restGet(`/users/${username}/repos`, {
    per_page: 30,
    sort: "pushed",
  })) as Array<Record<string, unknown>>;
  const results: Array<Record<string, unknown>> = [];

  for (const repo of repos || []) {
    if (results.length >= limit) break;
    const repoName = repo.name as string;
    try {
      const rels = (await client.restGet(`/repos/${username}/${repoName}/releases`, {
        per_page: 1,
      })) as Array<Record<string, unknown>>;
      if (rels && rels.length > 0) {
        const release = rels[0];
        results.push({
          name: release.name || release.tag_name || "unknown",
          tag: release.tag_name || "",
          url: release.html_url || "",
          published_at: release.published_at || "",
          repo: repoName,
          repo_url: repo.html_url || "",
          body: ((release.body as string) || "").slice(0, 200),
        });
      }
    } catch {
      // Skip repositories without reachable releases
    }
  }

  return results;
}

export function parseFeedEntries(text: string, limit?: number): unknown[] {
  const capped = Math.min(Math.max(limit ?? PREFETCH_LIMIT, 1), PREFETCH_LIMIT);
  const entries: Array<Record<string, unknown>> = [];
  const itemRegex = /<item[^>]*>.*?<\/item>/gis;
  const entryRegex = /<entry[^>]*>.*?<\/entry>/gis;
  const items = text.match(itemRegex) || text.match(entryRegex) || [];

  for (const item of items.slice(0, capped)) {
    const titleMatch = item.match(/<title[^>]*>(.*?)<\/title>/is);
    const linkMatch =
      item.match(/<link[^>]*href="([^"]+)"/i) || item.match(/<link[^>]*>(.*?)<\/link>/is);
    const pubMatch =
      item.match(/<pubDate[^>]*>(.*?)<\/pubDate>/is) ||
      item.match(/<published[^>]*>(.*?)<\/published>/is);

    const title = titleMatch
      ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, "$1").trim()
      : "Untitled";

    entries.push({
      title,
      url: linkMatch ? linkMatch[1].trim() : "",
      published: pubMatch ? pubMatch[1].trim() : "",
    });
  }

  return entries;
}

function scanBalancedParens(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (char === "'" || char === '"') {
      i = skipString(source, i);
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function skipString(source: string, quoteIndex: number): number {
  const quote = source[quoteIndex];
  for (let i = quoteIndex + 1; i < source.length; i++) {
    if (source[i] === "\\") {
      i++;
      continue;
    }
    if (source[i] === quote) return i;
  }
  return source.length;
}

function splitTopLevel(args: string): string[] {
  const trimmed = args.trim();
  if (!trimmed) return [];

  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "'" || char === '"') {
      const end = skipString(trimmed, i);
      current += trimmed.slice(i, end + 1);
      i = end;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth++;
    if (char === ")" || char === "]" || char === "}") depth--;
    if (char === "," && depth === 0) {
      tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  tokens.push(current);
  return tokens;
}

function resolveArgToken(token: string, seed: SourceSeed): unknown {
  const trimmed = token.trim();
  if (!trimmed) return undefined;

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "none" || trimmed === "null") return null;

  if (/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(trimmed)) {
    return lookupPath(seed.variables, trimmed);
  }

  return undefined;
}

function lookupPath(variables: Record<string, unknown>, path: string): unknown {
  let current: unknown = variables;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
