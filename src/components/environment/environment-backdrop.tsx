import Image from "next/image";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The environment the interface lives inside.
 *
 * Not a background image. The difference is that a background sits behind a
 * design and could be swapped for a flat colour without anything else changing;
 * this is the ground every surface above it is made to relate to — the glass
 * borrows its colour, the orb reflects its light, and the spacing exists so
 * you can see through to it.
 *
 * Four layers, in this order and for these reasons:
 *
 *   1. **The photograph.** Already graded in the file rather than with a CSS
 *      filter: a filter over a full-screen image asks the compositor for work
 *      on every frame, and a baked grade asks for none. Three widths are on
 *      disk so a phone never downloads the desktop file.
 *   2. **Depth.** A cool wash that pushes the trees back, so the panels in
 *      front of them read as nearer rather than pasted on.
 *   3. **Vignette.** Dark at every edge, which is what keeps the eye in the
 *      middle where the orb is.
 *   4. **Scrim.** The contrast floor. This is the load-bearing layer: a
 *      photograph behind words is exactly where this kind of interface fails,
 *      and the rule is that the picture never carries text contrast on its own.
 *
 * Fixed rather than scrolling, so the environment stays still while content
 * moves through it — the thing that makes it feel like a place rather than a
 * long picture. `pointer-events-none` because nothing here is clickable, and
 * `aria-hidden` because there is nothing here to read.
 */

/**
 * A 24-pixel blur of the same photograph, inlined so the first paint is the
 * forest in miniature rather than a black rectangle. Read at build time from
 * the file the image pipeline wrote, so it cannot drift from the photograph it
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
  const placeholder = blurPlaceholder();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image
        src="/environment/forest-2560.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        quality={78}
        {...(placeholder ? { placeholder: "blur" as const, blurDataURL: placeholder } : {})}
        // Centre-weighted low, so the ferns and the forest floor — the part
        // with the most light in it — sit behind the content rather than under
        // the fold.
        className="scale-105 object-cover object-[50%_62%]"
      />

      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-depth)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-vignette)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-scrim)" }} />

      {/* The one thing that moves. A very slow, very faint brightening drifting
          across the canopy, so the environment is alive without ever being
          something you catch moving. It collapses entirely under
          prefers-reduced-motion — see globals.css. */}
      <div className="env-breathe absolute inset-0" />
    </div>
  );
}
