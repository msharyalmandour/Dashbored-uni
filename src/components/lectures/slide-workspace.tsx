"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideAnnotator } from "@/components/lectures/slide-annotator";
import { SlideThumbnails } from "@/components/lectures/slide-thumbnails";
import { LectureNotesEditor } from "@/components/lectures/lecture-notes-editor";
import type { Stroke } from "@/lib/ink";
import { releasePdf } from "@/lib/pdf";
import { recordPosition } from "@/app/actions/study-position";
import { POSITION_SAVE_DELAY_MS } from "@/lib/study-position";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The slide, everything around it, and somewhere to write.
 *
 * The viewer used to be one canvas, a toolbar, and "page 7 / 40" between two
 * arrows. That is enough to annotate a slide you are already looking at and not
 * enough to study from a deck: there was no way to find a page except by
 * clicking past the thirty-nine others, no way to see a dense slide larger than
 * the column it was in, and no way to have your notes and the slide on screen
 * at the same time — which is the actual thing a student does with a lecture.
 *
 * Three panes: the page rail, the slide, and the lecture's notes. The outer two
 * both collapse, because on a laptop the slide needs the width and on a tablet
 * in portrait there is only room for one thing at a time.
 *
 * Zoom is not here any more. It used to be four fixed steps in this toolbar —
 * 75%, 100%, 150%, 200% — driven from up here and pushed down as a `zoom` prop.
 * That is the wrong place for it twice over: zoom belongs to the hand reading
 * the page, not to the furniture around it, and a page you can only view at
 * four sizes cannot be pinched. The annotator owns it now, continuously, along
 * with panning, because zoom and pan are one gesture and cannot be split across
 * two components. See slide-annotator.tsx.
 */
export function SlideWorkspace({
  slideId,
  lectureId,
  fileUrl,
  fileType,
  initialPageCount,
  initialPage,
  initialAnnotations,
  notes,
  dict,
  locale,
}: {
  slideId: string;
  lectureId: string;
  fileUrl: string;
  fileType: string;
  initialPageCount: number;
  /** Where this student left off. Resolved on the server — see the route. */
  initialPage: number;
  initialAnnotations: Record<number, Stroke[]>;
  notes: string | null;
  dict: Dictionary;
  locale: string;
}) {
  const [page, setPage] = React.useState(initialPage);
  const [pageCount, setPageCount] = React.useState(initialPageCount);
  const [railOpen, setRailOpen] = React.useState(true);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const shellRef = React.useRef<HTMLDivElement>(null);

  const S = dict.slides;
  const multiPage = pageCount > 1;

  // Free the parsed deck and its worker when this workspace goes away. Six
  // decks opened in one session is six workers still running otherwise.
  React.useEffect(() => () => releasePdf(fileUrl), [fileUrl]);

  /**
   * Remember where the student is.
   *
   * Debounced, because a page turn is cheap to make and not cheap to store:
   * paging through a forty-slide deck at reading speed would otherwise be forty
   * round trips. The row is an upsert, so the last write wins and nothing is
   * lost by skipping the ones in between.
   *
   * Deliberately not awaited and deliberately silent on failure — this runs on
   * a timer while somebody is reading, and a dropped save costs a few slides of
   * position. Interrupting reading to report that would be worse than the loss.
   */
  React.useEffect(() => {
    const timer = setTimeout(() => {
      void recordPosition(slideId, page).catch(() => {});
    }, POSITION_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [slideId, page]);

  // Keep our own state honest if the browser leaves fullscreen another way —
  // Escape, or the OS. Without this the button would say "exit" on a window
  // that is no longer fullscreen.
  React.useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await shellRef.current?.requestFullscreen().catch(() => {});
  }

  // Arrow keys page through the deck. Ignored while typing in the notes, or
  // the first left-arrow inside a sentence would jump to the previous slide.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
      else if (e.key === "ArrowRight") setPage((p) => Math.min(pageCount, p + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageCount]);

  const PrevIcon = locale === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex flex-col gap-3",
        // In fullscreen this element *is* the page, so it needs its own ground
        // and its own padding — otherwise it renders on the browser's default
        // black with the content jammed against the edge.
        fullscreen && "h-screen bg-[oklch(8.5%_0.003_60)] p-4"
      )}
    >
      {/* Navigation, and only navigation: where you are in the deck, how big
          it is, and what else is on screen. The pen's own tools float at the
          bottom of the workspace under your thumb — see slide-annotator.tsx.
          Two bars, but they divide cleanly: this one moves you, that one
          marks. Both are glass, because both float above the deck rather than
          belonging to it. */}
      <div className="glass-quiet flex flex-wrap items-center justify-between gap-2 rounded-full px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {multiPage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRailOpen((v) => !v)}
              aria-pressed={railOpen}
              title={S.pageRail}
            >
              {railOpen ? (
                <PanelLeftClose className="size-3.5" />
              ) : (
                <PanelLeftOpen className="size-3.5" />
              )}
            </Button>
          )}

          {multiPage && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title={S.prevPage}
              >
                <PrevIcon className="size-3.5" />
              </Button>
              <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground" dir="ltr">
                {page} / {pageCount}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                title={S.nextPage}
              >
                <NextIcon className="size-3.5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={notesOpen ? "default" : "ghost"}
            onClick={() => setNotesOpen((v) => !v)}
            aria-pressed={notesOpen}
            title={S.splitNotes}
          >
            <Columns2 className="size-3.5" />
            <span className="hidden sm:inline">{S.splitNotes}</span>
          </Button>

          <Button size="sm" variant="ghost" onClick={toggleFullscreen} title={S.fullscreen}>
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className={cn("flex min-h-0 gap-3", fullscreen && "flex-1")}>
        {multiPage && railOpen && (
          <div className={cn("hidden md:block", fullscreen ? "h-full" : "h-[70vh]")}>
            <SlideThumbnails
              fileUrl={fileUrl}
              fileType={fileType}
              pageCount={pageCount}
              page={page}
              onSelect={setPage}
              label={S.pageRail}
            />
          </div>
        )}

        {/* A bounded box, and nothing else.

            It needs a height of its own — an element sized by its content is
            not a viewport, and the pen's floating toolbar had nothing to pin
            itself to: measured, the bar sat at y≈895 on a 900px window, a
            sliver of glass and nothing else.

            It must NOT scroll. It used to be `overflow-auto`, which was right
            when the slide was a fixed bitmap that could overflow. Now the
            annotator clips and pans the page itself, so a scrollbar out here
            would be a second, competing way to move the same page — and on a
            touch screen the browser's scroll would win the gesture before our
            pinch ever saw it. */}
        <div className={cn("relative min-w-0 flex-1 overflow-hidden", fullscreen ? "h-full" : "h-[70vh]")}>
          <SlideAnnotator
            slideId={slideId}
            fileUrl={fileUrl}
            fileType={fileType}
            initialPageCount={initialPageCount}
            initialAnnotations={initialAnnotations}
            page={page}
            onPageCount={setPageCount}
            dict={{
              page: S.page,
              pen: S.pen,
              highlighter: S.highlighter,
              eraser: S.eraser,
              color: S.color,
              strokeWidth: S.strokeWidth,
              undo: S.undo,
              redo: S.redo,
              clearPage: S.clearPage,
              saved: S.saved,
              saving: S.saving,
              prevPage: S.prevPage,
              nextPage: S.nextPage,
              loadingSlide: S.loadingSlide,
              renderFailed: S.renderFailed,
              renderFailedHint: S.renderFailedHint,
              tryAgain: S.tryAgain,
              pages: S.pages,
              fitWidth: S.fitWidth,
              fitPage: S.fitPage,
              resetZoom: S.resetZoom,
            }}
          />
        </div>

        {notesOpen && (
          <aside
            className={cn(
              "w-full max-w-sm shrink-0 overflow-y-auto rounded-xl bg-[oklch(11.5%_0.005_55_/_96%)] p-3 shadow-[inset_0_1px_0_oklch(100%_0_0_/_6%)]",
              fullscreen ? "h-full" : "h-[70vh]"
            )}
          >
            <p className="mb-2 text-sm font-semibold">{dict.lecture.notes}</p>
            {/* The lecture's own notes, not a second store. Writing here and
                writing on the lecture page are the same text — anything else
                would give a student two places to look for one thing. */}
            <LectureNotesEditor lectureId={lectureId} notes={notes} dict={dict} />
          </aside>
        )}
      </div>
    </div>
  );
}
