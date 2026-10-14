import Link from "next/link";
import { ContentText } from "@/components/ui/content-text";
import { coverGradient, type World } from "@/lib/world";

/**
 * A course as a cover, in the four levels the owner's board draws.
 *
 * NOT A CARD WITH A COLOURED STRIP. The old one was a white-ish panel with a
 * 1px line of the course colour across the top; this IS the colour, floor to
 * ceiling, like a record sleeve. The point is recognition: he should know
 * which course he is looking at before he reads a word of it.
 *
 * THE FOUR LEVELS ARE THE WHOLE POINT AND THEIR ORDER NEVER CHANGES. His
 * "قبل وبعد" board of 2026-10-14 lists what the previous version got wrong,
 * and every item is about where the eye lands:
 *
 *   1 · top, small     the code and what kind of course it is
 *   2 · the title      the ARABIC name, big, with the English under it
 *   3 · وش الجاي       "الحصة الجاية" and when
 *   4 · status line    always in the same place, on every cover
 *
 * What it replaces: the course code set at 24px was the biggest thing on the
 * card, so the first thing read was "NURC 410" rather than the subject; the
 * name was English only; NURC 410 and NURC 411 both said "Critical Care
 * Nursing" and could not be told apart; and the "محاضرة جاهزة" pill floated
 * at a different height on every cover depending on whether there was a code.
 *
 * ANY LEVEL MAY BE ABSENT AND NONE MAY BE INVENTED. Three of his six courses
 * have no Arabic name on the board, one has no code, and a course with no
 * timetable row has no next class. Each of those renders as missing. The
 * alternative — translating a course title, or guessing a weekday — puts a
 * sentence on the most-read screen in the app that nobody checked.
 *
 * THE SADU BAND AND THE LATTICE ARE DECORATION AND ARE MARKED AS SUCH. They
 * carry no information — `aria-hidden`, no text, nothing a screen reader or a
 * keyboard needs.
 */
export function SubjectCover({
  href,
  code,
  name,
  kind,
  world,
  nextLabel,
  next,
  status,
  weight,
  width = 176,
  height = 230,
}: {
  href: string;
  /** "NURC 410". Null when the name carries no code. */
  code: string | null;
  /**
   * The course name, in English.
   *
   * THE OWNER'S INSTRUCTION OF 2026-10-14: course names stay English while
   * the interface is Arabic. An Arabic title was built here from a map of
   * names he had written himself, and he asked for it taken out — a Saudi
   * nursing student reads "Critical Care Nursing" on the timetable, on the
   * exam paper and on the slides, and a cover that renames it is one more
   * thing to map back.
   */
  name: string;
  /** "نظري" / "سريري". Null when the course has no timetable rows. */
  kind?: string | null;
  world: World;
  /** "الحصة الجاية" — the label above the time. */
  nextLabel?: string | null;
  /** "الإثنين · 8 الصبح". Null when the timetable does not say. */
  next?: string | null;
  /** Left of the status line: "2 محاضرات جاهزة". */
  status?: string | null;
  /** Right of it: "OSPE 40%". */
  weight?: string | null;
  width?: number;
  height?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        position: "relative",
        /* A FLOW COLUMN, NOT FOUR ABSOLUTE BOXES. The title was pinned at
           top 44 and the Sadu band at 52% of the height, and on a 176px
           phone cover "القيادة التمريضية" wraps to two lines — which put the
           English name underneath it straight through the band, unreadable.
           Now the band is a sibling after the title and cannot be reached by
           it, whatever the name does. The min-height on the block above keeps
           the band near the half-way line the board draws when the title is
           short, and lets it move down when the title is long. */
        display: "flex",
        flexDirection: "column",
        width,
        height,
        flex: "0 0 auto",
        borderRadius: 26,
        overflow: "hidden",
        textDecoration: "none",
        color: "#fff",
        background: coverGradient(world),
        border: "1px solid rgba(255,235,210,0.28)",
        boxShadow: "0 30px 50px -22px rgba(0,0,0,0.85)",
        padding: 10,
        boxSizing: "border-box",
      }}
    >
      <span aria-hidden className="lattice" style={{ position: "absolute", inset: 0 }} />
      {/* A scrim under the top row only. The pale end of a world — sand, gold —
          leaves white text on it at about 2:1, and the code and the kind sit
          right in it. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(20,8,4,0.42) 0%, rgba(20,8,4,0) 42%)",
        }}
      />
      {/* Levels 1 and 2 together, with a floor under them so the Sadu band
          still lands near the half-way line on a one-line title. */}
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: "38%",
          /* NOT SHRINKABLE. A flex child shrinks by default, and on the 176px
             phone cover that squeezed this block back under the band it was
             meant to sit above — the two-line "القيادة التمريضية" put its
             English line straight through the Sadu. */
          flexShrink: 0,
          padding: "2px 2px 8px",
        }}
      >
      {/* ── 1 · the code and what kind of course it is ───────────────────── */}
      {(code || kind) && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {code && (
            <span
              className="t-figure"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 99,
                whiteSpace: "nowrap",
                background: "rgba(20,8,4,0.42)",
                border: "1px solid rgba(255,235,210,0.25)",
              }}
            >
              {code}
            </span>
          )}
          {kind && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 99,
                whiteSpace: "nowrap",
                background: "rgba(255,255,255,0.88)",
                color: "#2A1208",
              }}
            >
              {kind}
            </span>
          )}
        </span>
      )}

      {/* ── 2 · the title ───────────────────────────────────────────────── */}
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <ContentText
          as="span"
          className="t-kufi"
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 2px 12px rgba(40,10,4,0.5)",
            /* Two lines is what a 176px cover holds. A course name long
               enough to need three would push the band and the status line
               off the bottom, and the status line's whole value is being in
               the same place on every cover. */
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {name}
        </ContentText>
      </span>

      </span>

      {/* The band sits under the title block, never on it. Decoration: it
          carries nothing a screen reader or a keyboard needs. */}
      <span aria-hidden className="sadu" style={{ marginInline: -10, flexShrink: 0 }} />

      {/* ── 3 and 4 · وش الجاي, then the status line, always here ────────── */}
      <span
        className="pane pane-deep"
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px",
          borderRadius: 18,
        }}
      >
        {/* Only when the timetable actually says. An invented "الإثنين 8
            الصبح" under a course with no slot is the kind of detail a student
            plans around and then misses the class. */}
        {next && (
          <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {nextLabel && (
              <span style={{ fontSize: 10, color: "rgba(255,240,220,0.7)" }}>{nextLabel}</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600 }}>{next}</span>
          </span>
        )}
        {(status || weight) && (
          <span
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 11,
              color: "rgba(255,240,220,0.85)",
            }}
          >
            <span>{status}</span>
            {weight && <span className="t-figure">{weight}</span>}
          </span>
        )}
      </span>
    </Link>
  );
}
