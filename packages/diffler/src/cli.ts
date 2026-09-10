#!/usr/bin/env node
import { writeFileSync, readFileSync, mkdirSync, existsSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command, CommanderError, InvalidArgumentError, Option, type OutputConfiguration } from "commander";
import { stringify as stringifyYaml } from "yaml";
import { githubUsernameSchema } from "@lukasparke/diffler-schemas";
import {
  loadConfig,
  loadConfigFromEnv,
  getProfiles,
  buildStatsActionConfig,
  withStatsActionOverrides,
  ProfileAssetsConfigSchema,
  StatsActionConfigSchema,
  type DifflerConfig,
  type StatsActionConfig,
} from "./config.js";
import { Engine } from "./core/engine.js";
import { Renderer } from "./core/renderer.js";
import { analyzeTemplate, collectProfiles } from "./engine/index.js";
import { buildProfileStatsConfig, profileExtrasDirectory } from "./engine/paths.js";
import { remotionInput, remotionSceneManifest } from "./helpers/remotion.js";

interface ConfigOptions {
  config?: string;
}

interface CollectOptions extends ConfigOptions {
  outputPath?: string;
  cachePath?: string;
  volatileCachePath?: string;
  backfillMode?: StatsActionConfig["backfillMode"];
  includePrivate?: boolean;
  includePrivateMetrics?: boolean;
  npmPackages?: string;
}

interface ExportOptions extends ConfigOptions {
  output?: string;
  target?: string;
  allowPrivate: boolean;
  scenes?: string;
}

function parsePath(value: string): string {
  if (!value.trim() || value.includes("\0")) throw new InvalidArgumentError("Expected a non-empty path without null bytes");
  return value;
}

function configOption(): Option {
  return new Option("-c, --config <path>", "Config file path").argParser(parsePath);
}

function outputOption(defaultPath?: string): Option {
  const option = new Option("-o, --output <path>", "Output path").argParser(parsePath);
  return defaultPath ? option.default(defaultPath) : option;
}

function writeOutput(path: string, content: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function errorMessage(error: unknown, config?: DifflerConfig): string {
  let message = error instanceof Error ? error.message : "Diffler command failed";
  const secrets = [
    config?.github.token,
    ...(config ? getProfiles(config.github).map((profile) => profile.token) : []),
    ...Object.entries(process.env)
      .filter(([name]) => /(?:TOKEN|SECRET|PASSWORD|API_KEY)/i.test(name))
      .map(([, value]) => value),
  ];
  const credentials = secrets.filter((secret): secret is string =>
    typeof secret === "string" && secret.length > 0 && !secret.startsWith("${"));
  for (const secret of credentials.sort((a, b) => b.length - a.length)) {
    message = message.replaceAll(secret, "[REDACTED]");
  }
  return message.replace(/(https?:\/\/)[^\s/@]+@/gi, "$1[REDACTED]@");
}

async function usingConfig<T>(options: ConfigOptions, action: (config: DifflerConfig) => Promise<T>): Promise<T> {
  let config: DifflerConfig | undefined;
  try {
    config = loadConfig(options.config);
    return await action(withStatsActionOverrides(config, {}));
  } catch (error) {
    throw new Error(errorMessage(error, config));
  }
}

function requireCollectionCredentials(config: DifflerConfig): void {
  const profiles = getProfiles(config.github);
  if (profiles.length === 0) {
    throw new Error("Configure a GitHub username or profiles, or set DIFFLER_GITHUB_USERNAME");
  }
  for (const profile of profiles) {
    if (!profile.token.trim() || /^\$\{[^}]+\}$/.test(profile.token)) {
      throw new Error(
        `A GitHub token is required for profile ${profile.username}. Configure github.token, a profile token, or its environment variable.`
      );
    }
  }
}

async function collect(config: DifflerConfig) {
  requireCollectionCredentials(config);
  return collectProfiles(analyzeTemplate("{{ stats }}"), config);
}

async function exportRemotion(options: ExportOptions): Promise<void> {
  await usingConfig(options, async (config) => {
    const { output } = await collect(withStatsActionOverrides(config, {
      includePrivateRepositoryDetails: options.allowPrivate,
    }));
    const input = remotionInput(output, {
      allowPrivateRepositoryDetails: options.allowPrivate,
    });
    const path = options.output ?? options.target ?? "remotion-input.json";
    writeOutput(path, JSON.stringify(input, null, 2));
    console.log(`Remotion input written to ${path}`);
    if (options.scenes) {
      writeOutput(options.scenes, JSON.stringify(remotionSceneManifest(output), null, 2));
      console.log(`Remotion card metadata written to ${options.scenes}`);
    }
  });
}

export function createProgram(output: OutputConfiguration = {}): Command {
  const program = new Command();
  program
    .name("diffler")
    .description("Collect GitHub stats and generate profile READMEs and renderer inputs")
    .version("0.1.0")
    .configureOutput({
      ...output,
      outputError: (message, write) => write(errorMessage(new Error(message))),
    })
    .exitOverride();

  program
    .command("init")
    .description("Scaffold a new Diffler project")
    .option("-d, --dir <directory>", "Template directory (default: configured directory or .github/diffler)", parsePath)
    .addOption(configOption().default(".github/diffler.yml"))
    .addOption(new Option("--username <username>", "GitHub identity (default: configuration or environment)")
      .argParser((value: string) => {
        const result = githubUsernameSchema.safeParse(value);
        if (!result.success) throw new InvalidArgumentError("Expected a GitHub username");
        return result.data;
      }))
    .addOption(new Option("--asset-base-url <url>", "Public asset URL or README-relative directory (default: ./assets)")
      .argParser((value: string) => {
        const result = ProfileAssetsConfigSchema.shape.baseUrl.safeParse(value);
        if (!result.success) throw new InvalidArgumentError("Expected a public HTTP(S) URL or an asset directory");
        return result.data;
      }))
    .action((options: ConfigOptions & { dir?: string; username?: string; assetBaseUrl?: string }) => {
      const configPath = resolve(options.config ?? ".github/diffler.yml");
      const existing = existsSync(configPath) ? loadConfig(configPath) : undefined;
      const config = existing ?? loadConfigFromEnv();
      const dir = resolve(options.dir ?? config.templates.directory);
      const username = options.username ?? getProfiles(config.github)[0]?.username;
      const templateName = existing?.templates.main ?? "profile.md.j2";

      if (!existing) {
        const assets = ProfileAssetsConfigSchema.parse({
          ...config.assets,
          ...(options.assetBaseUrl ? { baseUrl: options.assetBaseUrl } : {}),
        });
        writeOutput(configPath, stringifyYaml({
          version: "1",
          github: {
            username: username ?? "${DIFFLER_GITHUB_USERNAME}",
            token: "${GITHUB_TOKEN}",
          },
          templates: { main: templateName, directory: relative(process.cwd(), dir) || "." },
          assets,
          cache: { enabled: true, ttl: 3600 },
        }));
        console.log(`Created ${configPath}`);
      } else {
        console.log(`Skipped ${configPath} (already exists)`);
        if (options.dir && resolve(existing.templates.directory) !== dir) {
          console.log("Existing config was not changed; update templates.directory to use the requested directory.");
        }
      }

      const mainTemplate = resolve(dir, templateName);
      if (!existsSync(mainTemplate)) {
        const template = readFileSync(new URL("../templates/builtins/default.md.j2", import.meta.url), "utf-8");
        writeOutput(mainTemplate, template);
        console.log(`Created ${mainTemplate}`);
      } else {
        console.log(`Skipped ${mainTemplate} (already exists)`);
      }
      if (!username) console.log("Set DIFFLER_GITHUB_USERNAME or github.username before collecting.");
      console.log("Diffler project initialized. Configure credentials and assets.baseUrl.");
      console.log(`Render with diffler render --config ${JSON.stringify(configPath)}.`);
    });

  program
    .command("collect")
    .description("Collect configured GitHub profiles and persist their aggregate stats JSON")
    .addOption(configOption())
    .option("--output-path <path>", "Path for the generated aggregate stats JSON", parsePath)
    .option("--cache-path <path>", "Path for committed stable cache state", parsePath)
    .option("--volatile-cache-path <path>", "Path for volatile API metadata cache", parsePath)
    .addOption(new Option("--backfill-mode <mode>", "Optional metric backfill mode")
      .choices(StatsActionConfigSchema.shape.backfillMode.removeDefault().options))
    .option("--include-private", "Include private repository and cache details")
    .option("--include-private-metrics", "Include anonymous private repository metrics without repository details")
    .option("--npm-packages <packages>", "Comma-separated npm package names to include in package stats")
    .action(async (options: CollectOptions) => {
      await usingConfig(options, async (config) => {
        const overrides: Partial<StatsActionConfig> = {};
        if (options.outputPath !== undefined) overrides.outputPath = options.outputPath;
        if (options.cachePath !== undefined) overrides.cachePath = options.cachePath;
        if (options.volatileCachePath !== undefined) overrides.volatileCachePath = options.volatileCachePath;
        if (options.backfillMode !== undefined) overrides.backfillMode = options.backfillMode;
        if (options.includePrivate) {
          overrides.includePrivateRepositoryMetrics = true;
          overrides.includePrivateRepositoryDetails = true;
          overrides.includePrivateCacheDetails = true;
        }
        if (options.includePrivateMetrics) overrides.includePrivateRepositoryMetrics = true;
        if (options.npmPackages !== undefined) {
          const packages = options.npmPackages.split(",").map((name) => name.trim()).filter(Boolean);
          if (packages.length === 0) throw new Error("--npm-packages requires at least one package name");
          overrides.packageSources = [
            ...config.statsAction.packageSources.filter((source) => source.provider !== "npm"),
            { provider: "npm", packages },
          ];
        }
        const configured = withStatsActionOverrides(config, overrides);
        await collect(configured);
        console.log(`Aggregate stats written to ${configured.statsAction.outputPath}`);
      });
    });

  program
    .command("render")
    .description("Render the profile README")
    .addOption(configOption())
    .addOption(new Option("-o, --output <path>", "Output file (default: stdout)").argParser(parsePath))
    .action(async (options: ConfigOptions & { output?: string }) => {
      await usingConfig(options, async (config) => {
        const engine = new Engine(config, new Renderer(config));
        const result = await engine.render();
        if (options.output) {
          writeOutput(options.output, result);
          console.log(`Rendered to ${options.output}`);
        } else {
          console.log(result);
        }
      });
    });

  program
    .command("validate")
    .description("Validate configuration and templates")
    .addOption(configOption())
    .action(async (options: ConfigOptions) => {
      await usingConfig(options, async (config) => {
        const engine = new Engine(config, new Renderer(config));
        await engine.validate();
        console.log("Validation passed!");
      });
    });

  program
    .command("update")
    .description("Render and commit the updated profile README")
    .addOption(configOption())
    .option("-n, --dry-run", "Render without committing", false)
    .option("-m, --message <msg>", "Commit message", "🤖 Auto-update profile README")
    .action(async (options: ConfigOptions & { dryRun: boolean; message: string }) => {
      await usingConfig(options, async (config) => {
        const engine = new Engine(config, new Renderer(config));
        await engine.update({ dryRun: options.dryRun, message: options.message });
        console.log(options.dryRun
          ? "Dry run complete. No changes committed."
          : "Profile README updated successfully!");
      });
    });

  program
    .command("cache-clear")
    .description("Clear configured account caches without deleting published stats")
    .addOption(configOption())
    .action(async (options: ConfigOptions) => {
      await usingConfig(options, async (config) => {
        const base = buildStatsActionConfig(config);
        const paths = new Set([base.cachePath, base.volatileCachePath, ".diffler/backfill.json"].map((path) => resolve(path)));
        const snapshots = new Set([resolve(base.outputPath)]);
        for (const profile of getProfiles(config.github)) {
          const scoped = buildProfileStatsConfig(analyzeTemplate("{{ stats }}"), config, profile);
          paths.add(scoped.cachePath);
          paths.add(scoped.volatileCachePath);
          snapshots.add(scoped.outputPath);
          const extras = profileExtrasDirectory(config, profile);
          paths.add(resolve(extras, "orgs.json"));
          paths.add(resolve(extras, "gists.json"));
        }
        if ([...paths].some((path) => snapshots.has(path))) {
          throw new Error("Cache paths must not overlap a published stats output path");
        }
        let removed = 0;
        for (const path of paths) {
          try {
            unlinkSync(path);
            removed++;
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
          }
        }
        console.log(removed === 0 ? "No cache files found." : `Cache cleared (${removed} files); published stats preserved.`);
      });
    });

  program
    .command("export-remotion")
    .description("Export inline renderer SourceProps from collected stats")
    .addOption(configOption())
    .addOption(outputOption("remotion-input.json"))
    .option("--scenes <path>", "Also write card metadata to this path", parsePath)
    .option("--allow-private", "Collect and export private repository details (explicit opt-in)", false)
    .action(exportRemotion);

  program
    .command("export-remotion-scenes")
    .description("Export card metadata (not renderer theme or composition overrides)")
    .addOption(configOption())
    .addOption(outputOption("remotion-scenes.json"))
    .action(async (options: ConfigOptions & { output: string }) => {
      await usingConfig(options, async (config) => {
        const { output } = await collect(withStatsActionOverrides(config, {
          includePrivateRepositoryDetails: false,
        }));
        writeOutput(options.output, JSON.stringify(remotionSceneManifest(output), null, 2));
        console.log(`Remotion card metadata written to ${options.output}`);
      });
    });

  program
    .command("export-remotion-input")
    .description("Compatibility wrapper for export-remotion; accepts the legacy --target option")
    .addOption(configOption())
    .addOption(outputOption())
    .addOption(new Option("-t, --target <path>", "Legacy output path")
      .argParser(parsePath)
      .default("../github-stats-remotion/input.json")
      .conflicts("output"))
    .option("--allow-private", "Collect and export private repository details (explicit opt-in)", false)
    .action(exportRemotion);

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  try {
    await createProgram().parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
      return;
    }
    console.error(`Error: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) &&
    pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  await runCli();
}
