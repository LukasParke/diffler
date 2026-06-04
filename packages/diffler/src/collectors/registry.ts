import type { Collector } from "./types.js";
import type { CollectorContext } from "./context.js";

// Regexes to find Jinja2/Nunjucks variable references and function calls
const VAR_REF = /\{\{[\s\-]*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
const FUNC_CALL = /\{\{[\s\-]*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
// Also scan {% ... %} tags for variable references
const TAG_VAR_REF =
  /\{%[\+\s\-]*(?:for\s+\w+\s+in|if|elif|set\s+\w+\s*=)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

export class CollectorRegistry {
  private collectors = new Map<string, Collector>();

  register(collector: Collector): void {
    this.collectors.set(collector.name, collector);
  }

  discoverNeeded(templateSource: string): string[] {
    const refs = new Set<string>();

    let m: RegExpExecArray | null;

    VAR_REF.lastIndex = 0;
    while ((m = VAR_REF.exec(templateSource)) !== null) {
      refs.add(m[1]);
    }

    FUNC_CALL.lastIndex = 0;
    while ((m = FUNC_CALL.exec(templateSource)) !== null) {
      refs.add(m[1]);
    }

    TAG_VAR_REF.lastIndex = 0;
    while ((m = TAG_VAR_REF.exec(templateSource)) !== null) {
      refs.add(m[1]);
    }

    const needed = new Set<string>();
    for (const collector of this.collectors.values()) {
      for (const ref of collector.templateRefs) {
        if (refs.has(ref)) {
          needed.add(collector.name);
        }
      }
    }

    // Resolve dependencies
    const resolved: string[] = [];
    const seen = new Set<string>();

    const resolve = (name: string): void => {
      if (seen.has(name) || !this.collectors.has(name)) return;
      const collector = this.collectors.get(name)!;
      for (const dep of collector.dependencies) {
        resolve(dep);
      }
      seen.add(name);
      resolved.push(name);
    };

    for (const name of needed) {
      resolve(name);
    }

    return resolved;
  }

  async run(names: string[], ctx: CollectorContext): Promise<Record<string, string>> {
    const status: Record<string, string> = {};

    for (const name of names) {
      const collector = this.collectors.get(name);
      if (!collector) continue;

      if (collector.optional && ctx.rateLimitRemaining < 500) {
        console.warn(`Skipping optional collector ${name} (rate limit: ${ctx.rateLimitRemaining})`);
        status[name] = "skipped";
        continue;
      }

      try {
        const value = await collector.collect(ctx);
        ctx.set(name, value);
        status[name] = "success";
      } catch (err) {
        console.error(`Collector ${name} failed:`, err);
        status[name] = "failed";
        if (!collector.optional) {
          throw err;
        }
      }
    }

    return status;
  }
}
