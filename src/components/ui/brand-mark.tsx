"use client";

import * as React from "react";

/**
 * The mark: a page falling, and a glowing smile underneath that catches it.
 *
 * That is the whole product in one drawing — «ارمِ كل شي هنا» and «وخلّ الباقي
 * علينا» — so it is drawn rather than lettered, and it reads at 24px on a
 * mobile tab bar as well as at 64px on the drop button.
 *
 * `useId` ON EVERY GRADIENT, and it is not fussiness: three variants of this
 * mark can be on one screen at once (the sidebar, the drop button, a card),
 * and SVG gradient ids are global to the document. Hard-coded ids mean the
 * last one mounted silently repaints the others.
 */
export function BrandMark({
  size = 48,
  variant = "dark",
  className,
}: {
  size?: number;
  /** dark: on the ground · fill: the orange tile · mono: ink only. */
  variant?: "dark" | "fill" | "mono";
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  const p = `p-${uid}`;
  const k = `k-${uid}`;
  const bg = `bg-${uid}`;

  /* On the filled tile the ink goes dark, because cream on orange is 2.1:1. */
  const ink = variant === "fill" ? "#1C0900" : "#F5EDE4";

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id={p} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFE2B0" />
          <stop offset=".4" stopColor="#FF9A2A" />
          <stop offset="1" stopColor="#FF6A00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={k} x1="0" x2="1">
          <stop offset="0" stopColor="#FF6A00" />
          <stop offset=".5" stopColor="#FFC27A" />
          <stop offset="1" stopColor="#FF6A00" />
        </linearGradient>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB347" />
          <stop offset="1" stopColor="#FF6A00" />
        </linearGradient>
      </defs>

      {variant === "fill" ? (
        <rect width="48" height="48" rx="14" fill={`url(#${bg})`} />
      ) : variant === "dark" ? (
        <>
          <rect width="48" height="48" rx="14" fill="#140D09" />
          <rect
            x=".5"
            y=".5"
            width="47"
            height="47"
            rx="13.5"
            fill="none"
            stroke="rgba(255,170,90,.35)"
          />
        </>
      ) : null}

      {/* The glow that catches the page. Absent on the filled tile, where the
          tile is already the light. */}
      {variant !== "fill" && (
        <ellipse cx="24" cy="36" rx="13" ry="4" fill={`url(#${p})`} opacity=".9" />
      )}

      <g transform="rotate(-9 24 17)">
        <rect x="17" y="7" width="14" height="18" rx="3" fill="none" stroke={ink} strokeWidth="2.2" />
        <path
          d="M24 11.5v8M21 16.8l3 3 3-3"
          fill="none"
          stroke={ink}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M11 29.5Q24 41 37 29.5"
        fill="none"
        stroke={variant === "fill" ? ink : `url(#${k})`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
