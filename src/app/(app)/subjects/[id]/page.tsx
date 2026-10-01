import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format, type Dictionary } from "@/lib/i18n/dictionaries";
import { Badge } from "@/components/ui/badge";
import { ContentText } from "@/components/ui/content-text";
import { StateLine } from "@/components/shared/os-page-header";
import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { SubjectTabNav } from "@/components/academics/subject-tab-nav";
import { CreateLectureDialog } from "@/components/academics/create-lecture-dialog";
import { FileDocument } from "@/components/academics/file-document";
import { DeleteThing } from "@/components/shared/delete-thing";
import { formatDayMonth } from "@/lib/utils";
import { unreadOf, daysUntil } from "@/lib/exam-readiness";
import type { Locale } from "@/lib/i18n/config";

/**
 * ONE COURSE.
 *
 * Rebuilt from eight tabs to three, and from cards to the timetable. Both
 * changes came out of counting rather than taste.
 *
 * THE TABS. There were eight: overview, lectures, topics, flashcards,
 * problems, gaps, resources, analytics. Across this student's six courses that
 * is forty-eight destinations, and on 2026-10-01 nine of them had anything in
 * them. `problems` was empty in all six courses because `Problem` holds zero
 * rows; `analytics` was empty in all six because it is a practice-accuracy
 * figure computed from those same rows; `resources` had one row in one course
 * and none in five. Four of the six courses were empty in every single tab.
 * A tab that is empty for every course is not navigation, it is a door onto a
 * wall, and eight of them is why a course with four lectures in it felt hard
 * to read.
 *
 * What survives is what a student does here: read the material, go over what
 * they did not understand, and review. Three.
 *
 * `topics` folded into the material rather than being deleted — 46 topic rows
 * exist and none is linked to a lecture (`LectureTopic` is empty), so a grid
 * of 28 topic cards was a wall, not a route. The name now rides on the lecture
 * row that carries it.
 *
 * DEADLINES CAME OUT OF THE TABS ENTIRELY. They are not a section of a course,
 * they are the thing the course is counting down to — and measured, NURP (432)
 * has eleven tasks and no lectures, no cards and no gaps, so putting its only
 * content behind a tab meant opening that course and seeing nothing.
 *
 * THE CARDS. Two files used the `.tt` rule system and sixteen used `Card`,
 * with `OSSection` as a third language underneath. Three visual languages, and
 * the one chosen ("the timetable") had reached the home page and stopped. A
 * card claims "consider this separately"; eight on a page make the claim eight
 * times and it stops meaning anything. See src/components/shared/tt.tsx.
 *
 * THE LECTURE ROW lost three decorations: a five-star self-rating, a progress
 * bar and a status badge, on every row. Twelve ornaments for four lectures.
 * What replaces them is the one figure a student with an exam in eleven days
 * needs — pages not yet read — which is also the figure the exam band on the
 * home page is built on, so the two now agree.
 */

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "material" } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();

  const subject = await prisma.subject.findFirst({
    where: { id, userId },
    include: { semester: true },
  });
  if (!subject) notFound();

  const now = new Date();

  const [lectureCount, gapCount, flashcardCount, deadlines] = await Promise.all([
    prisma.lecture.count({ where: { subjectId: id } }),
    prisma.knowledgeGap.count({
      where: { subjectId: id, status: { notIn: ["UNDERSTOOD", "MASTERED"] } },
    }),
    prisma.flashcard.count({ where: { subjectId: id, nextReviewDate: { lte: now } } }),
    /* Only what is still ahead and still open. A deadline that has passed is
       not a countdown, and a completed one is not news. */
    prisma.task.findMany({
      where: { subjectId: id, status: { not: "COMPLETED" }, deadline: { gte: now } },
      select: { id: true, title: true, type: true, deadline: true },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start gap-3">
        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: subject.color }}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="t-display on-env">
              <ContentText>{subject.name}</ContentText>
            </h1>
            <Badge variant="secondary">{dict.status.subject[subject.status]}</Badge>
          </div>
          <p className="t-meta on-env-quiet">
            {subject.code ?? dict.academics.noCode} · {subject.creditHours}{" "}
            {dict.academics.creditHours}
            {subject.instructor ? ` · ${subject.instructor}` : ""} · {subject.semester.name}
          </p>
          <p className="t-meta on-env-quiet mt-1.5">
            <StateLine
              template={
                flashcardCount + gapCount > 0 ? dict.subject.stateLine : dict.subject.stateLineClear
              }
              values={{ lectures: lectureCount, due: flashcardCount, gaps: gapCount }}
              tones={{ due: "due", gaps: "due" }}
            />
          </p>
        </div>
      </header>

      {/* The countdown, above the tabs, because it is about the course and not
          about one of its parts. Absent when there is nothing ahead — a band
          that is always there is wallpaper. */}
      {deadlines.length > 0 && (
        <TtSection title={dict.subject.ahead}>
          {deadlines.map((t, i) => {
            const days = daysUntil(t.deadline, now);
            return (
              <TtRow
                key={t.id}
                // The figure is days, one unit down the column.
                figure={days}
                label={t.title}
                note={`${formatDayMonth(t.deadline, locale)} · ${dict.status.taskType[t.type]}`}
                // One marker, and it is the nearest thing only.
                now={i === 0 && days <= 14}
              />
            );
          })}
        </TtSection>
      )}

      <SubjectTabNav subjectId={id} active={tab} dict={dict} />

      {tab === "material" && (
        <MaterialTab subjectId={id} dict={dict} locale={locale} subjectName={subject.name} />
      )}
      {tab === "unclear" && <UnclearTab subjectId={id} dict={dict} locale={locale} />}
      {tab === "review" && <ReviewTab subjectId={id} dict={dict} locale={locale} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   المادة — the lectures, and the files that have not found one yet
   ──────────────────────────────────────────────────────────────────────────── */

async function MaterialTab({
  subjectId,
  dict,
  locale,
  subjectName,
}: {
  subjectId: string;
  dict: Dictionary;
  locale: Locale;
  subjectName: string;
}) {
  const [lectures, topics, unfiled] = await Promise.all([
    prisma.lecture.findMany({
      where: { subjectId },
      orderBy: { lectureNumber: "asc" },
      select: {
        id: true,
        lectureNumber: true,
        title: true,
        date: true,
        topic: { select: { name: true } },
        /* Positions hang off the DECK, not the lecture — a lecture can carry
           more than one slide set, and `StudyPosition` is keyed by slideId.
           See prisma/schema.prisma and src/lib/study-position.ts. */
        slides: {
          select: { pageCount: true, positions: { select: { furthestPage: true } } },
        },
      },
    }),
    prisma.topic.findMany({ where: { subjectId }, select: { id: true, name: true } }),
    /* THE 277 PAGES. Measured: 19 of this student's documents carry real
       extracted text and 17 of them are linked to no lecture, so the content
       was read successfully and then reached no screen in the app. Text
       extraction never went through the agent — only the filing did, and the
       agent has been out of credit since 11 September. They belong here,
       inside the course, with one question each. */
    prisma.document.findMany({
      where: {
        subjectId,
        lectureId: null,
        processingStatus: "COMPLETED",
      },
      select: { id: true, originalName: true, pageCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <TtSection
        title={dict.subject.lecturesTab}
        count={lectures.length}
        meta={
          <CreateLectureDialog
            subjectId={subjectId}
            topics={topics}
            nextLectureNumber={lectures.length + 1}
          />
        }
      >
        {lectures.length === 0 ? (
          <TtEmpty>{dict.subject.noLecturesYet}</TtEmpty>
        ) : (
          lectures.map((l) => {
            // The deck, and how much of it is still ahead. Same arithmetic the
            // home page's exam band uses, so the two cannot disagree.
            const pages = l.slides.reduce((max, s) => Math.max(max, s.pageCount), 0);
            const furthest = l.slides.reduce(
              (max, s) =>
                Math.max(max, s.positions.reduce((m, p) => Math.max(m, p.furthestPage), 0)),
              0
            );
            const unread = unreadOf({
              lectureId: l.id,
              title: l.title,
              pages,
              furthestPage: furthest,
            });

            return (
              <div key={l.id} className="group/row relative">
                <TtRow
                  href={`/lectures/${l.id}`}
                  // Pages left to read, which is the only figure here that is
                  // a call to do something. A lecture with no deck shows the
                  // lecture number instead of a zero that would read as done.
                  figure={pages > 0 ? unread : l.lectureNumber}
                  label={
                    <ContentText>
                      {format(dict.subject.lectureLine, {
                        n: l.lectureNumber,
                        title: l.title,
                      })}
                    </ContentText>
                  }
                  note={
                    pages > 0
                      ? format(dict.subject.ofPages, { pages })
                      : formatDayMonth(l.date, locale)
                  }
                />
                {/* Outside the row: a button inside an anchor is invalid and
                    unclickable. keptNote — a lecture releases its cards and
                    mistakes rather than taking them, and saying so is the
                    difference between a warning and a threat. */}
                <DeleteThing
                  kind="lecture"
                  id={l.id}
                  name={l.title}
                  keptNote
                  className="absolute inset-inline-end-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                />
                {l.topic && (
                  <span className="sr-only">{l.topic.name}</span>
                )}
              </div>
            );
          })
        )}
      </TtSection>

      {/* Files that were read but never filed. One question each: which
          lecture. Not an inbox — the inbox was deleted for being a fault log
          wearing the name of a workspace, and these are successes. */}
      {unfiled.length > 0 && (
        <TtSection
          title={dict.subject.unfiledTitle}
          count={unfiled.length}
          meta={<span className="tt-meta">{dict.subject.unfiledHint}</span>}
        >
          {unfiled.map((d) => (
            <TtRow key={d.id}>
              <span className="tt-n tt-latin">{d.pageCount ?? ""}</span>
              <span className="tt-label">
                <ContentText>{d.originalName}</ContentText>
              </span>
              <FileDocument
                documentId={d.id}
                lectures={lectures.map((l) => ({
                  id: l.id,
                  label: format(dict.subject.lectureLine, { n: l.lectureNumber, title: l.title }),
                }))}
                subjectName={subjectName}
              />
            </TtRow>
          ))}
        </TtSection>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   اللي ما فهمته
   ──────────────────────────────────────────────────────────────────────────── */

async function UnclearTab({
  subjectId,
  dict,
  locale,
}: {
  subjectId: string;
  dict: Dictionary;
  locale: Locale;
}) {
  const gaps = await prisma.knowledgeGap.findMany({
    where: { subjectId, status: { notIn: ["UNDERSTOOD", "MASTERED"] } },
    select: {
      id: true,
      title: true,
      difficulty: true,
      createdAt: true,
      lecture: { select: { lectureNumber: true } },
    },
    orderBy: [{ difficulty: "desc" }, { createdAt: "desc" }],
  });

  return (
    <TtSection title={dict.subject.gapsTab} count={gaps.length}>
      {gaps.length === 0 ? (
        <TtEmpty>{dict.subject.noOpenGaps}</TtEmpty>
      ) : (
        gaps.map((g) => (
          <TtRow
            key={g.id}
            href="/knowledge-gaps"
            // The lecture it came from, which is where it gets resolved. No
            // figure when it came from nowhere, rather than a zero.
            figure={g.lecture?.lectureNumber ?? ""}
            label={g.title}
            note={`${dict.common[g.difficulty.toLowerCase() as "easy" | "medium" | "hard"]} · ${formatDayMonth(g.createdAt, locale)}`}
          />
        ))
      )}
    </TtSection>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   المراجعة
   ──────────────────────────────────────────────────────────────────────────── */

async function ReviewTab({
  subjectId,
  dict,
  locale,
}: {
  subjectId: string;
  dict: Dictionary;
  locale: Locale;
}) {
  const now = new Date();
  const [due, total] = await Promise.all([
    prisma.flashcard.findMany({
      where: { subjectId, nextReviewDate: { lte: now } },
      select: {
        id: true,
        front: true,
        reviewCount: true,
        nextReviewDate: true,
        lecture: { select: { lectureNumber: true } },
      },
      orderBy: { nextReviewDate: "asc" },
      take: 40,
    }),
    prisma.flashcard.count({ where: { subjectId } }),
  ]);

  return (
    <TtSection
      title={dict.subject.flashcardsTab}
      count={due.length}
      meta={
        // The pile and the part of it that is due are different facts, and
        // measured they differ a lot: 42 cards exist on this account and 27
        // have never been shown once. Saying only "42" is the number that
        // stops someone starting.
        total > 0 ? (
          <span className="tt-meta tabular-nums">
            {format(dict.subject.ofTotalCards, { total })}
          </span>
        ) : undefined
      }
    >
      {due.length === 0 ? (
        <TtEmpty>{total === 0 ? dict.subject.noFlashcardsYet : dict.subject.nothingDue}</TtEmpty>
      ) : (
        due.map((c) => (
          <TtRow
            key={c.id}
            href="/review"
            figure={c.lecture?.lectureNumber ?? ""}
            label={c.front}
            note={
              c.reviewCount === 0
                ? dict.subject.neverSeen
                : formatDayMonth(c.nextReviewDate, locale)
            }
          />
        ))
      )}
    </TtSection>
  );
}
