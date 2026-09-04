import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star, FileText, Video as VideoIcon, Link2, StickyNote, Presentation, PenLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeLectureUnderstanding } from "@/lib/understanding-score";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import {
  GapStatusBadge,
  ProblemStatusBadge,
  FlashcardStatusBadge,
  DifficultyBadge,
} from "@/components/shared/status-badges";
import { LectureStatusControl } from "@/components/lectures/lecture-status-control";
import { SelfAssessmentSlider } from "@/components/lectures/self-assessment-slider";
import { LectureNotesEditor } from "@/components/lectures/lecture-notes-editor";
import {
  AddResourceDialog,
  AddGapDialog,
  AddFlashcardDialog,
  AddProblemDialog,
} from "@/components/lectures/lecture-add-dialogs";

const RESOURCE_ICON = { PDF: FileText, POWERPOINT: Presentation, VIDEO: VideoIcon, LINK: Link2, NOTE: StickyNote };

function scoreTone(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dict = getDictionary(await getLocale());

  const lecture = await prisma.lecture.findUnique({
    where: { id },
    include: {
      subject: true,
      topic: true,
      resources: true,
      knowledgeGaps: true,
      flashcards: true,
      problems: true,
      videos: true,
      reviewItems: { orderBy: { scheduledDate: "asc" } },
    },
  });
  if (!lecture) notFound();

  const understanding = await computeLectureUnderstanding(id);
  const ctx = { lectureId: lecture.id, subjectId: lecture.subjectId, topicId: lecture.topicId };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/subjects/${lecture.subjectId}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> {lecture.subject.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              #{lecture.lectureNumber} {lecture.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              {formatDate(lecture.date)}
              {lecture.lecturer ? ` · ${lecture.lecturer}` : ""}
              {lecture.topic ? ` · ${lecture.topic.name}` : ""}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dict.lecture.understandingScore}</CardTitle>
              <CardDescription>{dict.lecture.understandingSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <p className={`font-display text-4xl font-bold ${scoreTone(understanding.score)}`}>
                  {understanding.score}%
                </p>
                <div className="flex-1 space-y-1.5">
                  {Object.entries(understanding.basis).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 capitalize text-muted-foreground">
                        {key === "knowledgeGaps" ? "Knowledge gaps" : key === "selfAssessment" ? "Self-assessment" : key}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dict.lecture.notes}</CardTitle>
            </CardHeader>
            <CardContent>
              <LectureNotesEditor lectureId={lecture.id} notes={lecture.quickNotes} dict={dict} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{dict.lecture.learningResources}</CardTitle>
              <AddResourceDialog {...ctx} />
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {lecture.resources.length === 0 && <EmptyRow text={dict.lecture.noResources} />}
              {lecture.resources.map((r) => {
                const Icon = RESOURCE_ICON[r.type];
                return (
                  <span
                    key={r.id}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <Icon className="size-3.5 text-muted-foreground" /> {r.title}
                  </span>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{dict.lecture.slides}</CardTitle>
              <Link
                href={`/lectures/${lecture.id}/slides`}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <PenLine className="size-3.5" /> {dict.lecture.openSlides}
              </Link>
            </CardHeader>
          </Card>

          {lecture.videos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{dict.lecture.videos}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {lecture.videos.map((v) => (
                  <a
                    key={v.id}
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                  >
                    <VideoIcon className="size-4 text-muted-foreground" /> {v.title}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{dict.lecture.knowledgeGaps}</CardTitle>
              <AddGapDialog {...ctx} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {lecture.knowledgeGaps.length === 0 && <EmptyRow text={dict.lecture.noGapsYet} />}
              {lecture.knowledgeGaps.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="truncate">{g.title}</span>
                  <GapStatusBadge status={g.status} dict={dict} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{dict.lecture.flashcards}</CardTitle>
              <AddFlashcardDialog {...ctx} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {lecture.flashcards.length === 0 && <EmptyRow text={dict.lecture.noFlashcardsForLecture} />}
              {lecture.flashcards.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="truncate">{f.front}</span>
                  <FlashcardStatusBadge status={f.status} dict={dict} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{dict.lecture.practiceQuestions}</CardTitle>
              <AddProblemDialog {...ctx} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {lecture.problems.length === 0 && <EmptyRow text={dict.lecture.noQuestionsYet} />}
              {lecture.problems.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="truncate">{p.question}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <DifficultyBadge difficulty={p.difficulty} dict={dict} />
                    <ProblemStatusBadge status={p.status} dict={dict} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dict.lecture.completion}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dict.lecture.progress}</span>
                  <span>{lecture.completionPercentage}%</span>
                </div>
                <Progress value={lecture.completionPercentage} />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">{dict.lecture.selfAssessed}</p>
                <SelfAssessmentSlider lectureId={lecture.id} value={lecture.selfAssessment} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dict.lecture.reviewSchedule}</CardTitle>
              <CardDescription>{dict.lecture.reviewScheduleSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {lecture.reviewItems.length === 0 && (
                <EmptyRow text={dict.lecture.noScheduleYet} />
              )}
              {lecture.reviewItems.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                  <span className="font-medium">{r.reviewStage.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{formatDate(r.scheduledDate)}</span>
                  <span
                    className={
                      r.status === "COMPLETED"
                        ? "text-success"
                        : r.status === "DUE"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">{text}</p>;
}
