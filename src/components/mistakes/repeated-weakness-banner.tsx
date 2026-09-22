import { AlertOctagon } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import type { RepeatedWeakness } from "@/lib/mistake-patterns";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function RepeatedWeaknessBanner({ weaknesses, dict }: { weaknesses: RepeatedWeakness[]; dict: Dictionary }) {
  if (weaknesses.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {weaknesses.map((w) => (
        <div
          key={w.key}
          /* `bg-destructive/5` is 5% of a colour over a photograph, which is a
             border with trees inside it. This is the loudest thing the app ever
             says to a student — you have got the same thing wrong six times —
             and it was the one surface on the page still letting the forest
             through. Opaque, with the red carried by the rim and the heading
             rather than by a wash nobody can see. */
          className="flex flex-col gap-2 rounded-xl bg-[oklch(16%_0.045_25_/_96%)] p-4 shadow-[inset_0_0_0_1px_oklch(62.6%_0.1933_23_/_38%),0_10px_30px_-18px_oklch(0%_0_0_/_70%)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">{dict.mistakes.repeatedDetected}</p>
              <p className="text-sm">
                <span className="text-muted-foreground">{dict.mistakes.topicLabel} </span>
                <ContentText className="font-medium">{w.topicName ?? w.subjectName}</ContentText>
                <span className="text-muted-foreground"> · {dict.mistakes.incorrectAnswers} </span>
                <span className="font-medium">{w.incorrectCount}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dict.mistakes.recommendation} <ContentText>{w.recommendation}</ContentText>
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
