"use client";

import * as React from "react";
import {
  Eraser,
  Highlighter,
  PenLine,
  Redo2,
  Undo2,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSlideAnnotations, setSlidePageCount } from "@/app/actions/slides";
import { loadPdf } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import {
  dedupe,
  detectsPressure,
  ERASER_WIDTH_MULTIPLIER,
  HIGHLIGHTER_ALPHA,
  HIGHLIGHTER_WIDTH_MULTIPLIER,
  shouldRejectPointer,
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
};

/**
 * Ink colours, for writing on a slide rather than for the interface.
 *
 * The old set opened on `#0f172a`, a near-black navy, which is the right default
 * for marking up a white PDF and invisible the moment a slide has a dark
 * background — which most lecture decks do. Black and white both lead now, so
 * whichever the slide is, the first colour works.
 */
const COLORS = ["#111111", "#FFFFFF", "#F0913A", "#E5484D", "#3FA060", "#4C6FE0"];
const MAX_CANVAS_WIDTH = 900;

/**
 * Draw a stroke by segments, because its width changes along its length.
 *
 * A single `ctx.stroke()` can only carry one `lineWidth`, which is precisely why
 * the first version had no pressure: the shape of the code ruled it out. Round
 * caps on every segment make the joins invisible.
 */
function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
  dpr: number,
  hasPressure: boolean
) {
  const segments = strokeSegments(stroke, width, height, dpr, hasPressure);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.mode === "eraser") {
    // Full alpha. At anything less this removes most of the ink and leaves a
    // ghost, and the ghost is ink, so it can be ghosted again forever.
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#000";
  } else if (stroke.mode === "highlighter") {
    // `multiply` is what makes a highlighter read as ink under the text rather
    // than paint over it, and it is why overlapping passes darken.
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = HIGHLIGHTER_ALPHA;
    ctx.strokeStyle = stroke.color;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
  }

  // A stroke that never moved is a dot — one tap of the nib.
  if (segments.length === 0 && stroke.points.length === 1 && stroke.mode !== "eraser") {
    const p = stroke.points[0];
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, (stroke.width * dpr) / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  for (const seg of segments) {
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
  zoom = 1,
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
  /** 1 is fit-to-width. The canvas re-renders at the new scale rather than
      being stretched, so zooming in gets sharper rather than blurrier. */
  zoom?: number;
  onPageCount?: (n: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const baseCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const pdfDocRef = React.useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  const [size, setSize] = React.useState({ width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_WIDTH * 1.3 });
  const [readyForPage, setReadyForPage] = React.useState<number | null>(null);
  /**
   * Why the slide is not on screen, when it is not on screen.
   *
   * There was no such state, and the cost of that was the worst failure this
   * component had. `renderBase()` is called from an effect and its promise is
   * not awaited by anything, so a rejection inside it — a PDF pdf.js cannot
   * draw, a signed URL that has expired, a network drop — became an unhandled
   * promise rejection. Nothing threw, nothing logged, and the screen said
   * "Loading slide…" indefinitely. A student cannot tell that from a slow
   * connection, so they wait, and then they reload, and then they conclude the
   * feature is broken — which it is, silently.
   */
  const [renderError, setRenderError] = React.useState(false);
  const loading = readyForPage !== page && !renderError;
  const [tool, setTool] = React.useState<InkMode>("pen");
  const [color, setColor] = React.useState(COLORS[0]);
  const [penWidth, setPenWidth] = React.useState(3);

  const strokesRef = React.useRef<Record<number, Stroke[]>>(initialAnnotations);
  const redoRef = React.useRef<Record<number, Stroke[]>>({});
  /* The strokes live in a ref because they change 120 times a second and must
     not re-render anything. Their *counts* are different: they only move when a
     stroke is committed, and the toolbar's enabled state is derived from them.
     Keeping counts in state is what lets the buttons be correct without reading
     a ref during render — which the previous version did, and papered over with
     a forced re-render. */
  const [counts, setCounts] = React.useState({ strokes: 0, redo: 0 });
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");

  /**
   * Whether the toolbar should get out of the way.
   *
   * A second after the last stroke the bar drops to 40%, and any pointer
   * movement or keyboard focus anywhere in the workspace brings it straight
   * back. The handwriting is what should stay lit; the controls are not what
   * you are looking at while you write.
   *
   * It fades rather than disappears on purpose. A control that vanishes is a
   * control you have to remember exists, and at 40% over the dark ground every
   * icon is still visible — this is recession, not hiding.
   */
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

  React.useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The live stroke. A ref, not state: it changes 120 times a second. */
  const drawingRef = React.useRef<{ stroke: Stroke; drawnUpTo: number } | null>(null);
  /** Device pixel ratio at the moment the canvas was sized. */
  const dprRef = React.useRef(1);
  /** Palm rejection turns on for good once a real stylus has been used. */
  const sawPenRef = React.useRef(false);
  /** Pressure samples from the current stroke, to tell a real nib from a flat one. */
  const pressureSamplesRef = React.useRef<number[]>([]);
  const hasPressureRef = React.useRef(false);

  /**
   * Repaint every committed stroke on this page.
   *
   * Only for undo, redo, clear, and changing page. Emphatically NOT per pointer
   * move: the old code redrew the entire page on every event, so the cost of
   * drawing rose with how much was already drawn and the pen got slower the
   * longer you wrote on a page. Live strokes extend themselves instead.
   */
  const redraw = React.useCallback(() => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current[page] ?? []) {
      drawStroke(ctx, stroke, canvas.width, canvas.height, dprRef.current, true);
    }
  }, [page]);

  const renderBase = React.useCallback(async () => {
    const container = containerRef.current;
    const base = baseCanvasRef.current;
    if (!container || !base) return;
    const renderedPage = page;
    const cssWidth = Math.min(container.clientWidth, MAX_CANVAS_WIDTH) * zoom;

    // Render at the screen's real resolution. Sizing the canvas in CSS pixels
    // put every slide and every stroke on an iPad at half resolution, which is
    // the single reason the whole surface looked soft.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    dprRef.current = dpr;

    let cssHeight = 0;

    if (fileType === "pdf") {
      if (!pdfDocRef.current) {
        // Shared with the thumbnail rail: one fetch, one parse, one copy.
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
      const unscaled = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: (cssWidth / unscaled.width) * dpr });

      base.width = Math.round(viewport.width);
      base.height = Math.round(viewport.height);
      cssHeight = Math.round(viewport.height / dpr);
      const ctx = base.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport, canvas: base }).promise;
    } else {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const scale = cssWidth / img.naturalWidth;
          cssHeight = Math.round(img.naturalHeight * scale);
          base.width = Math.round(cssWidth * dpr);
          base.height = Math.round(cssHeight * dpr);
          const ctx = base.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, base.width, base.height);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = fileUrl;
      });
    }

    const draw = drawCanvasRef.current;
    if (draw) {
      draw.width = base.width;
      draw.height = base.height;
    }
    setSize({ width: cssWidth, height: cssHeight });
    redraw();
    setRenderError(false);
    setReadyForPage(renderedPage);
  }, [fileType, fileUrl, initialPageCount, page, redraw, slideId, zoom, onPageCount]);

  React.useEffect(() => {
    // Loads and rasterizes the slide (PDF/image) from Supabase Storage, an
    // external system, then syncs the resulting canvas size into state.
    // The catch is load-bearing — see `renderError` above.
    renderBase().catch((e) => {
      console.error("Slide render failed", e);
      setRenderError(true);
    });
  }, [renderBase]);

  React.useEffect(() => {
    let frame = 0;
    function onResize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => void renderBase());
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [renderBase]);

  React.useEffect(() => redraw(), [page, redraw]);

  /** Re-derive the toolbar's state from whatever is now on this page. */
  const syncCounts = React.useCallback(
    (forPage = page) =>
      setCounts({
        strokes: (strokesRef.current[forPage] ?? []).length,
        redo: (redoRef.current[forPage] ?? []).length,
      }),
    [page]
  );

  // Switching page changes what undo would undo.
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

  /** One pointer sample, in normalised page coordinates. */
  function toPoint(e: PointerEvent | React.PointerEvent, rect: DOMRect): InkPoint {
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      p: e.pressure,
    };
  }

  /** Paint only what has been added since the last frame. */
  function drawLiveTail() {
    const live = drawingRef.current;
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!live || !canvas || !ctx) return;
    const pts = live.stroke.points;
    if (pts.length < 2) return;
    // One segment back, so the newly smoothed joint is repainted rather than
    // left as a corner.
    const from = Math.max(0, live.drawnUpTo - 1);
    drawStroke(
      ctx,
      { ...live.stroke, points: pts.slice(from) },
      canvas.width,
      canvas.height,
      dprRef.current,
      hasPressureRef.current
    );
    live.drawnUpTo = pts.length - 1;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") sawPenRef.current = true;
    if (shouldRejectPointer(e.pointerType, sawPenRef.current)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pressureSamplesRef.current = [e.pressure];
    hasPressureRef.current = e.pointerType === "pen";

    const width =
      tool === "eraser"
        ? penWidth * ERASER_WIDTH_MULTIPLIER
        : tool === "highlighter"
          ? penWidth * HIGHLIGHTER_WIDTH_MULTIPLIER
          : penWidth;

    const rect = e.currentTarget.getBoundingClientRect();
    drawingRef.current = {
      stroke: { mode: tool, color, width, points: [toPoint(e, rect)] },
      drawnUpTo: 0,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const live = drawingRef.current;
    if (!live) return;
    if (shouldRejectPointer(e.pointerType, sawPenRef.current)) return;

    const rect = e.currentTarget.getBoundingClientRect();

    // Everything the digitiser saw since the last frame, not just the one
    // sample the browser chose to surface. Without this, a fast stroke on a
    // 120Hz stylus is drawn from roughly one point in eight.
    const native = e.nativeEvent;
    const batch =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [native];

    const added: InkPoint[] = [];
    for (const sample of batch.length > 0 ? batch : [native]) {
      added.push(toPoint(sample, rect));
      pressureSamplesRef.current.push(sample.pressure);
    }

    hasPressureRef.current = detectsPressure(e.pointerType, pressureSamplesRef.current);
    live.stroke.points = smoothTail(dedupe([...live.stroke.points, ...added]));
    drawLiveTail();
  }

  function onPointerUp() {
    restChrome();
    const live = drawingRef.current;
    if (!live) return;
    drawingRef.current = null;
    const finished = live.stroke;
    if (finished.points.length === 0) return;

    strokesRef.current = {
      ...strokesRef.current,
      [page]: [...(strokesRef.current[page] ?? []), finished],
    };
    // Drawing after an undo discards the redo stack: what it would have put
    // back is no longer this page's future.
    redoRef.current = { ...redoRef.current, [page]: [] };
    syncCounts();
    redraw();
    scheduleSave();
  }

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
    // Clearing is undoable, because the alternative is losing a page of
    // handwriting to one mis-tap.
    redoRef.current = { ...redoRef.current, [page]: [...(redoRef.current[page] ?? []), ...list] };
    strokesRef.current = { ...strokesRef.current, [page]: [] };
    syncCounts();
    redraw();
    scheduleSave();
  }

  // Keyboard, for the half of the time this is used on a laptop.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const TOOLS: { mode: InkMode; label: string; icon: typeof PenLine }[] = [
    { mode: "pen", label: dict.pen, icon: PenLine },
    { mode: "highlighter", label: dict.highlighter, icon: Highlighter },
    { mode: "eraser", label: dict.eraser, icon: Eraser },
  ];

  return (
    <div
      className="relative flex flex-col gap-3"
      // Any movement anywhere in the workspace brings the chrome back. On a
      // laptop that is the mouse; on a tablet it is the first touch after a
      // pause. Focus counts too, so tabbing to a control never lands on a
      // faded one.
      onPointerMove={wakeChrome}
      onPointerDown={wakeChrome}
      onFocusCapture={wakeChrome}
    >
      <div ref={containerRef} className="relative mx-auto w-full max-w-[900px]">
        {loading && (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-24 text-sm text-muted-foreground">
            {dict.loadingSlide}
          </div>
        )}
        {renderError && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/40 px-6 py-20 text-center">
            <p className="t-body text-foreground">{dict.renderFailed}</p>
            <p className="t-meta max-w-sm text-muted-foreground">{dict.renderFailedHint}</p>
            <Button size="sm" variant="secondary" onClick={() => void renderBase().catch(() => setRenderError(true))}>
              {dict.tryAgain}
            </Button>
          </div>
        )}
        {/* The page.

            It used to be `bg-white`, which is the colour of a browser and not
            the colour of anything you would write on. A sheet of paper is
            warm, and pure white next to warm dark chrome reads as a hole cut in
            the screen rather than as a page lying on a desk.

            The warmth is applied as a multiply wash over the slide itself, not
            just as a backing colour — a PDF paints its own white, so a backing
            colour would only ever show in the margins. Kept very light: this is
            paper stock, not a colour cast, and the ink canvas sits above it so
            handwriting stays exactly the colour it was drawn in. */}
        <div
          className="relative mx-auto overflow-hidden rounded-xl border border-border bg-[#F6F1E8] shadow-[0_18px_44px_-24px_oklch(0%_0_0_/_80%)]"
          style={{ width: size.width, height: size.height, display: loading || renderError ? "none" : "block" }}
        >
          {/* Both canvases are sized in device pixels and displayed at CSS size,
              which is what keeps the slide and the ink sharp on a tablet. */}
          <canvas
            ref={baseCanvasRef}
            className="absolute inset-0"
            style={{ width: size.width, height: size.height }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-multiply"
            style={{ background: "#FBF7F0" }}
          />
          <canvas
            ref={drawCanvasRef}
            /* `touch-none` stops the page scrolling under the nib; `overscroll-none`
               stops the pull-to-refresh that a downward stroke triggers on a phone. */
            className="absolute inset-0 touch-none overscroll-none"
            style={{ width: size.width, height: size.height, cursor: "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
          />
        </div>
      </div>

      {/* The toolbar, floating.

          It used to be a solid bar above the page: a full row of layout, at the
          top, permanently, on a screen whose entire job is to show you one
          slide as large as possible. On a tablet in portrait it took a tenth of
          the height before a single word of the lecture appeared.

          Now it sticks to the bottom of the workspace, centred, in glass — the
          one material reserved for things that float above content. It is under
          your thumb on a tablet rather than across the room at the top of the
          page, and it never covers the writing area because it sits below the
          sheet rather than on it. */}
      <div
        className={cn(
          "pointer-events-none sticky bottom-3 z-20 flex justify-center transition-opacity duration-500",
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
                // Material change again, not a filled pill: the selected tool
                // is a lit surface, and the accent lives on the icon.
                tool === t.mode &&
                  "bg-[oklch(100%_0_0_/_10%)] text-primary shadow-[inset_0_1px_0_oklch(100%_0_0_/_18%)]"
              )}
            >
              <t.icon className="size-4" />
            </Button>
          ))}

          <span aria-hidden className="mx-1 h-5 w-px bg-[oklch(100%_0_0_/_12%)]" />

          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="size-5 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "var(--primary)" : "oklch(100% 0 0 / 22%)",
                  transform: color === c ? "scale(1.18)" : "scale(1)",
                }}
              />
            ))}
          </div>

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

          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            title={dict.undo}
            aria-label={dict.undo}
            onClick={undo}
            disabled={counts.strokes === 0}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            title={dict.redo}
            aria-label={dict.redo}
            onClick={redo}
            disabled={counts.redo === 0}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            title={dict.clearPage}
            aria-label={dict.clearPage}
            onClick={clearPage}
            disabled={counts.strokes === 0}
          >
            <Trash2 className="size-4" />
          </Button>

          {/* Saving state stays in the bar, because "is my handwriting safe"
              is the one question this screen must always be able to answer. */}
          <span className="t-label ms-1 w-14 shrink-0 text-muted-foreground" aria-live="polite">
            {saveState === "saving" && <Loader2 className="size-3 animate-spin" aria-label={dict.saving} />}
            {saveState === "saved" && dict.saved}
          </span>
        </div>
      </div>
    </div>
  );
}
