export { DifflerConfig, GitHubConfig, GitHubProfileConfig } from "./config.js";
export { Engine } from "./core/engine.js";
export { Renderer } from "./core/renderer.js";
export { ContextBuilder } from "./core/context.js";
export {
  collectPackageStats,
  NpmPackageStatsAdapter,
  type PackageStatsAdapter,
  type PackageStatsAdapterResult,
  type PackageStatsCollection,
} from "./packages/index.js";
