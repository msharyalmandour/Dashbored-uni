import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getUrgency } from "@/lib/urgency";
import type { Task, Subject } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function DeadlinesCard({
  dict,
  tasks,
}: {
  dict: Dictionary;
  tasks: (Task & { subject: Subject | null })[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" />
          {dict.dashboard.deadlines}
        </CardTitle>
        <CardDescription>{dict.dashboard.deadlinesSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {dict.dashboard.noDeadlines}
          </p>
        )}
        {tasks.map((task) => {
          const urgency = getUrgency(task.deadline, new Date(), dict);
          return (
            <Link
              key={task.id}
              href={`/tasks?task=${task.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{task.title}</p>
                {task.subject && (
                  <p className="truncate text-xs text-muted-foreground">{task.subject.name}</p>
                )}
              </div>
              <span className={`shrink-0 whitespace-nowrap text-xs font-medium ${urgency.colorClass}`}>
                {urgency.emoji} {urgency.label}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
