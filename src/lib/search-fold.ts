/**
 * The in-memory half of search.
 *
 * `contains` in a Prisma query is a SQL LIKE: it compares codepoints. That is
 * exactly right for Latin and not enough for Arabic, where several written
 * distinctions are optional in practice — الحموضة and الحموضه, أهداف and
 * اهداف, يُعطى and يعطي are each one word spelled two ways, and none of the
 * pairs match as codepoints. The fold that makes them meet
 * (foldArabicForSearch) cannot run inside SQL without a generated column, so
 * an Arabic query is answered by reading the student's own rows and comparing
 * in memory.
 *
 * These two live here rather than in the Server Action that uses them for a
 * reason that is a build error, not a preference: every export of a
 * `"use server"` module is treated as a Server Function and must be async, so
 * a plain helper exported from one is a wire endpoint the app never meant to
 * publish. Here they are ordinary functions, and testable as ordinary
 * functions — see scripts/verify-arabic-search.ts.
 */

import { arabicAwareIncludes } from "@/lib/pdf-text";

/** How many results any one table contributes to the panel. */
export const RESULT_LIMIT = 5;

/**
 * How many of the student's own rows an Arabic query may fold through.
 *
 * Not a page size — the five that come back are chosen after folding. This is
 * the ceiling on how much is read to find them. This is one student's own
 * material, so the bound guards a future that has not happened rather than a
 * limit anyone meets today; if it ever does start truncating, the fix is a
 * folded column in Postgres, not a bigger number here.
 */
export const SCAN_LIMIT = 500;

/** Rows to read from one table: enough to fold through, or just the answer. */
export function rowsToRead(folded: boolean): number {
  return folded ? SCAN_LIMIT : RESULT_LIMIT;
}

/**
 * Keeps the best few, after folding — and only when the fold was needed.
 *
 * When `folded` is false the rows came back already narrowed by SQL and
 * already limited, so they are returned untouched. When it is true they are
 * every row of that table the student owns, up to SCAN_LIMIT, and the filter
 * here is the only thing standing between a one-word query and the student's
 * entire library coming back as "results".
 */
export function pickMatching<T>(
  rows: T[],
  folded: boolean,
  query: string,
  textOf: (row: T) => string
): T[] {
  if (!folded) return rows;
  return rows.filter((row) => arabicAwareIncludes(textOf(row), query)).slice(0, RESULT_LIMIT);
}
