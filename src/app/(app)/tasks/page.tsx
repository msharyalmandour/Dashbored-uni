import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskRow, type TaskRowData } from "@/components/tasks/task-row";
import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { dayCapacity, remainingCapacityToday } from "@/lib/time-intelligence";
import { TtSection, TtEmpty } from "@/components/shared/tt";

import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { detectFriction } from "@/lib/patterns";
import { isPersonalisationEnabled } from "@/lib/student-profile";

export const generateMetadata = pageTitle((dict) => dict.nav.items.tasks.label);
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
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

  /* The one figure the sidebar ring draws. From the capacity engine, which
     already knows how to refuse to answer when the week is unknown — an
     empty TimeCommitment table computes to twenty-four free hours a day. */
  const commitments = await prisma.timeCommitment.findMany({
    where: { userId },
    select: { id: true, kind: true, label: true, weekday: true, startMinute: true, endMinute: true },
  });
  const remaining = remainingCapacityToday(commitments, now);
  const today = dayCapacity(commitments, now);

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    estimatedMinutes: t.estimatedMinutes,
    subjectName: t.subject?.name ?? null,
    subjectId: t.subjectId ?? null,
    /* The agent files from a drop and stamps the capture id; anything
       without one he typed himself. */
    fromDrop: t.sourceCaptureId !== null,
  }));

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

  /* Only the tasks the pattern engine actually flagged. The board has
     nowhere to say "this one has moved three times", and that is the one
     thing on this page read from a PATTERN rather than from a row, so the
     old row survives for exactly those. */
  const nudged = tasks.filter(
    (t) => t.status !== "COMPLETED" && frictionByTask.has(t.id)
  );

  const active = tasks.filter((t) => t.status !== "COMPLETED");
  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const overdueCount = active.filter((t) => t.deadline < now).length;
  const dueSoonCount = active.filter((t) => {
    const days = (t.deadline.getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 3;
  }).length;



  function toRow(t: (typeof tasks)[number]): TaskRowData {
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      status: t.status,
      deadline: t.deadline.toISOString(),
      subjectName: t.subject?.name ?? null,
      subjectId: t.subjectId ?? null,
      subjectColor: t.subject?.color ?? null,
      postponements: frictionByTask.get(t.id)?.postponements ?? 0,
      stuckCount: frictionByTask.get(t.id)?.stuckCount ?? 0,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader
        title={dict.tasks.title}
        state={
          <StateLine
            template={overdueCount > 0 ? dict.tasks.stateLine : dict.tasks.stateLineClear}
            values={{ overdue: overdueCount, soon: dueSoonCount, active: active.length }}
            tones={{ overdue: "due", soon: "due" }}
          />
        }
        actions={<CreateTaskDialog subjects={subjects} />}
      />

      {/* THE BOARD REPLACES THE FIVE SECTIONS.
      
          متأخرة · هالأسبوع · بعدين · خلصت, which is four piles rather than
          five bands of urgency plus a collapsed "completed" at the bottom.
          The old list is gone rather than kept beside it: two lists of the
          same fifteen tasks on one page is a worse screen than either.
      
          What it must not lose is the writing. The toggle in each row calls
          `updateTaskStatus`, the same server action the old row called, so
          the board is a different layout over the same data and not a second
          way of changing it. The postpone affordance and the "تأجلت N مرات"
          nudge have NOT been carried over yet — see the note below. */}
      {active.length === 0 && completed.length === 0 ? (
        <TtSection title={dict.tasks.title}>
          <TtEmpty>{dict.tasks.nothingOutstanding}</TtEmpty>
        </TtSection>
      ) : (
        <TaskBoard
          tasks={boardTasks}
          nowMs={now.getTime()}
          remainingStudyMinutes={remaining.studyMinutes}
          totalStudyMinutes={Math.round(today.flexibleMinutes * (2 / 3))}
          locale={locale}
          t={dict.tasks.board}
          priorityNames={dict.status.taskPriority}
          typeNames={dict.status.taskType}
        />
      )}

      {/* The deadline-moving help, kept because it is the one thing on this
          page that reads a PATTERN rather than a row: a task moved three
          times is a task he is avoiding, and the board has nowhere to say
          so. It only renders for tasks that have actually been moved. */}
      {nudged.length > 0 && (
        <TtSection title={dict.tasks.activeTasks} ground>
          {nudged.map((t) => (
            <TaskRow key={t.id} task={toRow(t)} />
          ))}
        </TtSection>
      )}

    </div>
  );
}
