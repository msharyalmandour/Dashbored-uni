import * as React from "react";
import Image, { getImageProps } from "next/image";
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
 * A MISSING IMAGE IS NOT A BROKEN CARD. Five of the ten photographs have
 * landed; five have not. Without one the card draws the warm gradient and
 * layers 3-5 and keeps its text. Nothing shows a torn-image icon and nothing
 * collapses. See PRESENT in lib/course-images.ts for how a caller knows.
 *
 * TWO PHOTOGRAPHS, ONE REQUEST. The home band is a different picture on a
 * phone than on a laptop — a lit corridor shot tall against a student at a
 * window shot wide — and that is art direction, not a crop. Rendering both
 * and hiding one with `hidden md:block` downloads both: a hidden <img> is
 * still fetched. `getImageProps` + <picture> is Next's own answer (see
 * node_modules/next/dist/docs/.../image.md, "Art direction") and the browser
 * picks exactly one srcset before it requests anything.
 */
export function CinematicCard({
  image,
  imageMobile,
  imagePosition = "center",
  imageMobilePosition,
  mirrored = false,
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
  /** A different photograph below 768px. Needs `image` to be set too. */
  imageMobile?: string | null;
  imagePosition?: string;
  /** `object-position` for the mobile photograph; defaults to the desktop one. */
  imageMobilePosition?: string;
  /**
   * Flip the photograph horizontally.
   *
   * For one picture only, and for a real reason: `woman.jpg` is lit from the
   * right and her face sits in the right third, which in RTL is exactly
   * where the Arabic text lands. Mirrored, the face moves to the left third
   * and the text sits on the dark side it was always meant to sit on.
   */
  mirrored?: boolean;
  darkSide?: "start" | "end" | "bottom" | "both";
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
        : darkSide === "both"
          ? "c-cine-dark-both"
          : "c-cine-dark-start";

  /* The two object-positions travel as custom properties rather than as one
     inline `object-position`, because which of them applies is a media query
     and an inline style cannot hold one. `.c-cine-img` reads --cine-pos, and
     below 768px reads --cine-pos-sm when it is set. */
  const posVars = {
    "--cine-pos": imagePosition,
    ...(imageMobilePosition ? { "--cine-pos-sm": imageMobilePosition } : {}),
  } as React.CSSProperties;

  let photograph: React.ReactNode = null;
  if (image && imageMobile) {
    const common = { alt: "", fill: true, sizes } as const;
    const { props: wide } = getImageProps({ ...common, src: image });
    const { props: tall } = getImageProps({ ...common, src: imageMobile, priority });
    const { style: fillStyle, ...rest } = tall;
    /* One <source> and then the <img>, not two <source>s: the img already
       carries the mobile srcSet, so the phone case needs no media query and
       a browser without <picture> still gets a photograph. */
    photograph = (
      <picture>
        <source media="(min-width: 768px)" srcSet={wide.srcSet} sizes={sizes} />
        {/* A bare <img>, and deliberately: <picture> is how art direction is
            done, and both of its sources came from `getImageProps`, so the
            files are still optimised and still served by Next. The alt is in
            `rest` — empty, because the photograph is decoration — and the
            rule below cannot see through the spread to find it. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt:"" is in `rest` */}
        <img
          {...rest}
          className={cn("c-cine-img", mirrored && "c-cine-mirror")}
          style={{ ...fillStyle, ...posVars }}
        />
      </picture>
    );
  } else if (image) {
    photograph = (
      <Image
        src={image}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className={cn("c-cine-img", mirrored && "c-cine-mirror")}
        style={posVars}
      />
    );
  }

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {photograph ?? (
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
