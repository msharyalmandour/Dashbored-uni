import Link from "next/link";
import { Flame, Lightbulb, CheckSquare, RotateCcw, AlertTriangle, Layers, ArrowRight, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/priority-engine";
import { recommendationTier } from "@/lib/priority-engine";
import type { NextBestAction } from "@/lib/decision-engine";
import type { DayCapacity } from "@/lib/time-intelligence";
import { formatMinutes } from "@/lib/time-intelligence";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";

const TYPE_ICON: Record<Recommendation["type"], typeof Layers> = {
  FLASHCARDS: Layers,
  KNOWLEDGE_GAP: Lightbulb,
  TASK: CheckSquare,
  REVIEW: RotateCcw,
  MISTAKE: AlertTriangle,
};

/**
 * Why this action and not the other eleven.
 *
 * The sentence exists because an unexplained recommendation is just an
 * instruction, and the product's whole claim is that it can say *why*. It is
 * also where the system admits when it demoted the top priority to fit the
 * time available, rather than quietly showing something smaller and letting
 * the student assume it was the most important thing.
 */
function basisLine(action: NextBestAction, capacity: DayCapacity, dict: Dictionary): string {
  const time = formatMinutes(capacity.studyMinutes, {
    hours: dict.time.hours,
    minutes: dict.time.minutes,
  });
  switch (action.basis) {
    case "TOP_PRIORITY_FITS":
      return format(dict.decision.fitsTime, { time });
    case "SCALED_TO_TIME":
      return format(dict.decision.scaledToTime, { time });
    case "DAY_IS_FULL":
      return dict.decision.dayIsFull;
    case "TIME_UNKNOWN":
      return dict.decision.timeUnknown;
  }
}

/**
 * Flashcards and reviews already have a purpose-built one-at-a-time flow;
 * dropping a timer in front of them would add a step, not focus. Everything
 * else is open work, where a session with a clock is the thing that turns
 * "I should study" into studying.
 */
const RUNS_AS_SESSION = new Set<Recommendation["type"]>(["TASK", "KNOWLEDGE_GAP", "MISTAKE"]);

/**
 * Where Start actually goes.
 *
 * It used to drop the student on the module page — /tasks, a list of forty
 * rows — which is the screen they were already avoiding. Handing the session
 * over in the URL means Start begins the work it just named.
 */
function startHref(rec: Recommendation, reason: string): string {
  if (!RUNS_AS_SESSION.has(rec.type)) return rec.href;
  const params = new URLSearchParams({
    do: rec.title,
    minutes: String(rec.estimatedMinutes),
    why: reason,
  });
  if (rec.subjectId) params.set("subject", rec.subjectId);
  if (rec.taskId) params.set("task", rec.taskId);
  return `/focus?${params.toString()}`;
}

/**
 * The dashboard's single largest, most confident element — deliberately not
 * a list. One recommendation gets full editorial treatment (icon, subject,
 * headline-scale title, reason, one clear action); the next couple ride
 * along underneath as a quiet, unboxed queue. This is the "what matters
 * most" anchor the rest of the Today composition is built around.
 *
 * `decision` is what makes the answer specific to *now*: the same ranked
 * signals, narrowed to the one thing that fits the hours genuinely left.
 * It is optional so the component still renders correctly for a student who
 * has told the system nothing about their week.
 */
export function FocusNow({
  dict,
  recommendations,
  decision,
}: {
  dict: Dictionary;
  recommendations: Recommendation[];
  decision?: { action: NextBestAction | null; capacity: DayCapacity; needsTimeSetup: boolean };
}) {
  // The decision engine's pick wins when there is one; otherwise fall back to
  // plain rank order, which is what this card showed before it was time-aware.
  const top = decision?.action?.recommendation ?? recommendations[0];
  const secondary = recommendations.filter((r) => r.id !== top?.id).slice(0, 2);

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
    <Card variant="glass" className="flex flex-col gap-5 p-6 sm:p-8">
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

      {/* Why this one, in a sentence — including when the top priority was
          set aside because it does not fit the time that is actually left. */}
      {decision?.action && (
        <p className="-mt-1 flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {basisLine(decision.action, decision.capacity, dict)}
            {decision.needsTimeSetup && (
              <>
                {" "}
                <Link href="/time" className="text-primary underline-offset-2 hover:underline">
                  {dict.decision.setUpTime}
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      <Button asChild size="lg" className="w-fit">
        <Link href={startHref(top, top.reason)}>
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
                href={startHref(rec, rec.reason)}
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
