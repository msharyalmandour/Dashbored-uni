import { cn } from "@/lib/utils";

/**
 * University OS's own way of saying it is working.
 *
 * A thin stream of light travels, bends, and closes into a ring — one shape
 * doing one continuous thing. That continuity is the whole idea: a spinner
 * says "a computer is busy and cannot tell you more", three dots say the same
 * with less dignity, and a progress bar promises a percentage this system
 * usually does not honestly have. A stream that becomes a ring says something
 * is being drawn together, which is what is actually happening.
 *
 * It is also meant to be recognised. Used in the same form everywhere the
 * system is thinking and no orb is on screen, it becomes the product's
 * handwriting rather than a widget borrowed from a library.
 *
 * Pure SVG and CSS: no canvas, no library, no per-frame JavaScript. Under
 * prefers-reduced-motion the stroke resolves to its finished state and simply
 * stays there — see globals.css.
 */
export function SignatureLoader({
  size = 48,
  className,
  label,
}: {
  size?: number;
  className?: string;
  /**
   * What is being waited for, for anyone who cannot see the animation.
   * Required in spirit: a loader that announces nothing is a loader that
   * leaves a screen-reader user in silence.
   */
  label: string;
}) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
        <defs>
          <linearGradient id="uos-signature" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(88% 0.10 190)" stopOpacity="0.2" />
            <stop offset="55%" stopColor="oklch(92% 0.11 188)" />
            <stop offset="100%" stopColor="oklch(74% 0.12 210)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* The stream: enters low and left, bends through the middle, and
            curls into the circle it is about to become. */}
        <path
          className="signature-stream"
          d="M6 78 C 26 84, 34 56, 50 50 C 66 44, 80 52, 82 50 A 32 32 0 1 1 50 18"
          stroke="url(#uos-signature)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* What it gathers into. Arrives late, which is what makes the stream
            read as the cause of it. */}
        <circle
          className="signature-gather"
          cx="50"
          cy="50"
          r="15"
          fill="oklch(88% 0.09 192 / 22%)"
          stroke="oklch(92% 0.10 190 / 55%)"
          strokeWidth="1"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
