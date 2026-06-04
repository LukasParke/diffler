import type { GitHubConfig } from "../config.js";

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
      if (response.status < 500) {
        return response;
      }
      // Server error — retry if we have attempts left
      if (attempt < maxRetries) {
        const sleepTime = backoff * 2 ** attempt;
        console.warn(
          `HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${sleepTime.toFixed(1)}s...`
        );
        await sleep(sleepTime * 1000);
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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

export type RestResponse<T = unknown> = {
  data: T;
  headers: Record<string, string | number | undefined>;
  status: number;
};

export class GitHubClient {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
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

    const responseHeaders: Record<string, string | number | undefined> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data: unknown;
    if (response.status === 304) {
      data = null;
    } else if (response.status === 202) {
      data = null;
    } else if (!response.ok) {
      throw new Error(`GitHub REST error: ${response.status} ${response.statusText}`);
    } else {
      data = await response.json();
    }

    return { data, headers: responseHeaders, status: response.status };
  }

  async graphqlQuery(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    const url = new URL("/graphql", this.config.apiUrl);

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
      throw new Error(`GitHub GraphQL error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data?: unknown; errors?: unknown[] };
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
  }
}
