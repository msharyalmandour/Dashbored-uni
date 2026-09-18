"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { loadPdf } from "@/lib/pdf";

/**
 * The page rail.
 *
 * A lecture deck is forty slides and the old viewer gave you "page 7 / 40" and
 * two arrows, which means finding the slide about volume of distribution is a
 * matter of clicking next until you recognise it. A rail of thumbnails is how
 * you find a page in a deck you have already read once.
 *
 * Pages are rendered lazily and only once. Rendering forty PDF pages up front
 * is several seconds of main-thread work before the slide you actually asked
 * for appears, so the rail draws what is on screen and fills in the rest as it
 * is scrolled — which is also why each thumbnail keeps its own canvas and its
 * own "already drawn" flag rather than being redrawn from a list.
 */
export function SlideThumbnails({
  fileUrl,
  fileType,
  pageCount,
  page,
  onSelect,
  label,
}: {
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
        <Thumb
          key={n}
          fileUrl={fileUrl}
          fileType={fileType}
          page={n}
          active={n === page}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}

function Thumb({
  fileUrl,
  fileType,
  page,
  active,
  onSelect,
}: {
  fileUrl: string;
  fileType: string;
  page: number;
  active: boolean;
  onSelect: (page: number) => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const drawn = React.useRef(false);
  const [visible, setVisible] = React.useState(false);

  // Only draw what has been scrolled near. Forty pages rendered eagerly is
  // several seconds of blocked main thread before the page you asked for shows.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || drawn.current) return;
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const width = 96;
      // Thumbnails are small, so device pixels matter proportionally more here
      // than anywhere: a 96px-wide canvas on a 2x screen is 192 real pixels, and
      // at 96 it is a smear.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (fileType === "pdf") {
        const doc = await loadPdf(fileUrl).catch(() => null);
        if (!doc || cancelled) return;
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: (width / unscaled.width) * dpr });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      } else {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (cancelled) return resolve();
            const h = Math.round((img.naturalHeight / img.naturalWidth) * width);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.height = `${h}px`;
            canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = fileUrl;
        });
      }
      if (!cancelled) drawn.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, fileUrl, fileType, page]);

  return (
    <button
      type="button"
      onClick={() => onSelect(page)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-white transition-shadow",
        active
          ? "shadow-[0_0_0_2px_var(--primary)]"
          : "shadow-[0_0_0_1px_oklch(100%_0_0_/_10%)] hover:shadow-[0_0_0_1px_oklch(100%_0_0_/_25%)]"
      )}
    >
      <canvas ref={ref} style={{ width: 96, display: "block" }} />
      <span
        className={cn(
          "absolute bottom-1 end-1 rounded px-1 text-[10px] font-semibold tabular-nums",
          active ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
        )}
        dir="ltr"
      >
        {page}
      </span>
    </button>
  );
}
