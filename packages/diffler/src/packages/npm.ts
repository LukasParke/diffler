import type {
  PackageDownloadCounts,
  PackageMetric,
  PackageStatsAdapter,
  PackageStatsAdapterResult,
} from "./types.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;
type Sleep = (ms: number) => Promise<void>;

const DOWNLOAD_PERIODS: Array<[keyof PackageDownloadCounts, string]> = [
  ["lastDay", "last-day"],
  ["lastWeek", "last-week"],
  ["lastMonth", "last-month"],
  ["lastYear", "last-year"],
];
const NPM_DOWNLOAD_DATA_START = new Date("2015-01-10T00:00:00.000Z");
const PACKAGE_CONCURRENCY = 2;
const RANGE_CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 15_000;
// npm's CDN serves short-lived 429 bursts with "Retry-After: 0", so patience
// (several backed-off attempts) matters more than raw concurrency.
const MAX_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;
// Space out request starts so large package lists do not trip the burst limit.
const REQUEST_PACE_MS = 200;

export class NpmPackageStatsAdapter implements PackageStatsAdapter {
  readonly provider = "npm";
  private readonly pacer: RequestPacer;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: Sleep = defaultSleep,
    paceIntervalMs: number = REQUEST_PACE_MS
  ) {
    this.pacer = new RequestPacer(paceIntervalMs, sleep);
  }

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
      `https://registry.npmjs.org/${encodedName}`,
      this.sleep,
      this.pacer
    );
    const metadataRecord = asRecord(metadata);
    const createdAt = parseDate(asRecord(metadataRecord.time).created);
    const [downloadCounts, allTime] = await Promise.all([
      Promise.all(
        DOWNLOAD_PERIODS.map(([, period]) =>
          this.fetchDownloads(
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

  // The downloads API 404s for published packages that have no download data
  // yet; treat that as zero downloads instead of failing the package.
  private async fetchDownloads(url: string): Promise<unknown> {
    try {
      return await fetchJson(this.fetcher, url, this.sleep, this.pacer);
    } catch (error) {
      if (error instanceof NpmRequestError && error.status === 404) {
        return { downloads: 0 };
      }
      throw error;
    }
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
        this.fetchDownloads(
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

class NpmRequestError extends Error {
  constructor(
    readonly status: number,
    url: string
  ) {
    super(`npm request failed with HTTP ${status}: ${url}`);
  }
}

// Serializes request starts across the adapter so bursts of parallel packages
// still reach npm at a steady, gentle rate.
class RequestPacer {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly intervalMs: number,
    private readonly sleep: Sleep
  ) {}

  async wait(): Promise<void> {
    if (this.intervalMs <= 0) return;
    const next = this.tail.then(() => this.sleep(this.intervalMs));
    this.tail = next;
    await next;
  }
}

// npm rate limits bursts of downloads API requests with short-lived 429s, so
// retry with backoff and honor Retry-After when the registry provides it.
async function fetchJson(
  fetcher: Fetcher,
  url: string,
  sleep: Sleep,
  pacer: RequestPacer
): Promise<unknown> {
  let lastError: unknown = new Error(`npm request failed: ${url}`);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryAfterMs: number | null = null;
    try {
      await pacer.wait();
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        return response.json();
      }
      lastError = new NpmRequestError(response.status, url);
      if (response.status !== 429 && response.status < 500) {
        break;
      }
      retryAfterMs = parseRetryAfter(response.headers?.get("retry-after"));
    } catch (error) {
      lastError = error;
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMs(attempt, retryAfterMs));
    }
  }
  throw lastError;
}

function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1_000, RETRY_MAX_DELAY_MS);
}

function retryDelayMs(attempt: number, retryAfterMs: number | null): number {
  const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
  const delay = Math.min(backoff + jitter, RETRY_MAX_DELAY_MS);
  // Cloudflare fronts npm and answers 429s with "Retry-After: 0", so treat the
  // header as a floor rather than a replacement for backoff.
  return retryAfterMs !== null ? Math.max(delay, retryAfterMs) : delay;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
