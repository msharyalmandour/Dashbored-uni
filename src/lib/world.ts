/**
 * A course is a place, and this is what it looks like.
 *
 * The approved handoff of 2026-10-13 gives each course a WORLD: a pair or
 * triple of colours used for its cover and for the ground of every screen
 * inside it. You are in Critical Care and everything is saffron and ember; you
 * are in Leadership and everything is wine. A lecture sits one step deeper and
 * redder than its course, so going into it reads as going further in rather
 * than sideways.
 *
 * MATCHED ON THE COURSE CODE, NOT ON THE STORED COLOUR, and that is forced by
 * the data rather than chosen. Measured on the real account: all six subjects
 * hold `#6366f1`, the schema's default — indigo, from the palette this product
 * had before it was black and orange — because every one was filed by the
 * agent rather than created through the colour picker. Keying off `color`
 * would paint six identical worlds.
 *
 * `code` is also null on all six, so the code is read out of the NAME, which
 * really does carry it: "NURC (410) Critical Care Nursing". That is what
 * src/lib/course-code.ts already does for the short names on every row.
 *
 * A course the handoff does not name — a new one, or an elective with no code
 * — falls back to the palette BY POSITION, which is the rule the accents
 * already use. It gets a real world rather than the default one, and the same
 * course gets the same world every time.
 */

import { courseCode } from "@/lib/course-code";

export interface World {
  /** Top-right light. */
  one: string;
  /** The middle of the cover, and the second radial. */
  two: string;
  /** The deep end. Absent for the two-stop worlds in the handoff. */
  three?: string;
}

/**
 * The six the handoff names, by the code in the course's name.
 *
 * Keyed by the bare code ("NURC410") so "NURC (410)", "NURC 410" and
 * "nurc410" all land on the same world — the importer has written all three
 * spellings into this account at different times.
 */
const NAMED: Record<string, World> = {
  NURC410: { one: "#f0a23a", two: "#c9572b", three: "#3e120b" }, // saffron → ember
  NURC411: { one: "#d9603a", two: "#8e2a1c" },                   // ember red
  NURP431: { one: "#b8455a", two: "#6e1e2e" },                   // wine
  NURP432: { one: "#a07850", two: "#5a3a22" },                   // oud brown
  NURM410: { one: "#e0b25a", two: "#9a6420" },                   // amber
};

/**
 * For a course the handoff does not name.
 *
 * NONE OF THESE MAY EQUAL A NAMED WORLD, which is the whole point and was got
 * wrong first: the fallback list started as a copy of the handoff's palette,
 * so his code-less "Elective Course" landed on Critical Care's saffron and the
 * screen showed five worlds for six courses. These are their own colours,
 * warm and in the same family, and a check below asserts they stay distinct.
 */
const FALLBACK: World[] = [
  { one: "#c9a88a", two: "#6e5442" }, // sand — the handoff's "Elective"
  { one: "#b07d5a", two: "#5e3a28" }, // clay
  { one: "#a85f52", two: "#5c2a24" }, // rose brown
  { one: "#d4a24a", two: "#7a4a18" }, // old gold
];

/** A lecture: one step deeper and redder than whatever course it is in. */
export const LECTURE_WORLD: World = { one: "#e0703a", two: "#8e2a2e", three: "#3a0e14" };

/** Strip a code to its bare letters and digits: "NURC (410)" -> "NURC410". */
function bare(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function worldFor(
  subject: { name: string; code?: string | null },
  position = 0
): World {
  const code = courseCode(subject.name, subject.code);
  if (code) {
    const named = NAMED[bare(code)];
    if (named) return named;
  }
  /* Modulo so a seventh course gets a world rather than undefined, and the
     same one every time — position comes from creation order. */
  const i = ((position % FALLBACK.length) + FALLBACK.length) % FALLBACK.length;
  return FALLBACK[i];
}

/** The three radials a `.world` ground needs, as CSS custom properties. */
export function worldVars(world: World): Record<string, string> {
  return {
    "--w1": world.one,
    "--w2": world.two,
    /* A two-stop world still needs a third radial or the bottom of the screen
       falls to bare ink and the gradient stops dead half way down. Its own
       deep end doubles as the floor. */
    "--w3": world.three ?? world.two,
  };
}

/** The cover's linear gradient, top-left to bottom-right. */
export function coverGradient(world: World): string {
  const end = world.three ?? world.two;
  return `linear-gradient(165deg, ${world.one} 0%, ${world.two} 48%, ${end} 100%)`;
}
