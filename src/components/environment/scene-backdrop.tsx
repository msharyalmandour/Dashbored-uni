"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { sceneFor, type Scene } from "@/lib/scene";

/**
 * The scene of the route you are on, for anything that needs to know.
 *
 * Deliberately not a context. The scene is a pure function of the path, and a
 * provider would add a tree, a subscription and a chance of two components
 * disagreeing in exchange for nothing — `usePathname` is already the
 * subscription.
 */
export function useScene(): Scene {
  return sceneFor(usePathname() ?? "/");
}

/**
 * The layers that turn a photograph into a room.
 *
 * Painted in this order, and the order is the whole design:
 *
 *   1. **Grade** — the wash that pulls the picture toward this scene's hour.
 *   2. **Depth** — pushes the image back so panels read as nearer.
 *   3. **Vignette** — dark at the edges, which is what keeps the eye centred.
 *   4. **Scrim** — the contrast floor, and the only layer allowed to be heavy.
 *   5. **Key light** — last, and above the scrim on purpose.
 *
 * Five above four is the one non-obvious call here. Underneath the scrim a
 * light source is crushed by the very layer that protects the text, and the
 * scene ends up with no light in it — six scenes that differ only in how dark
 * they are. Above it, the key is visible and the room has a direction. It is
 * also then the one layer that can undo the contrast floor, which is why
 * scripts/verify-scene.ts composites it last, at its peak alpha, over the real
 * photograph, for every scene.
 */
function Layers({ scene }: { scene: Scene }) {
  return (
    <div data-scene={scene} className="absolute inset-0">
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-grade)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-depth)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-vignette)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-scrim)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-key)" }} />
      {/* 6. **Trails** — the light itself, and only on `command`, where there
             is no photograph for the other layers to act on. Above the key for
             the same reason the key is above the scrim: it is a light source,
             and a source under the floor that protects text is a source you
             have darkened out of existence. `none` everywhere else. */}
      <div className="absolute inset-0" style={{ backgroundImage: "var(--env-trails)" }} />
    </div>
  );
}

export function SceneBackdrop() {
  const scene = useScene();

  /**
   * Crossing from one room into another.
   *
   * Swapping the layer stack outright is a hard cut: the whole screen changes
   * brightness in one frame, which reads as a theme switching rather than as a
   * place changing. So the outgoing stack stays mounted underneath at full
   * strength while the incoming one fades in over it.
   *
   * Over, rather than instead of, because both stacks are darkening washes: a
   * new one fading in from nothing would briefly leave *less* protection than
   * either scene declares, and text on the picture would flash unreadable
   * mid-navigation. Stacked, the floor during the crossing is never lower than
   * the darker of the two scenes.
   */
  const [previous, setPrevious] = React.useState<Scene | null>(null);
  const lastScene = React.useRef(scene);

  React.useEffect(() => {
    if (lastScene.current === scene) return;
    setPrevious(lastScene.current);
    lastScene.current = scene;
    const t = setTimeout(() => setPrevious(null), 600);
    return () => clearTimeout(t);
  }, [scene]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* No photograph, in any scene. See SCENE_IMAGE in src/lib/scene.ts:
          every entry is null, the trails below are the picture, and the
          2560px JPEG has left the critical path of all twenty-three routes. */}

      {previous && <Layers scene={previous} />}
      <div key={scene} className="scene-in absolute inset-0">
        <Layers scene={scene} />
      </div>

      {/* The one thing that moves. A very slow, very faint brightening drifting
          across the canopy, so the environment is alive without ever being
          something you catch moving. It collapses entirely under
          prefers-reduced-motion — see globals.css. */}
      <div className="env-breathe absolute inset-0" />
    </div>
  );
}
