import { GitHubHttpError, type GitHubResponseHeaders } from "../github/client.js";
import type { RateLimitInfo, StatsActionConfig } from "./types.js";

export class BudgetStoppedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetStoppedError";
  }
}

export type SchedulerState = {
  graphqlRateLimit: RateLimitInfo | null;
  restRateLimit: RateLimitInfo | null;
  warnings: string[];
};

type RequestKind = "graphql" | "rest";

export class RequestScheduler {
  private readonly startedAt: number;
  private graphqlRateLimit: RateLimitInfo | null = null;
  private restRateLimit: RateLimitInfo | null = null;
  private warnings: string[] = [];
  private retryAt: Record<RequestKind, number> = { graphql: 0, rest: 0 };

  constructor(private readonly config: StatsActionConfig, startedAt = Date.now()) {
    this.startedAt = startedAt;
  }

  state(): SchedulerState {
    return {
      graphqlRateLimit: this.graphqlRateLimit,
      restRateLimit: this.restRateLimit,
      warnings: [...this.warnings],
    };
  }

  shouldStartOptional(kind: RequestKind): boolean {
    if (this.isRuntimeExhausted() || Date.now() < this.retryAt[kind]) return false;
    const rate = kind === "graphql" ? this.graphqlRateLimit : this.restRateLimit;
    return !rate || Date.parse(rate.resetAt) <= Date.now() ||
      rate.remaining > this.minimumRemaining(kind);
  }

  async graphql<T extends { rateLimit?: RateLimitInfo }>(
    label: string,
    request: () => Promise<T>,
    optional = false,
    retries = 3
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      this.checkOptionalBudget("graphql", label, optional);
      try {
        const response = await request();
        if (response.rateLimit) this.recordRateLimit("graphql", response.rateLimit);
        return response;
      } catch (error) {
        await this.retryAfterError("graphql", label, error, attempt++, retries, optional);
      }
    }
  }

  async rest<T extends { headers?: GitHubResponseHeaders; status?: number }>(
    label: string,
    request: () => Promise<T>,
    optional = true,
    retries = 3
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      this.checkOptionalBudget("rest", label, optional);
      try {
        const response = await request();
        this.updateRateLimitFromHeaders("rest", response.headers);
        return response;
      } catch (error) {
        await this.retryAfterError("rest", label, error, attempt++, retries, optional);
      }
    }
  }

  private checkOptionalBudget(kind: RequestKind, label: string, optional: boolean): void {
    if (optional && !this.shouldStartOptional(kind)) {
      throw new BudgetStoppedError(`${kind} budget exhausted before ${label}`);
    }
  }

  private async retryAfterError(
    kind: RequestKind,
    label: string,
    error: unknown,
    attempt: number,
    retries: number,
    optional: boolean
  ): Promise<void> {
    const status = getErrorStatus(error);
    const headers = error instanceof GitHubHttpError ? error.headers : undefined;
    this.updateRateLimitFromHeaders(kind, headers);
    const backoffMs = retryDelayMs(headers, attempt);
    const retryableStatus = isRetryableStatus(status, headers);
    if (status === 429 || (status === 403 && retryableStatus)) {
      this.retryAt[kind] = Math.max(this.retryAt[kind], Date.now() + backoffMs);
    }

    const retryable = retryableStatus ||
      (kind === "graphql" && isTransientGraphQLError(error));
    if (attempt >= retries || !retryable) throw error;

    const waitMs = backoffMs + Math.floor(Math.random() * 250);
    if (optional && Date.now() + waitMs >= this.startedAt + this.config.maxRuntimeSeconds * 1000) {
      this.warnings.push(`${label} deferred because the retry would exceed the runtime budget`);
      throw new BudgetStoppedError(`${kind} retry exceeds the runtime budget before ${label}`);
    }
    this.warnings.push(
      `${label} returned ${status ?? "transient error"}; retrying in ${Math.round(waitMs)}ms`
    );
    await delay(waitMs);
  }

  private isRuntimeExhausted(): boolean {
    return Date.now() - this.startedAt >= this.config.maxRuntimeSeconds * 1000;
  }

  private minimumRemaining(kind: RequestKind): number {
    return kind === "graphql" ? this.config.minGraphqlRemaining : this.config.minRestRemaining;
  }

  private recordRateLimit(kind: RequestKind, rateLimit: RateLimitInfo): void {
    if (kind === "graphql") this.graphqlRateLimit = rateLimit;
    else this.restRateLimit = rateLimit;
    if (rateLimit.remaining <= this.minimumRemaining(kind)) {
      this.warnings.push(
        `${kind === "graphql" ? "GraphQL" : "REST"} budget near threshold: ${rateLimit.remaining} remaining`
      );
    }
  }

  private updateRateLimitFromHeaders(
    kind: RequestKind,
    headers: GitHubResponseHeaders | undefined
  ): void {
    const limit = readHeaderNumber(headers, "x-ratelimit-limit");
    const remaining = readHeaderNumber(headers, "x-ratelimit-remaining");
    const used = readHeaderNumber(headers, "x-ratelimit-used");
    const reset = readHeaderNumber(headers, "x-ratelimit-reset");
    if (limit === null || remaining === null || reset === null) return;

    this.recordRateLimit(kind, {
      limit,
      remaining,
      used: used ?? Math.max(0, limit - remaining),
      resetAt: new Date(reset * 1000).toISOString(),
    });
  }
}

export async function runLimited<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex++;
      if (currentIndex >= items.length) return;

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await worker(items[currentIndex], currentIndex),
        };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export function isBudgetStopped(error: unknown): boolean {
  return error instanceof BudgetStoppedError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readHeaderNumber(
  headers: GitHubResponseHeaders | undefined,
  name: string
): number | null {
  const value = headers?.[name];
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  return typeof error.status === "number" ? error.status : null;
}

function getRetryAfterMs(headers: GitHubResponseHeaders | undefined): number | null {
  const retryAfter = headers?.["retry-after"];
  if (retryAfter === undefined || retryAfter === "") return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : null;
  const date = Date.parse(String(retryAfter));
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function retryDelayMs(headers: GitHubResponseHeaders | undefined, attempt: number): number {
  const retryAfter = getRetryAfterMs(headers);
  const reset = readHeaderNumber(headers, "x-ratelimit-reset");
  const exhausted = readHeaderNumber(headers, "x-ratelimit-remaining") === 0;
  const resetDelay = exhausted && reset !== null ? Math.max(0, reset * 1000 - Date.now()) : null;
  if (retryAfter !== null || resetDelay !== null) return Math.max(retryAfter ?? 0, resetDelay ?? 0);
  return Math.min(30000, 1000 * Math.pow(2, attempt));
}

function isRetryableStatus(status: number | null, headers: GitHubResponseHeaders | undefined): boolean {
  if (status === 403) {
    return getRetryAfterMs(headers) !== null || readHeaderNumber(headers, "x-ratelimit-remaining") === 0;
  }
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isTransientGraphQLError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout|nginx/i.test(message);
}
