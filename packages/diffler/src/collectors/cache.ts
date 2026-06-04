import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

interface CacheEntry {
  value: unknown;
  timestamp: number;
}

export class StatsCache {
  private stablePath: string | null;
  private volatile: Map<string, CacheEntry>;
  private stable: Map<string, CacheEntry>;

  constructor(stablePath?: string) {
    this.stablePath = stablePath ?? null;
    this.volatile = new Map();
    this.stable = new Map();

    if (this.stablePath && existsSync(this.stablePath)) {
      try {
        const raw = readFileSync(this.stablePath, "utf-8");
        const data = JSON.parse(raw) as Record<string, CacheEntry>;
        for (const [k, v] of Object.entries(data)) {
          this.stable.set(k, v);
        }
      } catch {
        // Ignore corrupt cache files
      }
    }
  }

  get(key: string): unknown | undefined {
    // Check volatile first
    const v = this.volatile.get(key);
    if (v) return v.value;

    // Then stable
    const s = this.stable.get(key);
    if (s) return s.value;

    return undefined;
  }

  set(key: string, value: unknown): void {
    this.volatile.set(key, { value, timestamp: Date.now() });
  }

  setStable(key: string, value: unknown): void {
    this.stable.set(key, { value, timestamp: Date.now() });
  }

  save(): void {
    if (!this.stablePath) return;
    try {
      const dir = dirname(this.stablePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.stable);
      writeFileSync(this.stablePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Ignore write errors
    }
  }
}
