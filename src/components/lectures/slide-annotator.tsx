"use client";

import * as React from "react";
import {
  Eraser,
  Highlighter,
  Maximize,
  MoveHorizontal,
  PenLine,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSlideAnnotations, setSlidePageCount } from "@/app/actions/slides";
import { loadPdf } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HIGHLIGHTER,
  DEFAULT_PEN,
  paletteFor,
} from "@/lib/pen-palette";
import {
  addPointer,
  centroid,
  emptyArbiter,
  intentFor,
  movePointer,
  removePointer,
  spread,
  type ArbiterState,
  type PointerSample,
} from "@/lib/gesture";
import {
  centred,
  clampPan,
  fitPage,
  fitWidth,
  panBy,
  maxRenderScale,
  renderScaleFor,
  zoomAround,
  type View,
} from "@/lib/zoom";
import {
  dedupe,
  detectsPressure,
  ERASER_WIDTH_MULTIPLIER,
  HIGHLIGHTER_WIDTH_MULTIPLIER,
  isContinuousTool,
  layerOf,
  opacityOf,
  smoothTail,
  strokeSegments,
  type InkMode,
  type InkPoint,
  type Stroke,
} from "@/lib/ink";

type AnnotatorDict = {
  page: string;
  renderFailed: string;
  renderFailedHint: string;
  tryAgain: string;
  pen: string;
  highlighter: string;
  eraser: string;
  color: string;
  strokeWidth: string;
  undo: string;
  redo: string;
  clearPage: string;
  saved: string;
  saving: string;
  prevPage: string;
  nextPage: string;
  loadingSlide: string;
  pages: string;
  fitWidth: string;
  fitPage: string;
  resetZoom: string;
};

/** Padding between the page and the edge of its viewport, in CSS pixels. */
const VIEWPORT_PAD = 16;

/**
 * Paint one stroke.
 *
 * Two renderers, because a pen and a marker are physically different objects
 * and drawing them the same way is what produced the bug this phase exists to
 * fix.
 *
 * A **pen** varies in width along its length, so it is drawn segment by
 * segment — that is the only way a single canvas path can change `lineWidth`,
 * and it is what makes a nib look like a nib.
 *
 * A **highlighter** does not vary, and drawing it segment by segment was
 * measurably wrong. Consecutive round-capped segments overlap; each overlap
 * composites again; a nominal 38% opacity measured 85% after one pass and the
 * stroke came out as a row of beads. It is now stroked as ONE path with the
 * alpha applied once, so a self-intersection costs nothing: the path is
 * rasterised whole, then composited whole.
 */
function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
  scale: number,
  hasPressure: boolean
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.mode === "eraser") {
    // Full alpha. At anything less this removes most of the ink and leaves a
    // ghost, and the ghost is ink, so it can be ghosted again forever.
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#000";
  } else {
    /* `source-over`, even for the highlighter.
       The multiply that makes a marker read as dye under the text happens at
       the LAYER, via `mix-blend-mode` on the highlighter canvas — see the three
       canvases below. Doing it here instead was the original bug: two separate
       canvas elements mean `globalCompositeOperation` blends a stroke only
       against other ink, and the layer as a whole still landed on the page with
       ordinary alpha. Measured, black body text came out at 64,37,16. */
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = opacityOf(stroke);
    ctx.strokeStyle = stroke.color;
  }

  const pts = stroke.points;

  // A stroke that never moved is a dot — one tap of the nib.
  if (pts.length === 1 && stroke.mode !== "eraser") {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, (stroke.width * scale) / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (isContinuousTool(stroke.mode) && pts.length >= 2) {
    ctx.lineWidth = stroke.width * scale;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * width, pts[0].y * height);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * width, pts[i].y * height);
    ctx.stroke();
    ctx.restore();
    return;
  }

  for (const seg of strokeSegments(stroke, width, height, scale, hasPressure)) {
    ctx.beginPath();
    ctx.lineWidth = seg.width;
    ctx.moveTo(seg.from.x, seg.from.y);
    ctx.lineTo(seg.to.x, seg.to.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function SlideAnnotator({
  slideId,
  fileUrl,
  fileType,
  initialPageCount,
  initialAnnotations,
  dict,
  page,
  onPageCount,
}: {
  slideId: string;
  fileUrl: string;
  fileType: string;
  initialPageCount: number;
  initialAnnotations: Record<number, Stroke[]>;
  dict: AnnotatorDict;
  /** The workspace owns which page is open — the rail and the canvas agree. */
  page: number;
  onPageCount?: (n: number) => void;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  /** The transformed box. Zoom and pan are written here, not to the canvases. */
  const stageRef = React.useRef<HTMLDivElement>(null);
  const baseCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const highlightCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const pdfDocRef = React.useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  /** The page's own size in CSS pixels at 1:1 — the PDF's natural dimensions. */
  const [pageSize, setPageSize] = React.useState({ width: 720, height: 540 });
  const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });
  const [view, setView] = React.useState<View>({ scale: 1, x: 0, y: 0 });
  /**
   * How many device pixels of raster the page is carrying, as a multiple of its
   * CSS size. Separate from `view.scale` on purpose — see THE TWO STAGES below.
   */
  const [renderScale, setRenderScale] = React.useState(1);

  const [readyForPage, setReadyForPage] = React.useState<number | null>(null);
  const [renderError, setRenderError] = React.useState(false);
  const loading = readyForPage !== page && !renderError;

  const [tool, setTool] = React.useState<InkMode>("pen");
  const [penColor, setPenColor] = React.useState(DEFAULT_PEN);
  const [highlighterColor, setHighlighterColor] = React.useState(DEFAULT_HIGHLIGHTER);
  const [penWidth, setPenWidth] = React.useState(3);
  const color = tool === "highlighter" ? highlighterColor : penColor;

  const strokesRef = React.useRef<Record<number, Stroke[]>>(initialAnnotations);
  const redoRef = React.useRef<Record<number, Stroke[]>>({});
  const [counts, setCounts] = React.useState({ strokes: 0, redo: 0 });
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The live stroke. A ref, not state: it changes 120 times a second. */
  const drawingRef = React.useRef<{ stroke: Stroke; drawnUpTo: number } | null>(null);
  const dprRef = React.useRef(1);
  /**
   * The backing multiplier the page was ACTUALLY rasterised at.
   *
   * Not `dpr * renderScale`, which is only what was asked for. `maxRenderScale`
   * can cap it, and when it does, a stroke drawn at the uncapped figure lands at
   * the wrong size and — past the canvas edge — not at all. Two places compute
   * stroke geometry, and both must use the same number the base canvas used, so
   * that number is recorded here when the raster is made rather than derived
   * twice from state that no longer describes it.
   */
  const backingRef = React.useRef(1);
  const pressureSamplesRef = React.useRef<number[]>([]);
  const hasPressureRef = React.useRef(false);

  /** Which pointers are down, and what each of them currently means. */
  const arbiterRef = React.useRef<ArbiterState>(emptyArbiter());
  /** The baseline a pan or pinch is measured against. */
  const gestureRef = React.useRef<{
    view: View;
    centroid: { x: number; y: number };
    spread: number;
  } | null>(null);
  /** The view is written every frame during a gesture; React is told at the end. */
  const viewRef = React.useRef<View>(view);
  /**
   * The two measurements the opening fit needs, mirrored as refs.
   *
   * The page's natural size arrives from pdf.js and the viewport's from a
   * ResizeObserver, in either order, and the fit can only happen once both are
   * known. Reading them from state would force the fit into an effect that
   * watches both — and setting state synchronously in an effect body is exactly
   * the cascading-render pattern React warns about. As refs, the fit can instead
   * run at each arrival site, which is where the external measurement actually
   * appears.
   */
  const pageSizeRef = React.useRef({ width: 720, height: 540 });
  const viewportSizeRef = React.useRef({ width: 0, height: 0 });
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chromeIdle, setChromeIdle] = React.useState(false);
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const wakeChrome = React.useCallback(() => {
    setChromeIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const restChrome = React.useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setChromeIdle(true), 1000);
  }, []);

  React.useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  /* ------------------------------------------------------------ the view --- */

  /**
   * Apply a view without waiting for React.
   *
   * A pinch produces sixty of these a second and every one of them must be on
   * screen in the same frame it arrived, so the transform is written to the DOM
   * directly and state is reconciled afterwards. React still owns the value —
   * `viewRef` and `view` never disagree once the hand leaves the glass.
   */
  const applyView = React.useCallback((next: View) => {
    viewRef.current = next;
    const stage = stageRef.current;
    if (stage) {
      stage.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
    }
  }, []);

  /**
   * Re-assert the transform after any render.
   *
   * `applyView` writes the transform imperatively, which means React does not
   * know about it — so a render triggered by anything else (a tool change, a
   * save badge, a settle) would leave the DOM holding a transform React never
   * put there. That works only for as long as React never writes the property
   * itself. Rather than rely on that, the committed view is re-applied on every
   * render: it is one string assignment, it always agrees with `viewRef`, and it
   * removes a whole class of "the page jumped when I picked up the eraser".
   */
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const v = viewRef.current;
    stage.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
  });

  /**
   * Fit the page's width to the viewport, once, when both are first known.
   *
   * Deliberately once: `fittedRef` latches, because a student who has zoomed in
   * on a diagram and then rotates the iPad or opens the notes pane must not have
   * their zoom thrown away by a resize. Re-clamping on resize is handled
   * separately; re-fitting is a thing only the student asks for, from the
   * toolbar.
   */
  const fittedRef = React.useRef(false);
  const maybeFit = React.useCallback(() => {
    if (fittedRef.current) return;
    const viewport = viewportSizeRef.current;
    const pageBox = pageSizeRef.current;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    fittedRef.current = true;
    const next = centred(fitWidth(pageBox, viewport, VIEWPORT_PAD), pageBox, viewport);
    applyView(next);
    setView(next);
    setRenderScale(renderScaleFor(next.scale));
  }, [applyView]);

  /**
   * THE TWO STAGES.
   *
   * During a pinch the page is only transformed — no re-rasterising, so the
   * gesture never waits for pdf.js. When the hand settles, the raster is
   * regenerated at a resolution that suits the new scale.
   *
   * The swap cannot flash or jump, and the reason is structural rather than
   * careful: the canvases keep the same CSS size at every zoom level, and only
   * their backing store changes. Nothing in the layout moves, nothing
   * re-positions, the transform is untouched. The page simply becomes sharper
   * between one frame and the next.
   *
   * The scale ladder in `renderScaleFor` is what stops a student who fidgets
   * between 1.03× and 1.06× triggering a full-page render each time.
   */
  const settleRender = React.useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const wanted = renderScaleFor(viewRef.current.scale);
      setRenderScale((current) => (current === wanted ? current : wanted));
      setView(viewRef.current);
    }, 140);
  }, []);

  /* --------------------------------------------------------- rasterising --- */

  const redraw = React.useCallback(() => {
    const hl = highlightCanvasRef.current;
    const ink = inkCanvasRef.current;
    if (!hl || !ink) return;
    const hlCtx = hl.getContext("2d");
    const inkCtx = ink.getContext("2d");
    if (!hlCtx || !inkCtx) return;

    hlCtx.clearRect(0, 0, hl.width, hl.height);
    inkCtx.clearRect(0, 0, ink.width, ink.height);

    // The multiplier the base raster actually used — see backingRef.
    const scale = backingRef.current;

    /* Replayed in order, onto both layers.
       An eraser is painted on *both* canvases because it has to remove whatever
       came before it regardless of which tool laid it down — a student rubbing
       out a mistake does not know or care that their highlighter and their pen
       live on different surfaces. Everything else goes to its own layer only,
       and the ordering within each layer is preserved, so an eraser still only
       erases what it was drawn after. */
    for (const stroke of strokesRef.current[page] ?? []) {
      if (stroke.mode === "eraser") {
        drawStroke(hlCtx, stroke, hl.width, hl.height, scale, true);
        drawStroke(inkCtx, stroke, ink.width, ink.height, scale, true);
        continue;
      }
      const target = layerOf(stroke.mode) === "highlight" ? hlCtx : inkCtx;
      const canvas = layerOf(stroke.mode) === "highlight" ? hl : ink;
      drawStroke(target, stroke, canvas.width, canvas.height, scale, true);
    }
    /* `renderScale` is deliberately not a dependency.
       The geometry now comes from `backingRef`, which is a ref, so a change in
       the requested render scale does not by itself mean this needs to re-run —
       and it would be the wrong trigger anyway, because the canvases have not
       been resized yet at that moment. The correct trigger is the raster itself,
       and `renderBase` calls this as its last step once the new backing store
       exists. */
  }, [page]);

  const renderBase = React.useCallback(async () => {
    const base = baseCanvasRef.current;
    const hl = highlightCanvasRef.current;
    const ink = inkCanvasRef.current;
    if (!base || !hl || !ink) return;
    const renderedPage = page;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    dprRef.current = dpr;
    /* The backing multiplier is computed per page, below, once the page's own
       size is known — a cap that depends on the page's area cannot be applied
       before the page has been measured. See `backingFor`. */
    const backingFor = (natural: { width: number; height: number }) =>
      dpr * Math.min(renderScale, maxRenderScale(natural, dpr));

    let natural = { width: 720, height: 540 };

    if (fileType === "pdf") {
      if (!pdfDocRef.current) {
        const doc = await loadPdf(fileUrl);
        pdfDocRef.current = doc;
        if (doc.numPages !== initialPageCount) {
          onPageCount?.(doc.numPages);
          void setSlidePageCount(slideId, doc.numPages);
        }
      }
      const doc = pdfDocRef.current;
      if (!doc) return;
      const pdfPage = await doc.getPage(page);

      /* The page at 1:1 — its own dimensions, in CSS pixels.
         Nothing here scales the document to fit anything. The page is the size
         the PDF says it is, and the view transform is what makes it bigger or
         smaller on screen. That separation is what keeps the render faithful:
         there is no fitting, stretching or cropping in the raster path at all. */
      const unscaled = pdfPage.getViewport({ scale: 1 });
      natural = { width: Math.round(unscaled.width), height: Math.round(unscaled.height) };

      /* Capped, because the ladder asks for more than a device will give.
         At 8x on a dpr-3 iPad the requested backing store is 24x the page — for
         a 720x540 slide that is 17280x12960, 224 million pixels, 896MB, three
         layers over. iOS Safari does not report that as an error: it hands back
         a canvas whose backing store it silently refused to allocate and the
         slide goes blank, at exactly the zoom a student uses to read a small
         label on a diagram. See maxRenderScale in src/lib/zoom.ts. */
      const backing = backingFor(natural);
      backingRef.current = backing;
      const viewport = pdfPage.getViewport({ scale: backing });
      base.width = Math.round(viewport.width);
      base.height = Math.round(viewport.height);

      const ctx = base.getContext("2d");
      if (!ctx) return;
      /* White paper, explicitly.
         A PDF page is white by definition, but the file is not obliged to paint
         it — plenty of decks rely on the viewer for that. Left transparent, the
         app's dark ground would show through wherever the page did not draw,
         which is both wrong and the kind of thing that only appears on somebody
         else's lecture. */
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, base.width, base.height);
      ctx.restore();

      await pdfPage.render({ canvasContext: ctx, viewport, canvas: base }).promise;
    } else {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          natural = { width: img.naturalWidth, height: img.naturalHeight };
          // Same cap as the PDF path, and it matters more here: a phone photo of
          // a whiteboard is routinely 4032x3024, which is already 12M pixels at
          // 1:1 and over the budget at any dpr above 1.
          const backing = backingFor(natural);
          backingRef.current = backing;
          base.width = Math.round(img.naturalWidth * backing);
          base.height = Math.round(img.naturalHeight * backing);
          const ctx = base.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, base.width, base.height);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = fileUrl;
      });
    }

    // The annotation layers match the page's raster exactly, so a normalised
    // coordinate lands on the same pixel on all three.
    for (const canvas of [hl, ink]) {
      canvas.width = base.width;
      canvas.height = base.height;
    }

    pageSizeRef.current = natural;
    setPageSize(natural);
    setRenderError(false);
    setReadyForPage(renderedPage);
    redraw();
    maybeFit();
  }, [fileType, fileUrl, initialPageCount, maybeFit, page, redraw, renderScale, slideId, onPageCount]);

  React.useEffect(() => {
    renderBase().catch((e) => {
      console.error("Slide render failed", e);
      setRenderError(true);
    });
  }, [renderBase]);

  React.useEffect(() => redraw(), [redraw]);

  /* ------------------------------------------------------ viewport sizing --- */

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      viewportSizeRef.current = { width: r.width, height: r.height };
      setViewportSize({ width: r.width, height: r.height });
      maybeFit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maybeFit]);



  /* ------------------------------------------------------------- drawing --- */

  const syncCounts = React.useCallback(
    (forPage = page) =>
      setCounts({
        strokes: (strokesRef.current[forPage] ?? []).length,
        redo: (redoRef.current[forPage] ?? []).length,
      }),
    [page]
  );

  React.useEffect(() => {
    syncCounts();
  }, [syncCounts]);

  function scheduleSave() {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const savingPage = page;
    saveTimer.current = setTimeout(async () => {
      await saveSlideAnnotations(slideId, savingPage, strokesRef.current[savingPage] ?? []);
      setSaveState("saved");
    }, 400);
  }

  /**
   * One pointer sample, in normalised page coordinates.
   *
   * Measured against the ink canvas's own box, which the browser has already
   * put through the view transform — so this is correct at any zoom and any pan
   * without knowing anything about either. It is also why zoom cannot make
   * annotations drift: the coordinate never had a scale in it to go stale.
   */
  function toPoint(e: { clientX: number; clientY: number; pressure: number }, rect: DOMRect): InkPoint {
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      p: e.pressure,
    };
  }

  function liveLayer(): CanvasRenderingContext2D[] {
    const hl = highlightCanvasRef.current?.getContext("2d");
    const ink = inkCanvasRef.current?.getContext("2d");
    const live = drawingRef.current;
    if (!live || !hl || !ink) return [];
    if (live.stroke.mode === "eraser") return [hl, ink];
    return layerOf(live.stroke.mode) === "highlight" ? [hl] : [ink];
  }

  /**
   * Paint the live stroke.
   *
   * A pen extends: only the newly-arrived segments are painted, so the cost of
   * a stroke does not rise with how long it already is.
   *
   * A highlighter cannot extend, because its whole point is that the band is
   * composited once — painting the new tail over the old one would reintroduce
   * exactly the compounding this phase removed. So it is cleared and redrawn
   * whole on each frame. That is more work per frame and it is bounded: a
   * marker stroke is short, and it is the only tool that does it.
   */
  function drawLive() {
    const live = drawingRef.current;
    if (!live) return;
    const pts = live.stroke.points;
    if (pts.length < 2) return;
    // The multiplier the base raster actually used — see backingRef.
    const scale = backingRef.current;

    if (isContinuousTool(live.stroke.mode)) {
      const hl = highlightCanvasRef.current;
      const ctx = hl?.getContext("2d");
      if (!hl || !ctx) return;
      ctx.clearRect(0, 0, hl.width, hl.height);
      for (const stroke of strokesRef.current[page] ?? []) {
        if (stroke.mode === "eraser" || layerOf(stroke.mode) === "highlight") {
          drawStroke(ctx, stroke, hl.width, hl.height, scale, true);
        }
      }
      drawStroke(ctx, live.stroke, hl.width, hl.height, scale, hasPressureRef.current);
      live.drawnUpTo = pts.length - 1;
      return;
    }

    const from = Math.max(0, live.drawnUpTo - 1);
    for (const ctx of liveLayer()) {
      const canvas = ctx.canvas;
      drawStroke(
        ctx,
        { ...live.stroke, points: pts.slice(from) },
        canvas.width,
        canvas.height,
        scale,
        hasPressureRef.current
      );
    }
    live.drawnUpTo = pts.length - 1;
  }

  function sampleOf(e: React.PointerEvent): PointerSample {
    return {
      id: e.pointerId,
      kind: e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse",
      x: e.clientX,
      y: e.clientY,
      width: e.width,
      height: e.height,
    };
  }

  function beginStroke(e: React.PointerEvent) {
    const ink = inkCanvasRef.current;
    if (!ink) return;
    pressureSamplesRef.current = [e.pressure];
    hasPressureRef.current = e.pointerType === "pen";

    const width =
      tool === "eraser"
        ? penWidth * ERASER_WIDTH_MULTIPLIER
        : tool === "highlighter"
          ? penWidth * HIGHLIGHTER_WIDTH_MULTIPLIER
          : penWidth;

    drawingRef.current = {
      stroke: { mode: tool, color, width, points: [toPoint(e, ink.getBoundingClientRect())] },
      drawnUpTo: 0,
    };
  }

  function extendStroke(e: React.PointerEvent) {
    const live = drawingRef.current;
    const ink = inkCanvasRef.current;
    if (!live || !ink) return;
    const rect = ink.getBoundingClientRect();

    // Everything the digitiser saw since the last frame, not just the one
    // sample the browser chose to surface. Without this, a fast stroke on a
    // 120Hz stylus is drawn from roughly one point in eight.
    const native = e.nativeEvent;
    const batch =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [native];

    const added: InkPoint[] = [];
    for (const sample of batch.length > 0 ? batch : [native]) {
      added.push(toPoint(sample, rect));
      pressureSamplesRef.current.push(sample.pressure);
    }

    hasPressureRef.current = detectsPressure(e.pointerType, pressureSamplesRef.current);
    live.stroke.points = smoothTail(dedupe([...live.stroke.points, ...added]));
    drawLive();
  }

  function commitStroke() {
    const live = drawingRef.current;
    if (!live) return;
    drawingRef.current = null;
    if (live.stroke.points.length === 0) return;

    strokesRef.current = {
      ...strokesRef.current,
      [page]: [...(strokesRef.current[page] ?? []), live.stroke],
    };
    redoRef.current = { ...redoRef.current, [page]: [] };
    syncCounts();
    redraw();
    scheduleSave();
  }

  /* ------------------------------------------------------------ gestures --- */

  function resetGestureBaseline() {
    const touches = [...arbiterRef.current.pointers.values()].filter((p) => p.kind === "touch");
    gestureRef.current = {
      view: viewRef.current,
      centroid: centroid(touches),
      spread: spread(touches),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    wakeChrome();
    arbiterRef.current = addPointer(arbiterRef.current, sampleOf(e));
    const intent = intentFor(arbiterRef.current, e.pointerId);

    if (intent === "reject") return;

    /* Capture the pointer so a stroke that leaves the page keeps arriving here
       rather than being taken over by whatever is underneath.

       Guarded, because `setPointerCapture` throws `NotFoundError` for a pointer
       id the browser no longer considers active — which happens for real when a
       touch ends between the event being queued and the handler running, and
       when an automated test synthesises an event. Unguarded, the throw took out
       the rest of this handler, so the stroke was never begun: capture is an
       optimisation for the edges of the page, and losing it must not cost the
       stroke itself. */
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // No capture. Drawing still works; a stroke dragged off the page just ends
      // at the boundary.
    }

    if (intent === "ink") {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      beginStroke(e);
      return;
    }

    // A finger landing while a stroke is in flight must not corrupt it — the
    // stylus owns the ink and the touch is already rejected above, but a mouse
    // user starting a pan mid-stroke would.
    resetGestureBaseline();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arbiterRef.current.pointers.has(e.pointerId)) return;
    arbiterRef.current = movePointer(arbiterRef.current, sampleOf(e));
    const intent = intentFor(arbiterRef.current, e.pointerId);

    if (intent === "ink") {
      if (drawingRef.current) extendStroke(e);
      return;
    }
    if (intent === "reject") return;

    const touches = [...arbiterRef.current.pointers.values()].filter((p) => p.kind === "touch");
    const base = gestureRef.current;
    if (!base) return;

    const now = centroid(touches);

    if (intent === "zoom" && touches.length >= 2 && base.spread > 0) {
      const factor = spread(touches) / base.spread;
      // Scale about where the fingers are, then carry the page along with them
      // — a pinch that also slides should do both, which is what a hand expects
      // and what a page under a hand actually does.
      const zoomed = zoomAround(base.view, factor, now.x, now.y);
      const moved = panBy(zoomed, now.x - base.centroid.x, now.y - base.centroid.y);
      applyView(clampPan(moved, pageSize, viewportSize));
    } else if (intent === "pan") {
      const moved = panBy(base.view, now.x - base.centroid.x, now.y - base.centroid.y);
      applyView(clampPan(moved, pageSize, viewportSize));
    }
  }

  function endPointer(e: React.PointerEvent) {
    const wasInk = intentFor(arbiterRef.current, e.pointerId) === "ink";
    arbiterRef.current = removePointer(arbiterRef.current, e.pointerId);

    if (wasInk) {
      commitStroke();
      restChrome();
    } else {
      // The remaining fingers, if any, start a fresh baseline — otherwise
      // lifting one finger of a pinch makes the page leap.
      const touches = [...arbiterRef.current.pointers.values()].filter((p) => p.kind === "touch");
      if (touches.length > 0) resetGestureBaseline();
      else gestureRef.current = null;
      settleRender();
    }
  }

  /** Trackpad pinch and ctrl+wheel zoom; plain wheel scrolls the page. */
  function onWheel(e: React.WheelEvent) {
    wakeChrome();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY / 240);
      applyView(
        clampPan(
          zoomAround(viewRef.current, factor, e.clientX, e.clientY),
          pageSize,
          viewportSize
        )
      );
    } else {
      applyView(clampPan(panBy(viewRef.current, -e.deltaX, -e.deltaY), pageSize, viewportSize));
    }
    settleRender();
  }

  /** Double-tap / double-click: into the page at that point, or back out. */
  function onDoubleClick(e: React.MouseEvent) {
    const fit = fitWidth(pageSize, viewportSize, VIEWPORT_PAD);
    const zoomedIn = viewRef.current.scale > fit * 1.2;
    const next = zoomedIn
      ? centred(fit, pageSize, viewportSize)
      : clampPan(zoomAround(viewRef.current, 2, e.clientX, e.clientY), pageSize, viewportSize);
    applyView(next);
    setView(next);
    setRenderScale(renderScaleFor(next.scale));
  }

  const setZoom = React.useCallback(
    (scale: number) => {
      const next = centred(scale, pageSize, viewportSize);
      applyView(next);
      setView(next);
      setRenderScale(renderScaleFor(next.scale));
    },
    [applyView, pageSize, viewportSize]
  );

  /* ------------------------------------------------------------ keyboard --- */

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setZoom(viewRef.current.scale * 1.25);
        } else if (e.key === "-") {
          e.preventDefault();
          setZoom(viewRef.current.scale / 1.25);
        } else if (e.key === "0") {
          e.preventDefault();
          setZoom(1);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------------------------------------------------------------- undo --- */

  function undo() {
    const list = strokesRef.current[page] ?? [];
    if (list.length === 0) return;
    const popped = list[list.length - 1];
    strokesRef.current = { ...strokesRef.current, [page]: list.slice(0, -1) };
    redoRef.current = { ...redoRef.current, [page]: [...(redoRef.current[page] ?? []), popped] };
    syncCounts();
    redraw();
    scheduleSave();
  }

  function redo() {
    const stack = redoRef.current[page] ?? [];
    if (stack.length === 0) return;
    const restored = stack[stack.length - 1];
    redoRef.current = { ...redoRef.current, [page]: stack.slice(0, -1) };
    strokesRef.current = {
      ...strokesRef.current,
      [page]: [...(strokesRef.current[page] ?? []), restored],
    };
    syncCounts();
    redraw();
    scheduleSave();
  }

  function clearPage() {
    const list = strokesRef.current[page] ?? [];
    if (list.length === 0) return;
    strokesRef.current = { ...strokesRef.current, [page]: [] };
    redoRef.current = { ...redoRef.current, [page]: [...(redoRef.current[page] ?? []), ...list] };
    syncCounts();
    redraw();
    scheduleSave();
  }

  /* ----------------------------------------------------------------- UI --- */

  const TOOLS: { mode: InkMode; label: string; icon: typeof PenLine }[] = [
    { mode: "pen", label: dict.pen, icon: PenLine },
    { mode: "highlighter", label: dict.highlighter, icon: Highlighter },
    { mode: "eraser", label: dict.eraser, icon: Eraser },
  ];

  const swatches = paletteFor(tool);
  const percent = Math.round(view.scale * 100);

  return (
    <div
      className="relative flex h-full flex-col gap-3"
      onPointerMove={wakeChrome}
      onFocusCapture={wakeChrome}
    >
      {loading && (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          {dict.loadingSlide}
        </div>
      )}
      {renderError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/40 px-6 text-center">
          <p className="t-body text-foreground">{dict.renderFailed}</p>
          <p className="t-meta max-w-sm text-muted-foreground">{dict.renderFailedHint}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void renderBase().catch(() => setRenderError(true))}
          >
            {dict.tryAgain}
          </Button>
        </div>
      )}

      {/* THE GESTURE SURFACE.
          Every pointer lands here rather than on the ink canvas, which is what
          makes pan and pinch possible at all: the canvas used to carry
          `touch-action: none` and claim every touch, so the browser never
          delivered a pinch and no amount of styling could have produced one.
          `touch-action: none` moves here because this component now implements
          panning and zooming itself and must not fight the browser's. */}
      <div
        ref={viewportRef}
        className={cn(
          "relative flex-1 touch-none select-none overflow-hidden rounded-xl",
          (loading || renderError) && "hidden"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
      >
        <div ref={stageRef} style={{ transformOrigin: "0 0", willChange: "transform" }}>
          {/* THE PAGE — three layers, and the order is the whole design.

              `isolation: isolate` is load-bearing: it makes this box the
              backdrop the highlighter multiplies against, so the blend sees the
              PDF and the white paper and nothing behind them. Without it the
              marker would multiply against the app's dark ground wherever the
              page is transparent. */}
          <div
            className="relative shadow-[0_18px_44px_-24px_oklch(0%_0_0_/_80%)]"
            style={{
              width: pageSize.width,
              height: pageSize.height,
              isolation: "isolate",
              background: "#FFFFFF",
            }}
          >
            {/* 1 — the document. Authoritative, and nothing is drawn over it.
                The warm paper wash that used to sit here has been removed: it
                was a multiply of #FBF7F0 across the whole page, which changed
                every colour in the lecturer's slide. A tint that alters the
                source is not a style choice. */}
            <canvas
              ref={baseCanvasRef}
              className="absolute inset-0"
              style={{ width: pageSize.width, height: pageSize.height }}
            />
            {/* 2 — highlighter, multiplying into the page beneath it, which is
                what keeps black text black while the paper takes the colour. */}
            <canvas
              ref={highlightCanvasRef}
              className="absolute inset-0"
              style={{
                width: pageSize.width,
                height: pageSize.height,
                mixBlendMode: "multiply",
              }}
            />
            {/* 3 — pen and pencil ink, opaque, on top. Deliberately not
                blended: a white pen on a dark slide would disappear. */}
            <canvas
              ref={inkCanvasRef}
              className="absolute inset-0"
              style={{ width: pageSize.width, height: pageSize.height }}
            />
          </div>
        </div>
      </div>

      {/* The toolbar, floating and out of the way. Drops to 40% a second after
          the last stroke and returns on any movement or focus. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center transition-opacity duration-500",
          chromeIdle ? "opacity-40" : "opacity-100"
        )}
      >
        <div className="glass-quiet pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 overflow-x-auto rounded-full px-2 py-1.5">
          {TOOLS.map((t) => (
            <Button
              key={t.mode}
              size="sm"
              variant="ghost"
              title={t.label}
              aria-label={t.label}
              aria-pressed={tool === t.mode}
              onClick={() => setTool(t.mode)}
              className={cn(
                "rounded-full",
                tool === t.mode &&
                  "bg-[oklch(100%_0_0_/_10%)] text-primary shadow-[inset_0_1px_0_oklch(100%_0_0_/_18%)]"
              )}
            >
              <t.icon className="size-4" />
            </Button>
          ))}

          <span aria-hidden className="mx-1 h-5 w-px bg-[oklch(100%_0_0_/_12%)]" />

          {/* Only the tools that put colour on the page get a palette, and the
              palette they get is their own — a highlighter has no use for navy
              and every use for yellow, which the shared six-colour list did not
              contain at all. */}
          {tool !== "eraser" && (
            <div className="flex items-center gap-1">
              {swatches.map((s) => (
                <button
                  key={s.hex}
                  type="button"
                  aria-label={s.hex}
                  aria-pressed={color === s.hex}
                  onClick={() =>
                    tool === "highlighter" ? setHighlighterColor(s.hex) : setPenColor(s.hex)
                  }
                  className="size-5 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: s.hex,
                    borderColor: color === s.hex ? "var(--primary)" : "oklch(100% 0 0 / 22%)",
                    transform: color === s.hex ? "scale(1.18)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          )}

          <input
            type="range"
            min={1}
            max={16}
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            className="mx-1.5 w-20 accent-primary"
            aria-label={dict.strokeWidth}
          />

          <span aria-hidden className="mx-1 h-5 w-px bg-[oklch(100%_0_0_/_12%)]" />

          <Button size="sm" variant="ghost" className="rounded-full" title={dict.undo}
            aria-label={dict.undo} onClick={undo} disabled={counts.strokes === 0}>
            <Undo2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" title={dict.redo}
            aria-label={dict.redo} onClick={redo} disabled={counts.redo === 0}>
            <Redo2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" title={dict.clearPage}
            aria-label={dict.clearPage} onClick={clearPage} disabled={counts.strokes === 0}>
            <Trash2 className="size-4" />
          </Button>

          <span aria-hidden className="mx-1 h-5 w-px bg-[oklch(100%_0_0_/_12%)]" />

          <Button size="sm" variant="ghost" className="rounded-full" title={dict.fitWidth}
            aria-label={dict.fitWidth}
            onClick={() => setZoom(fitWidth(pageSize, viewportSize, VIEWPORT_PAD))}>
            <MoveHorizontal className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" title={dict.fitPage}
            aria-label={dict.fitPage}
            onClick={() => setZoom(fitPage(pageSize, viewportSize, VIEWPORT_PAD))}>
            <Maximize className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" title={dict.resetZoom}
            aria-label={dict.resetZoom} onClick={() => setZoom(1)}>
            <RotateCcw className="size-4" />
          </Button>
          <span className="t-label w-11 shrink-0 tabular-nums text-muted-foreground" dir="ltr">
            {percent}%
          </span>

          <span className="t-label ms-1 w-14 shrink-0 text-muted-foreground" aria-live="polite">
            {saveState === "saving" && <Loader2 className="size-3 animate-spin" aria-label={dict.saving} />}
            {saveState === "saved" && dict.saved}
          </span>
        </div>
      </div>
    </div>
  );
}
