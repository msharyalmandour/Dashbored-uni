"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Makes a panel occupy space.
 *
 * A card that lifts straight up under the cursor is still a flat thing moving.
 * One that tilts has a near corner and a far one, and the eye reads that as an
 * object rather than a rectangle — which is the whole difference between "a
 * dark box" and something that looks made of a material.
 *
 * The maths is deliberately small: where the pointer is within the element, in
 * -1..1 on each axis, scaled to a few degrees. More than about six and it stops
 * looking like a solid object and starts looking like a card trick.
 *
 * Two things keep this cheap. The rotation is written to CSS custom properties
 * and the transform itself lives in the stylesheet, so React never re-renders
 * on pointer movement — the browser composites it. And it is skipped entirely
 * for anyone who cannot use a pointer or has asked for less motion: on a
 * touchscreen there is no hover to respond to, so the work would be spent on a
 * tilt nobody triggers.
 */
export function Tilt({
  children,
  className,
  /** How far it leans, in degrees, at the very corner. */
  degrees = 5,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  degrees?: number;
  as?: "div" | "section" | "article";
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const enabled = useTiltAllowed();

  const onMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || !enabled) return;
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      // Y drives rotateX and is inverted: pushing the pointer down should tip
      // the far edge away, not towards.
      el.style.setProperty("--tilt-x", `${(-y * degrees).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * degrees).toFixed(2)}deg`);
    },
    [degrees, enabled]
  );

  const reset = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn("panel panel-3d", className)}
    >
      {children}
    </Tag>
  );
}

/**
 * Whether a tilt is wanted here at all.
 *
 * `matchMedia` is state that lives outside React, so it is read with
 * `useSyncExternalStore` rather than copied into `useState` from an effect —
 * the effect version renders once with the wrong answer, then again with the
 * right one, and subscribes to nothing, so it never notices a person turning
 * reduced-motion on while the page is open.
 *
 * The server snapshot is `false`: no pointer has been proven to exist during
 * a render on a server, and a tilt that is off is a still card rather than a
 * broken one.
 */
function useTiltAllowed(): boolean {
  const subscribe = React.useCallback((onChange: () => void) => {
    const queries = [
      window.matchMedia("(hover: hover) and (pointer: fine)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    ];
    queries.forEach((q) => q.addEventListener("change", onChange));
    return () => queries.forEach((q) => q.removeEventListener("change", onChange));
  }, []);

  return React.useSyncExternalStore(
    subscribe,
    () =>
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}
