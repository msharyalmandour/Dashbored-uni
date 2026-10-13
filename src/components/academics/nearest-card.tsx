import { ContentText } from "@/components/ui/content-text";

/**
 * أقرب شي مهم — the one deadline nearest the student, with the days left big.
 *
 * ONE CARD, ONE NUMBER. The whole point of the approved design is that the
 * first thing on the screen answers "how worried should I be" without being
 * read: a 52px number and the word after it. Everything else on the card is
 * support for that number.
 *
 * THE WEIGHT CHIP IS HIDDEN WHEN THE TITLE DOES NOT SAY. It is parsed out of
 * the deadline's own title (src/lib/exam-weight.ts), and thirteen of his
 * fifteen deadlines carry no percentage. Showing a guess on the one thing he
 * is looking at would change what he studies tonight.
 */
export function NearestCard({
  title,
  courseCode,
  dateLabel,
  daysLeft,
  weight,
  accent,
  progress,
  labels,
}: {
  title: string;
  courseCode: string | null;
  dateLabel: string;
  daysLeft: number;
  /** 0–100, or null when the title does not say. */
  weight: number | null;
  accent: string;
  /** 0..1 of the term gone, or null when the term's dates are unknown. */
  progress: number | null;
  labels: Record<string, string>;
}) {
  const when =
    daysLeft <= 0 ? labels.today : daysLeft === 1 ? labels.tomorrow : labels.daysLeft;

  return (
    <section className="pane" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, color: "rgba(246,235,221,0.75)" }}>{labels.nearest}</span>
        {weight !== null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 99,
              background: "rgba(232,163,61,0.22)",
              color: "#F7C77E",
              whiteSpace: "nowrap",
            }}
          >
            {labels.ofGrade.replace("{weight}", String(weight))}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <ContentText as="div" className="t-kufi" style={{ fontSize: 18 }}>
            {title}
          </ContentText>
          <span className="t-figure" style={{ fontSize: 13, color: "rgba(246,235,221,0.7)" }}>
            {[courseCode, dateLabel].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
          {/* The number only. "61 يوم باقي" reads as one phrase; wrapping the
              digits and the word together would let them split across lines. */}
          <span
            className="t-figure"
            style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: "#fff" }}
          >
            {Math.max(0, daysLeft)}
          </span>
          <span style={{ fontSize: 14, color: "rgba(246,235,221,0.8)" }}>{when}</span>
        </div>
      </div>

      {/* How much of the term is gone. Drawn only when the term has real
          dates — a bar at an invented width under a countdown is the kind of
          thing that looks like data and is not. */}
      {progress !== null && (
        <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 99,
              width: `${Math.round(progress * 100)}%`,
              background: `linear-gradient(90deg, ${accent}, #C9572B)`,
            }}
          />
        </div>
      )}
    </section>
  );
}
