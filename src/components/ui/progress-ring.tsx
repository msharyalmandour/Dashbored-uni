"use client";

import * as React from "react";

/**
 * A number drawn as an arc.
 *
 * IT CARRIES ITS OWN LABEL. A ring with "٧٢" inside it and nothing else is the
 * bug this project has hit twice — a figure with no unit reads as whatever the
 * person expects, and on one screen "49" meant pages LEFT while it looked like
 * pages done. So `label` is required, not optional.
 *
 * `role="img"` with the label in `aria-label`: the arc is a picture of a
 * number, and a screen reader should say the number once, not read a cluster
 * of SVG nodes.
 */
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  animate = true,
}: {
  /** 0–100. Clamped, because a stale count can exceed its total. */
  value: number;
  size?: number;
  stroke?: number;
  /** What the number IS. Required on purpose. */
  label: string;
  sublabel?: string;
  animate?: boolean;
}) {
  const uid = React.useId().replace(/:/g, "");
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      role="img"
      aria-label={`${Math.round(pct)}٪ — ${label}`}
      style={{ position: "relative", width: size, height: size }}
    >
      <svg width={size} height={size} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFB347" />
            <stop offset="1" stopColor="#FF6A00" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,235,210,0.14)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g-${uid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={
            animate
              ? {
                  transition: "stroke-dashoffset var(--dur-hero) var(--ease-out)",
                }
              : undefined
          }
        />
      </svg>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <span
          className="t-figure"
          style={{ fontSize: size * 0.28, fontWeight: 700, lineHeight: 1, color: "var(--cream)" }}
        >
          {Math.round(pct)}
          <span style={{ fontSize: size * 0.15 }}>٪</span>
        </span>
        <span style={{ fontSize: 11, color: "var(--sec)", textAlign: "center" }}>
          {sublabel ?? label}
        </span>
      </div>
    </div>
  );
}

/** The tutor, as a warm body of light. Decorative: it says nothing. */
export function TutorOrb({ size = 56, floaty = false }: { size?: number; floaty?: boolean }) {
  return (
    <span
      aria-hidden
      className={floaty ? "c-floaty" : undefined}
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 40% 30%, #FFE2B0, #FF8A00 45%, #6A1E00 90%)",
        boxShadow: `0 0 ${size * 0.5}px rgba(255,138,0,0.45)`,
      }}
    />
  );
}
