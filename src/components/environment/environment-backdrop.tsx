import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SceneBackdrop } from "@/components/environment/scene-backdrop";

/**
 * The environment the interface lives inside.
 *
 * Not a background image. The difference is that a background sits behind a
 * design and could be swapped for a flat colour without anything else
 * changing; this is the ground every surface above it is made to relate to —
 * the glass borrows its colour, the orb reflects its light, and the spacing
 * exists so you can see through to it.
 *
 * This file is the server half: it reads the blur placeholder off disk at
 * request time and hands it to the client half, which is the part that has to
 * know which route you are on. Everything about how the layers are built and
 * why they are in that order lives in scene-backdrop.tsx; everything about
 * what each scene looks like lives in THE SCENES in globals.css.
 *
 * It used to render one photograph for all twenty-three routes, with a comment
 * saying a backdrop that changed between pages would read as a theme rather
 * than as a place. That was right about themes and wrong about environments: a
 * ground that never changes carries no information, and after a week the eye
 * stops reading it. The six scenes are one world at different hours — same
 * grade family, same scrim ramp, one key light each — which keeps the original
 * point and drops the wallpaper.
 */

/**
 * A 24-pixel blur of the photograph, inlined so the first paint is the forest
 * in miniature rather than a black rectangle. Read at build time from the file
 * the image pipeline wrote, so it cannot drift from the photograph it
 * describes.
 */
function blurPlaceholder(): string {
  try {
    return readFileSync(join(process.cwd(), "public/environment/forest-blur.txt"), "utf8").trim();
  } catch {
    // A missing placeholder is a slightly worse first paint, never a failed
    // page: the image below is what matters and it is loaded separately.
    return "";
  }
}

export function EnvironmentBackdrop() {
  return <SceneBackdrop placeholder={blurPlaceholder()} />;
}
