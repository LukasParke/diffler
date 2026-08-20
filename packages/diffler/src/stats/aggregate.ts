// Pure aggregation lives in @lukasparke/diffler-schemas so the collector and
// renderer share one implementation. Re-exported here for existing imports.
export {
  emptyContributionsCollection,
  mergeContributionsCollections,
  calculateContributionStats,
  aggregateLanguages,
  aggregateRepositoryLanguages,
  calculateRepoStats,
  calculateComputedStats,
  formatBytes,
  formatNumber,
} from "@lukasparke/diffler-schemas";
