import { ContentText } from "@/components/ui/content-text";
import type { NextExam } from "@/lib/exam-coverage-store";

/**
 * The exam, and what is actually left of it.
 *
 * "An exam in 6 days" is what the app said before, and it is not something a
 * student can act on: it does not say what to open. This says it — how many
 * topics the exam covers and how many are unread — and it is deliberately the
 * only loud thing on the screen when the exam is close.
 *
 * IT NEVER SHRINKS THE EXAM. Lectures with no breakdown are counted and named
 * in their own line rather than left out: "14 topics left" about an exam that
 * also carries three un-broken lectures is a comforting number and a false
 * one, and comforting-and-false is the exact failure this product exists to
 * prevent.
 */
export function ExamBand({
  exam,
  daysLeft,
  accent,
  labels,
}: {
  exam: NextExam;
  daysLeft: number;
  accent: string;
  labels: Record<string, string>;
}) {
  const { topicsTotal, topicsDone, unreadLectures } = exam.coverage;
  const left = topicsTotal - topicsDone;

  const when =
    daysLeft <= 0
      ? labels.examToday
      : daysLeft === 1
        ? labels.examTomorrow
        : labels.examIn.replace("{days}", String(daysLeft));

  return (
    <section className="glass pb-4 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="t-label" style={{ color: accent }}>
          {labels.examTitle}
        </span>
        <span className="t-meta tabular-nums text-muted-foreground">{when}</span>
      </div>

      <ContentText as="div" className="t-body mt-1 font-semibold">
        {exam.title}
      </ContentText>

      {topicsTotal > 0 && (
        <>
          <p className="t-meta mt-2 tabular-nums text-muted-foreground">
            {labels.examCovers
              .replace("{done}", String(topicsDone))
              .replace("{total}", String(topicsTotal))}
          </p>
          <div
            className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
            style={{ background: "rgb(255 255 255 / 12%)" }}
            role="presentation"
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${(topicsDone / topicsTotal) * 100}%`, background: accent }}
            />
          </div>
          <p className="t-body mt-2 font-medium">
            {left === 0
              ? labels.examAllDone
              : labels.examLeft.replace("{count}", String(left))}
          </p>
        </>
      )}

      {/* The part that would be tempting to leave out. */}
      {unreadLectures > 0 && (
        <p className="t-meta mt-1 text-muted-foreground">
          {labels.examAlsoLectures.replace("{count}", String(unreadLectures))}
        </p>
      )}
    </section>
  );
}
