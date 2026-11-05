import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A photograph with text on it, in six layers and always the same six.
 *
 * THE ORDER IS THE WHOLE COMPONENT. Text over a photograph fails in one
 * specific way — a bright patch drifts under a glyph and the line stops being
 * readable, on one device, at one size, for one image. Every fix for that is
 * either "darken the ramp" or "move the text", and both have to happen in the
 * same place for every card or the next photograph brings the bug back.
 *
 *   1 image          saturate(1.08) contrast(1.06)
 *   2 darkening ramp on the side the text sits
 *   3 ribbed glass   optional, overlay
 *   4 warm glow      optional, screen
 *   5 noise          overlay at .16, so the gradient does not band
 *   6 the text       cream, with its own shadow
 *
 * NEVER LIGHTEN THE TEXT TO FIX CONTRAST. The reference says it and it is the
 * right rule: cream is the one text colour, so a line that fails gets a
 * darker ramp underneath it, not a brighter ink on top. Lightening text is
 * how a palette turns into fourteen greys.
 *
 * A MISSING IMAGE IS NOT A BROKEN CARD. Half the photographs do not exist
 * yet; without one the card draws the warm gradient and layers 3-5 and keeps
 * its text. Nothing shows a torn-image icon and nothing collapses.
 */
export function CinematicCard({
  image,
  imagePosition = "center",
  darkSide = "start",
  ribbed = false,
  glow = true,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className,
  children,
}: {
  /** A path under /public, or null until the photograph arrives. */
  image?: string | null;
  imagePosition?: string;
  darkSide?: "start" | "end" | "bottom";
  ribbed?: boolean;
  glow?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ramp =
    darkSide === "bottom"
      ? "c-cine-dark-bottom"
      : darkSide === "end"
        ? "c-cine-dark-end"
        : "c-cine-dark-start";

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="c-cine-img"
          style={{ objectPosition: imagePosition }}
        />
      ) : (
        /* The stand-in: the identity's own warmth, so a card without its
           photograph still belongs to the same screen. */
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #3a1c08 0%, #26130a 55%, #140d09 100%)",
          }}
        />
      )}

      <div aria-hidden className={cn("absolute inset-0", ramp)} />
      {ribbed && <div aria-hidden className="c-cine-ribbed absolute inset-0" />}
      {glow && <div aria-hidden className="c-cine-glow absolute inset-0" />}
      <div aria-hidden className="c-cine-noise absolute inset-0" />

      <div className="c-cine-text relative">{children}</div>
    </div>
  );
}

/** The plain glass surface, for everything that is not a photograph. */
export function GlassCard({
  dark = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { dark?: boolean }) {
  return (
    <div
      className={cn(dark ? "c-glass-dark" : "c-glass", "rounded-[22px]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
