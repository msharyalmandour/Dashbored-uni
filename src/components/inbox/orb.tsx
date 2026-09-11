"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * What the orb is currently doing.
 *
 * Six states rather than four, because "processing" was hiding three
 * genuinely different moments from the student: hearing them, working out
 * what they gave it, and carrying out the result. Those feel different to
 * live through and now look different.
 *
 * `drag` is kept as the name for LISTENING — a file held over the orb and a
 * held microphone are the same moment from the orb's side: something is being
 * offered and it is paying attention.
 */
export type OrbState =
  /** Nothing being asked of it. Breathing, drifting, waiting. */
  | "idle"
  /** Something is being offered — a file held over it, a voice speaking. */
  | "drag"
  /** Reading what it was given. Light gathers inward. */
  | "understanding"
  /** Carrying out what it decided. Energy crosses the sphere. */
  | "processing"
  /** Finished. One ripple out, then stillness. */
  | "done"
  /** It could not. A single controlled wobble, never an alarm. */
  | "error";

/**
 * The Drop Anything orb — a living AI object, not an upload box.
 *
 * Built as a canvas of moving liquid under a glass shell, rather than a HUD of
 * concentric rings. The interior is genuinely organic: overlapping fields of
 * blue, cyan and violet drifting on unrelated slow cycles, so the pattern
 * never repeats and never reads as a loop.
 *
 * The liquid is rendered into a small buffer and scaled up by the browser.
 * That is the whole trick: the upscale supplies the smooth blur for free,
 * where a real blur filter over a full-size canvas would cost far more per
 * frame than this entire component. It is also why the orb can drift, breathe
 * and sweep light at the same time without the page feeling heavy.
 *
 * Nothing here sits on a plate. The halo is the only thing behind the sphere,
 * and it fades to nothing well before any edge, so the orb floats in the
 * existing interface rather than arriving with its own background.
 *
 * The sphere carries no text. Words laid over moving liquid have to fight it,
 * and the fight is settled by dimming the liquid — which spends the whole
 * effect to buy legibility that reads better underneath anyway.
 *
 * Under prefers-reduced-motion the CSS animations collapse and the canvas
 * paints one still frame instead of running a loop nobody asked for.
 */
export function Orb({
  state,
  onActivate,
  className,
}: {
  state: OrbState;
  onActivate?: () => void;
  className?: string;
}) {
  const [ripples, setRipples] = React.useState<number[]>([]);
  const [hovered, setHovered] = React.useState(false);
  const shellRef = React.useRef<HTMLButtonElement>(null);

  // Where the cursor is over the sphere, in -1..1 on each axis. The liquid
  // leans towards it and the specular follows it, which is what makes the
  // glass feel like a surface being looked at rather than a picture.
  const pointer = React.useRef({ x: 0, y: 0 });
  const [specular, setSpecular] = React.useState({ x: 32, y: 24 });

  // The interior runs hot while anything is happening to it. Hover counts:
  // the liquid leaning towards a cursor is what makes the glass feel looked at.
  const energetic =
    state === "processing" || state === "understanding" || state === "drag" || hovered;

  /**
   * The motion for the state, as a class the stylesheet owns.
   *
   * Kept as a lookup rather than a chain of conditionals in the JSX so that
   * adding a state is one line here and one keyframe there — and so the
   * mapping from meaning to movement can be read in one place.
   */
  const STATE_MOTION: Record<OrbState, string> = {
    idle: "",
    drag: "orb-state-listening",
    understanding: "orb-state-understanding",
    processing: "",
    done: "orb-state-completed",
    error: "orb-state-error",
  };

  function emitRipple() {
    const id = Date.now();
    setRipples((r) => [...r, id]);
    // Cleared on a timer rather than animationend: ripples overlap, and the
    // element that finishes is not necessarily the one an event fires from.
    window.setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 1300);
  }

  function trackPointer(event: React.PointerEvent<HTMLButtonElement>) {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointer.current = { x, y };
    // The highlight moves a fraction of the cursor's travel — a specular that
    // tracks one-to-one reads as a sticker, not a reflection.
    setSpecular({ x: 32 + x * 13, y: 24 + y * 11 });
  }

  return (
    <div className={cn("relative isolate flex items-center justify-center", className)}>
      <div
        aria-hidden
        className={cn(
          "orb-halo orb-float pointer-events-none absolute -inset-[26%] transition-opacity duration-700",
          energetic ? "opacity-100" : "opacity-75"
        )}
      />

      <button
        ref={shellRef}
        type="button"
        onClick={() => {
          emitRipple();
          onActivate?.();
        }}
        onPointerMove={trackPointer}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false);
          pointer.current = { x: 0, y: 0 };
          setSpecular({ x: 32, y: 24 });
        }}
        disabled={state === "processing" || state === "understanding"}
        className={cn(
          "orb-float group relative aspect-square w-[min(78vw,25rem)] rounded-full",
          "transition-transform duration-500 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
          state === "drag" && "scale-[1.05]",
          state !== "processing" && state !== "understanding" && "hover:scale-[1.025]",
          energetic && "orb-active",
          STATE_MOTION[state]
        )}
      >
        {/* The liquid. Clipped to the sphere and sitting under every glass
            layer, so the shell reads as something the light is trapped in. */}
        <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
          <LiquidField energetic={energetic} pointer={pointer} />
        </span>

        {/* Glass. The specular is an inline gradient because it follows the
            cursor; everything else about the shell is in the stylesheet. */}
        <span
          aria-hidden
          className="orb-shell absolute inset-0 rounded-full"
          style={{
            backgroundImage: `radial-gradient(58% 52% at ${specular.x}% ${specular.y}%, oklch(98% 0.02 220 / 32%) 0%, transparent 62%), radial-gradient(circle closest-side, transparent 58%, oklch(17% 0.04 200 / 36%) 88%, oklch(12% 0.035 205 / 64%) 100%)`,
            transition: "background-image 380ms ease-out",
          }}
        />
        <span aria-hidden className="orb-rim absolute inset-0 rounded-full" />
        <span aria-hidden className="orb-sweep orb-sweep-light absolute inset-0 rounded-full opacity-70" />

        {/* ACTING: a band of light crossing the sphere and leaving the far
            side. Directional on purpose — this state means something is being
            carried somewhere, where a symmetric pulse would only mean "busy".
            Clipped here rather than in the stylesheet so the band can overrun
            the sphere's own bounds and still be cut to its edge. */}
        {state === "processing" && (
          <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
            <span className="orb-current" />
          </span>
        )}

        {ripples.map((id) => (
          <span
            key={id}
            aria-hidden
            className="orb-ripple absolute inset-0 rounded-full border border-[oklch(85%_0.10_235_/_55%)]"
          />
        ))}

      </button>
    </div>
  );
}

/**
 * The moving interior.
 *
 * Six soft colour fields on unrelated periods, composited additively. Because
 * their cycles never line up, the pattern does not repeat — which is what
 * separates liquid from a looping animation you start to notice.
 *
 * Deliberately painted at a fraction of display size. The browser's upscale
 * is what makes it smooth, and it means the per-frame cost stays roughly flat
 * however large the orb is drawn.
 */
function LiquidField({
  energetic,
  pointer,
}: {
  energetic: boolean;
  pointer: React.RefObject<{ x: number; y: number }>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const energyRef = React.useRef(energetic);

  React.useEffect(() => {
    energyRef.current = energetic;
  }, [energetic]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The whole point of the low buffer: the upscale is the blur.
    const SIZE = 190;
    canvas.width = SIZE;
    canvas.height = SIZE;

    // rgb, not the oklch these tokens are written in: canvas gradients do not
    // parse oklch() in every engine, and a failed parse falls back to black —
    // an invisible field on a dark ground, with no error to notice.
    //
    // Ribbons rather than round blobs. Overlapping soft circles only ever
    // average into one bright pool; long, rotating, squashed ellipses cross
    // each other and leave the bright seams that read as liquid caught in
    // glass. `phase` spreads them apart at t=0 so the first frame is already
    // a composition rather than everything stacked in the middle.
    const ribbons = [
      // Tuned to the environment it now floats in. The interior used to run
      // blue and violet, which was fine over a near-black page and wrong the
      // moment there was a forest behind it: a cold blue sphere against green
      // trees reads as an object dropped onto the picture rather than
      // something made of the same light. These are the forest's own range —
      // deep teal, moss, and the pale green-white of light through a canopy —
      // with one cool blue kept so the sphere never turns into a leaf.
      { hue: "22, 104, 118", rx: 0.86, ry: 0.38, spin: 0.19, orbit: 0.46, ox: 0.055, phase: 0.0, a: 0.72 },
      { hue: "34, 152, 156", rx: 0.76, ry: 0.28, spin: -0.14, orbit: 0.5, ox: 0.079, phase: 1.9, a: 0.68 },
      { hue: "168, 240, 226", rx: 0.56, ry: 0.19, spin: 0.27, orbit: 0.48, ox: 0.113, phase: 3.4, a: 0.6 },
      { hue: "64, 150, 120", rx: 0.7, ry: 0.32, spin: -0.21, orbit: 0.47, ox: 0.061, phase: 4.7, a: 0.6 },
      { hue: "18, 78, 104", rx: 1.0, ry: 0.56, spin: 0.09, orbit: 0.34, ox: 0.037, phase: 2.6, a: 0.66 },
      { hue: "226, 252, 246", rx: 0.36, ry: 0.13, spin: 0.34, orbit: 0.52, ox: 0.149, phase: 5.6, a: 0.5 },
      { hue: "40, 186, 198", rx: 0.62, ry: 0.24, spin: -0.3, orbit: 0.44, ox: 0.095, phase: 0.9, a: 0.55 },
    ];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let t = 0;
    let last = performance.now();
    let visible = true;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);

    function paint() {
      if (!ctx) return;
      const c = SIZE / 2;

      // A deep base so the blobs have something to glow inside of.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgb(14, 22, 52)";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Additive: where ribbons cross they brighten, which is what gives the
      // interior its molten seams instead of muddy layering.
      ctx.globalCompositeOperation = "lighter";

      const lean = pointer.current ?? { x: 0, y: 0 };

      for (const b of ribbons) {
        const angle = b.phase + t * b.ox;
        const x = c + Math.cos(angle) * b.orbit * c + lean.x * 0.13 * c;
        const y = c + Math.sin(angle * 1.31) * b.orbit * c + lean.y * 0.13 * c;
        const rotation = b.phase + t * b.spin;
        // Each ribbon also swells and thins as it turns, so none of them reads
        // as a rigid shape being rotated.
        const rx = b.rx * c * (1 + Math.sin(t * b.ox * 2.1 + b.phase) * 0.16);
        const ry = b.ry * c * (1 + Math.cos(t * b.ox * 1.6 + b.phase) * 0.3);

        // Drawn in the ribbon's own space: translate, rotate, then scale, so a
        // unit circle becomes the ellipse and a radial gradient inside it
        // falls to zero exactly at its edge. A gradient painted in page space
        // gets clipped by the ellipse boundary instead, leaving the hard arcs
        // that stop this reading as liquid.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(rx, ry);

        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `rgba(${b.hue}, ${b.a})`);
        g.addColorStop(0.42, `rgba(${b.hue}, ${b.a * 0.62})`);
        g.addColorStop(0.75, `rgba(${b.hue}, ${b.a * 0.2})`);
        g.addColorStop(1, `rgba(${b.hue}, 0)`);
        ctx.fillStyle = g;

        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = "source-over";
    }

    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible) {
        t += dt * (energyRef.current ? 3.4 : 1);
        paint();
      }
      frame = requestAnimationFrame(loop);
    }

    if (reduced.matches) {
      paint();
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, [pointer]);

  // `size-full` is load-bearing: a canvas is a replaced element, so `inset-0`
  // alone leaves it at its intrinsic 300x150 and the field draws into a small
  // box in the corner instead of filling the sphere.
  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}
