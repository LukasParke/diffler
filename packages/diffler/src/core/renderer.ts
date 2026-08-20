import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Environment, FileSystemLoader } from "nunjucks";
import type { DifflerConfig } from "../config.js";
import { registerAllHelpers } from "../helpers/register.js";
import type { SourceStore } from "../helpers/prefetch.js";

// npm layout resolves dist/index.js -> <pkg>/templates/builtins; the bundled
// action layout resolves dist-action/index.js -> <pkg>/templates/builtins.
function resolveBuiltinTemplates(): string {
  const here = import.meta.dirname || "";
  const candidates = [
    resolve(here, "../../templates/builtins"),
    resolve(here, "../templates/builtins"),
  ];
  for (const candidate of candidates) {
    try {
      readdirSync(candidate);
      return candidate;
    } catch {
      // Try the next layout
    }
  }
  return candidates[0];
}

const BUILTIN_TEMPLATES = resolveBuiltinTemplates();

export class Renderer {
  private config: DifflerConfig;
  private env: Environment;

  constructor(config: DifflerConfig) {
    this.config = config;
    this.env = this.buildEnvironment();
    registerAllHelpers(this.env);
  }

  private buildEnvironment(): Environment {
    const paths: string[] = [];
    const userDir = resolve(this.config.templates.directory);
    try {
      readdirSync(userDir);
      paths.push(userDir);
    } catch {
      // Directory doesn't exist
    }

    if (this.config.templates.builtins) {
      paths.push(BUILTIN_TEMPLATES);
    }

    if (paths.length === 0) {
      throw new Error(`No template directories found. Expected ${userDir}`);
    }

    return new Environment(new FileSystemLoader(paths), {
      autoescape: false,
      trimBlocks: false,
      lstripBlocks: false,
    });
  }

  readTemplateSource(): string {
    // Try to read from filesystem directly
    const paths = [
      resolve(this.config.templates.directory, this.config.templates.main),
      resolve(BUILTIN_TEMPLATES, this.config.templates.main),
    ];
    for (const path of paths) {
      try {
        return readFileSync(path, "utf-8");
      } catch {
        // try next
      }
    }
    return "";
  }

  render(context: Record<string, unknown>, sources?: SourceStore): string {
    if (sources) registerAllHelpers(this.env, sources);
    const template = this.env.getTemplate(this.config.templates.main);
    return template.render(context);
  }

  validate(
    context?: Record<string, unknown>,
    sources?: SourceStore
  ): void {
    if (sources) registerAllHelpers(this.env, sources);
    const template = this.env.getTemplate(this.config.templates.main);
    if (context) {
      template.render(context);
    }
  }
}
