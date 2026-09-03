import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { StatCard } from "@/components/shared/stat-card";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskRow, type TaskRowData } from "@/components/tasks/task-row";
import { getUrgency } from "@/lib/urgency";
import { CheckSquare, AlertTriangle, Clock } from "lucide-react";

export const metadata = { title: "Tasks & Deadlines" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const userId = await getCurrentUserId();
  const now = new Date();

  const [tasks, subjects] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      include: { subject: true },
      orderBy: { deadline: "asc" },
    }),
    prisma.subject.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

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

  const SECTION_LABELS: [key: string, label: string][] = [
    ["OVERDUE", "🔴 Overdue"],
    ["TODAY", "🔴 Due Today"],
    ["SOON", "🟠 Due Within 3 Days"],
    ["UPCOMING", "🟡 Due Within 7 Days"],
    ["FUTURE", "🟢 Future"],
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
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Tasks &amp; Deadlines</h1>
          <p className="text-sm text-muted-foreground">Assignments, exams, projects — auto-sorted by urgency.</p>
        </div>
        <CreateTaskDialog subjects={subjects} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Tasks" value={active.length} icon={CheckSquare} />
        <StatCard label="Overdue" value={overdueCount} icon={AlertTriangle} tone={overdueCount > 0 ? "destructive" : "default"} />
        <StatCard label="Due Within 3 Days" value={dueSoonCount} icon={Clock} tone={dueSoonCount > 0 ? "warning" : "default"} />
      </div>

      {active.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Nothing outstanding — add a task or enjoy the calm.
        </p>
      )}

      {SECTION_LABELS.map(([key, label]) =>
        groups[key].length > 0 ? (
          <div key={key}>
            <h2 className="mb-2.5 text-sm font-semibold">{label} ({groups[key].length})</h2>
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
            Completed ({completed.length})
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
