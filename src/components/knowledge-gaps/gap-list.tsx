"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { ContentText } from "@/components/ui/content-text";
import { DeleteThing } from "@/components/shared/delete-thing";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateGapStatus } from "@/app/actions/knowledge-gap";
import type { GapListItem } from "@/lib/knowledge-gaps";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";

/**
 * WHAT THIS REPLACES: a five-column board.
 *
 * Measured on the real account on 2026-10-01, and every figure pointed the
 * same way:
 *
 *   gaps                    11
 *   in NOT_UNDERSTOOD       11   — every one, none ever moved
 *   with a linked mistake    0
 *   with a linked flashcard  0
 *   with a linked lecture    0
 *   with a description      11
 *
 * So the board had five columns and content in one, and at phone width the
 * grid collapsed to a single column — which means four headings saying "0"
 * stacked under the only one with anything in it. Meanwhile the card on each
 * row carried two counters that were zero and a lecture link that was null,
 * on all eleven.
 *
 * None of that is the student refusing to use a board. It is a board asking
 * for a drag: moving a gap is a gesture you perform ON a record, and nobody
 * opens a study app to maintain records. So the status moves to a control on
 * the row — one tap, the same `updateGapStatus` the panel always called — and
 * the columns become sections that appear only when they hold something, the
 * way the review page already does it.
 *
 * THE FIVE STATUSES STAY. Collapsing them to three was tempting and would
 * have been a data change: `GapStatus` has five members, every resolution
 * check in this codebase reads `UNDERSTOOD` or `MASTERED`, and the review
 * scheduler fires on them. The interface stops making you navigate them; it
 * does not stop you choosing one.
 *
 * The panel survives, because 11 of 11 gaps carry a real description — it is
 * the one thing here with text worth opening. What came off it: the two
 * zero counters.
 */
const STATUSES: {
  status: GapListItem["status"];
  labelKey: "notUnderstood" | "learning" | "practicing" | "understood" | "mastered";
}[] = [
  { status: "NOT_UNDERSTOOD", labelKey: "notUnderstood" },
  { status: "LEARNING", labelKey: "learning" },
  { status: "PRACTICING", labelKey: "practicing" },
  { status: "UNDERSTOOD", labelKey: "understood" },
  { status: "MASTERED", labelKey: "mastered" },
];

export function GapList({ gaps }: { gaps: GapListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict, locale } = useI18n();
  const t = dict.knowledgeGaps;

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

  async function move(id: string, status: GapListItem["status"]) {
    try {
      await updateGapStatus(id, status);
      if (status === "UNDERSTOOD" || status === "MASTERED") {
        toast.success(dict.status.gap[status]);
      }
      router.refresh();
    } catch {
      toast.error(dict.common.somethingWentWrong);
    }
  }

  const byStatus = new Map<GapListItem["status"], GapListItem[]>();
  for (const gap of gaps) {
    const bucket = byStatus.get(gap.status);
    if (bucket) bucket.push(gap);
    else byStatus.set(gap.status, [gap]);
  }

  // Only the statuses that hold something. An empty heading is not news.
  const present = STATUSES.filter((s) => (byStatus.get(s.status)?.length ?? 0) > 0);

  if (gaps.length === 0) {
    return (
      <TtSection title={t.title}>
        <TtEmpty>{t.nothingHere}</TtEmpty>
      </TtSection>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {present.map(({ status, labelKey }) => {
          const items = byStatus.get(status)!;
          return (
            <TtSection
              key={status}
              title={t.columns[labelKey]}
              count={items.length}
              // Eleven in one section today, and a gap list grows rather than
              // clears, so it gets paper.
              ground
            >
              {items.map((gap) => (
                <TtRow key={gap.id}>
                  <span className="tt-n tt-latin" />

                  <button
                    type="button"
                    onClick={() => openGap(gap.id)}
                    className="tt-label flex min-w-0 items-center gap-2 text-start hover:underline"
                  >
                    {/* The course as a dot in its own colour, not its name on
                        every row — the same choice the review rows made. */}
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: gap.subjectColor }}
                      title={gap.subjectName}
                    />
                    <ContentText className="truncate">{gap.title}</ContentText>
                  </button>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tt-meta hidden sm:inline">
                      {dict.common[gap.difficulty.toLowerCase() as "easy" | "medium" | "hard"]}
                    </span>
                    {/* The whole point of the rewrite: moving a gap is one tap
                        here instead of a drag between columns. */}
                    <Select value={gap.status} onValueChange={(v) => move(gap.id, v as GapListItem["status"])}>
                      <SelectTrigger
                        aria-label={dict.common.status}
                        className="h-7 w-auto gap-1 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-[color:var(--accent)]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.status} value={s.status} className="text-xs">
                            {t.columns[s.labelKey]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </TtRow>
              ))}
            </TtSection>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          {selected && (
            <div className="flex flex-col gap-5 p-6">
              <SheetHeader className="p-0">
                <SheetTitle>
                  <ContentText>{selected.title}</ContentText>
                </SheetTitle>
                {selected.description && (
                  <SheetDescription>
                    <ContentText>{selected.description}</ContentText>
                  </SheetDescription>
                )}
              </SheetHeader>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <ContentText style={{ color: selected.subjectColor }}>
                  {selected.subjectName}
                </ContentText>
                <span aria-hidden>·</span>
                <span>
                  {dict.common[selected.difficulty.toLowerCase() as "easy" | "medium" | "hard"]}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {t.sourceLabels[selected.source as keyof typeof t.sourceLabels] ?? selected.source}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {t.created} {formatDate(selected.createdAt, locale)}
                </span>
              </p>

              {/* TWO COUNTERS CAME OFF THIS PANEL. They read "0 related
                  mistakes" and "0 related flashcards" as two bordered tiles
                  with icons, on all eleven gaps, because nothing in this app
                  links either one to a gap yet. A tile whose only possible
                  value is zero is a tile reporting on the app, not on the
                  student. */}

              {selected.lectureId && (
                <Link
                  href={`/lectures/${selected.lectureId}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <BookOpen className="size-4 text-muted-foreground" />
                  <ContentText>{selected.lectureTitle}</ContentText>
                </Link>
              )}

              <div className="flex justify-end border-t border-[color:var(--border)] pt-3">
                {/* In the panel rather than on the row. A list of forty with a
                    bin on each is a list you delete from by accident; the panel
                    is already the place where this one gap is the subject. */}
                <DeleteThing
                  kind="gap"
                  id={selected.id}
                  name={selected.title}
                  variant="button"
                  keptNote={selected.mistakeCount + selected.flashcardCount > 0}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
