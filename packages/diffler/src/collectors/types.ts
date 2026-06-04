import type { CollectorContext } from "./context.js";

export interface Collector {
  name: string;
  templateRefs: Set<string>;
  dependencies: Set<string>;
  optional: boolean;
  collect(ctx: CollectorContext): unknown | Promise<unknown>;
}

export type CollectorResult = Record<string, unknown>;

export type CollectionStatus =
  | "success"
  | "skipped"
  | "failed";
