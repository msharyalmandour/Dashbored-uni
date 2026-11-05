"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand-mark";
import { BRAND_LINE, BRAND_SUB } from "@/lib/brand";

/**
 * «ارمِ كل شي هنا.» — the surface the whole product is named after.
 *
 * THREE STATES, AND THE MIDDLE ONE IS THE POINT. A drop target that looks
 * identical while a file is over it is the single most common reason a drop
 * is released in the wrong place: the person is holding a file and gets no
 * answer. So `over` is loud — orange edge, a glow from below, and a line
 * that speaks back: «فكّه، وأنا أمسكه».
 *
 * IT IS A <button>, NOT A DIV. The drop target is also the browse target, and
 * a student on a phone has no drag to make — tapping is the primary gesture
 * there, not the fallback. A div with onClick is unreachable by Tab, which is
 * how a "clickable" area ends up usable only by a mouse.
 *
 * THE READING STATE ANNOUNCES ITSELF. `role="status"` with the live count, so
 * a screen reader says "قاعد أقرأ ٣ ملفات" instead of leaving the person on a
 * silent page while the work happens.
 *
 * It takes PDFs, images, DOCX, links and pasted text — the five things that
 * actually arrive from a phone's downloads folder and a WhatsApp group.
 */
export function DropZone({
  state = "idle",
  reading = 0,
  progress,
  onFiles,
  className,
}: {
  state?: "idle" | "over" | "reading";
  /** How many files are being read, for the live line. */
  reading?: number;
  /** 0–100 across all of them, when it is known. */
  progress?: number;
  onFiles?: (files: FileList) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const shown = state === "reading" ? "reading" : dragging || state === "over" ? "over" : "idle";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer?.files?.length) onFiles?.(e.dataTransfer.files);
      }}
      className={cn("relative", className)}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,image/*,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.files && onFiles?.(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="c-press flex w-full flex-col items-center justify-center gap-3 rounded-[26px] px-6 py-10 text-center"
        style={{
          border:
            shown === "over"
              ? "2px solid var(--o-500)"
              : "2px dashed rgba(255,220,190,0.22)",
          background:
            shown === "over"
              ? "radial-gradient(70% 90% at 50% 120%, rgba(255,138,0,0.28), transparent 70%), var(--glass)"
              : "var(--glass)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          transition: "border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
        }}
      >
        <BrandMark size={shown === "over" ? 68 : 60} variant={shown === "over" ? "fill" : "dark"} />

        {shown === "reading" ? (
          <span role="status" className="flex flex-col items-center gap-2">
            <span className="t-kufi text-[17px] font-bold text-[color:var(--cream)]">
              قاعد أقرأ {reading} {reading === 1 ? "ملف" : reading === 2 ? "ملفين" : "ملفات"}…
            </span>
            <span
              aria-hidden
              className="h-1.5 w-48 overflow-hidden rounded-full"
              style={{ background: "rgba(255,235,210,0.14)" }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(4, Math.min(100, progress ?? 12))}%`,
                  background: "linear-gradient(90deg,#FF7A00,#FFA640)",
                  transition: "width var(--dur-fast) var(--ease-out)",
                }}
              />
            </span>
          </span>
        ) : shown === "over" ? (
          <span className="t-kufi text-[19px] font-extrabold text-[color:var(--cream)]">
            فكّه، وأنا أمسكه
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1">
            <span className="t-kufi text-[19px] font-extrabold text-[color:var(--cream)]">
              {BRAND_LINE}
            </span>
            <span className="text-[13px] text-[color:var(--sec)]">{BRAND_SUB}</span>
            <span className="mt-1 text-[12px] text-[color:var(--sec)]">
              سلايدز · صورة سبورة · ملف وورد · رابط
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
