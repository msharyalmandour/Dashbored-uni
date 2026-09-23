import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A card whose ground is a photograph.
 *
 * The reference art gets its weight from four layers, in this order: a
 * photograph, a gradient that darkens the side the words sit on, one warm
 * light off-frame, and the content. Any one of them alone is a flat card with
 * a picture behind it.
 *
 * This is that stack, extracted from ProgressCard — which had been the only
 * place in the app that did it — so the dashboard has ONE image card rather
 * than one per author. Everything it paints comes from the theme tokens, not
 * from hardcoded hex, so it follows the surface ramp instead of drifting from
 * it the first time the ramp moves.
 *
 * WHAT IT WILL NOT DO is invent the number in the middle. ProgressCard's own
 * comment settled this for the app already: the reference art shows a metric,
 * and where this product does not measure that thing, showing it would be
 * presenting fiction as data. So `value` is required and the caller has to
 * have one; there is no default, no placeholder, and no "—" dressed up as a
 * reading.
 */
export type ImageFeatureCardProps = {
  /** The photograph. A real file in /public, never a remote guess. */
  image: string;
  /** Sits above everything. Short. */
  label: string;
  /**
   * The measured figure. Required: see the note above.
   *
   * A node, not a string, so a caller with a composed value can hand over its
   * parts. "1س 25د" as one string is a mixed-direction run and the bidi
   * algorithm reorders it — three attempts at fixing that with dir and
   * unicode-bidi each produced a differently wrong arrangement in the browser.
   * Laid out as elements, the order is flexbox's and nothing can reorder it.
   */
  value: React.ReactNode;
  /** What the figure is of — the period, the unit, the qualifier. */
  caption?: string;
  /** Makes the whole card the target. Omitted, it is not interactive. */
  href?: string;
  /**
   * Which edge the gradient weights toward.
   *
   * "bottom" for a portrait-ish card where the copy stacks at the foot;
   * "start" for a wide one where the copy sits on the leading edge and the
   * photograph keeps the trailing half. "start", not "left", because this app
   * is read in Arabic as often as in English and a gradient that always eats
   * the left side puts the scrim behind the photo in RTL.
   */
  weight?: "bottom" | "start";
  className?: string;
  children?: React.ReactNode;
};

export function ImageFeatureCard({
  image,
  label,
  value,
  caption,
  href,
  weight = "bottom",
  className,
  children,
}: ImageFeatureCardProps) {
  const body = (
    <>
      <Image
        src={image}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 420px"
        /* No hover scale. The app's panels already answer the pointer with a
           tilt, and a photograph that also grows underneath reads as two
           different ideas about what a card is. */
        className="pointer-events-none object-cover"
      />

      {/* The scrim. Logical direction, so RTL darkens the side the words are
          actually on. `from-surface-primary` rather than a black: the card has
          to end up the same colour as the panels beside it or it reads as a
          cut-out. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          /* The top stop is 35%, not 10%. At 10% the photograph arrived at
             essentially full brightness and the top half of the card lit up
             against a page whose whole point is that it is dark — rendered and
             looked at, not reasoned about. 35% still reads unmistakably as a
             photograph and stops it shouting. */
          weight === "bottom"
            ? "bg-gradient-to-t from-surface-primary via-surface-primary/85 to-surface-primary/35"
            : /* Tailwind has no logical gradient direction — `to-s` compiles to
                 nothing at all, silently, which I shipped for about a minute
                 before checking whether the class existed. The rtl: variant is
                 the real way to say "the side the reading starts on". */
              "bg-gradient-to-r from-surface-primary via-surface-primary/85 to-surface-primary/30 rtl:bg-gradient-to-l"
        )}
      />

      {/* One warm light, off the top trailing corner, the way a lamp sits just
          outside a photograph. Tokenised, so it is the same orange as the rest
          of the identity and moves with it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -end-16 size-44 rounded-full bg-[var(--glow-primary-strong)] blur-3xl"
      />

      <div className="relative flex h-full flex-col justify-end gap-3 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {/* An INLINE row inside a normal block.
          
              dir="ltr" fixes the ORDER of the parts — a measurement reads left
              to right in both languages, the call focus-now.tsx already made
              for the running timer. But a BLOCK carrying that dir also takes
              the full width and aligns itself by its own direction, so in
              Arabic the figure left the text column and sat against the far
              edge while its own label stayed on the other side. Inline, it
              flows to whichever edge the parent starts at, and only the order
              inside it is forced. Both halves of this were wrong once each,
              in the browser, before they were right. */}
          <p className="mt-1">
            <span
              dir="ltr"
              className="font-display inline-flex items-baseline gap-1 text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums"
            >
              {value}
            </span>
          </p>
          {caption && <p className="mt-1.5 text-xs text-foreground/70">{caption}</p>}
        </div>
        {children}
      </div>
    </>
  );

  const shell = cn(
    "relative isolate flex min-h-[220px] flex-col overflow-hidden rounded-xl border border-border-subtle",
    href &&
      "transition-colors duration-200 hover:border-border-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
