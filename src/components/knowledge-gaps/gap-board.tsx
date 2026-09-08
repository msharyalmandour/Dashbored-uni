"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Layers, BookOpen, Calendar } from "lucide-react";
import { GapCard } from "@/components/knowledge-gaps/gap-card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DifficultyBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { updateGapStatus } from "@/app/actions/knowledge-gap";
import type { GapListItem } from "@/lib/knowledge-gaps";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";

const COLUMNS: { status: GapListItem["status"]; labelKey: "notUnderstood" | "learning" | "practicing" | "understood" | "mastered"; emoji: string }[] = [
  { status: "NOT_UNDERSTOOD", labelKey: "notUnderstood", emoji: "❌" },
  { status: "LEARNING", labelKey: "learning", emoji: "🟡" },
  { status: "PRACTICING", labelKey: "practicing", emoji: "🔵" },
  { status: "UNDERSTOOD", labelKey: "understood", emoji: "🟢" },
  { status: "MASTERED", labelKey: "mastered", emoji: "🏆" },
];

export function GapBoard({ gaps }: { gaps: GapListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useI18n();
  const selectedId = searchParams.get("gap");
  const selected = gaps.find((g) => g.id === selectedId) ?? null;

  function openGap(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("gap", id);
    router.push(`/knowledge-gaps?${params.toString()}`, { scroll: false });
  }

  function closeSheet(open: boolean) {
    if (open) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("gap");
    router.push(`/knowledge-gaps?${params.toString()}`, { scroll: false });
  }

  async function handleStatusChange(status: GapListItem["status"]) {
    if (!selected) return;
    await updateGapStatus(selected.id, status);
    if (status === "UNDERSTOOD" || status === "MASTERED") {
      toast.success(dict.status.gap[status], { description: "A review schedule was created to keep it mastered." });
    }
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = gaps.filter((g) => g.status === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold">
                  {col.emoji} {dict.knowledgeGaps.columns[col.labelKey]}
                </p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    {dict.knowledgeGaps.nothingHere}
                  </p>
                )}
                {items.map((gap) => (
                  <GapCard key={gap.id} gap={gap} onClick={() => openGap(gap.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          {selected && (
            <div className="flex flex-col gap-5 p-6">
              <SheetHeader className="p-0">
                <SheetTitle>{selected.title}</SheetTitle>
                {selected.description && <SheetDescription>{selected.description}</SheetDescription>}
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <DifficultyBadge difficulty={selected.difficulty} dict={dict} />
                <Badge variant="secondary">{selected.source.replace("_", " ")}</Badge>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${selected.subjectColor}22`, color: selected.subjectColor }}
                >
                  {selected.subjectName}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{dict.common.status}</label>
                <Select value={selected.status} onValueChange={(v) => handleStatusChange(v as GapListItem["status"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_UNDERSTOOD">❌ {dict.knowledgeGaps.columns.notUnderstood}</SelectItem>
                    <SelectItem value="LEARNING">🟡 {dict.knowledgeGaps.columns.learning}</SelectItem>
                    <SelectItem value="PRACTICING">🔵 {dict.knowledgeGaps.columns.practicing}</SelectItem>
                    <SelectItem value="UNDERSTOOD">🟢 {dict.knowledgeGaps.columns.understood}</SelectItem>
                    <SelectItem value="MASTERED">🏆 {dict.knowledgeGaps.columns.mastered}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selected.lectureId && (
                <Link
                  href={`/lectures/${selected.lectureId}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                >
                  <BookOpen className="size-4 text-muted-foreground" /> {selected.lectureTitle}
                </Link>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold">
                    <AlertTriangle className="size-4 text-destructive" /> {selected.mistakeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">{dict.knowledgeGaps.relatedMistakes}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold">
                    <Layers className="size-4 text-primary" /> {selected.flashcardCount}
                  </p>
                  <p className="text-xs text-muted-foreground">{dict.knowledgeGaps.relatedFlashcards}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                {dict.knowledgeGaps.created} {formatDate(selected.createdAt)}
                {selected.resolvedAt && ` · ${dict.knowledgeGaps.resolvedOn} ${formatDate(selected.resolvedAt)}`}
                {selected.nextReviewDate && ` · ${dict.knowledgeGaps.nextReview} ${formatDate(selected.nextReviewDate)}`}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
