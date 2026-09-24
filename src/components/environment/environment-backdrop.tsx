import { SceneBackdrop } from "@/components/environment/scene-backdrop";

/**
 * The environment the interface lives inside.
 *
 * Not a background image. The difference is that a background sits behind a
 * design and could be swapped for a flat colour without anything else
 * changing; this is the ground every surface above it is made to relate to —
 * the glass borrows its colour and the spacing exists so you can see through
 * to it.
 *
 * It used to be a photograph of a forest, and this file's whole job was to
 * read a blur placeholder off disk so the first paint was the forest in
 * miniature rather than a black rectangle. There is no photograph now: the
 * identity is a black canvas with orange light trails, the trails are
 * gradients, and a gradient has no loading state to cover. So the server half
 * has nothing left to do, and what is left is the one line that says where the
 * environment is mounted.
 *
 * Everything about how the layers are built and why they are in that order
 * lives in scene-backdrop.tsx; everything about what each scene looks like
 * lives in THE SCENES in globals.css.
 */
export function EnvironmentBackdrop() {
  return <SceneBackdrop />;
}
