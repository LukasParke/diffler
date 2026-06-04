import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { DifflerConfig } from "../config.js";
import { commitAndPush, hasChanges, README_PATH } from "./git.js";
import { Renderer } from "./renderer.js";
import { ContextBuilder } from "./context.js";

export class Engine {
  private renderer: Renderer;
  contextBuilder: ContextBuilder;

  constructor(config: DifflerConfig, renderer: Renderer) {
    this.renderer = renderer;
    this.contextBuilder = new ContextBuilder(config);
  }

  async render(): Promise<string> {
    const templateSource = this.renderer.readTemplateSource();
    const context = await this.contextBuilder.build(templateSource);
    return this.renderer.render(context);
  }

  async validate(): Promise<void> {
    const templateSource = this.renderer.readTemplateSource();
    const context = await this.contextBuilder.build(templateSource);
    this.renderer.validate(context);
  }

  async update(options: { dryRun?: boolean; message?: string } = {}): Promise<void> {
    const rendered = await this.render();

    if (options.dryRun) {
      console.info("Dry run — output:\n", rendered);
      return;
    }

    let current = "";
    if (existsSync(README_PATH)) {
      current = readFileSync(README_PATH, "utf-8");
    }

    if (rendered === current) {
      console.info("No changes detected; skipping commit.");
      return;
    }

    writeFileSync(README_PATH, rendered, "utf-8");
    console.info("README.md updated locally.");

    if (hasChanges(README_PATH)) {
      commitAndPush(options.message || "🤖 Auto-update profile README", README_PATH);
    } else {
      console.info("No git changes detected; skipping commit.");
    }
  }
}
