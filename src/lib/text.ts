/**
 * Text that came out of a document, made fit to show.
 *
 * WHY THIS EXISTS, with the row that caused it. On 2026-10-13 the student's
 * own screen read:
 *
 *     2. Management Process &amp; First-Line Nurse Manager's Roles
 *
 * Nothing in the app was broken: the title really is that string in the
 * database. It arrived that way because the agent read it out of a document
 * whose text is XML — a .docx and .pptx body, and most HTML — where a literal
 * "&" MUST be written "&amp;". Two readers in this codebase already decoded
 * entities for the text they extracted (the OOXML processor and the link
 * reader) and each had its own private copy of the function; neither ran on
 * the short strings the agent then writes as titles, so an ampersand survived
 * into a heading and was drawn as it was stored.
 *
 * So: one decoder, in one place, used by both readers and by every title the
 * agent writes. A third copy appearing is the thing to prevent — two copies
 * already disagreed about `&nbsp;` and `&#39;`.
 *
 * WHAT IT WILL NOT DO. It does not strip tags, and it is not a sanitiser:
 * React escapes what it renders, so the job here is only to undo an encoding
 * the document applied, never to make unsafe text safe.
 */

/** A code point that would corrupt the string, mapped to nothing instead. */
function safeCodePoint(code: number): string {
  /* Surrogates, out-of-range values and NUL all throw or produce text that
     breaks later string handling. An entity nobody can render is dropped
     rather than allowed to poison the whole title. */
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
  if (code >= 0xd800 && code <= 0xdfff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/**
 * Undo XML/HTML entity encoding.
 *
 * `&amp;` is decoded LAST, which is the one ordering that matters: a document
 * containing the literal text "&amp;lt;" encodes it as "&amp;amp;lt;", and
 * decoding the ampersand first would turn that into "<" — inventing a tag the
 * document never had.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => safeCodePoint(parseInt(code, 16)))
    .replace(/&amp;/gi, "&");
}

/**
 * A short string on its way into the database as a name a student will read.
 *
 * Decodes, collapses runs of whitespace — a title pulled out of a two-line
 * text box arrives with a newline in the middle of it, and a heading with a
 * line break inside breaks every layout that truncates — and trims.
 */
export function cleanTitle(text: string): string {
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}
