import Link from "next/link";
import { ContentText } from "@/components/ui/content-text";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";
import type { ExamReadiness } from "@/lib/exam-readiness";

/**
 * The exam, the pages, and where to start — in one line.
 *
 * WHAT IT IS FOR. On 2026-10-01 this student had a midterm in eleven days and
 * ninety-two unread pages in the course it covers. The date was on a Task, the
 * page counts on LectureSlide, the positions on StudyPosition. All three were
 * stored and none of them had ever appeared on the same screen.
 *
 * WHY IT IS NOT A CARD. It is the timetable language, because what it shows is
 * a row of figures — days, pages, pages a day — and those are scanned, not
 * read. A card with a picture here would be the app being dramatic about an
 * exam, which is the student's job and not the interface's.
 *
 * WHY IT IS NOT ALWAYS THERE. It appears only while a page a day would no
 * longer get him there; see src/lib/exam-readiness.ts for why that is the
 * threshold rather than a number somebody chose. A band that is always present
 * is wallpaper, and this app has just deleted one queue for being exactly
 * that.
 *
 * The figure that carries the weight is `pagesPerDay`: "eleven days" is a fact
 * about the calendar and "ninety-two pages" is a fact about the folder, but
 * "nine pages a day" is the one he can act on tonight.
 */
export function ExamBand({ band, dict }: { band: ExamReadiness; dict: Dictionary }) {
  if (band.kind !== "CALL") return null;
  const t = dict.today;

  const days =
    band.daysAway <= 0
      ? t.examToday
      : band.daysAway === 1
        ? t.examOneDay
        : format(t.examDays, { count: band.daysAway });

  return (
    <section className="tt">
      <div className="tt-head">
        <span className="tt-meta tt-latin">{t.examEyebrow}</span>
        {/* The countdown sits in the heading rather than in a row: it is the
            one fact that is about the whole band and not about any line. */}
        <span className="tt-meta tt-latin tabular-nums">{days}</span>
      </div>

      {/* ONE UNIT IN THE FIGURE COLUMN, and it is pages.
      
          The first draft put pages-a-day on the top row and pages-left on the
          one below it — two different quantities stacked in the column the eye
          runs down, which is the one thing a timetable's number column may not
          do. Rendering it showed it immediately: "9" above "50" reads as a
          fall, and nothing had fallen.
      
          So the column is pages throughout: the course, then the lecture to
          open. Pages a day stays beside the exam, where it is a rate rather
          than a quantity. */}
      <div className="tt-row tt-now">
        <span className="tt-n tt-latin">{band.unreadPages}</span>
        <span className="tt-label">
          <ContentText>{band.examTitle}</ContentText>
        </span>
        <span className="tt-meta tt-latin tabular-nums">
          {format(t.examPerDay, { count: band.pagesPerDay })}
        </span>
      </div>

      <div className="tt-row">
        <span className="tt-n tt-latin">{band.startUnread}</span>
        <Link
          href={`/lectures/${band.startLectureId}`}
          className="tt-label hover:underline"
        >
          <span className="text-muted-foreground">{t.examStart} </span>
          <ContentText>{band.startLectureTitle}</ContentText>
        </Link>
        <span className="tt-meta tt-latin tabular-nums">
          {format(t.examUnread, { count: band.startUnread })}
        </span>
      </div>
    </section>
  );
}
