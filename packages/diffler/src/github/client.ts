import { z } from "zod";
import type { GitHubConfig } from "../config.js";

const graphqlEnvelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.unknown()).optional(),
});

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token && !token.startsWith("${")) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryFetch(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  backoff = 2.0
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status < 500 || attempt === maxRetries) {
        return response;
      }
      // Server error — retry if we have attempts left
      if (attempt < maxRetries) {
        const sleepTime = backoff * 2 ** attempt;
        console.warn(
          `HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${sleepTime.toFixed(1)}s...`
        );
        await sleep(sleepTime * 1000);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const sleepTime = backoff * 2 ** attempt;
        console.warn(
          `Request error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${sleepTime.toFixed(1)}s...`
        );
        await sleep(sleepTime * 1000);
      }
    }
  }

  throw lastError ?? new Error("Retry exhausted");
}

export type GitHubResponseHeaders = Record<string, string | number | undefined>;

export class GitHubHttpError extends Error {
  readonly status: number;
  readonly headers: GitHubResponseHeaders;

  constructor(api: "REST" | "GraphQL", response: Response) {
    super(`GitHub ${api} error: HTTP ${response.status} ${response.statusText}`.trim());
    this.name = "GitHubHttpError";
    this.status = response.status;
    this.headers = responseHeaders(response);
  }
}

function responseHeaders(response: Response): GitHubResponseHeaders {
  return Object.fromEntries(response.headers.entries());
}

export type RestResponse<T = unknown> = {
  data: T;
  headers: GitHubResponseHeaders;
  status: number;
};

export class GitHubClient {
  private readonly config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = { ...config };
  }

  get targetUsername(): string | null {
    return this.config.username;
  }

  async restGet(path: string, params?: Record<string, string | number>): Promise<unknown> {
    const response = await this.restGetRaw(path, params);
    return response.data;
  }

  async restGetRaw(
    path: string,
    params?: Record<string, string | number>,
    extraHeaders?: Record<string, string>
  ): Promise<RestResponse> {
    const url = new URL(path, this.config.apiUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      ...authHeaders(this.config.token),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...extraHeaders,
    };

    const response = await retryFetch(url.toString(), {
      method: "GET",
      headers,
    });

    let data: unknown;
    if (response.status === 304) {
      data = null;
    } else if (response.status === 202) {
      data = null;
    } else if (!response.ok) {
      throw new GitHubHttpError("REST", response);
    } else {
      data = await response.json();
    }

    return { data, headers: responseHeaders(response), status: response.status };
  }

  async graphqlQuery(
    query: string,
    variables?: Record<string, unknown>,
    options: { allowMissingNodes?: boolean } = {}
  ): Promise<unknown> {
    const url = new URL(this.config.graphqlUrl);

    const headers: Record<string, string> = {
      ...authHeaders(this.config.token),
      "Content-Type": "application/json",
    };

    const body = JSON.stringify({ query, variables });

    const response = await retryFetch(url.toString(), {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new GitHubHttpError("GraphQL", response);
    }

    const parsed = graphqlEnvelopeSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Invalid GitHub GraphQL response");
    const data = parsed.data;
    if (data.errors?.length && !(options.allowMissingNodes && onlyMissingNodes(data.data, data.errors))) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
  }
}

function onlyMissingNodes(data: unknown, errors: unknown[]): boolean {
  if (typeof data !== "object" || data === null || !("nodes" in data) || !Array.isArray(data.nodes)) {
    return false;
  }
  const nodes: unknown[] = data.nodes;
  return errors.every((error) => {
    if (typeof error !== "object" || error === null || !("type" in error) || error.type !== "NOT_FOUND") {
      return false;
    }
    if (!("path" in error) || !Array.isArray(error.path) || error.path.length !== 2) return false;
    const [field, index] = error.path;
    return field === "nodes" && typeof index === "number" && Number.isInteger(index) &&
      index >= 0 && nodes[index] === null;
  });
}
