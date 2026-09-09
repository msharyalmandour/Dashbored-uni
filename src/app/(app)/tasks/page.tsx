import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { StatCard } from "@/components/shared/stat-card";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskRow, type TaskRowData } from "@/components/tasks/task-row";
import { getUrgency } from "@/lib/urgency";
import { CheckSquare, AlertTriangle, Clock } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { detectFriction } from "@/lib/patterns";
import { isPersonalisationEnabled } from "@/lib/student-profile";

export const metadata = { title: "Tasks & Deadlines" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());
  const now = new Date();

  const [tasks, subjects, postponements, personalisationOn] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      include: { subject: true },
      orderBy: { deadline: "asc" },
    }),
    prisma.subject.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // Every recorded move of a deadline. Read as rows and counted by the
    // pattern engine rather than as a stored tally, so a task that stops
    // being moved stops being flagged.
    prisma.studentEvent.findMany({
      where: {
        userId,
        type: { in: ["TASK_POSTPONED", "STUDENT_STUCK"] },
        taskId: { not: null },
      },
      select: { taskId: true, type: true, occurredAt: true },
    }),
    isPersonalisationEnabled(userId),
  ]);

  // Which tasks have been moved enough times that offering help is warranted.
  // Silent below the threshold: two moves is a week that changed twice, and
  // saying anything about it would be nagging rather than noticing.
  const stuckByTask = new Map<string, number>();
  for (const e of postponements) {
    if (e.type !== "STUDENT_STUCK") continue;
    stuckByTask.set(e.taskId!, (stuckByTask.get(e.taskId!) ?? 0) + 1);
  }

  const frictionByTask = new Map(
    personalisationOn
      ? detectFriction(
          postponements
            .filter((p) => p.type === "TASK_POSTPONED")
            .map((p) => ({ taskId: p.taskId!, occurredAt: p.occurredAt })),
          stuckByTask
        ).map((f) => [f.taskId, f])
      : []
  );

  const active = tasks.filter((t) => t.status !== "COMPLETED");
  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const overdueCount = active.filter((t) => t.deadline < now).length;
  const dueSoonCount = active.filter((t) => {
    const days = (t.deadline.getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 3;
  }).length;

  const groups: Record<string, typeof tasks> = {
    OVERDUE: [],
    TODAY: [],
    SOON: [],
    UPCOMING: [],
    FUTURE: [],
  };
  for (const t of active) {
    groups[getUrgency(t.deadline).level].push(t);
  }

  const SECTION_LABELS: [key: string, emoji: string, labelKey: "sectionOverdue" | "sectionToday" | "sectionSoon" | "sectionUpcoming" | "sectionFuture"][] = [
    ["OVERDUE", "🔴", "sectionOverdue"],
    ["TODAY", "🔴", "sectionToday"],
    ["SOON", "🟠", "sectionSoon"],
    ["UPCOMING", "🟡", "sectionUpcoming"],
    ["FUTURE", "🟢", "sectionFuture"],
  ];

  function toRow(t: (typeof tasks)[number]): TaskRowData {
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      status: t.status,
      deadline: t.deadline.toISOString(),
      subjectName: t.subject?.name ?? null,
      subjectColor: t.subject?.color ?? null,
      postponements: frictionByTask.get(t.id)?.postponements ?? 0,
      stuckCount: frictionByTask.get(t.id)?.stuckCount ?? 0,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.tasks.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.tasks.subtitle}</p>
        </div>
        <CreateTaskDialog subjects={subjects} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={dict.tasks.activeTasks} value={active.length} icon={CheckSquare} />
        <StatCard label={dict.tasks.overdue} value={overdueCount} icon={AlertTriangle} tone={overdueCount > 0 ? "destructive" : "default"} />
        <StatCard label={dict.tasks.dueWithin3} value={dueSoonCount} icon={Clock} tone={dueSoonCount > 0 ? "warning" : "default"} />
      </div>

      {active.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          {dict.tasks.nothingOutstanding}
        </p>
      )}

      {SECTION_LABELS.map(([key, emoji, labelKey]) =>
        groups[key].length > 0 ? (
          <div key={key}>
            <h2 className="mb-2.5 text-sm font-semibold">{emoji} {dict.tasks[labelKey]} ({groups[key].length})</h2>
            <div className="flex flex-col gap-2">
              {groups[key].map((t) => (
                <TaskRow key={t.id} task={toRow(t)} />
              ))}
            </div>
          </div>
        ) : null
      )}

      {completed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
            {dict.tasks.completedSection} ({completed.length})
          </summary>
          <div className="mt-2.5 flex flex-col gap-2">
            {completed.map((t) => (
              <TaskRow key={t.id} task={toRow(t)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
