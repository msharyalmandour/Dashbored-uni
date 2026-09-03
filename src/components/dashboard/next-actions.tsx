import Link from "next/link";
import { Flame, Lightbulb, CheckSquare, RotateCcw, AlertTriangle, Layers, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/priority-engine";
import { recommendationTier } from "@/lib/priority-engine";

const TYPE_ICON: Record<Recommendation["type"], typeof Layers> = {
  FLASHCARDS: Layers,
  KNOWLEDGE_GAP: Lightbulb,
  TASK: CheckSquare,
  REVIEW: RotateCcw,
  MISTAKE: AlertTriangle,
};

const TIER_STYLE = {
  HIGH: { label: "🔥 High Priority", badge: "destructive" as const },
  MEDIUM: { label: "Medium Priority", badge: "warning" as const },
  LOW: { label: "Low Priority", badge: "muted" as const },
};

export function NextActions({ recommendations }: { recommendations: Recommendation[] }) {
  const top = recommendations.slice(0, 3);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="size-4 text-destructive" />
            What Should I Do Next?
          </CardTitle>
          <CardDescription>Ranked by the Smart Priority Engine — every action explains why.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {top.length === 0 && (
          <EmptyState />
        )}
        {top.map((rec, i) => {
          const Icon = TYPE_ICON[rec.type];
          const tier = TIER_STYLE[recommendationTier(rec.score)];
          return (
            <div
              key={rec.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {i + 1}
                </span>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={tier.badge}>{tier.label}</Badge>
                    {rec.subjectName && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: rec.subjectColor }}
                        />
                        {rec.subjectName}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {rec.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Reason: {rec.reason} · ~{rec.estimatedMinutes} min
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="secondary" className="shrink-0 self-start sm:self-center">
                <Link href={rec.href}>
                  Start <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
      <Flame className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You&apos;re fully caught up</p>
      <p className="text-xs text-muted-foreground">
        No overdue reviews, gaps, or deadlines right now. Nice work.
      </p>
    </div>
  );
}
