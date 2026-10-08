import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { localeDirection } from "@/lib/i18n/config";
import { ContentText } from "@/components/ui/content-text";
import { LectureIdentity } from "@/components/lectures/lecture-identity";
import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { LectureSummaryView } from "@/components/lectures/lecture-summary";
import { formatDate, formatDayMonth } from "@/lib/utils";
import { LectureStatusControl } from "@/components/lectures/lecture-status-control";
import { LectureNotesEditor } from "@/components/lectures/lecture-notes-editor";
import { DeleteThing } from "@/components/shared/delete-thing";
import { AddGapDialog, AddFlashcardDialog } from "@/components/lectures/lecture-add-dialogs";
import { resumePage, isResumable, showsAsFinished, type Deck } from "@/lib/study-position";
import { unreadOf } from "@/lib/exam-readiness";

export const dynamic = "force-dynamic";

/**
 * ONE LECTURE.
 *
 * Five tabs became none, and four figures went with them. Counted on this
 * student's seven real lectures on 2026-10-01:
 *
 *   flashcards linked to a lecture     0 of 7
 *   gaps linked to a lecture           0 of 7
 *   problems                           0 of 7
 *   videos                             0 of 7
 *   review items                       0 of 7
 *   selfAssessment                     null in all 7
 *   completionPercentage               0 in all 7
 *   difficultyRating                   3 in all 7 — the default, never moved
 *
 * So the `flashcards` tab and the `related` tab were empty for every lecture
 * that exists, and the `overview` tab was four panels of absences: an
 * understanding score that correctly says it cannot tell, a progress bar at
 * zero, a self-assessment slider never touched in twenty-six days, and five
 * stars left on their default.
 *
 * WHY THE CARDS AND GAPS READ ZERO, which matters because it is not disuse:
 * 42 flashcards and 11 knowledge gaps exist on this account. They carry a
 * `subjectId` and no `lectureId` — the agent files them to the course. So the
 * capability is starved by how things are filed, not rejected by the student,
 * and the two sections stay, small, with their add actions doing the work: a
 * gap created HERE gets the lecture. The same reasoning kept `Problem` and
 * `Mistake` alive earlier in this project when their zero rows turned out to
 * measure an outage.
 *
 * WHAT IS ACTUALLY USED, same measurement: 5 of 7 lectures carry a deck of
 * 13 to 51 pages, 3 decks have a reading position, 3 pages carry ink, and 2
 * lectures have notes typed into them. That is the page: the deck, where you
 * stopped, and what you wrote.
 *
 * NO TABS. With two of five empty everywhere and one made of absences, tabs
 * were a filing system over a page short enough to read. Flat, in the order
 * a student uses it.
 */
export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();

  const lecture = await prisma.lecture.findFirst({
    where: { id, subject: { userId } },
    select: {
      id: true,
      lectureNumber: true,
      title: true,
      date: true,
      lecturer: true,
      status: true,
      quickNotes: true,
      subjectId: true,
      topicId: true,
      subject: { select: { id: true, name: true } },
      topic: { select: { name: true } },
      slides: {
        select: {
          id: true,
          title: true,
          pageCount: true,
          positions: {
            select: { lastPage: true, furthestPage: true, lastViewedAt: true, completedAt: true },
            orderBy: { lastViewedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "asc" },
      },
      knowledgeGaps: {
        select: { id: true, title: true, difficulty: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      flashcards: {
        select: { id: true, front: true, reviewCount: true, nextReviewDate: true },
        orderBy: { nextReviewDate: "asc" },
      },
      /* The summary, read in the same query as everything else rather than in
         its own round trip: it is one row and its points, and this page is
         already one query. */
      summary: {
        select: {
          idea: true,
          chain: true,
          points: {
            select: { heading: true, body: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  if (!lecture) notFound();

  const L = dict.lecture;
  const ctx = { lectureId: lecture.id, subjectId: lecture.subjectId, topicId: lecture.topicId };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <LectureIdentity
          subject={{ id: lecture.subjectId, name: lecture.subject.name }}
          lecture={{ id: lecture.id, title: lecture.title }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-meta flex flex-wrap items-center gap-1.5 text-muted-foreground">
            {/* dir="ltr" on the number: an Arabic-Indic digit with a "#" in
                front of it in an RTL run puts the hash on the wrong side. */}
            <span dir="ltr">#{lecture.lectureNumber}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(lecture.date, locale)}</span>
            {lecture.lecturer && (
              <>
                <span aria-hidden>·</span>
                <ContentText>{lecture.lecturer}</ContentText>
              </>
            )}
            {/* The topic, which lost its own tab on the course page and rides
                here instead — the one place it says something. */}
            {lecture.topic && (
              <>
                <span aria-hidden>·</span>
                <ContentText>{lecture.topic.name}</ContentText>
              </>
            )}
            {/* The five difficulty stars were here. All seven lectures sat on
                the default 3, so the row said "medium" seven times in a
                language that looked like data. */}
          </p>
          <div className="flex items-center gap-1">
            <LectureStatusControl lectureId={lecture.id} status={lecture.status} />
            <DeleteThing kind="lecture" id={lecture.id} name={lecture.title} keptNote />
          </div>
        </div>
      </header>

      {/* THE SUMMARY, FIRST WHEN THERE IS ONE. It is the only thing on this
          page that can be read instead of the lecture, so it goes above the
          deck — a student who has thirty seconds reads this, and one who has
          an hour scrolls past it to the slides. Absent, nothing is drawn and
          the deck keeps the top, which is where it belonged before. */}
      {lecture.summary && (
        <LectureSummaryView
          idea={lecture.summary.idea}
          chain={lecture.summary.chain}
          points={lecture.summary.points}
          rtl={localeDirection[locale] === "rtl"}
          labels={{
            summary: L.summaryTitle,
            chain: L.summaryChain,
            mustKnow: L.summaryMustKnow,
          }}
        />
      )}

      {/* THE DECK, because it is the thing on this page with real data behind
          it and the one that answers "what do I do now". */}
      <TtSection title={L.slides} count={lecture.slides.length}>
        {lecture.slides.length === 0 ? (
          <TtEmpty>{L.nothingLinkedHint}</TtEmpty>
        ) : (
          lecture.slides.map((s) => {
            const deck: Deck = {
              slideId: s.id,
              pageCount: s.pageCount,
              position: s.positions[0] ?? null,
            };
            const at = resumePage(deck);
            const unread = unreadOf({
              lectureId: lecture.id,
              title: s.title,
              pages: s.pageCount,
              furthestPage: s.positions[0]?.furthestPage ?? 0,
            });

            return (
              <TtRow
                key={s.id}
                href={`/lectures/${lecture.id}/slides/${s.id}`}
                // Pages still ahead — the same figure the course page and the
                // home page's exam band use, so all three agree.
                figure={unread}
                label={s.title}
                note={
                  showsAsFinished(deck)
                    ? L.deckFinished
                    : isResumable(deck)
                      ? format(L.deckResume, { page: at })
                      : format(L.deckPages, { pages: s.pageCount })
                }
              />
            );
          })
        )}
      </TtSection>

      {/* What he wrote. Used on 2 of 7 lectures, which on a 26-day-old
          account is the most-used thing on this page after the deck. */}
      <TtSection title={L.notes}>
        <div className="py-3.5">
          <LectureNotesEditor lectureId={lecture.id} notes={lecture.quickNotes} dict={dict} />
        </div>
      </TtSection>

      <TtSection
        title={L.gapsHere}
        count={lecture.knowledgeGaps.length}
        meta={<AddGapDialog {...ctx} />}
      >
        {lecture.knowledgeGaps.length === 0 ? (
          /* No icon panel. Four of six courses and seven of seven lectures
             are empty here, so this is the common state — and a drawn empty
             state repeated down a page is louder than the content. */
          <TtEmpty>{L.noGapsHere}</TtEmpty>
        ) : (
          lecture.knowledgeGaps.map((g) => (
            <TtRow
              key={g.id}
              href="/knowledge-gaps"
              label={g.title}
              note={`${dict.common[g.difficulty.toLowerCase() as "easy" | "medium" | "hard"]} · ${formatDayMonth(g.createdAt, locale)}`}
            />
          ))
        )}
      </TtSection>

      <TtSection
        title={L.cardsHere}
        count={lecture.flashcards.length}
        meta={<AddFlashcardDialog {...ctx} />}
      >
        {lecture.flashcards.length === 0 ? (
          <TtEmpty>{L.noCardsHere}</TtEmpty>
        ) : (
          lecture.flashcards.map((c) => (
            <TtRow
              key={c.id}
              href="/review"
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
    </div>
  );
}
