import Link from "next/link";
import { Flame, Lightbulb, CheckSquare, RotateCcw, AlertTriangle, Layers, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/priority-engine";
import { recommendationTier } from "@/lib/priority-engine";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TYPE_ICON: Record<Recommendation["type"], typeof Layers> = {
  FLASHCARDS: Layers,
  KNOWLEDGE_GAP: Lightbulb,
  TASK: CheckSquare,
  REVIEW: RotateCcw,
  MISTAKE: AlertTriangle,
};

export function NextActions({
  dict,
  recommendations,
}: {
  dict: Dictionary;
  recommendations: Recommendation[];
}) {
  const top = recommendations.slice(0, 3);
  const TIER_STYLE = {
    HIGH: { label: dict.dashboard.highPriority, badge: "destructive" as const },
    MEDIUM: { label: dict.dashboard.mediumPriority, badge: "warning" as const },
    LOW: { label: dict.dashboard.lowPriority, badge: "muted" as const },
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="size-4 text-destructive" />
            {dict.dashboard.whatNext}
          </CardTitle>
          <CardDescription>{dict.dashboard.whatNextSubtitle}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {top.length === 0 && <EmptyState dict={dict} />}
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
                    {dict.dashboard.reason} {rec.reason} · ~{rec.estimatedMinutes} {dict.common.min}
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="secondary" className="shrink-0 self-start sm:self-center">
                <Link href={rec.href}>
                  {dict.dashboard.start} <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EmptyState({ dict }: { dict: Dictionary }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
      <Flame className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{dict.dashboard.caughtUpTitle}</p>
      <p className="text-xs text-muted-foreground">{dict.dashboard.caughtUpSubtitle}</p>
    </div>
  );
}
