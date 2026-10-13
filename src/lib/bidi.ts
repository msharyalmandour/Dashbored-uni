/**
 * Keeping an English sentence's full stop at its own end.
 *
 * `ContentText` already fixes the easy case: a string that is ENTIRELY Latin
 * gets `dir="auto"` and runs left to right with its punctuation attached. This
 * is the other case, and it is the common one in this product — a sentence
 * that is Arabic AND English at once:
 *
 *     "صح. Planning is deciding in advance what should be done, how, when,
 *      where and by whom."
 *
 * The string starts with Arabic, so `dir="auto"` resolves the paragraph to
 * RTL, and the final "." is a neutral sitting between a Latin letter and the
 * end of an RTL paragraph. Unicode's bidi algorithm resolves it to the
 * paragraph direction and the browser draws it at the LEFT edge. Measured in
 * Chromium, reading the rendered line left to right:
 *
 *     .be done, how, when, where and by whom      ← before
 *     be done, how, when, where and by whom.      ← after
 *
 * Nothing is misspelled; the period is simply in the wrong place, on every
 * English definition the student is trying to memorise.
 *
 * THE FIX IS `<bdi>` AROUND THE LATIN RUN, which is what that element is for:
 * it isolates the run so its own direction is resolved independently, and the
 * punctuation that belongs to it stays with it.
 *
 * WHAT COUNTS AS A RUN. A maximal stretch that contains at least one Latin
 * letter and no Arabic, carrying along the spaces, digits and punctuation
 * inside and immediately after it. It cannot swallow Arabic, because no Arabic
 * character is in the set; and it must END on a letter, digit or closing
 * punctuation, so a run never ends on the space before an Arabic word.
 *
 * The one invariant that matters is that this only REGROUPS: the segments
 * joined back together are the input, character for character. A function that
 * silently drops a character out of a student's lecture note would be far
 * worse than a misplaced full stop.
 */

/** A piece of a string, and whether it should be isolated as Latin. */
export interface BidiSegment {
  text: string;
  latin: boolean;
}

/* The characters a Latin run may contain after its first letter. Deliberately
   not "everything that is not Arabic": a newline or a tab ends a run, because
   joining two lines into one isolate changes where they break. */
const RUN = /[A-Za-z][A-Za-z0-9 .,:;'"()[\]{}\-–—/&%+#@!?*°…]*[A-Za-z0-9.)\]}%!?'"]|[A-Za-z]/g;

/**
 * Split a mixed string into Arabic and Latin segments.
 *
 * Returns a single non-latin segment for a string with no Latin letters at
 * all, so the caller can skip the wrapping entirely in the common case.
 */
export function bidiSegments(text: string): BidiSegment[] {
  const out: BidiSegment[] = [];
  let at = 0;
  for (const match of text.matchAll(RUN)) {
    const start = match.index;
    if (start > at) out.push({ text: text.slice(at, start), latin: false });
    out.push({ text: match[0], latin: true });
    at = start + match[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  if (out.length === 0) out.push({ text, latin: false });
  return out;
}

/** Whether isolating is worth doing at all: mixed scripts, not just one. */
export function isMixed(text: string): boolean {
  return /[A-Za-z]/.test(text) && /[؀-ۿ]/.test(text);
}
