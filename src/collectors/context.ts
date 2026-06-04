import type { DifflerConfig } from "../config.js";
import { StatsCache } from "./cache.js";

export class CollectorContext {
  config: DifflerConfig;
  results: Record<string, unknown> = {};
  cache: StatsCache;
  rateLimitRemaining = 5000;
  rateLimitReset = 0;

  constructor(config: DifflerConfig, cache?: StatsCache) {
    this.config = config;
    this.cache = cache ?? new StatsCache();
  }

  get(key: string, defaultValue?: unknown): unknown {
    return this.results[key] ?? defaultValue;
  }

  set(key: string, value: unknown): void {
    this.results[key] = value;
  }
}
