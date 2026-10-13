import Link from "next/link";
import { ContentText } from "@/components/ui/content-text";
import { coverGradient, type World } from "@/lib/world";

/**
 * A course as a cover, the way the approved design draws it.
 *
 * NOT A CARD WITH A COLOURED STRIP. The old one was a white-ish panel with a
 * 1px line of the course colour across the top; this IS the colour, floor to
 * ceiling, with the name on a glass strip at the bottom like a record sleeve.
 * The point is recognition: he should know which course he is looking at
 * before he reads a word of it.
 *
 * THE SADU BAND AND THE LATTICE ARE DECORATION AND ARE MARKED AS SUCH. They
 * carry no information — `aria-hidden`, no text, nothing a screen reader or a
 * keyboard needs. The handoff asks for them by name as Saudi branding, and the
 * rule for anything decorative in this app is that it must be invisible to
 * everything except the eye.
 */
export function SubjectCover({
  href,
  code,
  name,
  world,
  note,
  figure,
  width = 176,
  height = 230,
}: {
  href: string;
  /** "NURC 410". Null when the name carries no code. */
  code: string | null;
  name: string;
  world: World;
  /** The one line under the name: the next class, usually. */
  note?: string | null;
  /** A short fact above the name — "2 محاضرة جاهزة". Omitted when unknown. */
  figure?: string | null;
  width?: number;
  height?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        position: "relative",
        display: "block",
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
      }}
    >
      <span aria-hidden className="lattice" style={{ position: "absolute", inset: 0 }} />
      {/* Sits just above the halfway line, as the artboards place it. */}
      <span
        aria-hidden
        className="sadu"
        style={{ position: "absolute", left: 0, right: 0, top: Math.round(height * 0.42) }}
      />

      {code && (
        <span
          className="t-figure"
          style={{ position: "absolute", top: 16, left: 16, fontSize: 24, fontWeight: 700 }}
        >
          {code}
        </span>
      )}

      {figure && (
        <span
          style={{
            position: "absolute",
            top: 50,
            left: 16,
            fontSize: 12,
            padding: "3px 10px",
            borderRadius: 99,
            background: "rgba(20,8,4,0.35)",
          }}
        >
          {figure}
        </span>
      )}

      <span
        className="pane pane-deep"
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 10,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "10px 12px",
          borderRadius: 18,
        }}
      >
        <ContentText as="span" className="t-kufi" style={{ fontSize: 15, color: "#fff" }}>
          {name}
        </ContentText>
        {/* Only when the timetable actually says. An invented "الإثنين 8 ص"
            under a course with no slot is the kind of detail a student plans
            around and then misses the class. */}
        {note && (
          <span style={{ fontSize: 12, color: "rgba(255,240,220,0.8)" }}>{note}</span>
        )}
      </span>
    </Link>
  );
}
