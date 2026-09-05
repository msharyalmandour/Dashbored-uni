import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Animates opacity only (GPU-friendly, no layout or
 * paint thrash) and is neutralised by the global prefers-reduced-motion
 * guard in globals.css, so it never becomes a distraction.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  // Foreground-derived rather than `bg-muted`: placeholders sit on both the
  // app background and on lighter card surfaces, and a fixed muted fill
  // disappears against the latter.
  return <div className={cn("animate-pulse rounded-md bg-foreground/12", className)} {...props} />;
}

export { Skeleton };
