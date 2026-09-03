import Link from "next/link";
import { BookOpen, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

export function SubjectCard({ subject }: { subject: SubjectCardData }) {
  return (
    <Link href={`/subjects/${subject.id}`}>
      <Card className="group relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: subject.color }} />
        <div className="flex h-full flex-col gap-3 p-5">
          <div>
            <p className="font-display text-sm font-semibold group-hover:text-primary">{subject.name}</p>
            <p className="text-xs text-muted-foreground">
              {subject.code ?? "No code"} · {subject.creditHours} credit hrs
            </p>
            {subject.instructor && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subject.instructor}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion</span>
              <span>{Math.round(subject.avgCompletion)}%</span>
            </div>
            <Progress value={subject.avgCompletion} />
          </div>

          <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5" /> {subject.lectureCount} lectures
            </span>
            {subject.unresolvedGaps > 0 && (
              <Badge variant="warning" className="ml-auto">
                <Lightbulb className="size-3" /> {subject.unresolvedGaps} gap
                {subject.unresolvedGaps === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
