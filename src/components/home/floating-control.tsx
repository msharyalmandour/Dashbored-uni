import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One of the four ways out of Home.
 *
 * Spatial rather than navigational: it floats in the environment at a size
 * that says "over there if you need it", not "here is a menu". That is why it
 * carries a count only when there is something to count — a control that
 * always shows a number is a badge, and a badge always showing zero is noise
 * a student learns to stop seeing.
 *
 * Quiet glass, never the full material. The heavy glass is spent on the one
 * surface that matters on this page, and if everything is made of the same
 * thick material nothing reads as more important than anything else.
 */
export function FloatingControl({
  href,
  icon: Icon,
  label,
  count,
  className,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Shown only when there is genuinely something waiting. */
  count?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "glass-quiet group flex items-center gap-2.5 rounded-full px-4 py-2.5",
        // `.on-env` rather than a foreground token: these sit on quiet glass
        // over a photograph, and at /85 on bark they rendered as pills with no
        // words in them — which is what the first screenshot showed.
        "on-env text-sm font-medium transition-all duration-300",
        "hover:brightness-125",
        // Lifts towards the reader on hover rather than growing: a control
        // that scales up in a composition this open reads as jumpy.
        "hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className
      )}
    >
      <Icon className="size-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
      <span className="whitespace-nowrap">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-primary-foreground/90 ring-1 ring-primary/30">
          {count}
        </span>
      )}
    </Link>
  );
}
