import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { ContentText } from "@/components/ui/content-text";
import { byWeek, weekOf } from "@/lib/academic-week";
import { pluralForm, pick } from "@/lib/i18n/plural";
import { accentMap, DEFAULT_ACCENT } from "@/lib/subject-accent";
import { shortCourseName } from "@/lib/course-code";
import { formatDayMonth } from "@/lib/utils";

export const generateMetadata = pageTitle((dict) => dict.lectures.title);
export const dynamic = "force-dynamic";

/**
 * EVERY LECTURE, BY WEEK.
 *
 * This place did not exist. `/lectures/[id]` did, and `/lectures/[id]/slides`
 * did, but there was no `/lectures` — the only route to a lecture was through
 * its course, which means a student who remembers "the ECG one" but not which
 * course it is in has to guess first. The product's own glossary organises
 * lectures as course -> week -> lecture, and nothing in the app was shaped
 * that way.
 *
 * WHY WEEKS AND NOT THE EXISTING `lectureNumber`. The column exists and is
 * already untrustworthy: measured on this account, two different lectures are
 * both numbered 5. A week is derived from the date, cannot drift, and is the
 * unit the student is actually given — a syllabus says "weeks 1 to 4", never
 * "lectures 1 to 7". See src/lib/academic-week.ts.
 *
 * Newest week first, because the lecture a student wants is almost always the
 * one just taught; and empty weeks are omitted, because this semester runs
 * about forty-seven weeks and eight lectures sit in four of them.
 */
export default async function LecturesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();
  const L = dict.lectures;

  const [semester, lectures, subjects] = await Promise.all([
    /* The active semester anchors every week number. Without one there is no
       week 1 to count from, and the page falls back to a flat list rather than
       inventing an anchor. */
    prisma.semester.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { startDate: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.lecture.findMany({
      where: { subject: { userId } },
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        subjectId: true,
        subject: { select: { name: true, code: true } },
        _count: { select: { slides: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.subject.findMany({
      where: { userId },
      select: { id: true, color: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const accents = accentMap(subjects);
  const start = semester?.startDate ?? null;
  const unstudied = lectures.filter((l) => l.status !== "COMPLETED").length;

  /* With no active semester every lecture goes in one undated group rather
     than being scattered across weeks counted from an invented zero. */
  const groups = start
    ? byWeek(lectures, (l) => l.date, start)
    : [{ week: 0, from: new Date(), to: new Date(), items: lectures }];

  const thisWeek = start ? weekOf(new Date(), start) : -1;

  /* Built from two one-axis phrases — see the dictionary note. */
  const stateTemplate = [
    pick(L.countLine, pluralForm(locale, lectures.length)),
    unstudied > 0
      ? pick(L.remainingLine, pluralForm(locale, unstudied))
      : L.allStudied,
  ].join("، ");

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader
        title={L.title}
        state={
          lectures.length === 0 ? undefined : (
            <StateLine
              template={stateTemplate}
              values={{ count: lectures.length, unstudied }}
              tones={{ unstudied: "due" }}
            />
          )
        }
      />

      {lectures.length === 0 ? (
        <TtSection title={L.title}>
          <TtEmpty>{L.empty}</TtEmpty>
        </TtSection>
      ) : (
        groups.map((group) => (
          <TtSection
            key={group.week}
            title={group.week === 0 ? L.title : format(L.week, { n: group.week })}
            count={group.items.length}
            meta={
              <span className="t-meta text-muted-foreground">
                {group.week === thisWeek
                  ? L.thisWeek
                  : group.week === 0
                    ? undefined
                    : `${formatDayMonth(group.from, locale)} – ${formatDayMonth(group.to, locale)}`}
              </span>
            }
          >
            {group.items.map((lecture) => (
              <TtRow
                key={lecture.id}
                href={`/lectures/${lecture.id}`}
                label={
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accents.get(lecture.subjectId) ?? DEFAULT_ACCENT }}
                    />
                    <ContentText className="truncate">{lecture.title}</ContentText>
                  </span>
                }
                /* The one thing worth knowing at a glance that is not the
                   title: whether there is anything to open. Measured: two of
                   this account's lectures have no file, and both are inside
                   the window of an exam four days away. */
                note={
                  lecture._count.slides === 0
                    ? L.noFile
                    : lecture.status === "COMPLETED"
                      ? L.studied
                      : shortCourseName(lecture.subject.name, lecture.subject.code)
                }
                past={lecture.status === "COMPLETED"}
              />
            ))}
          </TtSection>
        ))
      )}
    </div>
  );
}
