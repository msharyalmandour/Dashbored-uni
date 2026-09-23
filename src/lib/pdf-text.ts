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
  /* Last, not per piece: the spacing decisions above measure geometry, which
     normalisation does not touch, and one pass over the finished line is
     cheaper than one per glyph run. See normalizeArabicText below for what
     this is for and why it is not a blanket NFKC. */
  return normalizeArabicText(out);
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

/**
 * Arabic, in the alphabet Arabic is actually written in.
 *
 * Unicode encodes Arabic twice. The letters people type, and that every
 * keyboard and search box produces, live in the Arabic block: ا is U+0627, ض
 * is U+0636. Alongside them sit the "presentation forms" — U+FB50–FDFF and
 * U+FE70–FEFF — one codepoint per *shape* a letter takes depending on its
 * neighbours: ﺍ is initial alef, ﺽ is isolated dad, and so on. They exist for
 * round-tripping legacy encodings and nothing else. Nobody types them.
 *
 * A PDF is free to say its glyphs mean either one, and plenty say the second.
 * Measured on an Arabic lecture: every page came back in presentation forms.
 * pdf.js is not wrong to report them — it is reporting what the file says.
 *
 * The damage is that it does not look like damage. The text reads correctly to
 * a human and to a model, the quality check calls it good, and the lecture is
 * stored. Then the student types الضغط الجزئي into search and gets nothing,
 * because what is stored is ﺍﻝﺽﻍﻁ ﺍﻝﺝﺯﺉﻱ — the same words in codepoints that
 * no query will ever contain. Global search, the agent's search over the
 * student's own records, and quoting the line under a pen mark all fail
 * silently and identically.
 *
 * NFKC is the transform that undoes it: it maps every presentation form back
 * to its letter, and decomposes the lam-alef ligature ﻻ into لا, which is two
 * letters and always was.
 *
 * Applied to the Arabic runs only, never to the whole string, and that
 * restraint is the point. Blanket NFKC also rewrites ₂ to 2 and ³ to 3 — so
 * PaCO₂ becomes PaCO2 in a respiratory lecture, and mmHg/m³ loses its unit.
 * Trading one silent corruption for another is not a fix. Outside these two
 * blocks the text is returned byte for byte.
 *
 * The range stops at U+FEFC, short of U+FEFD and U+FEFE (unassigned) and
 * U+FEFF (the byte-order mark). That is precision, not protection, and the
 * difference is worth stating plainly: NFKC leaves all three unchanged, so
 * widening the range would be harmless and no test can tell the two apart.
 * The narrower range says what this is for. It does not defend anything.
 */
const ARABIC_PRESENTATION_FORMS = /[\uFB50-\uFDFF\uFE70-\uFEFC]+/g;

export function normalizeArabicText(text: string): string {
  /* One `replace`, no guard clause. An earlier version tested first and
     returned the input untouched when it held no Arabic — which is what
     happens anyway, since `replace` with no match returns the string it was
     given. The guard bought nothing and cost a stateful global regex: `test`
     leaves `lastIndex` mid-string, so the shortcut needed resets around it
     that no test could justify, because `replace` resets `lastIndex` itself.
     Measured, both times. Code that exists only to defend against a bug the
     language does not have is code someone will later believe. */
  return text.replace(ARABIC_PRESENTATION_FORMS, (run) => run.normalize("NFKC"));
}
