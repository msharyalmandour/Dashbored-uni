import { AlertOctagon } from "lucide-react";
import type { RepeatedWeakness } from "@/lib/mistake-patterns";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function RepeatedWeaknessBanner({ weaknesses, dict }: { weaknesses: RepeatedWeakness[]; dict: Dictionary }) {
  if (weaknesses.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {weaknesses.map((w) => (
        <div
          key={w.key}
          className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">{dict.mistakes.repeatedDetected}</p>
              <p className="text-sm">
                <span className="text-muted-foreground">{dict.mistakes.topicLabel} </span>
                <span className="font-medium">{w.topicName ?? w.subjectName}</span>
                <span className="text-muted-foreground"> · {dict.mistakes.incorrectAnswers} </span>
                <span className="font-medium">{w.incorrectCount}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dict.mistakes.recommendation} {w.recommendation}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
