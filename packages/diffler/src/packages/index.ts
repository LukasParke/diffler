import type {
  PackageDownloadCounts,
  PackageMetric,
  PackageSourceConfig,
  PackageStatsAdapter,
  PackageStatsCollection,
} from "./types.js";
import { NpmPackageStatsAdapter } from "./npm.js";

const EMPTY_DOWNLOADS: PackageDownloadCounts = {
  lastDay: 0,
  lastWeek: 0,
  lastMonth: 0,
  lastYear: 0,
  allTime: 0,
};

export async function collectPackageStats(
  sources: PackageSourceConfig[],
  adapters: PackageStatsAdapter[] = [new NpmPackageStatsAdapter()]
): Promise<PackageStatsCollection> {
  const adaptersByProvider = new Map(
    adapters.map((adapter) => [adapter.provider, adapter])
  );
  const packages: PackageMetric[] = [];
  const warnings: string[] = [];
  const packagesByProvider = new Map<string, Set<string>>();

  for (const source of sources) {
    const packageNames = packagesByProvider.get(source.provider) ?? new Set<string>();
    source.packages.forEach((packageName) => packageNames.add(packageName));
    packagesByProvider.set(source.provider, packageNames);
  }

  for (const [provider, packageNames] of packagesByProvider) {
    const adapter = adaptersByProvider.get(provider);
    if (!adapter) {
      warnings.push(`No package stats adapter registered for "${provider}"`);
      continue;
    }

    try {
      const result = await adapter.collect([...packageNames]);
      packages.push(...result.packages);
      warnings.push(...result.warnings);
    } catch (error) {
      warnings.push(
        `${provider} package stats unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    packageCount: packages.length,
    providers: [...new Set(packages.map((item) => item.provider))],
    downloads: sumDownloads(packages),
    packages: packages.sort(
      (left, right) => right.downloads.lastMonth - left.downloads.lastMonth
    ),
    complete: warnings.length === 0,
    warnings,
  };
}

function sumDownloads(packages: PackageMetric[]): PackageDownloadCounts {
  return packages.reduce<PackageDownloadCounts>(
    (total, item) => ({
      lastDay: total.lastDay + item.downloads.lastDay,
      lastWeek: total.lastWeek + item.downloads.lastWeek,
      lastMonth: total.lastMonth + item.downloads.lastMonth,
      lastYear: total.lastYear + item.downloads.lastYear,
      allTime: total.allTime + item.downloads.allTime,
    }),
    { ...EMPTY_DOWNLOADS }
  );
}

export { NpmPackageStatsAdapter } from "./npm.js";
export type {
  PackageDownloadCounts,
  PackageMetric,
  PackageSourceConfig,
  PackageStatsAdapter,
  PackageStatsAdapterResult,
  PackageStatsCollection,
} from "./types.js";
