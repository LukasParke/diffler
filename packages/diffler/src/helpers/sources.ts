import type { SourceStore } from "./prefetch.js";

// All data is prefetched before rendering (see prefetch.ts); these readers only
// slice the prefetched results, so they are safe as synchronous Nunjucks
// globals. The token parameter is kept for template compatibility but auth now
// comes from the configured profile tokens.

export function githubEvents(store: SourceStore) {
  return (
    username?: string,
    _token?: string,
    limit = 10
  ): Array<Record<string, unknown>> => store.slice("github_events", username, limit);
}

export function recentStars(store: SourceStore) {
  return (
    username?: string,
    _token?: string,
    limit = 10
  ): Array<Record<string, unknown>> => store.slice("recent_stars", username, limit);
}

export function gists(store: SourceStore) {
  return (username?: string, _token?: string, limit = 5): Array<Record<string, unknown>> =>
    store.slice("gists", username, limit);
}

export function releases(store: SourceStore) {
  return (username?: string, _token?: string, limit = 5): Array<Record<string, unknown>> =>
    store.slice("releases", username, limit);
}

export function sponsors(store: SourceStore) {
  return (username?: string, _token?: string, limit = 10): Array<Record<string, unknown>> =>
    store.slice("sponsors", username, limit);
}

