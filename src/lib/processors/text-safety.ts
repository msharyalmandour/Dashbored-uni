/**
 * Making extracted text storable.
 *
 * WHY THIS FILE EXISTS. Two of this student's documents reached the database
 * write and were rejected by Postgres itself:
 *
 *     PostgresError { code: "22021",
 *       message: "invalid byte sequence for encoding \"UTF8\": 0x00" }
 *
 * A PDF had a NUL byte in its text layer — legal in a PDF string, legal in a
 * JavaScript string, and impossible in a Postgres `text` column, which stores
 * UTF-8 and has no representation for U+0000. So extraction succeeded, the
 * read was assessed, and the transaction died on the way in. The row went to
 * FAILED with a database error on it, which reads as a bug in the app to
 * anyone looking, and the student is simply told his file failed.
 *
 * Nothing upstream can prevent this. The byte is in the file. The only place
 * to deal with it is the boundary between "what we read" and "what we store".
 *
 * WHY ONLY NUL. It is tempting to scrub control characters generally, and
 * wrong: a tab and a newline are the shape of a slide's text, and stripping
 * them would silently damage every document to guard against two. Postgres
 * accepts every other code point UTF-8 can encode. And the other obvious
 * candidate — an unpaired surrogate — never reaches the driver as bad bytes:
 * measured, `Buffer.from("a\ud800b", "utf8")` yields `61 ef bf bd 62`, Node
 * having already substituted U+FFFD. So one character is removed, because one
 * character is the one that cannot be stored.
 *
 * Pure: a string in, a string out. No database, no clock.
 */

/** U+0000. Written as an escape rather than a literal so this file itself
 *  stays a file a text editor and a diff can handle. */
const NUL = /\u0000/g;

export interface StorableText {
  /** The text as it can be stored. Null in, null out — an unread document
   *  and a document read as an empty string are different facts, and
   *  collapsing them here would erase the distinction the row records. */
  text: string | null;
  /** How many characters had to go. Zero for almost every document; non-zero
   *  is worth recording on the row, because a file with NULs in its text
   *  layer is usually a file with a damaged text layer, and the count is the
   *  only hint of that anyone gets. */
  removed: number;
}

export function makeStorable(text: string | null | undefined): StorableText {
  if (text === null || text === undefined) return { text: null, removed: 0 };
  const removed = (text.match(NUL) ?? []).length;
  /* The common path returns the same string object rather than a copy: every
     document but two on this account has nothing to strip. */
  return removed === 0 ? { text, removed: 0 } : { text: text.replace(NUL, ""), removed };
}

/**
 * The same problem again, in the column next door.
 *
 * `Document.metadata` is `jsonb`, and jsonb has no NUL either — it fails with
 * a *different* code and a different message:
 *
 *     22P05  unsupported Unicode escape sequence
 *     DETAIL: \u0000 cannot be converted to text.
 *
 * That matters because the per-page text of a PDF is written there, as
 * `metadata.pages[n].text`. A fix that cleaned only `extractedText` would have
 * moved the failure from 22021 to 22P05 on exactly the same two documents and
 * looked, from the row, like the fix had not worked at all. Measured against
 * the live database before writing this, not assumed.
 *
 * So everything on its way into the jsonb column is walked. Keys as well as
 * values: a NUL in an object key is just as unstorable, and a processor's
 * metadata keys come from file formats, not from us.
 */
export function makeStorableJson<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return makeStorable(value).text;
  if (Array.isArray(value)) return value.map(walk);
  /* Date, Buffer and the like are left alone: they are not plain objects and
     rebuilding them entry by entry would quietly turn them into something
     else. Only object literals — which is what processor metadata is — are
     descended into. */
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[makeStorable(k).text as string] = walk(v);
    return out;
  }
  return value;
}
