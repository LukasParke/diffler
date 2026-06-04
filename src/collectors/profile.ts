import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const PROFILE_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    bio
    company
    location
    websiteUrl
    twitterUsername
    email
    createdAt
    followers {
      totalCount
    }
    following {
      totalCount
    }
    starredRepositories {
      totalCount
    }
  }
}
`;

export const profileCollector: Collector = {
  name: "profile",
  templateRefs: new Set(["profile", "github"]),
  dependencies: new Set(),
  optional: false,

  collect(ctx: CollectorContext): unknown | Promise<unknown> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_profile:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>;

    const client = new GitHubClient(ctx.config.github);
    return client
      .graphqlQuery(PROFILE_QUERY, { login: username })
      .then((data) => {
        const user = (data as { user?: Record<string, unknown> }).user ?? {};
        const result = {
          login: user.login,
          name: user.name || user.login,
          bio: user.bio,
          company: user.company,
          location: user.location,
          websiteUrl: user.websiteUrl,
          twitterUsername: user.twitterUsername,
          email: user.email,
          createdAt: user.createdAt,
          followers: ((user.followers as { totalCount?: number })?.totalCount) ?? 0,
          following: ((user.following as { totalCount?: number })?.totalCount) ?? 0,
          starredRepositories: ((user.starredRepositories as { totalCount?: number })?.totalCount) ?? 0,
        };
        ctx.cache.setStable(cacheKey, result);
        return result;
      });
  },
};
