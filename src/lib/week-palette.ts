/**
 * The week's colours, in one place.
 *
 * The month view, the week grid and the legend all draw the same week. They
 * used to each carry their own hex codes, which meant a class was indigo in one
 * and orange in another and the student had to learn the legend twice. Worse,
 * it made the drift silent: recolouring the grid left the legend behind, and
 * nothing anywhere said they were supposed to agree.
 *
 * So they agree by construction now. Everything below is derived from this
 * file, and `scripts/verify-palette.ts` enforces its rules.
 *
 * THE RULES, if you are changing a colour here:
 *
 *   1. A block's label must clear 4.5:1 against BOTH ends of its gradient — a
 *      two-hour block is tall enough that its second line sits over the dark
 *      end. Warm hues are much lighter than the indigos these replaced, which
 *      is why the bright kinds carry near-black labels rather than white ones.
 *   2. `CLASS` is the brightest fill. Classes are most of most weeks; if a lab
 *      or an activity outshines them, the eye lands on the exception instead of
 *      the week.
 *   3. Nothing here is blue. The theme is black and orange.
 *
 * The verify script checks all three. Run it after any change.
 */

export type SpanColour = {
  /** The block's fill. Two stops, because a flat rectangle has no material. */
  fill: string;
  /** For the cast shadow under the block — never for text or a border. */
  glow: string;
  /** The label. Its polarity follows the fill, not taste; see rule 1. */
  text: string;
};

export const SPAN_STYLE = {
  CLASS: { fill: "linear-gradient(150deg,#F0913A,#C36F22)", glow: "#FFC078", text: "#2A1405" },
  TUTORIAL: { fill: "linear-gradient(150deg,#C9983C,#AC802B)", glow: "#FFD98A", text: "#2B1A03" },
  LAB: { fill: "linear-gradient(150deg,#7F6D52,#423828)", glow: "#E8CFA6", text: "#FFF7EC" },
  ACTIVITY: { fill: "linear-gradient(150deg,#776B1B,#3E3708)", glow: "#DFCF62", text: "#FBF7DD" },
  /** Rose, not orange: the one place a medical convention beats a house style. */
  CLINICAL: { fill: "linear-gradient(150deg,#B83A54,#5C1526)", glow: "#FF8098", text: "#FFE7EC" },
  /** Anything that is not university. Deliberately the quietest thing here. */
  COMMITMENT: { fill: "linear-gradient(150deg,#2A2722,#16140F)", glow: "#5E594F", text: "#CAC5B9" },
} as const satisfies Record<string, SpanColour>;

/**
 * Points, not blocks: crossing a deadline takes no time, so it is a mark rather
 * than something with a height. These stay bright because they have to be found
 * against a grid that is otherwise full of blocks.
 */
export const POINT_STYLE = {
  DEADLINE: "#FFC14D",
  EXAM: "#FF5C5C",
  REVIEW: "#D4FF3D",
} as const;

/** The lit end of a kind's gradient — what a dot or a chip in a legend shows. */
export function markerFor(kind: keyof typeof SPAN_STYLE): string {
  const stops = SPAN_STYLE[kind].fill.match(/#[0-9A-Fa-f]{6}/g);
  if (!stops) throw new Error(`SPAN_STYLE.${kind}.fill has no colour stops`);
  return stops[0];
}

/**
 * The month view's five categories, mapped onto the same palette the week grid
 * uses. They are coarser than the grid's six kinds — the month view groups every
 * scheduled teaching session under "classes" — so the mapping is explicit rather
 * than automatic, but the colours are not new ones.
 */
export const CALENDAR_TYPE_COLOR = {
  CLASS: markerFor("CLASS"),
  CLINICAL: markerFor("CLINICAL"),
  STUDY: POINT_STYLE.DEADLINE,
  TASK: POINT_STYLE.EXAM,
  REVIEW: POINT_STYLE.REVIEW,
} as const;

export type CalendarType = keyof typeof CALENDAR_TYPE_COLOR;

/**
 * A month-view chip: an opaque tinted ground, and a label lifted off it.
 *
 * Both halves are here because of what the month view used to do. The chip was
 * the category colour at 13% alpha with the same colour as its label — which,
 * over a photographic background, is a translucent rectangle with a coloured
 * word floating on trees. It looked like a design and read like nothing, and
 * the densest screen in the app was the one it happened on.
 *
 * `bg` is the category colour at 32% composited onto the cell's own ground rather than
 * layered over whatever is behind it, so a chip is opaque wherever it lands.
 * `ink` is the same hue lifted until it clears 5:1 on that ground — a swatch
 * dark enough to work as a fill is too dark to work as 11px text on itself,
 * which is what made the clinical chips (at 2.65:1) the worst of them.
 *
 * 32% rather than something smaller because rose is the darkest of the five:
 * at 22% its chip lifted only 1.20:1 off the cell, which is a chip you cannot
 * see the edges of. The alpha is set by the worst category, not the average.
 */
export const CALENDAR_CHIP = {
  CLASS: { bg: "#5E3F21", ink: "#FFA959" },
  TASK: { bg: "#632E2C", ink: "#FF9292" },
  STUDY: { bg: "#634E27", ink: "#FFC456" },
  CLINICAL: { bg: "#4D2329", ink: "#F47992" },
  REVIEW: { bg: "#566222", ink: "#D4FF3D" },
} as const satisfies Record<CalendarType, { bg: string; ink: string }>;

/** The ground those chips are composited onto — the month cell's own fill. */
export const CALENDAR_CELL = "#1A1815";

/**
 * The colours a course can be.
 *
 * This is the last place the old blue theme was still alive, and the reason a
 * CSS sweep could never find it: it is not in the CSS, it is in the data. The
 * picker offered `["#8b5cf6", "#ef4444", "#0ea5e9", "#10b981", "#f59e0b",
 * "#ec4899", "#6366f1", "#64748b"]` — violet as the *default*, plus a sky blue
 * and an indigo — so every course created since the theme changed came out
 * wearing the colour of the theme before it. On a black-and-orange product, a
 * violet dot beside the course name is not a neutral choice; it is a leftover.
 *
 * The replacement is a warm-anchored set that avoids the blue arc entirely
 * (nothing between 200° and 280°) while still telling eight courses apart.
 * Both halves of that sentence are checked in scripts/verify-palette.ts:
 *
 *   - every colour clears 4.5:1 against the panel it is written on, because
 *     these are used as text and not only as dots;
 *   - no two are closer than 0.06 in OKLab ΔE, which is the measure that
 *     correctly calls the near-neutral distinct from the orange even though
 *     they share a hue angle — something a hue-distance check gets wrong;
 *   - nothing is blue.
 *
 * Orange leads, because the first swatch is the default and the default should
 * be the product's own colour rather than a hue it does not otherwise use.
 */
export const COURSE_SWATCHES = [
  "#F0913A", // the accent — the default a new course gets
  "#E3B33F", // amber
  "#BCCB4E", // lime
  "#5FC47C", // green
  "#47C0B2", // teal — the coolest the palette goes, and still not blue
  "#DE7ABE", // magenta
  "#EE7B92", // rose — the clinical hue's civilian cousin
  "#9A9086", // warm neutral, for a course that should not shout
] as const;
