export function devtoPosts(username: string, limit = 5): Promise<Array<Record<string, unknown>>> {
  return fetch(`https://dev.to/api/articles?username=${username}&per_page=${limit}`)
    .then((r) => r.json())
    .then((data) => {
      const articles = data as Array<Record<string, unknown>>;
      return (articles || []).slice(0, limit).map((a) => ({
        title: a.title || "Untitled",
        url: a.url || "#",
        published_at: a.published_at || "",
        tags: a.tag_list || [],
      }));
    })
    .catch(() => []);
}

export function rssFeed(url: string, limit = 5): Promise<Array<Record<string, unknown>>> {
  return fetch(url, { redirect: "follow" })
    .then((r) => r.text())
    .then((text) => {
      const entries: Array<Record<string, unknown>> = [];
      const itemRegex = /<item[^>]*>.*?<\/item>/gis;
      const entryRegex = /<entry[^>]*>.*?<\/entry>/gis;
      const items = text.match(itemRegex) || text.match(entryRegex) || [];

      for (const item of items.slice(0, limit)) {
        const titleMatch = item.match(/<title[^>]*>(.*?)<\/title>/is);
        const linkMatch = item.match(/<link[^>]*href="([^"]+)"/i) || item.match(/<link[^>]*>(.*?)<\/link>/is);
        const pubMatch = item.match(/<pubDate[^>]*>(.*?)<\/pubDate>/is) || item.match(/<published[^>]*>(.*?)<\/published>/is);

        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, "$1").trim() : "Untitled";
        const link = linkMatch ? linkMatch[1].trim() : "";
        const published = pubMatch ? pubMatch[1].trim() : "";

        entries.push({ title, url: link, published });
      }
      return entries;
    })
    .catch(() => []);
}

export function profileViewsBadge(username: string, style = "flat"): string {
  return `![Profile Views](https://komarev.com/ghpvc/?username=${username}&style=${style})`;
}

export function remotionAsset(username: string, asset = "readme", format = "gif"): string {
  return `https://${username}.github.io/github-stats-remotion/${asset}.${format}`;
}
