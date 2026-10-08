import { COURSE_SWATCHES } from "@/lib/week-palette";
import { deltaE, isHex, contrast } from "@/lib/colour";

/**
 * WHICH COLOUR A COURSE IS ACTUALLY DRAWN IN.
 *
 * `Subject.color` has existed since the first migration and nothing on a list
 * screen has ever read it, so this is less "add a colour" than "find out what
 * is already stored and whether it can be shown".
 *
 * What is stored, measured rather than assumed: the column defaults to
 * `#6366f1`. That is indigo — a swatch from the palette this product had
 * BEFORE it was black and orange, kept alive in the schema long after
 * COURSE_SWATCHES dropped the whole blue arc on the stated rule that "nothing
 * here is blue". Every course the agent files, every course an imported
 * timetable creates, and every course made by anything that does not go
 * through the picker gets that default. So the colour the database holds is
 * frequently not a colour the student chose and not a colour this product
 * uses.
 *
 * Painting it anyway would put the old theme back on screen, one dot per
 * course. Ignoring the field keeps six courses identical. So:
 *
 *   A STORED COLOUR THAT IS ONE OF THE APPROVED SWATCHES IS KEPT EXACTLY.
 *   ANYTHING ELSE SNAPS TO THE NEAREST APPROVED SWATCH IN OKLab.
 *
 * which means a student who picked a colour always gets that colour back
 * (distance zero), and only the values nobody chose get moved. The swatches
 * are already checked for legibility and separation in verify-palette.ts, so
 * snapping onto them inherits both properties instead of re-deriving them: a
 * clamped arbitrary hex would have to prove its own contrast, and a clamped
 * INDIGO would prove it and still be indigo.
 *
 * Nearest in OKLab rather than nearest in hue because hue distance gets the
 * near-neutral wrong — `#9A9086` sits at almost the same angle as the orange
 * accent and looks nothing like it.
 */

/** The ground these are drawn on: the app's dark background. */
export const GROUND = "#050505";

/**
 * The floor every accent must clear against that ground, because these are
 * used as small text and not only as dots. The swatches are verified at this
 * level in verify-palette.ts; this constant is what ties the two files to the
 * same number.
 */
export const MIN_CONTRAST = 4.5;

/** The swatch a course falls back to when it has no colour at all. */
export const DEFAULT_ACCENT: string = COURSE_SWATCHES[0];

/**
 * The value `Subject.color` defaults to in prisma/schema.prisma.
 *
 * Kept here as a constant because the whole rule below turns on it, and
 * verify-subject-accent.ts checks it still matches the schema — a default that
 * changed without this file noticing would quietly send every course down the
 * wrong branch.
 */
export const SCHEMA_DEFAULT = "#6366f1";

/**
 * The colour to draw for a course.
 *
 * Three cases, and the middle one is the reason this function is not just a
 * nearest-swatch snap:
 *
 *   AN APPROVED SWATCH is kept exactly. The student picked it.
 *
 *   THE SCHEMA DEFAULT is replaced by `position`. Snapping it would be
 *     correct and useless: every course the agent files carries the identical
 *     #6366f1, so all six of this student's courses would snap to the identical
 *     magenta and the screen would be exactly as colourless as before, having
 *     done arithmetic to get there. There is no choice to preserve in a value
 *     nobody chose, so the position in the student's own course list decides,
 *     and six courses get six colours.
 *
 *   ANY OTHER VALID HEX snaps to the nearest approved swatch in OKLab. A violet
 *     or a sky blue in the column is a colour the student picked from the
 *     palette this product had before it was black and orange — that is an
 *     intent, and the nearest warm equivalent keeps it.
 *
 * `position` is the course's index in a list ordered by creation, so adding a
 * course never recolours the ones already there. Deleting one shifts the
 * courses after it, which is the price of guaranteeing that no two courses on
 * screen share a colour; a hash of the id would be permanent instead, and
 * would collide — eight swatches over six ids lands on about four distinct
 * colours, which is the failure this branch exists to avoid.
 *
 * Total: every input returns an approved swatch, including null, undefined,
 * the empty string, a negative position and anything that is not a colour. A
 * list screen must not have to decide what to do with a bad row.
 */
export function accentFor(stored: string | null | undefined, position = 0): string {
  const byPosition = COURSE_SWATCHES[
    ((Math.trunc(position) % COURSE_SWATCHES.length) + COURSE_SWATCHES.length) %
      COURSE_SWATCHES.length
  ] as string;

  if (!isHex(stored)) return byPosition;

  const hex = stored.trim().toLowerCase();
  const normalised = hex.startsWith("#") ? hex : `#${hex}`;

  if (normalised === SCHEMA_DEFAULT.toLowerCase()) return byPosition;

  let best: string = DEFAULT_ACCENT;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const swatch of COURSE_SWATCHES) {
    const distance = deltaE(normalised, swatch);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = swatch;
    }
  }
  return best;
}

/** Whether a stored colour is left alone rather than snapped. */
export function isApproved(stored: string | null | undefined): boolean {
  if (!isHex(stored)) return false;
  const hex = stored.trim().toLowerCase();
  const normalised = hex.startsWith("#") ? hex : `#${hex}`;
  return COURSE_SWATCHES.some((swatch) => swatch.toLowerCase() === normalised);
}

/** Whether a colour can carry small text on the app's ground. */
export function isLegible(hex: string): boolean {
  return contrast(hex, GROUND) >= MIN_CONTRAST;
}

/**
 * Every course's accent at once, keyed by id.
 *
 * `accentFor` needs a position, and a position only means anything against the
 * student's whole course list — so a screen showing ONE course cannot work it
 * out from that course alone. Rather than let each screen invent its own
 * ordering (which is how the same course ends up two colours on two pages),
 * every caller passes the same list, ordered by creation, and reads its answer
 * out of the map.
 *
 * Order by `createdAt` ascending at the query, not by name: a rename must not
 * repaint the page.
 */
export function accentMap(subjects: { id: string; color: string | null }[]): Map<string, string> {
  const out = new Map<string, string>();
  subjects.forEach((subject, position) => {
    out.set(subject.id, accentFor(subject.color, position));
  });
  return out;
}
