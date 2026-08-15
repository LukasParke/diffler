import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfigFromFile,
  loadConfigFromEnv,
  buildStatsActionConfig,
  getUsernames,
  getProfiles,
  type GitHubConfig,
  type DifflerConfig,
} from "../src/config.js";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("default config", () => {
    it("has sensible defaults", () => {
      const config = loadConfigFromEnv();
      expect(config.version).toBe("1");
      expect(config.github.apiUrl).toBe("https://api.github.com");
      expect(config.templates.main).toBe("profile.md.j2");
      expect(config.cache.enabled).toBe(true);
      expect(config.statsAction.includePrivateRepositoryMetrics).toBe(false);
    });
  });

  describe("loadConfigFromFile", () => {
    it("reads a yaml config file", () => {
      const dir = mkdtempSync(join(tmpdir(), "diffler-"));
      const path = join(dir, "diffler.yml");
      writeFileSync(
        path,
        'version: "1"\n' +
          "github:\n" +
          '  username: "testuser"\n' +
          "templates:\n" +
          '  main: "custom.md.j2"\n',
        "utf-8"
      );

      const config = loadConfigFromFile(path);
      expect(config.github.username).toBe("testuser");
      expect(config.templates.main).toBe("custom.md.j2");
    });
  });

  describe("env var resolution", () => {
    it("resolves ${GITHUB_TOKEN} from environment", () => {
      process.env.GITHUB_TOKEN = "ghp_secret";
      const config = loadConfigFromEnv();
      expect(config.github.token).toBe("ghp_secret");
    });
  });

  describe("profiles", () => {
    it("profiles override usernames", () => {
      process.env.GH_PERSONAL = "token_personal";
      process.env.GH_WORK = "token_work";

      const dir = mkdtempSync(join(tmpdir(), "diffler-"));
      const path = join(dir, "diffler.yml");
      writeFileSync(
        path,
        'version: "1"\n' +
          "github:\n" +
          "  profiles:\n" +
          '    - username: "personal"\n' +
          '      token: "${GH_PERSONAL}"\n' +
          '    - username: "work"\n' +
          '      token: "${GH_WORK}"\n',
        "utf-8"
      );

      const config = loadConfigFromFile(path);
      const profiles = getProfiles(config.github);
      expect(profiles).toHaveLength(2);
      expect(profiles[0].username).toBe("personal");
      expect(profiles[0].token).toBe("token_personal");
      expect(profiles[1].username).toBe("work");
      expect(profiles[1].token).toBe("token_work");
    });

    it("getProfiles falls back to usernames with global token", () => {
      const github: GitHubConfig = {
        username: null,
        usernames: ["alice", "bob"],
        token: "global_token",
        profiles: [],
        apiUrl: "https://api.github.com",
        graphqlUrl: "https://api.github.com/graphql",
        includeOrgs: false,
        largeRepoMode: false,
      };
      const profiles = getProfiles(github);
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toEqual({ username: "alice", token: "global_token" });
      expect(profiles[1]).toEqual({ username: "bob", token: "global_token" });
    });

    it("getProfiles falls back to single username", () => {
      const github: GitHubConfig = {
        username: "alice",
        usernames: [],
        token: "global_token",
        profiles: [],
        apiUrl: "https://api.github.com",
        graphqlUrl: "https://api.github.com/graphql",
        includeOrgs: false,
        largeRepoMode: false,
      };
      const profiles = getProfiles(github);
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toEqual({ username: "alice", token: "global_token" });
    });

    it("getProfiles returns empty when nothing configured", () => {
      const github: GitHubConfig = {
        username: null,
        usernames: [],
        token: "${GITHUB_TOKEN}",
        profiles: [],
        apiUrl: "https://api.github.com",
        graphqlUrl: "https://api.github.com/graphql",
        includeOrgs: false,
        largeRepoMode: false,
      };
      expect(getProfiles(github)).toEqual([]);
      expect(getUsernames(github)).toEqual([]);
    });
  });

  describe("loadConfigFromEnv overrides", () => {
    it("uses DIFFLER_GITHUB_USERNAME", () => {
      process.env.DIFFLER_GITHUB_USERNAME = "envuser";
      const config = loadConfigFromEnv();
      expect(config.github.username).toBe("envuser");
    });

    it("uses GITHUB_TOKEN", () => {
      process.env.GITHUB_TOKEN = "envtoken";
      const config = loadConfigFromEnv();
      expect(config.github.token).toBe("envtoken");
    });

    it("uses DIFFLER_TEMPLATE_MAIN", () => {
      process.env.DIFFLER_TEMPLATE_MAIN = "other.md.j2";
      const config = loadConfigFromEnv();
      expect(config.templates.main).toBe("other.md.j2");
    });

    it("enables anonymous private repository metrics", () => {
      process.env.STATS_INCLUDE_PRIVATE_REPOSITORY_METRICS = "true";
      const config = buildStatsActionConfig(loadConfigFromEnv());
      expect(config.includePrivateRepositoryMetrics).toBe(true);
      expect(config.includePrivateRepositoryDetails).toBe(false);
      expect(config.includePrivateCacheDetails).toBe(false);
    });
  });
});
