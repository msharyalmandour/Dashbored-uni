import * as React from "react";
import { ContentText } from "@/components/ui/content-text";
import { TtSection } from "@/components/shared/tt";
import { layout, type Step } from "@/lib/summary";

/**
 * A lecture's summary, and the chain drawn from it.
 *
 * ── WHY BOTH LAYOUTS ARE IN THE MARKUP ──────────────────────────────────────
 *
 * `layout()` decides between a row and a column from the width available, and
 * on the server there is no width to ask. The three ways out, and why only one
 * survives this project's own rule that a diagram must never clip:
 *
 *   ONE viewBox, scaled by CSS — the row shrinks to fit a phone, and shrinking
 *     is exactly what verify-summary.ts forbids: the Arabic inside the boxes
 *     stops being readable and nothing in a diff shows it.
 *   MEASURE IN THE BROWSER — correct, and costs a client component plus a
 *     frame where the summary is not there. For a drawing of at most seven
 *     boxes that is a bad trade.
 *   BOTH, AND LET CSS CHOOSE — what this does. Duplicate markup for up to
 *     seven boxes, and the breakpoint is DERIVED rather than guessed: the row
 *     is laid out at no limit, its natural width is measured, and the media
 *     query switches at exactly that width plus the page's gutter.
 *
 * So the diagram is server-rendered, needs no JavaScript, and is the same
 * geometry the tests check — because it is the same function.
 */

/** The page's own side padding, so the breakpoint accounts for the gutter. */
const GUTTER = 32;

export function LectureSummaryView({
  idea,
  chain,
  points,
  labels,
}: {
  idea: string;
  chain: string[];
  points: { heading: string; body: string }[];
  /** Section headings, already in the reader's language. */
  labels: { summary: string; chain: string; mustKnow: string };
}) {
  const steps: Step[] = chain.map((label) => ({ label }));

  /* Laid out twice at two deliberate widths: once unconstrained, which always
     returns the row, and once at a phone, which always returns the column for
     anything that did not already fit. */
  const row = layout(steps, Number.POSITIVE_INFINITY);
  const column = layout(steps, 360);
  const switchAt = Math.ceil(row.width + GUTTER);

  /* A unique-enough class so two summaries on one page cannot share a
     breakpoint. Derived from the content rather than random, so the markup is
     stable between renders and the server and client agree. */
  const key = `cs${switchAt}-${steps.length}`;

  return (
    <TtSection title={labels.summary}>
      <div className="py-3.5">
        <p className="text-[15px] leading-relaxed">
          <ContentText>{idea}</ContentText>
        </p>

        {steps.length > 0 && (
          <figure className="mt-5 mb-1" aria-label={labels.chain}>
            {/* The row and the column, one of which is hidden. `aria-hidden`
                is on neither: the hidden one is display:none, which already
                takes it out of the accessibility tree, and marking the visible
                one would hide the diagram from a screen reader entirely. */}
            <style>{`
              .${key}-row{display:none}
              .${key}-col{display:block}
              @media (min-width:${switchAt}px){
                .${key}-row{display:block}
                .${key}-col{display:none}
              }
            `}</style>
            <div className={`${key}-row`}>
              <ChainSvg drawing={row} />
            </div>
            <div className={`${key}-col`}>
              <ChainSvg drawing={column} />
            </div>
            <figcaption className="sr-only">
              {chain.join(" → ")}
            </figcaption>
          </figure>
        )}

        {points.length > 0 && (
          <>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.mustKnow}
            </p>
            <ol className="mt-2 grid gap-2.5">
              {points.map((p, i) => (
                <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
                  <span className="tt-latin mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <b className="block text-sm font-semibold">
                      <ContentText>{p.heading}</ContentText>
                    </b>
                    <span className="block text-sm text-muted-foreground">
                      <ContentText>{p.body}</ContentText>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </TtSection>
  );
}

/**
 * One drawing, as SVG.
 *
 * Every colour comes from a theme token, never a literal, because a drawing
 * whose stroke is `#18242f` is invisible on the dark ground — and that is a
 * failure nobody sees until a student opens it at night. `currentColor` is
 * used where the surrounding text's colour is already right.
 */
function ChainSvg({ drawing }: { drawing: ReturnType<typeof layout> }) {
  if (drawing.boxes.length === 0) return null;
  const head = 5;

  return (
    <svg
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      width={drawing.width}
      height={drawing.height}
      className="h-auto max-w-full"
      role="img"
    >
      <defs>
        <marker
          id="arrow"
          viewBox={`0 0 ${head * 2} ${head * 2}`}
          refX={head * 2}
          refY={head}
          markerWidth={head}
          markerHeight={head}
          orient="auto-start-reverse"
        >
          <path d={`M0,0 L${head * 2},${head} L0,${head * 2} z`} fill="currentColor" />
        </marker>
      </defs>

      <g className="text-[color:var(--muted-foreground)]">
        {drawing.arrows.map((a, i) => (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="currentColor"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
        ))}
      </g>

      {drawing.boxes.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            rx={10}
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth={1}
          />
          {/* `foreignObject` rather than `<text>`: the labels are Arabic, and
              SVG text does no bidi shaping, no wrapping and no ellipsis — a
              long label would run out of its own box with nothing to stop it.
              A div inside clips and wraps the way the rest of the page does. */}
          <foreignObject x={b.x} y={b.y} width={b.width} height={b.height}>
            {/* The xmlns is spread rather than written as a prop because
                React's JSX types do not carry it for a div, and it is what
                makes the HTML inside foreignObject render in Safari. */}
            <div
              {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
              className="flex h-full w-full items-center justify-center px-2 text-center text-[12.5px] leading-tight"
              style={{ overflow: "hidden" }}
            >
              <ContentText className="line-clamp-3">{b.label}</ContentText>
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
}
