/**
 * The colours a student can write and highlight in.
 *
 * The viewer had six, shared between the pen and the highlighter, and the first
 * of them was `#111111`. Since the highlighter inherited whatever the pen was
 * last set to, its default was effectively near-black — and highlighting with a
 * black marker blacks the text out. That is not a colour choice, it is a
 * palette with no highlighter in it.
 *
 * Two palettes now, because the two tools want different things. A pen wants
 * saturated, legible ink against white paper. A highlighter wants a light,
 * high-value dye that survives being multiplied over black text and still
 * leaves it readable — which rules out navy and black entirely, whatever the
 * pen thinks of them.
 */

export type Swatch = { hex: string; key: string };

/**
 * Thirteen, per the brief, ordered the way a pen case is: the ones you reach
 * for first at the front.
 */
export const PEN_COLORS: Swatch[] = [
  { hex: "#111111", key: "black" },
  { hex: "#4A4A4A", key: "grey" },
  { hex: "#1F4FD8", key: "blue" },
  { hex: "#16306B", key: "navy" },
  { hex: "#1FA5C4", key: "cyan" },
  { hex: "#2FA65A", key: "green" },
  { hex: "#15663A", key: "darkGreen" },
  { hex: "#F2CE3A", key: "yellow" },
  { hex: "#F0913A", key: "orange" },
  { hex: "#D8362F", key: "red" },
  { hex: "#E8699C", key: "pink" },
  { hex: "#7A4BC4", key: "purple" },
  { hex: "#FFFFFF", key: "white" },
];

/**
 * Highlighter dyes.
 *
 * Every one is light enough that multiplying it over black body text leaves the
 * text black rather than tinted — the property the whole three-layer change
 * exists to give back. Black, grey, navy and white are deliberately absent:
 * three of them would obliterate the text and the fourth would do nothing at
 * all.
 */
export const HIGHLIGHTER_COLORS: Swatch[] = [
  { hex: "#FFE14D", key: "yellow" },
  { hex: "#FFB84D", key: "orange" },
  { hex: "#8CE99A", key: "green" },
  { hex: "#7FD8F7", key: "cyan" },
  { hex: "#C5A3FF", key: "purple" },
  { hex: "#FFA8C5", key: "pink" },
];

/** What a marker is when you first pick it up. Yellow, like every desk drawer. */
export const DEFAULT_HIGHLIGHTER = HIGHLIGHTER_COLORS[0].hex;
export const DEFAULT_PEN = PEN_COLORS[0].hex;

export function paletteFor(mode: "pen" | "highlighter" | "eraser"): Swatch[] {
  return mode === "highlighter" ? HIGHLIGHTER_COLORS : PEN_COLORS;
}
