import { describe, expect, it } from "vitest";
import { collectPackageStats, NpmPackageStatsAdapter } from "../../src/packages/index.js";

describe("NpmPackageStatsAdapter", () => {
  it("normalizes metadata and every supported download window", async () => {
    const requests: string[] = [];
    const adapter = new NpmPackageStatsAdapter(
      async (url) => {
        requests.push(url);
        if (url.startsWith("https://registry.npmjs.org/")) {
          return response({
            "dist-tags": { latest: "1.2.3" },
            time: {
              created: "2026-01-01T12:00:00.000Z",
              "1.2.3": "2026-08-01T12:00:00.000Z",
            },
          });
        }

        const period = url.split("/").at(-2) ?? "";
        return response({
          downloads: period.includes(":")
            ? 8_000
            : {
                "last-day": 10,
                "last-week": 70,
                "last-month": 300,
                "last-year": 3_650,
              }[period],
        });
      },
      () => new Date("2026-08-14T12:00:00.000Z")
    );

    const result = await adapter.collect(["@lukasparke/diffler"]);

    expect(result.warnings).toEqual([]);
    expect(result.packages).toEqual([
      {
        provider: "npm",
        name: "@lukasparke/diffler",
        url: "https://www.npmjs.com/package/%40lukasparke%2Fdiffler",
        latestVersion: "1.2.3",
        latestPublishedAt: "2026-08-01T12:00:00.000Z",
        downloads: {
          lastDay: 10,
          lastWeek: 70,
          lastMonth: 300,
          lastYear: 3_650,
          allTime: 8_000,
        },
      },
    ]);
    expect(requests).toHaveLength(6);
    expect(requests.every((url) => url.includes("%40lukasparke%2Fdiffler"))).toBe(
      true
    );
  });

  it("keeps successful packages when another package fails", async () => {
    const adapter = new NpmPackageStatsAdapter(
      async (url) => {
        if (url.includes("missing")) {
          return response({}, 404);
        }
        if (url.startsWith("https://registry.npmjs.org/")) {
          return response({
            "dist-tags": { latest: "1.0.0" },
            time: { created: "2026-01-01T00:00:00.000Z" },
          });
        }
        return response({ downloads: 5 });
      },
      () => new Date("2026-08-14T12:00:00.000Z")
    );

    const result = await adapter.collect(["working", "missing"]);

    expect(result.packages.map((item) => item.name)).toEqual(["working"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('npm package "missing" unavailable');
  });

  it("treats downloads API 404s as zero downloads for known packages", async () => {
    const adapter = new NpmPackageStatsAdapter(
      async (url) => {
        if (url.startsWith("https://registry.npmjs.org/")) {
          return response({
            "dist-tags": { latest: "0.1.0" },
            time: {
              created: "2026-08-01T00:00:00.000Z",
              "0.1.0": "2026-08-01T00:00:00.000Z",
            },
          });
        }
        return response({ error: "package not found" }, 404);
      },
      () => new Date("2026-08-14T12:00:00.000Z")
    );

    const result = await adapter.collect(["fresh-package"]);

    expect(result.warnings).toEqual([]);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].downloads).toEqual({
      lastDay: 0,
      lastWeek: 0,
      lastMonth: 0,
      lastYear: 0,
      allTime: 0,
    });
    expect(result.packages[0].latestVersion).toBe("0.1.0");
  });

  it("splits and sums historical downloads across bounded date ranges", async () => {
    const requests: string[] = [];
    const adapter = new NpmPackageStatsAdapter(
      async (url, init) => {
        requests.push(url);
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        if (url.startsWith("https://registry.npmjs.org/")) {
          return response({
            "dist-tags": { latest: "1.0.0" },
            time: { created: "2014-01-01T00:00:00.000Z" },
          });
        }
        const period = url.split("/").at(-2) ?? "";
        if (period.startsWith("2015-01-10:")) return response({ downloads: 100 });
        if (period.startsWith("2016-07-03:")) return response({ downloads: 200 });
        if (period.startsWith("2017-12-25:")) return response({ downloads: 300 });
        return response({ downloads: 1 });
      },
      () => new Date("2018-01-01T12:00:00.000Z")
    );

    const result = await adapter.collect(["historical"]);

    expect(requests).toContain(
      "https://api.npmjs.org/downloads/point/2015-01-10:2016-07-02/historical"
    );
    expect(requests).toContain(
      "https://api.npmjs.org/downloads/point/2016-07-03:2017-12-24/historical"
    );
    expect(requests).toContain(
      "https://api.npmjs.org/downloads/point/2017-12-25:2017-12-31/historical"
    );
    expect(result.packages[0].downloads.allTime).toBe(600);
  });
});

describe("NpmPackageStatsAdapter retries", () => {
  const noSleep = async () => {};

  it("retries rate-limited requests until they succeed", async () => {
    let callCount = 0;
    const delays: number[] = [];
    const adapter = new NpmPackageStatsAdapter(
      async (url) => {
        callCount += 1;
        if (callCount <= 2) {
          // npm's CDN answers 429s with "Retry-After: 0", which must not
          // flatten the backoff delay.
          return {
            ...response({}, 429),
            headers: { get: () => "0" },
          };
        }
        if (url.startsWith("https://registry.npmjs.org/")) {
          return response({
            "dist-tags": { latest: "1.0.0" },
            time: { created: "2026-01-01T00:00:00.000Z" },
          });
        }
        return response({ downloads: 5 });
      },
      () => new Date("2026-08-14T12:00:00.000Z"),
      async (ms) => {
        delays.push(ms);
      },
      0
    );

    const result = await adapter.collect(["limited"]);

    expect(result.warnings).toEqual([]);
    expect(result.packages).toHaveLength(1);
    expect(delays.length).toBeGreaterThanOrEqual(2);
    expect(delays.every((delay) => delay >= 1_000)).toBe(true);
  });

  it("bounds attempts and warns when rate limiting persists", async () => {
    let callCount = 0;
    const adapter = new NpmPackageStatsAdapter(
      async () => {
        callCount += 1;
        return response({}, 429);
      },
      () => new Date("2026-08-14T12:00:00.000Z"),
      noSleep
    );

    const result = await adapter.collect(["always-limited"]);

    expect(callCount).toBe(6);
    expect(result.packages).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("HTTP 429");
  });

  it("does not retry permanent client errors", async () => {
    let callCount = 0;
    const adapter = new NpmPackageStatsAdapter(
      async () => {
        callCount += 1;
        return response({}, 404);
      },
      () => new Date("2026-08-14T12:00:00.000Z"),
      noSleep
    );

    const result = await adapter.collect(["missing"]);

    expect(callCount).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("HTTP 404");
  });
});

describe("collectPackageStats", () => {
  it("deduplicates package names and aggregates normalized providers", async () => {
    const requested: string[][] = [];
    const result = await collectPackageStats(
      [
        { provider: "npm", packages: ["one", "one", "two"] },
        { provider: "npm", packages: ["two", "three"] },
        { provider: "pypi", packages: ["future"] },
      ],
      [
        {
          provider: "npm",
          async collect(packageNames) {
            requested.push(packageNames);
            return {
              warnings: [],
              packages: packageNames.map((name, index) => ({
                provider: "npm",
                name,
                url: `https://example.com/${name}`,
                latestVersion: "1.0.0",
                latestPublishedAt: null,
                downloads: {
                  lastDay: index + 1,
                  lastWeek: 10,
                  lastMonth: (index + 1) * 100,
                  lastYear: 1_000,
                  allTime: 2_000,
                },
              })),
            };
          },
        },
      ]
    );

    expect(requested).toEqual([["one", "two", "three"]]);
    expect(result.packageCount).toBe(3);
    expect(result.providers).toEqual(["npm"]);
    expect(result.downloads).toEqual({
      lastDay: 6,
      lastWeek: 30,
      lastMonth: 600,
      lastYear: 3_000,
      allTime: 6_000,
    });
    expect(result.packages.map((item) => item.name)).toEqual([
      "three",
      "two",
      "one",
    ]);
    expect(result.complete).toBe(false);
    expect(result.warnings).toEqual([
      'No package stats adapter registered for "pypi"',
    ]);
  });
});

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}
