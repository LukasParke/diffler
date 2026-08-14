import type {
  PackageDownloadCounts,
  PackageMetric,
  PackageMetrics,
} from "@lukasparke/diffler-schemas";
import type { PackageSourceConfig } from "../stats/types.js";

export type PackageStatsAdapter = {
  readonly provider: string;
  collect(packageNames: string[]): Promise<PackageStatsAdapterResult>;
};

export type PackageStatsAdapterResult = {
  packages: PackageMetric[];
  warnings: string[];
};

export type PackageStatsCollection = PackageMetrics;

export type { PackageDownloadCounts, PackageMetric, PackageSourceConfig };
