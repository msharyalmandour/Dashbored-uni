/**
 * التوبيكس — a lecture laid out as the topics it teaches.
 *
 * WHY THIS IS NOT THE SUMMARY. `src/lib/summary.ts` caps at seven points on
 * purpose: it is what a tired student reads in thirty seconds. This is the
 * other thing he asked for — the lecture, section by section, the way the
 * study file he built for himself did it. That file had twenty-one sections
 * for ONE lecture, each with a slide range, and he revised an exam from it.
 *
 * THE SHAPE OF A POINT IS THE WHOLE IDEA. Every point carries two halves:
 * `source`, which is the slide's own English, and `note`, a short Arabic
 * explanation or an example from his ward. The English is what the exam will
 * quote; the Arabic is what makes it stick. A point with only the English is
 * the slide again; a point with only the Arabic cannot be checked against the
 * lecture. The rules below let `note` be absent — the source material leaves
 * it out sometimes and filler would be worse — but never `source`.
 *
 * As with المحاكاة, this content is written by the agent from a deck and
 * nobody proof-reads it before a student studies from it, so every way it can
 * be wrong is refused here rather than discovered mid-revision.
 */

/**
 * NULL AND UNDEFINED BOTH, DELIBERATELY. Every optional field here arrives
 * from one of two places and they disagree: Prisma returns `null` for a
 * nullable column, and a hand-written object leaves the key off. Typing these
 * as `?: string` and then calling `.trim()` on them is the bug the first run
 * of this file's tests found — thirteen checks died on
 * "Cannot read properties of null", because the fixture is real JSON and real
 * JSON says `"note": null`. So the types admit both and `text()` below is the
 * only thing allowed to touch them.
 */
export interface SectionPoint {
  heading: string;
  /** The slide's own words. Copied, not paraphrased. */
  source: string;
  /** The Arabic explanation or example. Absent is allowed. */
  note?: string | null;
  /** The exact slide, when the point sits on one. */
  slide?: number | null;
}

export interface Section {
  title: string;
  /** "9", "4–5", "30–33" — as the deck numbers them. */
  slides?: string | null;
  idea: string;
  /** "انتبه" — what the exam does with this topic. */
  watch?: string | null;
  starred?: boolean | null;
  points: SectionPoint[];
}

/** The one place null and undefined are flattened. Never call .trim() direct. */
function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Whether an optional field was actually given a value. */
function given(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/* ── the limits, and why each is where it is ─────────────────────────────── */

/** Fewer than this is a summary, and there is already a summary. */
export const MIN_SECTIONS = 3;
/**
 * The source material runs to twenty-one for a thirty-three-slide lecture.
 * Past forty this is no longer a breakdown of a lecture, it is a transcript,
 * and a transcript is the thing the student already could not get through.
 */
export const MAX_SECTIONS = 40;
/** A section with no points says a topic exists and nothing about it. */
export const MIN_POINTS = 1;
/** The longest in the source material is eight. */
export const MAX_POINTS = 12;
export const MAX_TITLE = 80;
export const MAX_IDEA = 300;
export const MAX_WATCH = 300;
export const MAX_HEADING = 80;
export const MAX_SOURCE = 400;
export const MAX_NOTE = 400;
/** Four of twenty-one in the source. Marking everything marks nothing. */
export const MAX_STARRED_SHARE = 0.4;

export type SectionProblem =
  | { kind: "NO_SECTIONS" }
  | { kind: "TOO_FEW_SECTIONS"; count: number }
  | { kind: "TOO_MANY_SECTIONS"; count: number }
  | { kind: "SECTION_NO_TITLE"; index: number }
  | { kind: "SECTION_TITLE_TOO_LONG"; index: number; chars: number }
  | { kind: "SECTION_NO_IDEA"; index: number }
  | { kind: "SECTION_IDEA_TOO_LONG"; index: number; chars: number }
  | { kind: "WATCH_TOO_LONG"; index: number; chars: number }
  | { kind: "DUPLICATE_TITLE"; title: string }
  | { kind: "NO_POINTS"; index: number }
  | { kind: "TOO_MANY_POINTS"; index: number; count: number }
  | { kind: "POINT_NO_HEADING"; section: number; point: number }
  | { kind: "POINT_NO_SOURCE"; section: number; point: number }
  | { kind: "POINT_TOO_LONG"; section: number; point: number; field: string; chars: number }
  | { kind: "SLIDE_OUT_OF_RANGE"; section: number; point: number; slide: number; pages: number }
  | { kind: "SLIDE_NOT_A_PAGE"; section: number; point: number; slide: number }
  | { kind: "SLIDES_UNREADABLE"; index: number; slides: string }
  | { kind: "EVERYTHING_STARRED"; count: number; of: number };

/** "9" -> 9, "4–5" -> 4, "30–33" -> 30. Null when it says nothing numeric. */
export function firstSlideOf(slides: string | null | undefined): number | null {
  if (!slides) return null;
  /* Any dash the source might use: hyphen, en dash, em dash, Arabic comma.
     Only the FIRST run of digits matters — it is where the section opens. */
  const match = slides.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The slides a topic covers, inclusive at both ends. */
export interface SlideRange {
  from: number;
  to: number;
}

/**
 * "9" -> 9..9, "4–5" -> 4..5, "30–33" -> 30..33.
 *
 * BOTH ENDS, which is the difference between this and `firstSlideOf`. That one
 * answers "where does this topic open" — the link target. This one answers
 * "which topic am I looking at" when a student is on slide 32, and nine of the
 * twenty-one sections in his lecture span a range, so reading only the first
 * number would leave two thirds of the deck unlabelled.
 *
 * A reversed range ("33–30") is returned in reading order rather than refused:
 * it is a typo in the source, not a reason to label nothing.
 */
export function slideRangeOf(slides: string | null | undefined): SlideRange | null {
  if (!slides) return null;
  const numbers = [...slides.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n > 0);
  if (numbers.length === 0) return null;
  const from = numbers[0];
  const to = numbers.length > 1 ? numbers[numbers.length - 1] : from;
  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * Which topic a slide belongs to.
 *
 * This is the link that makes the deck and the breakdown one thing rather than
 * two lists about the same lecture: a student on slide 9 is reading Planning,
 * and the screen can say so and hand him that topic's "انتبه" without his
 * having to go and look.
 *
 * THE NARROWEST RANGE WINS, and his own lecture is why. Section 10 covers
 * exactly slide 15 ("Emotional Intelligence Competencies"); section 9 spans
 * 14–16 and contains it. A topic that says "this IS slide 15" is a better
 * answer than one that merely reaches over it, so the tighter claim wins and
 * only a tie on width falls back to whichever opened first. The first version
 * of this preferred the earlier section and labelled slide 15 with the wrong
 * topic — caught by a check against the real deck, not by reading the code.
 *
 * Returns null rather than guessing when nothing covers the page: a title
 * slide, a references page, or a deck that is not this lecture at all. Saying
 * nothing is correct there; naming the nearest topic would be a claim about a
 * slide nobody wrote one for.
 */
export function topicForSlide<T extends Section>(sections: T[], slide: number): T | null {
  if (!Number.isInteger(slide) || slide < 1) return null;
  let best: { section: T; width: number; from: number } | null = null;
  for (const section of sections) {
    const range = slideRangeOf(section.slides);
    if (!range) continue;
    if (slide < range.from || slide > range.to) continue;
    const width = range.to - range.from;
    if (!best || width < best.width || (width === best.width && range.from < best.from)) {
      best = { section, width, from: range.from };
    }
  }
  return best?.section ?? null;
}

/**
 * Everything wrong with a breakdown, in the order a reader would meet it.
 *
 * `pages` is the deck's length when exactly one deck owns the lecture, so a
 * cited slide is checked against a real document rather than merely being a
 * number that looks plausible.
 */
export function problemsWith(sections: Section[], pages?: number): SectionProblem[] {
  const problems: SectionProblem[] = [];

  if (sections.length === 0) {
    problems.push({ kind: "NO_SECTIONS" });
    return problems;
  }
  if (sections.length < MIN_SECTIONS) {
    problems.push({ kind: "TOO_FEW_SECTIONS", count: sections.length });
  }
  if (sections.length > MAX_SECTIONS) {
    problems.push({ kind: "TOO_MANY_SECTIONS", count: sections.length });
  }

  /* A repeated title is the failure that looks like content: two sections
     called "Planning" and no way for a student to tell which one he read. */
  const seen = new Map<string, number>();
  for (const section of sections) {
    const key = text(section.title).toLowerCase();
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [title, count] of seen) {
    if (count > 1) problems.push({ kind: "DUPLICATE_TITLE", title });
  }

  sections.forEach((section, index) => {
    const title = text(section.title);
    if (!title) problems.push({ kind: "SECTION_NO_TITLE", index });
    else if (title.length > MAX_TITLE) {
      problems.push({ kind: "SECTION_TITLE_TOO_LONG", index, chars: title.length });
    }

    const idea = text(section.idea);
    if (!idea) problems.push({ kind: "SECTION_NO_IDEA", index });
    else if (idea.length > MAX_IDEA) {
      problems.push({ kind: "SECTION_IDEA_TOO_LONG", index, chars: idea.length });
    }

    if (given(section.watch) && text(section.watch).length > MAX_WATCH) {
      problems.push({ kind: "WATCH_TOO_LONG", index, chars: text(section.watch).length });
    }

    /* A slide range that parses to nothing is worse than none: it is drawn as
       a label the student tries to find in the deck. */
    if (given(section.slides) && firstSlideOf(section.slides) === null) {
      problems.push({ kind: "SLIDES_UNREADABLE", index, slides: text(section.slides) });
    }

    if (section.points.length < MIN_POINTS) {
      problems.push({ kind: "NO_POINTS", index });
    } else if (section.points.length > MAX_POINTS) {
      problems.push({ kind: "TOO_MANY_POINTS", index, count: section.points.length });
    }

    section.points.forEach((point, p) => {
      if (!text(point.heading)) problems.push({ kind: "POINT_NO_HEADING", section: index, point: p });
      else if (text(point.heading).length > MAX_HEADING) {
        problems.push({
          kind: "POINT_TOO_LONG", section: index, point: p,
          field: "heading", chars: text(point.heading).length,
        });
      }

      /* THE ONE THAT CANNOT BE EMPTY. Without the lecture's own sentence this
         is a note about a lecture rather than the lecture. */
      if (!text(point.source)) problems.push({ kind: "POINT_NO_SOURCE", section: index, point: p });
      else if (text(point.source).length > MAX_SOURCE) {
        problems.push({
          kind: "POINT_TOO_LONG", section: index, point: p,
          field: "source", chars: text(point.source).length,
        });
      }

      if (given(point.note) && text(point.note).length > MAX_NOTE) {
        problems.push({
          kind: "POINT_TOO_LONG", section: index, point: p,
          field: "note", chars: text(point.note).length,
        });
      }

      if (point.slide !== undefined && point.slide !== null) {
        if (!Number.isInteger(point.slide) || point.slide < 1) {
          problems.push({ kind: "SLIDE_NOT_A_PAGE", section: index, point: p, slide: point.slide });
        } else if (pages !== undefined && point.slide > pages) {
          problems.push({
            kind: "SLIDE_OUT_OF_RANGE", section: index, point: p, slide: point.slide, pages,
          });
        }
      }
    });
  });

  /* Emphasis that is everywhere is emphasis nowhere. */
  const starred = sections.filter((s) => s.starred).length;
  if (sections.length > 0 && starred > Math.ceil(sections.length * MAX_STARRED_SHARE)) {
    problems.push({ kind: "EVERYTHING_STARRED", count: starred, of: sections.length });
  }

  return problems;
}

export function isSound(sections: Section[], pages?: number): boolean {
  return problemsWith(sections, pages).length === 0;
}

/** A problem in words a student could read, for the agent's refusal message. */
export function describeProblem(p: SectionProblem): string {
  switch (p.kind) {
    case "NO_SECTIONS":
      return "No topics. Break the lecture into the topics it teaches.";
    case "TOO_FEW_SECTIONS":
      return `${p.count} topics is a summary, and there is already a summary. Give at least ${MIN_SECTIONS}.`;
    case "TOO_MANY_SECTIONS":
      return `${p.count} topics is a transcript, not a breakdown. Keep it under ${MAX_SECTIONS}.`;
    case "SECTION_NO_TITLE":
      return `Topic ${p.index + 1} has no title.`;
    case "SECTION_TITLE_TOO_LONG":
      return `Topic ${p.index + 1}'s title is ${p.chars} characters. Keep it under ${MAX_TITLE} — it is a name, not a sentence.`;
    case "SECTION_NO_IDEA":
      return `Topic ${p.index + 1} has no idea line. Say the one thing to say if you only say one.`;
    case "SECTION_IDEA_TOO_LONG":
      return `Topic ${p.index + 1}'s idea is ${p.chars} characters. Keep it under ${MAX_IDEA} — one or two lines.`;
    case "WATCH_TOO_LONG":
      return `Topic ${p.index + 1}'s exam note is ${p.chars} characters. Keep it under ${MAX_WATCH}.`;
    case "DUPLICATE_TITLE":
      return `Two topics are both called "${p.title}". A student cannot tell which one he has read.`;
    case "NO_POINTS":
      return `Topic ${p.index + 1} has no points — it names a topic and says nothing about it.`;
    case "TOO_MANY_POINTS":
      return `Topic ${p.index + 1} has ${p.count} points. Keep the ${MAX_POINTS} that matter.`;
    case "POINT_NO_HEADING":
      return `Topic ${p.section + 1}, point ${p.point + 1} has no heading.`;
    case "POINT_NO_SOURCE":
      return `Topic ${p.section + 1}, point ${p.point + 1} has no line from the lecture. Copy the slide's own sentence — that is what the exam quotes.`;
    case "POINT_TOO_LONG":
      return `Topic ${p.section + 1}, point ${p.point + 1}: the ${p.field} is ${p.chars} characters and will not fit.`;
    case "SLIDE_OUT_OF_RANGE":
      return `Topic ${p.section + 1}, point ${p.point + 1} cites slide ${p.slide}, but the deck has ${p.pages} pages.`;
    case "SLIDE_NOT_A_PAGE":
      return `Topic ${p.section + 1}, point ${p.point + 1} cites "${p.slide}", which is not a page number.`;
    case "SLIDES_UNREADABLE":
      return `Topic ${p.index + 1}'s slide range "${p.slides}" has no number in it.`;
    case "EVERYTHING_STARRED":
      return `${p.count} of ${p.of} topics are marked important. Marking everything marks nothing.`;
  }
}
