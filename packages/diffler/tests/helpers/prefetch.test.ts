import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import type { GitHubClient } from "../../src/github/client.js";
import {
  SourceStore,
  buildSourceSeed,
  extractHelperCalls,
  parseFeedEntries,
  prefetchSources,
  resolveCallArgs,
} from "../../src/helpers/prefetch.js";

function fakeClient(handler: (path: string) => unknown): GitHubClient {
  return {
    restGet: vi.fn(async (path: string) => handler(path)),
  } as unknown as GitHubClient;
}

describe("extractHelperCalls", () => {
  it("finds known helper calls with arguments", () => {
    const template = `
      {{ gists(github.user.login, 5) }}
      {{ github_events('octocat', token, 10) }}
      {{ unknown_helper(gists) }}
    `;
    const calls = extractHelperCalls(template);
    expect(calls.map((c) => ({ name: c.name, args: c.args }))).toEqual([
      { name: "gists", args: ["github.user.login", " 5"] },
      { name: "github_events", args: ["'octocat'", " token", " 10"] },
    ]);
  });

  it("handles nested parentheses and strings containing separators", () => {
    const template = `{{ rss_feed("https://example.com/feed?a=(1,2)", 3) }}`;
    const calls = extractHelperCalls(template);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("rss_feed");
    const args = resolveCallArgs(calls[0], buildSourceSeed("luke"));
    expect(args).toEqual(["https://example.com/feed?a=(1,2)", 3]);
  });

  it("ignores identifiers that are not helpers", () => {
    const template = `{{ filter_repos(repositories, limit=5) }} {{ gists }}`;
    expect(extractHelperCalls(template)).toEqual([]);
  });
});

describe("resolveCallArgs", () => {
  it("resolves literals and dotted variable lookups", () => {
    const seed = buildSourceSeed("luke");
    const call = { name: "gists", args: ["github.user.login", "'other'", "7", "true", "undefined_expr"] };
    expect(resolveCallArgs(call, seed)).toEqual(["luke", "other", 7, true, undefined]);
  });
});

describe("SourceStore", () => {
  it("slices prefetched arrays and falls back to the default username", () => {
    const store = new SourceStore("luke");
    store.set("gists", "luke", [{ id: "1" }, { id: "2" }, { id: "3" }]);

    expect(store.slice("gists", undefined, 2)).toEqual([{ id: "1" }, { id: "2" }]);
    expect(store.slice("gists", "luke", 10)).toHaveLength(3);
    expect(store.slice("gists", "missing", 5)).toEqual([]);
  });

  it("stores arbitrary JSON for fetch_json by url", () => {
    const store = new SourceStore("luke");
    store.set("fetch_json", "https://example.com/data.json", { hello: true });
    expect(store.get("fetch_json", "https://example.com/data.json")).toEqual({ hello: true });
    expect(store.get("fetch_json", "https://example.com/other.json")).toBeUndefined();
  });
});

describe("prefetchSources", () => {
  it("prefetches gists through the profile client and shapes them for the reader", async () => {
    const client = fakeClient((path) => {
      if (path.startsWith("/users/luke/gists")) {
        return [
          {
            id: "abc",
            description: "demo",
            html_url: "https://gist.github.com/abc",
            created_at: "2026-01-01",
            files: { "a.rs": {} },
          },
        ];
      }
      throw new Error(`unexpected path ${path}`);
    });
    const store = new SourceStore("luke");

    await prefetchSources(
      "{{ gists(github.user.login, 5) }}",
      [{ username: "luke", client }],
      "luke",
      store
    );

    expect(store.slice("gists", "luke", 5)).toEqual([
      {
        id: "abc",
        description: "demo",
        url: "https://gist.github.com/abc",
        created_at: "2026-01-01",
        files: ["a.rs"],
      },
    ]);
  });

  it("keeps the store empty when a prefetch fails", async () => {
    const client = fakeClient(() => {
      throw new Error("rate limited");
    });
    const store = new SourceStore("luke");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await prefetchSources(
      "{{ github_events(github.user.login, 10) }}",
      [{ username: "luke", client }],
      "luke",
      store
    );

    expect(store.slice("github_events", "luke", 10)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("rate limited"));
    warn.mockRestore();
  });

  it("does nothing when the template uses no source helpers", async () => {
    const client = fakeClient(() => {
      throw new Error("should not be called");
    });
    const store = new SourceStore("luke");

    await prefetchSources(
      "{{ github.user.name }}",
      [{ username: "luke", client }],
      "luke",
      store
    );

    expect(client.restGet).not.toHaveBeenCalled();
  });
});

describe("parseFeedEntries", () => {
  it("extracts titles and links from RSS and Atom feeds", () => {
    const rss = `<rss><channel><item><title>First</title><link>https://a.example/1</link><pubDate>Mon, 01 Jun 2026</pubDate></item></channel></rss>`;
    expect(parseFeedEntries(rss)).toEqual([
      { title: "First", url: "https://a.example/1", published: "Mon, 01 Jun 2026" },
    ]);

    const atom = `<feed><entry><title>Second</title><link href="https://b.example/2"/><published>2026-06-02</published></entry></feed>`;
    expect(parseFeedEntries(atom, 1)).toEqual([
      { title: "Second", url: "https://b.example/2", published: "2026-06-02" },
    ]);
  });

  it("unwraps CDATA titles", () => {
    const rss = `<item><title><![CDATA[Wrapped & Titled]]></title><link>https://c.example/3</link></item>`;
    expect(parseFeedEntries(rss)[0]).toMatchObject({ title: "Wrapped & Titled" });
  });
});

describe("template integration", () => {
  it("renders prefetched helper data inside a Nunjucks template", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "abc",
            description: "demo gist",
            html_url: "https://gist.github.com/abc",
            created_at: "2026-01-01",
            files: { "a.rs": {} },
          },
        ]),
        { status: 200 }
      )
    );

    const templateDir = mkdtempSync(join(tmpdir(), "diffler-templates-"));
    const templatePath = join(templateDir, "profile.md.j2");
    writeFileSync(
      templatePath,
      "Gists: {% for g in gists(github.user.login, 5) %}[{{ g.id }}]{% endfor %}"
    );

    try {
      const { GitHubClient } = await import("../../src/github/client.js");
      const { Renderer } = await import("../../src/core/renderer.js");
      const { SourceStore, prefetchSources } = await import("../../src/helpers/prefetch.js");

      const client = new GitHubClient({
        username: "luke",
        token: "test-token",
        apiUrl: "https://api.github.com",
        graphqlUrl: "https://api.github.com/graphql",
        usernames: [],
        profiles: [],
        includeOrgs: false,
        largeRepoMode: false,
      });

      const config = {
        github: {},
        templates: { main: "profile.md.j2", directory: templateDir, builtins: false },
      } as never;
      const renderer = new Renderer(config);
      const templateSource = renderer.readTemplateSource();

      const store = new SourceStore("luke");
      await prefetchSources(templateSource, [{ username: "luke", client }], "luke", store);
      const output = renderer.render({ github: { user: { login: "luke" } } }, store);

      expect(output).toBe("Gists: [abc]");
    } finally {
      fetchSpy.mockRestore();
      rmSync(templateDir, { recursive: true, force: true });
    }
  });
});
