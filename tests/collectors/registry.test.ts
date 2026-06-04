import { describe, it, expect } from "vitest";
import { CollectorRegistry } from "../../src/collectors/registry.js";
import { CollectorContext } from "../../src/collectors/context.js";
import type { Collector } from "../../src/collectors/types.js";

function makeCollector(
  name: string,
  templateRefs: string[],
  deps: string[] = [],
  optional = false
): Collector {
  return {
    name,
    templateRefs: new Set(templateRefs),
    dependencies: new Set(deps),
    optional,
    collect: () => ({ name }),
  };
}

describe("CollectorRegistry", () => {
  describe("discoverNeeded", () => {
    it("finds collectors referenced by variable", () => {
      const registry = new CollectorRegistry();
      registry.register(makeCollector("profile", ["profile", "github"]));
      registry.register(makeCollector("contributions", ["contributions"]));

      const needed = registry.discoverNeeded("{{ profile.name }}");
      expect(needed).toEqual(["profile"]);
    });

    it("finds collectors referenced by function call", () => {
      const registry = new CollectorRegistry();
      registry.register(makeCollector("filter_repos", ["filter_repos"]));

      const needed = registry.discoverNeeded("{{ filter_repos(repositories) }}");
      expect(needed).toContain("filter_repos");
    });

    it("finds collectors referenced in for loops", () => {
      const registry = new CollectorRegistry();
      registry.register(makeCollector("repos", ["repositories"]));

      const needed = registry.discoverNeeded("{% for repo in repositories %}{{ repo }}{% endfor %}");
      expect(needed).toContain("repos");
    });

    it("resolves dependencies", () => {
      const registry = new CollectorRegistry();
      registry.register(makeCollector("base", ["base"]));
      registry.register(makeCollector("derived", ["derived"], ["base"]));

      const needed = registry.discoverNeeded("{{ derived }}");
      expect(needed).toEqual(["base", "derived"]);
    });

    it("returns empty when nothing matches", () => {
      const registry = new CollectorRegistry();
      registry.register(makeCollector("profile", ["profile"]));

      const needed = registry.discoverNeeded("{{ unrelated }}");
      expect(needed).toEqual([]);
    });
  });

  describe("run", () => {
    it("executes collectors and stores results", async () => {
      const registry = new CollectorRegistry();
      const collector = makeCollector("profile", ["profile"]);
      registry.register(collector);

      const ctx = new CollectorContext({
        version: "1",
        github: {
          username: null,
          usernames: [],
          token: "",
          profiles: [],
          apiUrl: "",
          graphqlUrl: "",
          includeOrgs: false,
          largeRepoMode: false,
        },
        templates: { main: "", directory: "", builtins: true },
        cache: { enabled: false, ttl: 0, directory: null },
        helpers: {},
        plugins: [],
      });

      const statuses = await registry.run(["profile"], ctx);
      expect(statuses.profile).toBe("success");
      expect(ctx.get("profile")).toEqual({ name: "profile" });
    });

    it("skips optional collectors when rate limit is low", async () => {
      const registry = new CollectorRegistry();
      registry.register(makeCollector("optional", ["opt"], [], true));

      const ctx = new CollectorContext({
        version: "1",
        github: {
          username: null,
          usernames: [],
          token: "",
          profiles: [],
          apiUrl: "",
          graphqlUrl: "",
          includeOrgs: false,
          largeRepoMode: false,
        },
        templates: { main: "", directory: "", builtins: true },
        cache: { enabled: false, ttl: 0, directory: null },
        helpers: {},
        plugins: [],
      });
      ctx.rateLimitRemaining = 100;

      const statuses = await registry.run(["optional"], ctx);
      expect(statuses.optional).toBe("skipped");
    });
  });
});
