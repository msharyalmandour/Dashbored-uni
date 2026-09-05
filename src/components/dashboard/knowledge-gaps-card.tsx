import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function KnowledgeGapsCard({
  dict,
  summary,
}: {
  dict: Dictionary;
  summary: { total: number; unresolved: number; difficult: number; recentlyResolved: number };
}) {
  const stats = [
    { label: dict.dashboard.total, value: summary.total },
    { label: dict.dashboard.unresolved, value: summary.unresolved, tone: "text-destructive" },
    { label: dict.dashboard.difficult, value: summary.difficult, tone: "text-amber-700 dark:text-amber-400" },
    { label: dict.dashboard.resolved7d, value: summary.recentlyResolved, tone: "text-success" },
  ];

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-primary" />
          {dict.dashboard.knowledgeGaps}
        </CardTitle>
        <CardDescription>{dict.dashboard.knowledgeGapsSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3 text-center">
              <p className={`font-display text-xl font-semibold ${s.tone ?? ""}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <Button asChild variant="secondary" size="sm" className="self-start">
          <Link href="/knowledge-gaps">
            {dict.dashboard.openGapCenter} <ArrowRight className="size-3.5 rtl:rotate-180" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
