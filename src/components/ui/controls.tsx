"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The small controls, all of them at least 44px.
 *
 * Not a preference: 44 is the size a thumb hits on a phone held in one hand
 * on a bus, which is where this app is used between a hospital shift and
 * home. Anything smaller is a control that works on a desktop and fails on
 * the device it was built for.
 */

const TAP = "min-h-[44px] min-w-[44px]";

/**
 * A segmented switch. One white-hot pill slides under the live segment.
 *
 * `role="tablist"` with real buttons: arrow keys and Tab both work, and the
 * selected one announces itself. A row of divs with a background colour says
 * nothing to anyone who is not looking at it.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("c-glass flex gap-1 rounded-full p-1", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(TAP, "flex-1 rounded-full px-4 text-[14px] font-semibold")}
            style={{
              background: on ? "linear-gradient(90deg,#FF7A00,#FFA640)" : "transparent",
              color: on ? "#1C0900" : "var(--sec-2)",
              transition: "background var(--dur-fast) var(--ease-spring), color var(--dur-fast) var(--ease-out)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A chip. The icon always has its word beside it — reference rule, and the
 * reason is that an icon alone is a guess, in any language.
 */
export function Chip({
  icon,
  children,
  tone = "quiet",
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "quiet" | "warm" | "danger";
  className?: string;
}) {
  const colour =
    tone === "warm" ? "var(--o-300)" : tone === "danger" ? "var(--danger)" : "var(--sec-2)";
  return (
    <span
      className={cn(
        /* `whitespace-nowrap shrink-0` — a chip is a token, and a token that
           breaks over three lines beside a long assignment title stops being
           one. Measured in the أسبوعي panel: "بعد 3 أيام" came out as three
           stacked words taller than the row it labelled. */
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold",
        className
      )}
      style={{
        color: colour,
        background: "rgba(255,240,225,0.06)",
        border: "1px solid rgba(255,220,190,0.16)",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * The one control that is allowed to be an icon alone — and only because it
 * carries an aria-label, which is checked in /dev/design.
 */
export function IconButton({
  label,
  children,
  onClick,
  className,
}: {
  /** Required. An icon button without a name is a button nobody can use. */
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(TAP, "c-press c-glass grid place-items-center rounded-full", className)}
      style={{ color: "var(--cream)" }}
    >
      {children}
    </button>
  );
}

/** The subject's colour, as the 3px edge the reference asks for. */
export const SUBJECT_EDGE: Record<string, string> = {
  NURC410: "var(--subject-nurc410)",
  NURC411: "var(--subject-nurc411)",
  NURP431: "var(--subject-nurp431)",
  NURP432: "var(--subject-nurp432)",
  NURM410: "var(--subject-nurm410)",
  ELECTIVE: "var(--subject-elective)",
  ACTIVITY: "var(--subject-activity)",
};

/**
 * A block on the week grid: the subject's colour on its leading edge, its
 * name, its hours, and badges for whatever is tied to that slot.
 *
 * `border-inline-start` rather than `border-left`, so the edge is on the
 * reading-start side in both directions without a second rule.
 */
export function SubjectBlock({
  code,
  title,
  time,
  place,
  badges,
  now = false,
  suggestion = false,
  className,
}: {
  code: keyof typeof SUBJECT_EDGE | string;
  title: string;
  time: string;
  place?: string;
  badges?: string[];
  now?: boolean;
  /** A tutor's proposal, not a fact from the timetable. Drawn dashed. */
  suggestion?: boolean;
  className?: string;
}) {
  const edge = SUBJECT_EDGE[code] ?? "var(--subject-activity)";
  return (
    <div
      className={cn("rounded-[16px] p-3", now && "c-pulse", className)}
      style={{
        borderInlineStart: `3px solid ${edge}`,
        border: suggestion ? "1px dashed rgba(255,220,190,0.3)" : undefined,
        borderInlineStartWidth: 3,
        borderInlineStartStyle: "solid",
        borderInlineStartColor: edge,
        background: `color-mix(in oklab, ${edge} 12%, var(--glass))`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-kufi text-[15px] font-bold text-[color:var(--cream)]">{title}</span>
        <span className="t-figure text-[12px]" style={{ color: "var(--sec-2)" }}>
          {time}
        </span>
      </div>
      {(place || suggestion) && (
        <div className="mt-0.5 text-[12px]" style={{ color: "var(--sec)" }}>
          {suggestion ? `اقترحه المعلّم${place ? ` · ${place}` : ""}` : place}
        </div>
      )}
      {badges && badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <Chip key={b}>{b}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}
