/**
 * Which room of the building a route is in.
 *
 * The product used to put one photograph of a forest behind all twenty-three
 * routes. The layout even said so out loud — "a background that changed
 * between routes would read as a theme, not an environment" — and the instinct
 * was right about themes and wrong about environments. A ground that never
 * changes carries no information. After a week the eye stops reading it, and
 * what was meant to be a place is wallpaper.
 *
 * So: six scenes, and the rule that keeps the original instinct intact is that
 * they are one world at different hours, not six different worlds. Same grade
 * family, same scrim ramp shape, one key light each (see THE SCENES in
 * globals.css). Walking from Courses into Clinical should feel like walking
 * into another room of the same building.
 *
 * Pure and table-driven so it can be tested without a browser —
 * scripts/verify-scene.ts asserts every route in the app resolves, that the
 * deeper route wins over the shallower one, and that the scrim each scene
 * declares actually clears the contrast floor over the real photograph.
 */

export const SCENES = ["forest", "hall", "ward", "desk", "dawn", "night"] as const;

export type Scene = (typeof SCENES)[number];

/**
 * The photograph each scene stands in.
 *
 * Five of the six point at the forest today. That is a gap, stated rather than
 * hidden: a lecture theatre, a ward and a lit desk are photographs nobody in
 * this repository has, and inventing them is not something code can do. What
 * the code *can* do is make adding them a one-line change instead of a
 * rebuild, which is what this table is for. Until then each scene is the same
 * photograph under its own grade, key light and scrim — which is genuinely
 * different light in the same room, and is honest about being that.
 */
export const SCENE_IMAGE: Record<Scene, string> = {
  forest: "/environment/forest-2560.jpg",
  hall: "/environment/forest-2560.jpg",
  ward: "/environment/forest-2560.jpg",
  desk: "/environment/forest-2560.jpg",
  dawn: "/environment/forest-2560.jpg",
  night: "/environment/forest-2560.jpg",
};

/**
 * Route prefix → scene, longest match wins.
 *
 * Ordered by specificity at lookup rather than by hand, so a new entry cannot
 * be shadowed by an existing shorter one just by being written underneath it.
 */
const ROUTES: ReadonlyArray<readonly [string, Scene]> = [
  // Home and the daily loop. The calm one.
  ["/", "forest"],
  ["/today", "forest"],
  ["/inbox", "forest"],
  ["/review", "forest"],
  ["/tasks", "forest"],
  ["/videos", "forest"],
  ["/knowledge-gaps", "forest"],
  ["/analytics", "forest"],

  // Planning. The one screen a student opens to decide rather than to work,
  // and the only scene lighter than the default.
  ["/time", "dawn"],
  ["/calendar", "dawn"],

  // Coursework. A lecture theatre with the lights down — the densest reading
  // in the product, so the scene that gives the most contrast back.
  ["/academics", "hall"],
  ["/subjects", "hall"],
  ["/lectures", "hall"],

  // Inside a deck. Going deeper into a lecture visibly means going quieter.
  ["/lectures/slides", "night"],

  // The rotation.
  ["/clinical", "ward"],

  // One lamp, and the rest of the room gone.
  ["/flashcards", "desk"],
  ["/problems", "desk"],
  ["/mistakes", "desk"],
  ["/focus", "desk"],
];

/** Sorted once, at module load, so `sceneFor` is a scan and not a sort. */
const BY_SPECIFICITY = [...ROUTES].sort((a, b) => b[0].length - a[0].length);

/**
 * `/lectures/abc123/slides/def456` has an id in the middle of it, so a plain
 * prefix table cannot see that it is a slides route. Ids are replaced with a
 * marker and dropped, which turns every lecture URL into one of exactly two
 * shapes: `/lectures` or `/lectures/slides`.
 *
 * A segment counts as an id if it is not a word — cuid, uuid and numeric ids
 * all qualify, and no route segment in this app does.
 */
function skeleton(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const kept = parts.filter((part) => /^[a-z][a-z-]*$/.test(part));
  return kept.length ? `/${kept.join("/")}` : "/";
}

export function sceneFor(pathname: string): Scene {
  const path = skeleton(pathname);
  for (const [prefix, scene] of BY_SPECIFICITY) {
    if (prefix === "/") continue;
    if (path === prefix || path.startsWith(prefix + "/")) return scene;
  }
  return "forest";
}
