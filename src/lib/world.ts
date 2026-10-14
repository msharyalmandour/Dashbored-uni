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
 * NONE OF THESE MAY LOOK LIKE A NAMED WORLD, which is the whole point and was
 * got wrong twice. First the fallback list was a copy of the handoff's
 * palette, so his code-less "Elective Course" landed on Critical Care's
 * saffron. Then it was replaced with four more warm earth tones and the guard
 * compared HEX STRINGS — which passed, while on the real screen the Elective's
 * "old gold" #d4a24a sat next to Research Methods' amber #e0b25a and the two
 * covers were indistinguishable. A check that asserts two strings differ is a
 * check of nothing; the one in scripts/verify-world.ts now measures the
 * perceptual distance in Oklab and holds every pair at least as far apart as
 * the closest pair the handoff itself drew.
 *
 * THESE ARE ALL DESERT, AND THAT IS AN INSTRUCTION, NOT A PREFERENCE.
 * VOICE.md rule 6: "Nothing decorative outside the desert palette (no
 * green/blue/purple covers — the Elective gets sand #C9A88A)."
 *
 * They were cool for a day — night blue, ash, fig, sea green — because the
 * sand had been measured against the Elective's OLD gold #d4a24a, which was
 * 0.0459 from Research Methods' amber and read as one colour with it. Sand is
 * a different colour: #c9a88a measures 0.2825 from that amber across the
 * three stops the cover draws, clear of the 0.2730 floor below. The warm
 * palette was never the problem; the wrong warm colour was.
 *
 * FOUR, AND FOUR IS THE LIMIT — measured, not guessed. A fifth un-named
 * course wraps round to the first. Generating worlds instead of listing them
 * was tried and is worse: spacing hues round a circle at one lightness gives
 * pairs closer than this list's worst pair by the time there are four of
 * them, because what separates these is lightness and chroma as much as hue,
 * and the gamut that stays legible under white text is not large.
 *
 * So if he ever carries more than four courses the handoff does not name —
 * next term, when the codes change — the fix is to NAME them here, which is
 * what the handoff's model asks for anyway: a course is a place, and a place
 * is named. This list is the safety net under that, not a substitute for it.
 */
const FALLBACK: World[] = [
  { one: "#c0bfa9", two: "#131205" }, // pale khaki
  { one: "#944d24", two: "#2e0000" }, // sienna
  { one: "#e09a8c", two: "#53201a" }, // dune rose
  { one: "#c9a88a", two: "#6e5442" }, // sand — VOICE.md names this one, and
                                      // it is his "Elective Course"
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
