"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageCanvas } from "@/components/lectures/page-canvas";

/**
 * The page rail.
 *
 * A lecture deck is forty slides and the old viewer gave you "page 7 / 40" and
 * two arrows, which means finding the slide about volume of distribution is a
 * matter of clicking next until you recognise it. A rail of thumbnails is how
 * you find a page in a deck you have already read once.
 *
 * The rendering is no longer here. It is in PageCanvas, which the cover on a
 * deck card and the wall of pages also use — the lazy drawing, the device
 * pixel ratio and the cache of drawn pictures were going to be copied into
 * three components otherwise, and the one that got forgotten would have been
 * the image branch, which no PDF test would ever have caught.
 */
export function SlideThumbnails({
  slideId,
  fileUrl,
  fileType,
  pageCount,
  page,
  onSelect,
  label,
}: {
  slideId: string;
  fileUrl: string;
  fileType: string;
  pageCount: number;
  page: number;
  onSelect: (page: number) => void;
  /** Accessible name for the rail, already in the reader's language. */
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex h-full w-[116px] shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain rounded-xl bg-[oklch(11.5%_0.005_55_/_96%)] p-2 shadow-[inset_0_1px_0_oklch(100%_0_0_/_6%)]"
    >
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          aria-current={n === page ? "true" : undefined}
          aria-label={`${label} ${n}`}
          className={cn(
            "relative shrink-0 overflow-hidden rounded-lg bg-white transition-shadow",
            n === page
              ? "shadow-[0_0_0_2px_var(--primary)]"
              : "shadow-[0_0_0_1px_oklch(100%_0_0_/_10%)] hover:shadow-[0_0_0_1px_oklch(100%_0_0_/_25%)]"
          )}
        >
          <PageCanvas
            slideId={slideId}
            fileUrl={fileUrl}
            fileType={fileType}
            page={n}
            width={96}
          />
          <span
            className={cn(
              "absolute bottom-1 end-1 rounded px-1 text-[10px] font-semibold tabular-nums",
              n === page ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
            )}
            dir="ltr"
          >
            {n}
          </span>
        </button>
      ))}
    </nav>
  );
}
