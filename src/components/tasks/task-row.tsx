"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getUrgency } from "@/lib/urgency";
import { updateTaskStatus } from "@/app/actions/tasks";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";
import type { TaskType, TaskPriority } from "@prisma/client";

export interface TaskRowData {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  deadline: string;
  subjectName: string | null;
  subjectColor: string | null;
}

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "secondary" | "muted"> = {
  URGENT: "destructive",
  HIGH: "warning",
  MEDIUM: "secondary",
  LOW: "muted",
};

export function TaskRow({ task }: { task: TaskRowData }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [pending, startTransition] = React.useTransition();
  const done = task.status === "COMPLETED";
  const urgency = getUrgency(new Date(task.deadline), new Date(), dict);

  function complete() {
    startTransition(async () => {
      await updateTaskStatus(task.id, done ? "NOT_STARTED" : "COMPLETED");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={complete}
          disabled={pending}
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40 hover:border-primary"
          }`}
        >
          {done && <Check className="size-3" />}
        </button>
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {task.subjectName && <span style={{ color: task.subjectColor ?? undefined }}>{task.subjectName}</span>}
            <span>· {dict.status.taskType[task.type as TaskType] ?? task.type}</span>
            <span>· {formatDate(task.deadline)}</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[task.priority] ?? "muted"}>
          {dict.status.taskPriority[task.priority as TaskPriority] ?? task.priority}
        </Badge>
        {!done && (
          <span className={`text-xs font-medium ${urgency.colorClass}`}>
            {urgency.emoji} {urgency.label}
          </span>
        )}
      </div>
    </div>
  );
}
