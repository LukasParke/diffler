import type { SourceStore } from "./prefetch.js";

export function devtoPosts(store: SourceStore) {
  return (username?: string, limit = 5): Array<Record<string, unknown>> =>
    store.slice("devto_posts", username, limit);
}

export function rssFeed(store: SourceStore) {
  return (url?: string, limit = 5): Array<Record<string, unknown>> =>
    url ? store.slice("rss_feed", url, limit) : [];
}

export function fetchJson(store: SourceStore) {
  return (url?: string): unknown => (url ? store.get("fetch_json", url) ?? {} : {});
}

export function profileViewsBadge(username: string, style = "flat"): string {
  return `![Profile Views](https://komarev.com/ghpvc/?username=${username}&style=${style})`;
}

export function remotionAsset(username: string, asset = "readme", format = "gif"): string {
  return `https://${username}.github.io/github-stats-remotion/${asset}.${format}`;
}
