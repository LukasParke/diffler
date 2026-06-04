import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StatsCache } from "../../src/collectors/cache.js";

describe("StatsCache", () => {
  it("stores and retrieves volatile values", () => {
    const cache = new StatsCache();
    cache.set("key1", { data: "hello" });
    expect(cache.get("key1")).toEqual({ data: "hello" });
  });

  it("stores and retrieves stable values", () => {
    const cache = new StatsCache();
    cache.setStable("key1", { data: "stable" });
    expect(cache.get("key1")).toEqual({ data: "stable" });
  });

  it("volatile overrides stable", () => {
    const cache = new StatsCache();
    cache.setStable("key1", { data: "stable" });
    cache.set("key1", { data: "volatile" });
    expect(cache.get("key1")).toEqual({ data: "volatile" });
  });

  it("returns undefined for missing keys", () => {
    const cache = new StatsCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("persists stable cache to disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "diffler-cache-"));
    const path = join(dir, "cache.json");

    const cache = new StatsCache(path);
    cache.setStable("profile", { login: "test" });
    cache.save();

    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    expect(data.profile.value).toEqual({ login: "test" });
  });

  it("loads stable cache from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "diffler-cache-"));
    const path = join(dir, "cache.json");

    writeFileSync(
      path,
      JSON.stringify({ repos: { value: [{ name: "repo1" }], timestamp: Date.now() } }),
      "utf-8"
    );

    const cache = new StatsCache(path);
    expect(cache.get("repos")).toEqual([{ name: "repo1" }]);
  });
});
