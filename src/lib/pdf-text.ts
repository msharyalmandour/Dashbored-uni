/**
 * Turning pdf.js's text items back into text.
 *
 * A PDF does not contain sentences. It contains instructions to place glyph
 * runs at coordinates, and an exporter is free to split a word wherever it
 * likes — PowerPoint in particular splits on every kerning adjustment, so
 * "Mechanics" can arrive as ["M", "echan", "ics"].
 *
 * The extractor used to do this:
 *
 *   items.map(i => i.str).join(" ")
 *
 * which puts a space between every run, whether or not the PDF had one. On a
 * deck that splits aggressively that produces exactly the mangling a student
 * would report as "it isn't the same as the original":
 *
 *   1.TheM echan ics o fVen tila tion
 *   S tuden t Lea m ing O b jectives
 *
 * The information needed to do better is already on every item and was being
 * thrown away: `transform` says where the run starts, `width` says how wide it
 * is, and `hasEOL` says the line ended. So a space goes in when the geometry
 * says there is one — a real horizontal gap — and not otherwise.
 */

/** The shape we need from pdf.js's TextItem. Narrow on purpose: anything that
 *  can supply these can be tested against, and pdf.js's own type pulls in the
 *  whole library. */
export type TextPiece = {
  str: string;
  /** [a, b, c, d, e, f] — e and f are the run's x and y on the page. */
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

/**
 * How big a gap counts as a space, as a fraction of the run's height.
 *
 * A space in a typical face is around a quarter of the point size, and kerning
 * adjustments are far smaller than that. 0.18 sits below the one and above the
 * other with room on both sides — measured against decks that split per-kern,
 * where the within-word gaps land near 0.02–0.05 and real spaces near 0.25.
 */
export const SPACE_GAP_RATIO = 0.18;

/**
 * Join one page's runs into a line of text.
 *
 * Rules, in order:
 *   - a run that already ends in whitespace needs nothing added;
 *   - a run that begins with whitespace needs nothing added;
 *   - `hasEOL` ends the line;
 *   - otherwise a space goes in only if the next run starts far enough to the
 *     right of where this one ended.
 *
 * Runs that moved backwards or onto another line (a superscript, a second
 * column) are treated as needing a space, because gluing them together would
 * invent a word that is not there — the failure that is harder to notice.
 */
export function joinTextPieces(pieces: TextPiece[]): string {
  let out = "";
  /* The last run that actually contributed text — not simply the previous
     element. An exporter emits empty runs freely, and measuring a gap from one
     of those means measuring from x=0: the whole line then looks like one huge
     space. */
  let prev: TextPiece | undefined;

  for (const piece of pieces) {
    const str = piece.str ?? "";
    if (str === "") {
      // An empty run still carries a line break, which is the only thing it
      // has to say.
      if (piece.hasEOL && out && !out.endsWith("\n")) out += "\n";
      continue;
    }

    if (out === "") {
      out = str;
    } else if (out.endsWith("\n")) {
      // The break is the separator; anything more would indent the line.
      out += str;
    } else {
      out += separatorBetween(prev, piece) + str;
    }

    prev = piece;
    if (piece.hasEOL) out += "\n";
  }
  return out;
}

function separatorBetween(prev: TextPiece | undefined, next: TextPiece): string {
  if (!prev) return "";
  // Whitespace already present on either side of the seam: adding more would
  // only have to be collapsed again.
  if (/\s$/.test(prev.str ?? "")) return "";
  if (/^\s/.test(next.str ?? "")) return "";
  if (prev.hasEOL) return "";

  const prevX = prev.transform?.[4];
  const prevY = prev.transform?.[5];
  const nextX = next.transform?.[4];
  const nextY = next.transform?.[5];

  // Without geometry there is nothing to reason from, and a space is the
  // safer of the two guesses: it can be read past, a missing one cannot.
  if (![prevX, prevY, nextX, nextY].every((n) => typeof n === "number")) return " ";

  // A different line entirely.
  const lineHeight = Math.max(next.height || 0, prev.height || 0, 1);
  if (Math.abs((nextY as number) - (prevY as number)) > lineHeight * 0.5) return " ";

  /* A run that starts to the LEFT of where the previous one started is not a
     continuation of it — it is a reposition: a second column, a re-drawn line,
     right-to-left text. Gluing those together invents a word. The gap test
     below cannot catch this on its own, because a large negative gap and a
     tiny negative one (ordinary kerning overlap) both simply fail `> 0`. */
  if ((nextX as number) < (prevX as number)) return " ";

  const gap = (nextX as number) - ((prevX as number) + (prev.width || 0));
  return gap > lineHeight * SPACE_GAP_RATIO ? " " : "";
}
