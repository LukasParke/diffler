#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { loadConfig, getProfiles, buildStatsActionConfig } from "./config.js";
import { GitHubClient } from "./github/client.js";
import { Engine } from "./core/engine.js";
import { Renderer } from "./core/renderer.js";
import { remotionSceneManifest } from "./helpers/remotion.js";
import { runStatsCollection } from "./stats/index.js";

const program = new Command();

program
  .name("diffler")
  .description("A powerful engine for generating GitHub profile READMEs")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold a new Diffler project")
  .option("-d, --dir <directory>", "Template directory", ".github/diffler")
  .option("-c, --config <path>", "Config file path", ".github/diffler.yml")
  .action((options) => {
    const dir = resolve(options.dir);
    mkdirSync(dir, { recursive: true });

    const configPath = resolve(options.config);
    mkdirSync(resolve(configPath, ".."), { recursive: true });

    if (!existsSync(configPath)) {
      writeFileSync(
        configPath,
        'version: "1"\n\n' +
          "github:\n" +
          '  username: "your-username"\n' +
          '  token: "${GITHUB_TOKEN}"\n' +
          "  # For multi-profile aggregation with separate tokens:\n" +
          "  # profiles:\n" +
          "  #   - username: \"personal\"\n" +
          "  #     token: \"${GITHUB_TOKEN_PERSONAL}\"\n" +
          "  #   - username: \"work\"\n" +
          "  #     token: \"${GITHUB_TOKEN_WORK}\"\n\n" +
          "templates:\n" +
          '  main: "profile.md.j2"\n' +
          '  directory: ".github/diffler"\n\n' +
          "cache:\n" +
          "  enabled: true\n" +
          "  ttl: 3600\n",
        "utf-8"
      );
      console.log(`Created ${configPath}`);
    } else {
      console.log(`Skipped ${configPath} (already exists)`);
    }

    const mainTemplate = resolve(dir, "profile.md.j2");
    if (!existsSync(mainTemplate)) {
      writeFileSync(
        mainTemplate,
        '<div align="center">\n\n' +
          "# Hi, I'm {{ github.user.name }} 👋\n\n" +
          '{% if github.user.bio %}\n' +
          "*{{ github.user.bio }}*\n" +
          "{% endif %}\n\n" +
          '## 📊 GitHub Stats\n\n' +
          '<div align="center">\n\n' +
          '{{ github_stats_card(github.user.login) }}\n\n' +
          '{{ top_langs(github.user.login) }}\n\n' +
          '</div>\n\n' +
          '## 🛠️ Tech Stack\n\n' +
          '{{ skill_icons(["python", "javascript", "docker", "git"]) }}\n\n' +
          '## 📂 All Projects\n\n' +
          '{% set all_repos = filter_repos(github.user.repositories, exclude_forks=true, exclude_archived=true, sort_by="stars", limit=20) -%}\n' +
          '{% for repo in all_repos -%}\n' +
          '- [{{ repo.name }}]({{ repo.url }}){% if repo.description %} - {{ repo.description }}{% endif %}\n' +
          '{% endfor %}\n\n' +
          '## 📫 Connect\n\n' +
          "Feel free to reach out!\n",
        "utf-8"
      );
      console.log(`Created ${mainTemplate}`);
    } else {
      console.log(`Skipped ${mainTemplate} (already exists)`);
    }

    console.log("Diffler project initialized! Run `diffler render` to preview.");
  });

program
  .command("collect")
  .description("Collect GitHub stats and write JSON output (stats-action mode)")
  .option("-c, --config <path>", "Config file path")
  .option("--output-path <path>", "Path for the generated stats JSON")
  .option("--cache-path <path>", "Path for committed stable cache state")
  .option("--volatile-cache-path <path>", "Path for volatile API metadata cache")
  .option("--backfill-mode <mode>", "Backfill mode: resume, refresh, or off")
  .option(
    "--include-private-metrics",
    "Include anonymous private repository metrics without repository details"
  )
  .option(
    "--npm-packages <packages>",
    "Comma-separated npm package names to include in package stats"
  )
  .option("--include-private", "Include private repository details")
  .action(async (options) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("GITHUB_TOKEN is required");
      process.exit(1);
    }

    const config = loadConfig(options.config);
    const statsConfig = buildStatsActionConfig(config);

    if (options.outputPath) statsConfig.outputPath = options.outputPath;
    if (options.cachePath) statsConfig.cachePath = options.cachePath;
    if (options.volatileCachePath) statsConfig.volatileCachePath = options.volatileCachePath;
    if (options.backfillMode) {
      if (["resume", "refresh", "off"].includes(options.backfillMode)) {
        statsConfig.backfillMode = options.backfillMode;
      }
    }
    if (options.includePrivateMetrics) {
      statsConfig.includePrivateRepositoryMetrics = true;
    }
    if (options.includePrivate) {
      statsConfig.includePrivateRepositoryMetrics = true;
      statsConfig.includePrivateRepositoryDetails = true;
      statsConfig.includePrivateCacheDetails = true;
    }
    const npmPackages = options.npmPackages
      ?.split(",")
      .map((packageName: string) => packageName.trim())
      .filter(Boolean);
    if (npmPackages?.length) {
      statsConfig.packageSources = [
        ...statsConfig.packageSources.filter((source) => source.provider !== "npm"),
        {
          provider: "npm",
          packages: npmPackages,
        },
      ];
    }

    const client = new GitHubClient(config.github);
    await runStatsCollection(statsConfig, client);
  });

program
  .command("render")
  .description("Render the profile README")
  .option("-c, --config <path>", "Config file path")
  .option("-o, --output <path>", "Output file (default: stdout)")
  .action(async (options) => {
    const config = loadConfig(options.config);
    const renderer = new Renderer(config);
    const engine = new Engine(config, renderer);
    const result = await engine.render();

    if (options.output) {
      writeFileSync(options.output, result, "utf-8");
      console.log(`Rendered to ${options.output}`);
    } else {
      console.log(result);
    }
  });

program
  .command("validate")
  .description("Validate configuration and templates")
  .option("-c, --config <path>", "Config file path")
  .action(async (options) => {
    const config = loadConfig(options.config);
    const renderer = new Renderer(config);
    const engine = new Engine(config, renderer);
    await engine.validate();
    console.log("Validation passed!");
  });

program
  .command("update")
  .description("Render and commit the updated profile README")
  .option("-c, --config <path>", "Config file path")
  .option("-n, --dry-run", "Render without committing", false)
  .option("-m, --message <msg>", "Commit message", "🤖 Auto-update profile README")
  .action(async (options) => {
    const config = loadConfig(options.config);
    const renderer = new Renderer(config);
    const engine = new Engine(config, renderer);
    await engine.update({ dryRun: options.dryRun, message: options.message });
    if (options.dryRun) {
      console.log("Dry run complete. No changes committed.");
    } else {
      console.log("Profile README updated successfully!");
    }
  });

program
  .command("cache-clear")
  .description("Clear the local API response cache")
  .action(() => {
    const paths = [
      ".diffler/cache-stable.json",
      ".diffler/cache-volatile.json",
      ".diffler/backfill.json",
      ".diffler/stats.json",
    ];
    let removed = 0;
    for (const path of paths) {
      if (existsSync(path)) {
        unlinkSync(path);
        removed++;
        console.log(`Removed ${path}`);
      }
    }
    if (removed === 0) {
      console.log("No cache files found.");
    } else {
      console.log(`Cache cleared (${removed} files).`);
    }
  });

program
  .command("export-remotion")
  .description(
    "Generate a Remotion input.json with inline stats (optionally a scene manifest)"
  )
  .option("-c, --config <path>", "Config file path")
  .option("-o, --output <path>", "Output path", "remotion-input.json")
  .option("--scenes <path>", "Also write a scene manifest to this path")
  .option("--allow-private", "Include private repository details", false)
  .action(async (options) => {
    const config = loadConfig(options.config);
    const renderer = new Renderer(config);
    const engine = new Engine(config, renderer);
    const templateSource = renderer.readTemplateSource();
    const context = await engine.contextBuilder.build(templateSource);
    const stats = (context.stats as Record<string, unknown>) || {};
    const username = (stats.username as string) || config.github.username || "unknown";

    const profiles = getProfiles(config.github);
    const output: Record<string, unknown> = {
      username,
      stats,
      allowPrivateRepositoryDetails: options.allowPrivate,
    };

    if (profiles.length > 1) {
      output.usernames = profiles.map((p) => p.username);
    }

    writeFileSync(options.output, JSON.stringify(output, null, 2), "utf-8");
    console.log(`Remotion input written to ${options.output}`);

    if (options.scenes) {
      const manifest = remotionSceneManifest(stats);
      writeFileSync(options.scenes, JSON.stringify(manifest, null, 2), "utf-8");
      console.log(`Remotion scene manifest written to ${options.scenes}`);
    }
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
