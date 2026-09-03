import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function KnowledgeGapsCard({
  summary,
}: {
  summary: { total: number; unresolved: number; difficult: number; recentlyResolved: number };
}) {
  const stats = [
    { label: "Total", value: summary.total },
    { label: "Unresolved", value: summary.unresolved, tone: "text-destructive" },
    { label: "Difficult", value: summary.difficult, tone: "text-warning-foreground" },
    { label: "Resolved (7d)", value: summary.recentlyResolved, tone: "text-success" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-primary" />
          Knowledge Gaps
        </CardTitle>
        <CardDescription>Everything you don&apos;t understand yet, in one place.</CardDescription>
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
            Open Knowledge Gap Center <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
