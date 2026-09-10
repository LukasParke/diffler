import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/github/client.js";
import { collectProfile } from "../../src/stats/github.js";
import { BudgetStoppedError, RequestScheduler } from "../../src/stats/scheduler.js";
import { NOW, githubConfig, graphqlResponse, profile, statsConfig } from "./fixtures.js";

describe("RequestScheduler with the HTTP client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("honors REST Retry-After seconds and stops other optional work during the cooldown", async () => {
    const client = new GitHubClient(githubConfig);
    const scheduler = new RequestScheduler(statsConfig);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: {
        "Retry-After": "2",
        "X-RateLimit-Limit": "5000",
        "X-RateLimit-Remaining": "4500",
        "X-RateLimit-Reset": String(NOW.getTime() / 1000 + 3600),
      } }))
      .mockResolvedValueOnce(Response.json({ count: 12 }));

    const request = scheduler.rest("repository traffic", () => client.restGetRaw("/traffic"));
    await vi.advanceTimersByTimeAsync(0);

    expect(scheduler.shouldStartOptional("rest")).toBe(false);
    expect(scheduler.state().restRateLimit?.remaining).toBe(4500);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await request).toMatchObject({ data: { count: 12 }, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(scheduler.shouldStartOptional("rest")).toBe(true);
  });

  it("honors GraphQL Retry-After HTTP dates", async () => {
    const client = new GitHubClient(githubConfig);
    const scheduler = new RequestScheduler(statsConfig);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: {
        "Retry-After": "Mon, 01 Jun 2026 12:00:03 GMT",
        "X-RateLimit-Limit": "5000",
        "X-RateLimit-Remaining": "4500",
        "X-RateLimit-Reset": String(NOW.getTime() / 1000 + 3600),
      } }))
      .mockResolvedValueOnce(graphqlResponse({ viewer: profile() }));

    const request = collectProfile(client, scheduler);
    await vi.advanceTimersByTimeAsync(2999);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scheduler.state().graphqlRateLimit?.remaining).toBe(4500);
    await vi.advanceTimersByTimeAsync(1);
    expect((await request).profile.login).toBe("alice");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits for a primary rate-limit reset advertised on an HTTP error", async () => {
    const client = new GitHubClient(githubConfig);
    const scheduler = new RequestScheduler(statsConfig);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403, headers: {
        "X-RateLimit-Limit": "5000",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(NOW.getTime() / 1000 + 2),
      } }))
      .mockResolvedValueOnce(Response.json([]));

    const request = scheduler.rest("repository metrics", () => client.restGetRaw("/metrics"));
    await vi.advanceTimersByTimeAsync(1999);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scheduler.state().restRateLimit?.remaining).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect((await request).status).toBe(200);
  });

  it("defers optional work instead of waiting past the runtime budget", async () => {
    const client = new GitHubClient(githubConfig);
    const scheduler = new RequestScheduler({ ...statsConfig, maxRuntimeSeconds: 1 });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: {
      "Retry-After": "600",
    } }));

    const rejection = expect(scheduler.rest("repository metrics", () => client.restGetRaw("/metrics")))
      .rejects.toBeInstanceOf(BudgetStoppedError);
    await vi.runAllTimersAsync();
    await rejection;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Date.now()).toBe(NOW.getTime());
    expect(scheduler.shouldStartOptional("rest")).toBe(false);
  });

  it("does not retry a permission-only HTTP 403 as a rate limit", async () => {
    const client = new GitHubClient(githubConfig);
    const scheduler = new RequestScheduler(statsConfig);
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    const rejection = expect(scheduler.rest("repository metrics", () => client.restGetRaw("/metrics")))
      .rejects.toMatchObject({ status: 403 });
    await vi.runAllTimersAsync();
    await rejection;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scheduler.shouldStartOptional("rest")).toBe(true);
  });

  it("updates the REST budget from a returned HTTP 304", async () => {
    const client = new GitHubClient(githubConfig);
    const scheduler = new RequestScheduler(statsConfig);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304, headers: {
      "X-RateLimit-Limit": "5000",
      "X-RateLimit-Remaining": "700",
      "X-RateLimit-Reset": String(NOW.getTime() / 1000 + 3600),
    } }));

    const response = await scheduler.rest("repository metrics", () => client.restGetRaw("/metrics"));

    expect(response.status).toBe(304);
    expect(scheduler.state().restRateLimit).toEqual({
      limit: 5000, remaining: 700, used: 4300, resetAt: "2026-06-01T13:00:00.000Z",
    });
    expect(scheduler.shouldStartOptional("rest")).toBe(false);
  });
});
