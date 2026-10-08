"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { loadPdf } from "@/lib/pdf";
import { pageKey, readPage, writePage, toBlob } from "@/lib/page-cache";

/**
 * ONE PAGE OF A DECK, DRAWN.
 *
 * This logic used to live inside the viewer's thumbnail rail and nowhere else.
 * Three screens now want the same picture at three sizes — the rail, the cover
 * on a deck card, and the wall of pages — and three copies of "render a PDF
 * page to a canvas, lazily, once" is three places for the device-pixel-ratio
 * handling to drift and two places for the image branch to be forgotten.
 *
 * Three things it does that a naive version does not:
 *
 *   LAZY. A forty-page deck rendered eagerly is several seconds of blocked
 *     main thread before anything appears. Nothing is drawn until it is near
 *     the viewport.
 *   CACHED. Signed URLs carry a fresh signature per request, so the browser's
 *     HTTP cache never hits and every visit would re-download the whole PDF to
 *     draw one thumbnail. The drawn PICTURE is kept instead, keyed by row id —
 *     see src/lib/page-cache.ts.
 *   HONEST ABOUT DEVICE PIXELS. A 96px canvas on a 2x screen is 192 real
 *     pixels; at 96 it is a smear. Thumbnails are small enough that this is
 *     the difference between reading a slide title and not.
 */
export function PageCanvas({
  slideId,
  fileUrl,
  fileType,
  page,
  width,
  className,
  onDrawn,
}: {
  /** The row, which is what the cache is keyed on — never the signed URL. */
  slideId: string;
  /** A signed URL, or null when signing failed. Null draws nothing. */
  fileUrl: string | null;
  fileType: string;
  page: number;
  /** CSS pixels. The canvas is drawn at this times the device ratio. */
  width: number;
  className?: string;
  /** Told once, when there is really a picture on screen. */
  onDrawn?: () => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const drawn = React.useRef(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || drawn.current) return;
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = pageKey(slideId, page, width * dpr);

    /**
     * Size the element so the layout does not jump when the picture lands.
     *
     * BOTH axes in CSS pixels, not just the height. A deck is whatever shape
     * its author exported — 16:9, 4:3, or an A4 handout in portrait — and a
     * caller that drops these into a grid needs each one to declare its real
     * proportions so it can be fitted inside a common frame. With only the
     * height set, a portrait page and a widescreen slide claim the same width
     * and the row goes ragged.
     */
    function fit(w: number, h: number) {
      if (!canvas) return;
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      canvas.style.width = `${Math.round(w / dpr)}px`;
      canvas.style.height = `${Math.round(h / dpr)}px`;
    }

    function finish() {
      if (cancelled) return;
      drawn.current = true;
      onDrawn?.();
    }

    (async () => {
      /* The cache first, and before the URL is even looked at — a cached page
         costs no network, which is the entire point. */
      const cached = await readPage(key);
      if (cancelled) return;
      if (cached) {
        const bitmap = await createImageBitmap(cached).catch(() => null);
        if (cancelled) return;
        if (bitmap && canvas) {
          fit(bitmap.width, bitmap.height);
          canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
          bitmap.close();
          return finish();
        }
      }

      if (!fileUrl) return;

      if (fileType === "pdf") {
        const doc = await loadPdf(fileUrl).catch(() => null);
        if (!doc || cancelled || !canvas) return;
        const pdfPage = await doc.getPage(page).catch(() => null);
        if (!pdfPage || cancelled || !canvas) return;
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: (width / unscaled.width) * dpr });
        fit(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      } else {
        await new Promise<void>((resolve) => {
          const img = new Image();
          /* Without this the canvas is tainted and toBlob throws, so the
             picture would draw and never cache — a slow page that looks fine. */
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (cancelled || !canvas) return resolve();
            const h = (img.naturalHeight / img.naturalWidth) * width;
            fit(width * dpr, h * dpr);
            canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = fileUrl;
        });
      }

      if (cancelled || !canvas) return;
      finish();

      /* Kept after it is on screen, never before: the student waits for the
         picture, not for the bookkeeping. */
      const blob = await toBlob(canvas);
      if (blob && !cancelled) await writePage(key, blob);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, slideId, fileUrl, fileType, page, width, onDrawn]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("block", className)}
      /* `width` here is the resolution to draw at; the max rules let a caller
         put the result inside a fixed frame without distorting it. Both are
         needed: without the explicit width the element collapses before the
         picture arrives, and without the maxima a tall page would push its
         card taller than the one beside it. */
      style={{
        width,
        maxWidth: "100%",
        maxHeight: "100%",
        /* WITHOUT THIS THE PAGE IS SQUASHED, NOT FITTED.
           `max-width` and `max-height` constrain the two axes INDEPENDENTLY,
           so a portrait page inside a landscape frame has its width clamped to
           the frame's width and its height clamped to the frame's height, and
           arrives stretched — measured at 233x175 for a 595x842 page, which is
           a flowsheet nobody can read. A canvas is a replaced element, so
           `object-fit` applies to it and the drawing keeps its proportions
           inside whatever box the two maxima leave. */
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}
