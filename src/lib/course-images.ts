/**
 * Which photograph belongs to which course.
 *
 * ONE FILE, BECAUSE THE ALTERNATIVE IS SIX. A course appears as a cover on
 * الأكاديمي, as a strip on «كمّل من حيث وقفت», beside its exam under «الجاي»,
 * and at the head of its own page. Each of those used to pick its own
 * treatment, so the day a photograph changed it changed in one place and the
 * other three kept the old one. The map is the single answer to "what does
 * NURC 410 look like", and every surface reads it.
 *
 * THE MAP IS THE OWNER'S, NOT A GUESS. These four pairings come from the
 * image brief verbatim. Three of the four codes — 420, 308, 499 — are not
 * courses on this account (his are NURC 410, NURC 411, NURP 431, NURP 432,
 * NURM 410 and an elective with no code), so they match nothing today and
 * fall through to the default. They stay because he wrote them: a map that
 * silently drops the entries its author typed is a map he cannot trust.
 *
 * `book` IS THE DEFAULT and that is a decision, not a fallback. A course
 * without its own photograph gets the open textbook — true of every course
 * in a nursing degree — rather than a gradient, which is what this whole
 * change exists to remove.
 */
export const COURSE_IMAGE: Record<string, string> = {
  "NURC 410": "heart",
  "NURC 420": "lungs",
  "NURC 308": "book",
  "NURC 499": "pen",
};

/** The path, always. Spelled exactly as the brief asks. */
export const courseImage = (code: string) =>
  `/images/cinematic/${COURSE_IMAGE[code] ?? "book"}.jpg`;

/**
 * The files that have actually landed in `public/images/cinematic/`.
 *
 * WHY THIS LIST EXISTS, and it is the one piece of machinery the brief does
 * not name. Five of the ten photographs arrived; five have not. A
 * `next/image` pointed at a file that is not there does not fall back — it
 * requests `/_next/image?url=…`, the optimiser answers 400, and the card
 * draws a broken frame where the brief wanted a photograph. That is strictly
 * worse than the gradient it replaces.
 *
 * So a surface asks `courseImageIfPresent` instead, gets null for a file
 * that has not arrived, and `CinematicCard` draws the warm ground it already
 * draws for exactly this case. WHEN A FILE LANDS, ADD ITS NAME HERE — one
 * line, and every surface that reads this map shows it at once.
 */
export const PRESENT = new Set([
  "hero",
  "corridor",
  "hospital",
  "breath",
  "woman",
  /* still to arrive: heart, lungs, book, pen, tower */
]);

/**
 * How each photograph is framed, from the brief.
 *
 * THE FRAMING TRAVELS WITH THE FILE, not with the card. `heart.jpg` has the
 * specimen low and left of centre; at a plain `center` a 240px card shows
 * the desk it stands on. These are the owner's numbers and they are the same
 * on every surface that draws the file, which is the point of putting them
 * here rather than at four call sites.
 */
export const IMAGE_POSITION: Record<string, string> = {
  hero: "center 30%",
  corridor: "center 40%",
  hospital: "center",
  breath: "center 25%",
  woman: "center",
  heart: "25% 60%",
  lungs: "35% 50%",
  book: "center 60%",
  pen: "60% 60%",
  tower: "center 20%",
};

/** The course's photograph, or null while that file is not in the repo. */
export function courseImageIfPresent(code: string | null): string | null {
  const name = (code && COURSE_IMAGE[code]) || "book";
  return PRESENT.has(name) ? `/images/cinematic/${name}.jpg` : null;
}

/** The framing for the course's photograph, whether or not it has landed. */
export function courseImagePosition(code: string | null): string {
  const name = (code && COURSE_IMAGE[code]) || "book";
  return IMAGE_POSITION[name] ?? "center";
}

/** Any cinematic photograph by name, or null while it is not in the repo. */
export function cinematic(name: string): string | null {
  return PRESENT.has(name) ? `/images/cinematic/${name}.jpg` : null;
}
