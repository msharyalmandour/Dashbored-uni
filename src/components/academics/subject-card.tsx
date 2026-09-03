import Link from "next/link";
import { BookOpen, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface SubjectCardData {
  id: string;
  name: string;
  code: string | null;
  color: string;
  instructor: string | null;
  creditHours: number;
  lectureCount: number;
  avgCompletion: number;
  unresolvedGaps: number;
}

export function SubjectCard({ subject, dict }: { subject: SubjectCardData; dict: Dictionary }) {
  return (
    <Link href={`/subjects/${subject.id}`}>
      <Card className="group relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: subject.color }} />
        <div className="flex h-full flex-col gap-3 p-5">
          <div>
            <p className="font-display text-sm font-semibold group-hover:text-primary">{subject.name}</p>
            <p className="text-xs text-muted-foreground">
              {subject.code ?? dict.academics.noCode} · {subject.creditHours} {dict.academics.creditHours}
            </p>
            {subject.instructor && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subject.instructor}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{dict.lecture.completion}</span>
              <span>{Math.round(subject.avgCompletion)}%</span>
            </div>
            <Progress value={subject.avgCompletion} />
          </div>

          <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5" /> {subject.lectureCount} {dict.academics.lectures}
            </span>
            {subject.unresolvedGaps > 0 && (
              <Badge variant="warning" className="ms-auto">
                <Lightbulb className="size-3" /> {subject.unresolvedGaps}{" "}
                {subject.unresolvedGaps === 1 ? dict.academics.gap : dict.academics.gaps}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
