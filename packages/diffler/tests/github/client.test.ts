import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubClient, GitHubHttpError } from "../../src/github/client.js";
import type { GitHubConfig } from "../../src/config.js";

const mockConfig: GitHubConfig = {
  username: null,
  usernames: [],
  token: "test-token",
  profiles: [],
  apiUrl: "https://api.github.com",
  graphqlUrl: "https://api.github.com/graphql",
  includeOrgs: false,
  largeRepoMode: false,
};

describe("GitHubClient", () => {
  const fetchSpy = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("restGet", () => {
    it("makes a GET request with auth headers", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ login: "test" }), { status: 200 })
      );

      const client = new GitHubClient(mockConfig);
      const result = await client.restGet("/users/test");

      expect(result).toEqual({ login: "test" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.github.com/users/test",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            Accept: "application/vnd.github+json",
          }),
        })
      );
    });

    it("appends query params", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      );

      const client = new GitHubClient(mockConfig);
      await client.restGet("/users/test/repos", { per_page: 100, page: 1 });

      const url = fetchSpy.mock.calls[0][0];
      expect(url).toContain("per_page=100");
      expect(url).toContain("page=1");
    });

    it("retries on 502 and succeeds", async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ login: "test" }), { status: 200 })
        );

      const client = new GitHubClient(mockConfig);
      const request = client.restGet("/users/test");
      await vi.runAllTimersAsync();
      const result = await request;

      expect(result).toEqual({ login: "test" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries", async () => {
      fetchSpy.mockResolvedValue(
        new Response("Bad Gateway", { status: 502 })
      );

      const client = new GitHubClient(mockConfig);
      const rejection = expect(client.restGet("/users/test")).rejects.toMatchObject({
        name: "GitHubHttpError", status: 502,
      });
      await vi.runAllTimersAsync();
      await rejection;
      expect(fetchSpy).toHaveBeenCalledTimes(4); // initial + 3 retries
    });
  });

  describe("restGetRaw", () => {
    it("returns HTTP 304 status and validators without reading an absent body", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, {
        status: 304, headers: { etag: '"unchanged"' },
      }));

      const response = await new GitHubClient(mockConfig).restGetRaw("/metrics");

      expect(response).toEqual({ data: null, status: 304, headers: { etag: '"unchanged"' } });
    });

    it("returns HTTP 202 as pending rather than treating it as a completed body", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 202 }));

      const response = await new GitHubClient(mockConfig).restGetRaw("/metrics");

      expect(response).toEqual({ data: null, status: 202, headers: {} });
    });

    it("exposes HTTP error status and Retry-After without exposing the request token or body", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("private-repository-detail", {
        status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      }));
      const request = new GitHubClient(mockConfig).restGetRaw("/private-repository-detail");

      await expect(request).rejects.toBeInstanceOf(GitHubHttpError);
      await expect(request).rejects.toMatchObject({
        status: 429,
        headers: { "retry-after": "60", "x-ratelimit-remaining": "0" },
        message: "GitHub REST error: HTTP 429",
      });
    });
  });

  describe("graphqlQuery", () => {
    it("makes a POST to /graphql with query", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { user: { login: "test" } } }), {
          status: 200,
        })
      );

      const client = new GitHubClient(mockConfig);
      const result = await client.graphqlQuery("query { user { login } }");

      expect(result).toEqual({ user: { login: "test" } });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.github.com/graphql",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query: "query { user { login } }" }),
        })
      );
    });

    it("throws on GraphQL errors", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errors: [{ message: "Not found" }] }),
          { status: 200 }
        )
      );

      const client = new GitHubClient(mockConfig);
      await expect(
        client.graphqlQuery("query { user { login } }")
      ).rejects.toThrow("GraphQL errors");
    });

    it("preserves HTTP throttling metadata from GraphQL responses", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, {
        status: 429, headers: { "Retry-After": "2" },
      }));

      await expect(new GitHubClient(mockConfig).graphqlQuery("query { viewer { login } }"))
        .rejects.toMatchObject({ status: 429, headers: { "retry-after": "2" } });
    });

    it("allows explicitly requested missing nodes without discarding accessible results", async () => {
      fetchSpy.mockResolvedValueOnce(Response.json({
        data: { nodes: [{ id: "R_PUBLIC" }, null] },
        errors: [{ type: "NOT_FOUND", path: ["nodes", 1], message: "Unavailable" }],
      }));

      const result = await new GitHubClient(mockConfig).graphqlQuery(
        "query repositories($ids: [ID!]!) { nodes(ids: $ids) { id } }",
        { ids: ["R_PUBLIC", "R_MISSING"] },
        { allowMissingNodes: true }
      );

      expect(result).toEqual({ nodes: [{ id: "R_PUBLIC" }, null] });
    });

    it("does not suppress other GraphQL failures when missing nodes are allowed", async () => {
      fetchSpy.mockResolvedValueOnce(Response.json({
        data: { nodes: [null] },
        errors: [{ type: "RATE_LIMITED", path: ["nodes", 0], message: "Rate limited" }],
      }));

      await expect(new GitHubClient(mockConfig).graphqlQuery(
        "query repositories($ids: [ID!]!) { nodes(ids: $ids) { id } }",
        { ids: ["R_PUBLIC"] },
        { allowMissingNodes: true }
      )).rejects.toThrow("GraphQL errors");
    });

    it("rejects malformed GraphQL envelopes", async () => {
      fetchSpy.mockResolvedValueOnce(Response.json({ errors: "not an error array" }));

      await expect(new GitHubClient(mockConfig).graphqlQuery("query { viewer { login } }"))
        .rejects.toThrow("Invalid GitHub GraphQL response");
    });

    it("uses the configured GraphQL endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(Response.json({ data: {} }));
      const client = new GitHubClient({
        ...mockConfig, graphqlUrl: "https://github.example/api/graphql",
      });

      await client.graphqlQuery("query { viewer { login } }");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://github.example/api/graphql",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("skips auth header when token is empty", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 200 })
      );

      const noAuthConfig = { ...mockConfig, token: "" };
      const client = new GitHubClient(noAuthConfig);
      await client.graphqlQuery("query { viewer { login } }");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.github.com/graphql",
        expect.objectContaining({ headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }) })
      );
    });
  });
});
