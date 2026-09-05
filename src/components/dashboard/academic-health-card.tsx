import { HeartPulse, Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatHealthSignal, type AcademicHealth } from "@/lib/academic-health";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function AcademicHealthCard({ dict, health }: { dict: Dictionary; health: AcademicHealth }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - health.score / 100);

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="size-4 text-primary" />
          {dict.dashboard.academicHealth}
        </CardTitle>
        <CardDescription>{dict.dashboard.academicHealthSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex size-24 shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
              <circle cx="50" cy="50" r="42" strokeWidth="9" className="fill-none stroke-muted" />
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="9"
                strokeLinecap="round"
                className={cn("fill-none transition-all duration-700", scoreColor(health.score))}
                stroke="currentColor"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="absolute font-display text-2xl font-bold">{health.score}</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {Object.entries(health.breakdown).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-muted-foreground">
                  {dict.dashboard.healthLabels[key as keyof Dictionary["dashboard"]["healthLabels"]]}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full bg-primary")}
                    style={{ width: `${Math.round(value)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2">
          <div>
            {health.strengths.slice(0, 3).map((s) => (
              <p key={s.key} className="flex items-start gap-1.5 text-xs text-success">
                <Check className="mt-0.5 size-3 shrink-0" /> {formatHealthSignal(s, dict)}
              </p>
            ))}
          </div>
          <div>
            {health.weaknesses.slice(0, 3).map((w) => (
              <p key={w.key} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {formatHealthSignal(w, dict)}
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
