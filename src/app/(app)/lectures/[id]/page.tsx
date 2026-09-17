import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, FileText, Video as VideoIcon, Link2, StickyNote, Presentation, PenLine, Lightbulb, Layers, ListChecks, ArrowUpRight, CalendarClock, Link as LinkIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { computeLectureUnderstanding } from "@/lib/understanding-score";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { Progress } from "@/components/ui/progress";
import { ContentText } from "@/components/ui/content-text";
import { LectureIdentity } from "@/components/lectures/lecture-identity";
import { OSSection, OSRow, OSEmptyState } from "@/components/shared/os-section";
import { OSRowGroup } from "@/components/shared/os-row-group";
import { formatDate } from "@/lib/utils";
import {
  GapStatusBadge,
  ProblemStatusBadge,
  FlashcardStatusBadge,
  DifficultyBadge,
} from "@/components/shared/status-badges";
import { LectureStatusControl } from "@/components/lectures/lecture-status-control";
import { LectureTabNav } from "@/components/lectures/lecture-tab-nav";
import { SelfAssessmentSlider } from "@/components/lectures/self-assessment-slider";
import { LectureNotesEditor } from "@/components/lectures/lecture-notes-editor";
import {
  AddResourceDialog,
  AddGapDialog,
  AddFlashcardDialog,
  AddProblemDialog,
} from "@/components/lectures/lecture-add-dialogs";
import { markerFor, POINT_STYLE, SPAN_STYLE } from "@/lib/week-palette";

export const dynamic = "force-dynamic";

const RESOURCE_ICON = {
  PDF: FileText,
  POWERPOINT: Presentation,
  VIDEO: VideoIcon,
  LINK: Link2,
  NOTE: StickyNote,
};

function scoreTone(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

/**
 * A link out of a section header — the thing that makes a list a doorway rather
 * than a display case.
 */
function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowUpRight className="size-3" />
    </Link>
  );
}

export default async function LecturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();

  const lecture = await prisma.lecture.findFirst({
    where: { id, subject: { userId } },
    include: {
      subject: true,
      topic: true,
      resources: true,
      knowledgeGaps: true,
      flashcards: true,
      problems: true,
      videos: true,
      slides: { select: { id: true, title: true, pageCount: true } },
      reviewItems: { orderBy: { scheduledDate: "asc" } },
    },
  });
  if (!lecture) notFound();

  const understanding = await computeLectureUnderstanding(id);
  const ctx = { lectureId: lecture.id, subjectId: lecture.subjectId, topicId: lecture.topicId };
  const L = dict.lecture;

  const tabs = [
    { key: "overview", label: L.tabs.overview },
    { key: "notes", label: L.tabs.notes },
    { key: "slides", label: L.tabs.slides, count: lecture.slides.length },
    { key: "flashcards", label: L.tabs.flashcards, count: lecture.flashcards.length },
    {
      key: "related",
      label: L.tabs.related,
      count: lecture.knowledgeGaps.length + lecture.problems.length + lecture.videos.length,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <LectureIdentity
          subject={{ id: lecture.subjectId, name: lecture.subject.name }}
          lecture={{ id: lecture.id, title: lecture.title }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="t-meta flex flex-wrap items-center gap-1.5 text-muted-foreground">
              {/* `dir="ltr"` on the number: the lecture number is a figure, and
                  an Arabic-Indic digit with a `#` in front of it in an RTL run
                  ends up with the hash on the wrong side. */}
              <span dir="ltr">#{lecture.lectureNumber}</span>
              <span aria-hidden>·</span>
              <span>{formatDate(lecture.date, locale)}</span>
              {lecture.lecturer && (
                <>
                  <span aria-hidden>·</span>
                  <ContentText>{lecture.lecturer}</ContentText>
                </>
              )}
              {lecture.topic && (
                <>
                  <span aria-hidden>·</span>
                  <ContentText>{lecture.topic.name}</ContentText>
                </>
              )}
              <span className="ms-1 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-3 ${i < lecture.difficultyRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </span>
            </p>
          </div>
          <LectureStatusControl lectureId={lecture.id} status={lecture.status} />
        </div>
      </div>

      <LectureTabNav lectureId={lecture.id} active={tab} tabs={tabs} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <OSSection title={L.understandingScore}>
              <div className="px-4 py-4">
                <p className="mb-3 text-xs text-muted-foreground">{L.understandingSubtitle}</p>
                {/* No score until something has actually been measured. This card
                    used to read "70%" for a lecture nobody had touched, because
                    every missing input defaulted to 70. */}
                {understanding.score === null ? (
                  <p className="text-sm text-muted-foreground">{L.notEnoughToSay}</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <p className={`font-display text-4xl font-bold ${scoreTone(understanding.score)}`}>
                      {understanding.score}%
                    </p>
                    <div className="flex-1 space-y-1.5">
                      {Object.entries(understanding.basis)
                        .filter(([, value]) => value !== null)
                        .map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 text-muted-foreground">
                              {L.basisLabels[key as keyof typeof L.basisLabels]}
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.round(value as number)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </OSSection>

            <OSSection
              title={L.learningResources}
              count={lecture.resources.length}
              icon={FileText}
              meta={<AddResourceDialog {...ctx} />}
            >
              {lecture.resources.length === 0 ? (
                <OSEmptyState title={L.noResources} />
              ) : (
                <OSRowGroup limit={6}>
                  {lecture.resources.map((r) => {
                    const Icon = RESOURCE_ICON[r.type];
                    // A resource with a URL opens it. One without is a note the
                    // student wrote, and it says so rather than pretending to
                    // be a link that does nothing.
                    const body = (
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <ContentText className="truncate text-sm">{r.title}</ContentText>
                      </span>
                    );
                    return (
                      <OSRow key={r.id}>
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 flex-1 items-center gap-2 hover:text-primary"
                          >
                            {body}
                            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <>
                            {body}
                            <span className="shrink-0 text-[11px] text-muted-foreground/70">
                              {L.resourceHasNoFile}
                            </span>
                          </>
                        )}
                      </OSRow>
                    );
                  })}
                </OSRowGroup>
              )}
            </OSSection>
          </div>

          <div className="flex flex-col gap-4">
            <OSSection title={L.completion}>
              <div className="flex flex-col gap-4 px-4 py-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{L.progress}</span>
                    <span className="tabular-nums">{lecture.completionPercentage}%</span>
                  </div>
                  <Progress value={lecture.completionPercentage} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">{L.selfAssessed}</p>
                  <SelfAssessmentSlider lectureId={lecture.id} value={lecture.selfAssessment} />
                </div>
              </div>
            </OSSection>

            <OSSection
              title={L.reviewSchedule}
              icon={CalendarClock}
              meta={<SectionLink href="/review" label={dict.review.title} />}
            >
              {lecture.reviewItems.length === 0 ? (
                <OSEmptyState title={L.noScheduleYet} hint={L.reviewScheduleSubtitle} />
              ) : (
                lecture.reviewItems.map((r) => (
                  /* The row itself goes to the review, not just the section
                     header. A review that is due is the most actionable thing
                     on this page, and it was text you could only look at. */
                  <OSRow key={r.id} className="text-xs">
                    <Link href="/review" className="flex flex-1 items-center justify-between gap-3 hover:text-primary">
                    <span className="font-medium">
                      {/* The database's own name for the stage used to reach the
                          screen as `REVIEW_1`.replace("_"," ") — English, on an
                          Arabic page, meaning nothing. */}
                      {dict.review.stageLabels[
                        r.reviewStage as keyof Dictionary["review"]["stageLabels"]
                      ] ?? r.reviewStage}
                    </span>
                    <span className="text-muted-foreground">{formatDate(r.scheduledDate, locale)}</span>
                    <span
                      className={
                        r.status === "COMPLETED"
                          ? "text-success"
                          : r.status === "DUE"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {/* Likewise: this printed the raw `ReviewStatus`. */}
                      {dict.status.review[r.status] ?? r.status}
                    </span>
                    </Link>
                  </OSRow>
                ))
              )}
            </OSSection>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <OSSection title={L.notes} icon={StickyNote}>
          <div className="px-4 py-4">
            <LectureNotesEditor lectureId={lecture.id} notes={lecture.quickNotes} dict={dict} />
          </div>
        </OSSection>
      )}

      {tab === "slides" && (
        <OSSection
          title={L.slides}
          count={lecture.slides.length}
          icon={Presentation}
          meta={<SectionLink href={`/lectures/${lecture.id}/slides`} label={L.openSlides} />}
        >
          {lecture.slides.length === 0 ? (
            <OSEmptyState
              icon={Presentation}
              title={L.nothingLinkedYet}
              hint={L.nothingLinkedHint}
            />
          ) : (
            lecture.slides.map((s) => (
              <OSRow key={s.id}>
                <Link
                  href={`/lectures/${lecture.id}/slides/${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 hover:text-primary"
                >
                  <PenLine className="size-4 shrink-0 text-muted-foreground" />
                  <ContentText className="truncate text-sm font-medium">{s.title}</ContentText>
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
                  {s.pageCount} {L.tabs.slides.toLowerCase()}
                </span>
              </OSRow>
            ))
          )}
        </OSSection>
      )}

      {tab === "flashcards" && (
        <OSSection
          title={L.flashcards}
          count={lecture.flashcards.length}
          icon={Layers}
          accent={POINT_STYLE.REVIEW}
          meta={
            <div className="flex items-center gap-3">
              {lecture.flashcards.length > 0 && (
                <SectionLink
                  href={`/flashcards?lecture=${lecture.id}`}
                  label={L.openAllFlashcards}
                />
              )}
              <AddFlashcardDialog {...ctx} />
            </div>
          }
        >
          {lecture.flashcards.length === 0 ? (
            <OSEmptyState icon={Layers} title={L.noFlashcardsForLecture} />
          ) : (
            <OSRowGroup limit={8}>
              {lecture.flashcards.map((f) => (
                <OSRow key={f.id}>
                  {/* Was a bare <span>. A card you can see and not open is the
                      dead end this page was full of. */}
                  <Link
                    href={`/flashcards?lecture=${lecture.id}`}
                    className="min-w-0 flex-1 hover:text-primary"
                  >
                    <ContentText className="truncate text-sm">{f.front}</ContentText>
                  </Link>
                  <FlashcardStatusBadge status={f.status} dict={dict} />
                </OSRow>
              ))}
            </OSRowGroup>
          )}
        </OSSection>
      )}

      {tab === "related" && (
        <div className="flex flex-col gap-4">
          <OSSection
            title={L.knowledgeGaps}
            count={lecture.knowledgeGaps.length}
            icon={Lightbulb}
            accent={POINT_STYLE.DEADLINE}
            meta={
              <div className="flex items-center gap-3">
                {lecture.knowledgeGaps.length > 0 && (
                  <SectionLink
                    href={`/knowledge-gaps?lecture=${lecture.id}`}
                    label={L.openAllGaps}
                  />
                )}
                <AddGapDialog {...ctx} />
              </div>
            }
          >
            {lecture.knowledgeGaps.length === 0 ? (
              <OSEmptyState title={L.noGapsYet} />
            ) : (
              <OSRowGroup limit={6}>
                {lecture.knowledgeGaps.map((g) => (
                  <OSRow key={g.id}>
                    <Link
                      href={`/knowledge-gaps?gap=${g.id}`}
                      className="min-w-0 flex-1 hover:text-primary"
                    >
                      <ContentText className="truncate text-sm">{g.title}</ContentText>
                    </Link>
                    <GapStatusBadge status={g.status} dict={dict} />
                  </OSRow>
                ))}
              </OSRowGroup>
            )}
          </OSSection>

          <OSSection
            title={L.practiceQuestions}
            count={lecture.problems.length}
            icon={ListChecks}
            accent={markerFor("CLASS")}
            meta={
              <div className="flex items-center gap-3">
                {lecture.problems.length > 0 && (
                  <SectionLink
                    href={`/problems?lecture=${lecture.id}`}
                    label={L.openAllQuestions}
                  />
                )}
                <AddProblemDialog {...ctx} />
              </div>
            }
          >
            {lecture.problems.length === 0 ? (
              <OSEmptyState title={L.noQuestionsYet} />
            ) : (
              <OSRowGroup limit={6}>
                {lecture.problems.map((p) => (
                  <OSRow key={p.id}>
                    <Link
                      href={`/problems?lecture=${lecture.id}`}
                      className="min-w-0 flex-1 hover:text-primary"
                    >
                      <ContentText className="truncate text-sm">{p.question}</ContentText>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <DifficultyBadge difficulty={p.difficulty} dict={dict} />
                      <ProblemStatusBadge status={p.status} dict={dict} />
                    </div>
                  </OSRow>
                ))}
              </OSRowGroup>
            )}
          </OSSection>

          {lecture.videos.length > 0 && (
            <OSSection
              title={L.videos}
              count={lecture.videos.length}
              icon={VideoIcon}
              accent={SPAN_STYLE.TUTORIAL.glow}
            >
              {lecture.videos.map((v) => (
                <OSRow key={v.id}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2.5 hover:text-primary"
                  >
                    <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                    <ContentText className="truncate text-sm">{v.title}</ContentText>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                </OSRow>
              ))}
            </OSSection>
          )}
        </div>
      )}
    </div>
  );
}
