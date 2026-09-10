import { z } from "zod";

export const countSchema = z.number().int().nonnegative().safe();
export const nonnegativeNumberSchema = z.number().finite().nonnegative();
export const percentageSchema = z.number().finite().min(0).max(100);
export const dateSchema = z.string().date();
export const dateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    "Expected a valid timestamp",
  );
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const yearSchema = z.string().regex(/^\d{4}$/);
export const timestampSchema = countSchema.max(8_640_000_000_000_000);
export const githubUsernameSchema = z
  .string()
  .regex(
    /^(?!.*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i,
    "Expected a GitHub username",
  );
