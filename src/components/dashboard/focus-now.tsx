import Link from "next/link";
import { Flame, Lightbulb, CheckSquare, RotateCcw, AlertTriangle, Layers, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
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

/**
 * The dashboard's single largest, most confident element — deliberately not
 * a list. One recommendation gets full editorial treatment (icon, subject,
 * headline-scale title, reason, one clear action); the next couple ride
 * along underneath as a quiet, unboxed queue. This is the "what matters
 * most" anchor the rest of the Today composition is built around.
 */
export function FocusNow({ dict, recommendations }: { dict: Dictionary; recommendations: Recommendation[] }) {
  const [top, ...rest] = recommendations;
  const secondary = rest.slice(0, 2);

  const TIER_STYLE = {
    HIGH: { label: dict.dashboard.highPriority, badge: "destructive" as const },
    MEDIUM: { label: dict.dashboard.mediumPriority, badge: "warning" as const },
    LOW: { label: dict.dashboard.lowPriority, badge: "muted" as const },
  };

  if (!top) {
    return (
      <Card variant="elevated" className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Flame className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{dict.dashboard.caughtUpTitle}</p>
        <p className="text-xs text-muted-foreground">{dict.dashboard.caughtUpSubtitle}</p>
      </Card>
    );
  }

  const Icon = TYPE_ICON[top.type];
  const tier = TIER_STYLE[recommendationTier(top.score)];

  return (
    <Card variant="elevated" className="flex flex-col gap-5 p-6 sm:p-8">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Flame className="size-3.5 text-destructive" /> {dict.dashboard.whatNext}
      </p>

      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tier.badge}>{tier.label}</Badge>
            {top.subjectName && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: top.subjectColor }} />
                {top.subjectName}
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold leading-snug sm:text-2xl">{top.title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {dict.dashboard.reason} {top.reason} · ~{top.estimatedMinutes} {dict.common.min}
          </p>
        </div>
      </div>

      <Button asChild size="lg" className="w-fit">
        <Link href={top.href}>
          {dict.dashboard.start} <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </Button>

      {secondary.length > 0 && (
        <div className="flex flex-col border-t border-border-subtle pt-3">
          {secondary.map((rec) => {
            const SecIcon = TYPE_ICON[rec.type];
            return (
              <Link
                key={rec.id}
                href={rec.href}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <SecIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{rec.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ~{rec.estimatedMinutes} {dict.common.min}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
