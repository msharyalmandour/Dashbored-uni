import { z } from "zod";

/** Prisma cuid ids — used to validate every client-supplied id before it reaches a query. */
export const id = z.string().min(1).max(40);

export const shortText = z.string().trim().min(1).max(200);
export const optionalShortText = z.string().trim().max(200).optional();
export const longText = z.string().trim().min(1).max(20000);
export const optionalLongText = z.string().trim().max(20000).optional();

export const dateString = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date");

export const urlString = z.string().trim().url().max(2000);
export const optionalUrlString = z.string().trim().url().max(2000).optional();

export const percentage = z.number().int().min(0).max(100);
export const rating1to5 = z.number().int().min(1).max(5);
export const positiveInt = z.number().int().positive();
export const nonNegativeInt = z.number().int().min(0);
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color");

/** Throws a clean, safe-to-display error message on the first validation failure. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, field: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${field}: ${result.error.issues[0]?.message ?? "validation failed"}`);
  }
  return result.data;
}
