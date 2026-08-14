import type {
  PackageDownloadCounts,
  PackageMetric,
  PackageStatsAdapter,
  PackageStatsAdapterResult,
} from "./types.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

const DOWNLOAD_PERIODS: Array<[keyof PackageDownloadCounts, string]> = [
  ["lastDay", "last-day"],
  ["lastWeek", "last-week"],
  ["lastMonth", "last-month"],
  ["lastYear", "last-year"],
];
const NPM_DOWNLOAD_DATA_START = new Date("2015-01-10T00:00:00.000Z");
const PACKAGE_CONCURRENCY = 3;
const RANGE_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export class NpmPackageStatsAdapter implements PackageStatsAdapter {
  readonly provider = "npm";

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => Date = () => new Date()
  ) {}

  async collect(packageNames: string[]): Promise<PackageStatsAdapterResult> {
    const results = await mapSettledWithConcurrency(
      packageNames,
      PACKAGE_CONCURRENCY,
      (packageName) => this.collectPackage(packageName)
    );
    const packages: PackageMetric[] = [];
    const warnings: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        packages.push(result.value);
      } else {
        warnings.push(
          `npm package "${packageNames[index]}" unavailable: ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`
        );
      }
    });

    return { packages, warnings };
  }

  private async collectPackage(packageName: string): Promise<PackageMetric> {
    const encodedName = encodeURIComponent(packageName);
    const metadata = await fetchJson(
      this.fetcher,
      `https://registry.npmjs.org/${encodedName}`
    );
    const metadataRecord = asRecord(metadata);
    const createdAt = parseDate(asRecord(metadataRecord.time).created);
    const [downloadCounts, allTime] = await Promise.all([
      Promise.all(
        DOWNLOAD_PERIODS.map(([, period]) =>
          fetchJson(
            this.fetcher,
            `https://api.npmjs.org/downloads/point/${period}/${encodedName}`
          )
        )
      ),
      this.collectAllTimeDownloads(encodedName, createdAt),
    ]);
    const latestVersion = asNullableString(asRecord(metadataRecord["dist-tags"]).latest);
    const publishedAt = latestVersion
      ? asNullableString(asRecord(metadataRecord.time)[latestVersion])
      : null;
    const downloads = {
      ...Object.fromEntries(
        DOWNLOAD_PERIODS.map(([key], index) => [
          key,
          asNonNegativeNumber(asRecord(downloadCounts[index]).downloads),
        ])
      ),
      allTime,
    } as PackageDownloadCounts;

    return {
      provider: this.provider,
      name: packageName,
      url: `https://www.npmjs.com/package/${encodedName}`,
      latestVersion,
      latestPublishedAt: publishedAt,
      downloads,
    };
  }

  private async collectAllTimeDownloads(
    encodedName: string,
    createdAt: Date | null
  ): Promise<number> {
    const yesterday = new Date(this.now());
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const firstDay =
      createdAt && createdAt > NPM_DOWNLOAD_DATA_START
        ? startOfUtcDay(createdAt)
        : NPM_DOWNLOAD_DATA_START;
    if (firstDay > yesterday) return 0;

    const ranges = buildDownloadRanges(firstDay, yesterday);
    const results = await mapWithConcurrency(
      ranges,
      RANGE_CONCURRENCY,
      (range) =>
        fetchJson(
          this.fetcher,
          `https://api.npmjs.org/downloads/point/${range}/${encodedName}`
        )
    );
    return results.reduce<number>(
      (total, result) => total + asNonNegativeNumber(asRecord(result).downloads),
      0
    );
  }
}

function buildDownloadRanges(firstDay: Date, lastDay: Date): string[] {
  const ranges: string[] = [];
  let start = new Date(firstDay);

  while (start <= lastDay) {
    const end = new Date(
      Math.min(start.getTime() + 539 * 86_400_000, lastDay.getTime())
    );
    ranges.push(`${formatDate(start)}:${formatDate(end)}`);
    start = new Date(end.getTime() + 86_400_000);
  }

  return ranges;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function fetchJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`npm request failed with HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await worker(values[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function mapSettledWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  return mapWithConcurrency(values, concurrency, async (value) => {
    try {
      return { status: "fulfilled", value: await worker(value) } as const;
    } catch (reason) {
      return { status: "rejected", reason } as const;
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
