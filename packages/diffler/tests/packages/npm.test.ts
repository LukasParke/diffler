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
});

describe("collectPackageStats", () => {
  it("deduplicates package names and aggregates normalized providers", async () => {
    const requested: string[][] = [];
    const result = await collectPackageStats(
      [
        { provider: "npm", packages: ["one", "one", "two"] },
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

    expect(requested).toEqual([["one", "two"]]);
    expect(result.packageCount).toBe(2);
    expect(result.providers).toEqual(["npm"]);
    expect(result.downloads).toEqual({
      lastDay: 3,
      lastWeek: 20,
      lastMonth: 300,
      lastYear: 2_000,
      allTime: 4_000,
    });
    expect(result.packages.map((item) => item.name)).toEqual(["two", "one"]);
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
