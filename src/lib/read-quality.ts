/**
 * Did we actually read this, or only finish running?
 *
 * The pipeline used to write COMPLETED whenever a processor returned without
 * throwing — including when it returned nothing at all. So a lecture whose text
 * came back empty, or came back as mojibake, was recorded as understood. The
 * student saw a green tick, the agent filed from an empty string, and nobody
 * learned anything was wrong. That is how a failure survives for weeks: not by
 * being loud and ignored, but by being silent and green.
 *
 * "No errors ever" is not a promise any system can keep. "No SILENT errors" is,
 * and it is the better promise: the student can work around a thing that says
 * it could not read page 12, and cannot work around a thing that quietly
 * pretends it did.
 *
 * Everything here is deterministic and runs BEFORE any model sees the text.
 * A model asked "did you understand this?" will say yes; arithmetic will not.
 */

export type ReadVerdict = "good" | "thin" | "garbled" | "empty";

export type ReadQuality = {
  verdict: ReadVerdict;
  /** 0..1. Not a probability — a rank, used for ordering and thresholds. */
  confidence: number;
  /** Machine-readable reasons, so the UI can say them in the student's language. */
  reasons: ReadReason[];
  wordCount: number;
  pagesWithText: number;
  pageCount: number;
};

export type ReadReason =
  | "no-text"
  | "few-words"
  | "empty-pages"
  | "no-letters"
  | "broken-words"
  | "replacement-chars";

/** Below this, a page is treated as carrying nothing. */
export const MIN_WORDS_PER_PAGE = 3;

/** A document under this many words has not been read in any useful sense. */
export const MIN_TOTAL_WORDS = 10;

/**
 * How much of the text must be made of letters.
 *
 * Mojibake and a mis-decoded CID font come back as runs of punctuation,
 * question marks and control characters. Real prose — Latin or Arabic — is
 * overwhelmingly letters and spaces. Slides carrying mostly numbers are the
 * one honest exception, which is why this is a reason and not a veto.
 */
export const MIN_LETTER_RATIO = 0.55;

/**
 * How many one- and two-letter fragments in a row look like a broken word.
 *
 * "1.TheM echan ics o fVen tila tion" is the shape a PDF text layer takes when
 * every glyph run is joined with a space. Ordinary English has plenty of short
 * words, so this only fires on a HIGH proportion — the threshold is tuned to
 * sit above normal prose and below that mangling.
 */
export const MAX_FRAGMENT_RATIO = 0.4;

const LETTERS = /\p{L}/u;
const LETTERS_G = /\p{L}/gu;

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** The share of non-space characters that are letters. */
export function letterRatio(text: string): number {
  const solid = text.replace(/\s+/g, "");
  if (solid.length === 0) return 0;
  const letters = solid.match(LETTERS_G)?.length ?? 0;
  return letters / solid.length;
}

/**
 * The share of words that are one or two letters long.
 *
 * Deliberately counts only alphabetic fragments: a slide full of "1. 2. 3."
 * is a list, not a mangling, and numbering should not look like damage.
 */
export function fragmentRatio(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0 && LETTERS.test(w));
  if (words.length < 12) return 0; // too little to judge
  const fragments = words.filter((w) => w.replace(/[^\p{L}]/gu, "").length <= 2).length;
  return fragments / words.length;
}

/** U+FFFD and friends: the decoder gave up and said so. */
export function hasReplacementChars(text: string): boolean {
  return /�/.test(text);
}

/**
 * Judge one document's extraction.
 *
 * `pages` is optional because not every source has pages. When it is present
 * it carries the most useful signal there is: a 47-page deck with text on
 * three pages is a failure no total word count would reveal.
 */
export function assessRead(input: {
  text: string | null | undefined;
  pages?: { pageNumber: number; text: string }[];
  pageCount?: number;
}): ReadQuality {
  const text = (input.text ?? "").trim();
  const pages = input.pages ?? [];
  const pageCount = input.pageCount ?? pages.length ?? 0;
  const pagesWithText = pages.filter((p) => countWords(p.text ?? "") >= MIN_WORDS_PER_PAGE).length;
  const wordCount = countWords(text);
  const reasons: ReadReason[] = [];

  if (text.length === 0 || wordCount === 0) {
    return { verdict: "empty", confidence: 0, reasons: ["no-text"], wordCount: 0, pagesWithText, pageCount };
  }

  const letters = letterRatio(text);
  const fragments = fragmentRatio(text);

  if (hasReplacementChars(text)) reasons.push("replacement-chars");
  if (letters < MIN_LETTER_RATIO) reasons.push("no-letters");
  if (fragments > MAX_FRAGMENT_RATIO) reasons.push("broken-words");

  // Garbled beats thin: text that arrived damaged is a different problem from
  // text that is merely sparse, and conflating them sends the student to the
  // wrong remedy.
  if (reasons.length > 0) {
    return { verdict: "garbled", confidence: 0.2, reasons, wordCount, pagesWithText, pageCount };
  }

  if (wordCount < MIN_TOTAL_WORDS) reasons.push("few-words");
  // Only meaningful when we know how many pages there were.
  if (pageCount > 0 && pages.length > 0 && pagesWithText < Math.ceil(pageCount / 2)) {
    reasons.push("empty-pages");
  }

  if (reasons.length > 0) {
    return { verdict: "thin", confidence: 0.5, reasons, wordCount, pagesWithText, pageCount };
  }

  return { verdict: "good", confidence: 0.9, reasons: [], wordCount, pagesWithText, pageCount };
}

/**
 * Whether the text is fit to reason from.
 *
 * The agent should not file flashcards out of mojibake. `thin` still passes:
 * a title slide and three bullets is a real, if small, reading — and the deck
 * is still worth having. `garbled` and `empty` do not, and the caller is
 * expected to fall back to sending the file itself to the model instead.
 */
export function isUsableText(quality: ReadQuality): boolean {
  return quality.verdict === "good" || quality.verdict === "thin";
}

/** Whether to say something to the student rather than show a plain green tick. */
export function needsTelling(quality: ReadQuality): boolean {
  return quality.verdict !== "good";
}
