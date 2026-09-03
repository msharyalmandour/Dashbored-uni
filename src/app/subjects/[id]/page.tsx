import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, BookOpen, Lightbulb, Layers, PencilLine, FileText, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { SubjectTabNav } from "@/components/academics/subject-tab-nav";
import { CreateTopicDialog } from "@/components/academics/create-topic-dialog";
import { CreateLectureDialog } from "@/components/academics/create-lecture-dialog";
import {
  LectureStatusBadge,
  GapStatusBadge,
  ProblemStatusBadge,
  DifficultyBadge,
  FlashcardStatusBadge,
} from "@/components/shared/status-badges";
import { formatDate } from "@/lib/utils";
import { getUrgency } from "@/lib/urgency";

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { semester: true },
  });
  if (!subject) notFound();

  const [lectureCount, topicCount, gapCount, flashcardCount, problemCount] = await Promise.all([
    prisma.lecture.count({ where: { subjectId: id } }),
    prisma.topic.count({ where: { subjectId: id } }),
    prisma.knowledgeGap.count({ where: { subjectId: id, status: { notIn: ["UNDERSTOOD", "MASTERED"] } } }),
    prisma.flashcard.count({ where: { subjectId: id, nextReviewDate: { lte: new Date() } } }),
    prisma.problem.count({ where: { subjectId: id, status: "INCORRECT" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{subject.name}</h1>
              <Badge variant="secondary">{subject.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {subject.code ?? "No code"} · {subject.creditHours} credit hrs
              {subject.instructor ? ` · ${subject.instructor}` : ""} · {subject.semester.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Lectures" value={lectureCount} icon={BookOpen} />
        <StatCard label="Topics" value={topicCount} icon={Layers} />
        <StatCard label="Unresolved Gaps" value={gapCount} icon={Lightbulb} tone={gapCount > 0 ? "warning" : "default"} />
        <StatCard label="Flashcards Due" value={flashcardCount} icon={Layers} tone={flashcardCount > 0 ? "warning" : "default"} />
        <StatCard label="Incorrect Problems" value={problemCount} icon={PencilLine} tone={problemCount > 0 ? "destructive" : "default"} />
      </div>

      <SubjectTabNav subjectId={id} active={tab} />

      {tab === "overview" && <OverviewTab subjectId={id} />}
      {tab === "lectures" && <LecturesTab subjectId={id} />}
      {tab === "topics" && <TopicsTab subjectId={id} />}
      {tab === "flashcards" && <FlashcardsTab subjectId={id} />}
      {tab === "problems" && <ProblemsTab subjectId={id} />}
      {tab === "gaps" && <GapsTab subjectId={id} />}
      {tab === "resources" && <ResourcesTab subjectId={id} />}
      {tab === "analytics" && <AnalyticsTab subjectId={id} />}
    </div>
  );
}

async function OverviewTab({ subjectId }: { subjectId: string }) {
  const [recentLectures, deadlines, gaps] = await Promise.all([
    prisma.lecture.findMany({
      where: { subjectId },
      orderBy: { date: "desc" },
      take: 5,
      include: { topic: true },
    }),
    prisma.task.findMany({
      where: { subjectId, status: { not: "COMPLETED" } },
      orderBy: { deadline: "asc" },
      take: 4,
    }),
    prisma.knowledgeGap.findMany({
      where: { subjectId, status: { notIn: ["UNDERSTOOD", "MASTERED"] } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Lectures</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recentLectures.length === 0 && <EmptyRow text="No lectures yet." />}
          {recentLectures.map((l) => (
            <Link
              key={l.id}
              href={`/lectures/${l.id}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{l.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(l.date)}</p>
              </div>
              <LectureStatusBadge status={l.status} />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {deadlines.length === 0 && <EmptyRow text="Nothing due for this subject." />}
          {deadlines.map((t) => {
            const urgency = getUrgency(t.deadline);
            return (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="truncate font-medium">{t.title}</span>
                <span className={`text-xs font-medium ${urgency.colorClass}`}>{urgency.emoji} {urgency.label}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Open Knowledge Gaps</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/knowledge-gaps?subject=${subjectId}`}>
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {gaps.length === 0 && <EmptyRow text="No open knowledge gaps — great work." />}
          {gaps.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate font-medium">{g.title}</span>
              <GapStatusBadge status={g.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

async function LecturesTab({ subjectId }: { subjectId: string }) {
  const [lectures, topics] = await Promise.all([
    prisma.lecture.findMany({
      where: { subjectId },
      orderBy: { lectureNumber: "asc" },
      include: { topic: true },
    }),
    prisma.topic.findMany({ where: { subjectId }, select: { id: true, name: true } }),
  ]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Lectures</CardTitle>
        <CreateLectureDialog subjectId={subjectId} topics={topics} nextLectureNumber={lectures.length + 1} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {lectures.length === 0 && <EmptyRow text="No lectures yet." />}
        {lectures.map((l) => (
          <Link
            key={l.id}
            href={`/lectures/${l.id}`}
            className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">
                #{l.lectureNumber} {l.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(l.date)}
                {l.topic ? ` · ${l.topic.name}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-3 ${i < l.difficultyRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <div className="w-20">
                <Progress value={l.completionPercentage} />
              </div>
              <LectureStatusBadge status={l.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

async function TopicsTab({ subjectId }: { subjectId: string }) {
  const topics = await prisma.topic.findMany({
    where: { subjectId },
    include: { _count: { select: { lectures: true, knowledgeGaps: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Topics</CardTitle>
        <CreateTopicDialog subjectId={subjectId} />
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topics.length === 0 && <EmptyRow text="No topics yet." />}
        {topics.map((t) => (
          <div key={t.id} className="rounded-lg border border-border p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="truncate font-medium">{t.name}</p>
              <DifficultyBadge difficulty={t.difficulty} />
            </div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Mastery</span>
              <span>{t.masteryLevel}%</span>
            </div>
            <Progress value={t.masteryLevel} />
            <p className="mt-2 text-xs text-muted-foreground">
              {t._count.lectures} lectures · {t._count.knowledgeGaps} gaps
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function FlashcardsTab({ subjectId }: { subjectId: string }) {
  const flashcards = await prisma.flashcard.findMany({
    where: { subjectId },
    orderBy: { nextReviewDate: "asc" },
    take: 20,
  });
  const dueCount = flashcards.filter((f) => f.nextReviewDate <= new Date()).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Flashcards</CardTitle>
        <Button asChild size="sm">
          <Link href={`/flashcards?subject=${subjectId}`}>Review {dueCount > 0 ? `(${dueCount} due)` : ""}</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {flashcards.length === 0 && <EmptyRow text="No flashcards yet — capture one from any lecture." />}
        {flashcards.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="truncate">{f.front}</span>
            <FlashcardStatusBadge status={f.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function ProblemsTab({ subjectId }: { subjectId: string }) {
  const problems = await prisma.problem.findMany({
    where: { subjectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Problems</CardTitle>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/problems?subject=${subjectId}`}>Open Problem Bank</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {problems.length === 0 && <EmptyRow text="No practice problems yet." />}
        {problems.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="truncate">{p.question}</span>
            <ProblemStatusBadge status={p.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function GapsTab({ subjectId }: { subjectId: string }) {
  const gaps = await prisma.knowledgeGap.findMany({
    where: { subjectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Knowledge Gaps</CardTitle>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/knowledge-gaps?subject=${subjectId}`}>Open Knowledge Gap Center</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {gaps.length === 0 && <EmptyRow text="No knowledge gaps recorded." />}
        {gaps.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="truncate">{g.title}</span>
            <GapStatusBadge status={g.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function ResourcesTab({ subjectId }: { subjectId: string }) {
  const lectures = await prisma.lecture.findMany({
    where: { subjectId, resources: { some: {} } },
    include: { resources: true },
    orderBy: { lectureNumber: "asc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resources</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {lectures.length === 0 && <EmptyRow text="No resources uploaded yet." />}
        {lectures.map((l) => (
          <div key={l.id}>
            <Link href={`/lectures/${l.id}`} className="text-sm font-medium hover:text-primary">
              {l.title}
            </Link>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {l.resources.map((r) => (
                <span
                  key={r.id}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                >
                  <FileText className="size-3.5" />
                  {r.title}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function AnalyticsTab({ subjectId }: { subjectId: string }) {
  const [problems, gapsByStatus] = await Promise.all([
    prisma.problem.findMany({ where: { subjectId, status: { in: ["CORRECT", "INCORRECT"] } } }),
    prisma.knowledgeGap.groupBy({ by: ["status"], where: { subjectId }, _count: true }),
  ]);
  const correct = problems.filter((p) => p.status === "CORRECT").length;
  const accuracy = problems.length > 0 ? Math.round((correct / problems.length) * 100) : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Practice Accuracy</CardTitle>
        </CardHeader>
        <CardContent>
          {accuracy === null ? (
            <EmptyRow text="No attempted problems yet." />
          ) : (
            <>
              <p className="font-display text-3xl font-bold">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">
                {correct} correct out of {problems.length} attempted
              </p>
              <Progress value={accuracy} className="mt-3" />
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge Gap Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {gapsByStatus.length === 0 && <EmptyRow text="No knowledge gaps yet." />}
          {gapsByStatus.map((g) => (
            <div key={g.status} className="flex items-center justify-between text-sm">
              <GapStatusBadge status={g.status} />
              <span className="font-medium">{g._count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
