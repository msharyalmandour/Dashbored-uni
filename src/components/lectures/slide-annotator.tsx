"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Eraser, PenLine, Undo2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSlideAnnotations, setSlidePageCount } from "@/app/actions/slides";

type Point = { x: number; y: number };
type Stroke = { mode: "pen" | "eraser"; color: string; width: number; points: Point[] };

type AnnotatorDict = {
  page: string;
  pen: string;
  eraser: string;
  color: string;
  strokeWidth: string;
  undo: string;
  clearPage: string;
  saved: string;
  saving: string;
  prevPage: string;
  nextPage: string;
  loadingSlide: string;
  pages: string;
};

const COLORS = ["#0f172a", "#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#ffffff"];
const MAX_CANVAS_WIDTH = 900;

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number) {
  const pts = stroke.points.map((p) => ({ x: p.x * width, y: p.y * height }));
  if (pts.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.globalAlpha = stroke.mode === "eraser" ? 0.85 : 1;

  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    if (stroke.mode !== "eraser") ctx.fill();
    ctx.restore();
    return;
  }

  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = midpoint(pts[i], pts[i + 1]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

export function SlideAnnotator({
  slideId,
  fileUrl,
  fileType,
  initialPageCount,
  initialAnnotations,
  dict,
  locale,
}: {
  slideId: string;
  fileUrl: string;
  fileType: string;
  initialPageCount: number;
  initialAnnotations: Record<number, Stroke[]>;
  dict: AnnotatorDict;
  locale: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const baseCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const pdfDocRef = React.useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  const [pageCount, setPageCount] = React.useState(initialPageCount);
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState({ width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_WIDTH * 1.3 });
  const [readyForPage, setReadyForPage] = React.useState<number | null>(null);
  const loading = readyForPage !== page;
  const [tool, setTool] = React.useState<"pen" | "eraser">("pen");
  const [color, setColor] = React.useState(COLORS[0]);
  const [penWidth, setPenWidth] = React.useState(3);

  const strokesRef = React.useRef<Record<number, Stroke[]>>(initialAnnotations);
  const [, forceRender] = React.useReducer((c) => c + 1, 0);
  const drawingRef = React.useRef<{ stroke: Stroke; raw: Point[] } | null>(null);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const redraw = React.useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current[page] ?? []) {
      drawStroke(ctx, stroke, canvas.width, canvas.height);
    }
  }, [page]);

  const renderBase = React.useCallback(async () => {
    const container = containerRef.current;
    const base = baseCanvasRef.current;
    if (!container || !base) return;
    const renderedPage = page;
    const containerWidth = Math.min(container.clientWidth, MAX_CANVAS_WIDTH);

    if (fileType === "pdf") {
      if (!pdfDocRef.current) {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const doc = await pdfjsLib.getDocument({ url: fileUrl }).promise;
        pdfDocRef.current = doc;
        if (doc.numPages !== initialPageCount) {
          setPageCount(doc.numPages);
          void setSlidePageCount(slideId, doc.numPages);
        }
      }
      const doc = pdfDocRef.current;
      if (!doc) return;
      const pdfPage = await doc.getPage(page);
      const unscaled = pdfPage.getViewport({ scale: 1 });
      const scale = containerWidth / unscaled.width;
      const viewport = pdfPage.getViewport({ scale });

      base.width = Math.round(viewport.width);
      base.height = Math.round(viewport.height);
      const ctx = base.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport, canvas: base }).promise;
      setSize({ width: base.width, height: base.height });
    } else {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const scale = containerWidth / img.naturalWidth;
          const width = Math.round(img.naturalWidth * scale);
          const height = Math.round(img.naturalHeight * scale);
          base.width = width;
          base.height = height;
          const ctx = base.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, width, height);
          setSize({ width, height });
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
    redraw();
    setReadyForPage(renderedPage);
  }, [fileType, fileUrl, initialPageCount, page, redraw, slideId]);

  React.useEffect(() => {
    // Loads and rasterizes the slide (PDF/image) from Supabase Storage, an
    // external system, then syncs the resulting canvas size into state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    renderBase();
  }, [renderBase]);

  React.useEffect(() => {
    function onResize() {
      renderBase();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderBase]);

  React.useEffect(() => redraw(), [page, redraw]);

  function scheduleSave() {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveSlideAnnotations(slideId, page, strokesRef.current[page] ?? []);
      setSaveState("saved");
    }, 400);
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const width = tool === "eraser" ? penWidth * 6 : penWidth;
    const stroke: Stroke = { mode: tool, color, width, points: [] };
    drawingRef.current = { stroke, raw: [pointerPos(e)] };
    stroke.points = [drawingRef.current.raw[0]];
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const pos = pointerPos(e);
    drawingRef.current.raw.push(pos);
    drawingRef.current.stroke.points = drawingRef.current.raw;
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      redraw();
      drawStroke(ctx, drawingRef.current.stroke, canvas.width, canvas.height);
    }
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    const finished = drawingRef.current.stroke;
    drawingRef.current = null;
    if (finished.points.length === 0) return;
    strokesRef.current = {
      ...strokesRef.current,
      [page]: [...(strokesRef.current[page] ?? []), finished],
    };
    forceRender();
    redraw();
    scheduleSave();
  }

  function undo() {
    const list = strokesRef.current[page] ?? [];
    if (list.length === 0) return;
    strokesRef.current = { ...strokesRef.current, [page]: list.slice(0, -1) };
    forceRender();
    redraw();
    scheduleSave();
  }

  function clearPage() {
    if ((strokesRef.current[page] ?? []).length === 0) return;
    strokesRef.current = { ...strokesRef.current, [page]: [] };
    forceRender();
    redraw();
    scheduleSave();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")}>
            <PenLine className="size-3.5" /> {dict.pen}
          </Button>
          <Button size="sm" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")}>
            <Eraser className="size-3.5" /> {dict.eraser}
          </Button>

          <div className="mx-1 flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                className="size-6 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "var(--primary)" : "var(--border)",
                  transform: color === c ? "scale(1.12)" : "scale(1)",
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
            className="mx-1 w-24 accent-primary"
            aria-label={dict.strokeWidth}
          />

          <Button size="sm" variant="ghost" onClick={undo}>
            <Undo2 className="size-3.5" /> {dict.undo}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearPage}>
            <Trash2 className="size-3.5" /> {dict.clearPage}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <span className="flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> {dict.saving}
            </span>
          )}
          {saveState === "saved" && <span>{dict.saved}</span>}
        </div>
      </div>

      <div ref={containerRef} className="relative mx-auto w-full max-w-[900px]">
        {loading && (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-24 text-sm text-muted-foreground">
            {dict.loadingSlide}
          </div>
        )}
        <div
          className="relative mx-auto overflow-hidden rounded-xl border border-border bg-white shadow-sm"
          style={{ width: size.width, height: size.height, display: loading ? "none" : "block" }}
        >
          <canvas ref={baseCanvasRef} className="absolute inset-0" />
          <canvas
            ref={drawCanvasRef}
            className="absolute inset-0 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {locale === "ar" ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            {dict.prevPage}
          </Button>
          <span className="text-sm text-muted-foreground">
            {dict.page} {page} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            {dict.nextPage}
            {locale === "ar" ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}
