import { ContentText } from "@/components/ui/content-text";
import { coverGradient, type World } from "@/lib/world";

/**
 * The banner at the top of a course, the way the owner's board draws it.
 *
 * IT IS THE COVER, OPENED. On موادي the course is a 176px sleeve; tapping it
 * brings you here and the same gradient, the same Sadu band and the same code
 * are waiting at four times the size. That continuity is the whole point of
 * giving each course a world — you should not have to check the title to know
 * you arrived in the right place.
 *
 * THE SAME FOUR LEVELS, in the same order as the cover, because a student who
 * has learned where to look on one should not have to learn again on the
 * other: the code, the name with what kind of course it is, when the next
 * class is, and one figure.
 *
 * EVERY FIELD IS OPTIONAL AND NONE IS INVENTED. A course with no timetable row
 * has no next class, and one with no code shows none. The figure is a count of
 * real lectures, so it is always true — zero included.
 */
export function CourseHero({
  code,
  name,
  world,
  kind,
  next,
  figure,
  figureLabel,
}: {
  code: string | null;
  name: string;
  world: World;
  /** "نظري" / "سريري". Null when the timetable says nothing. */
  kind?: string | null;
  /** "الإثنين · 8 الصبح". Null when the timetable says nothing. */
  next?: string | null;
  figure: number;
  figureLabel: string;
}) {
  /* The two meet in one line under the name, and either may be missing. */
  const under = [kind, next].filter(Boolean).join(" · ");

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        minHeight: 200,
        display: "flex",
        flexDirection: "column",
        padding: 12,
        boxSizing: "border-box",
        color: "#fff",
        background: coverGradient(world),
        border: "1px solid rgba(255,235,210,0.26)",
        boxShadow: "0 30px 50px -24px rgba(0,0,0,0.85)",
      }}
    >
      <span aria-hidden className="lattice" style={{ position: "absolute", inset: 0 }} />
      {/* The code sits in the light end of the gradient on a sand or gold
          world, so it gets the same scrim the cover's does. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(20,8,4,0.42) 0%, rgba(20,8,4,0) 45%)",
        }}
      />

      {code && (
        <span
          className="t-figure"
          style={{
            position: "relative",
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            padding: "4px 6px",
            whiteSpace: "nowrap",
          }}
        >
          {code}
        </span>
      )}

      {/* In flow, never at a fixed offset: the band has to clear the code
          whatever the code's size does, and on a narrow screen the glass
          strip below grows with the name. */}
      <span
        aria-hidden
        className="sadu"
        style={{ marginInline: -12, marginTop: code ? 10 : 24, flexShrink: 0 }}
      />

      <span
        className="pane pane-deep"
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 20,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <ContentText
            as="h1"
            className="t-kufi"
            style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}
          >
            {name}
          </ContentText>
          {under && (
            <span style={{ fontSize: 12, color: "rgba(255,240,220,0.82)" }}>{under}</span>
          )}
        </span>
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span className="t-figure" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            {figure}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,240,220,0.8)" }}>{figureLabel}</span>
        </span>
      </span>
    </section>
  );
}
