import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubClient } from "../../src/github/client.js";
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
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      const url = fetchSpy.mock.calls[0][0] as string;
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
      const result = await client.restGet("/users/test");

      expect(result).toEqual({ login: "test" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries", async () => {
      fetchSpy.mockResolvedValue(
        new Response("Bad Gateway", { status: 502 })
      );

      const client = new GitHubClient(mockConfig);
      await expect(client.restGet("/users/test")).rejects.toThrow("HTTP 502");
      expect(fetchSpy).toHaveBeenCalledTimes(4); // initial + 3 retries
    }, 20000);
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

    it("skips auth header when token is empty", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 200 })
      );

      const noAuthConfig = { ...mockConfig, token: "" };
      const client = new GitHubClient(noAuthConfig);
      await client.graphqlQuery("query { viewer { login } }");

      const options = fetchSpy.mock.calls[0][1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });
});
