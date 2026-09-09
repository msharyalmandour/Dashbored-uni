"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { useQuickCapture } from "@/components/shared/quick-capture-context";
import { DropAnything } from "@/components/inbox/drop-anything";
import { getAiAvailability } from "@/app/actions/capture";
import { getQuickCaptureContext } from "@/app/actions/quick-capture";

/**
 * Drop Anything, floating above the dashboard.
 *
 * Deliberately not a dialog. A modal dims the page, traps focus and takes the
 * whole screen — it tells the student they have left what they were doing to
 * go and file something, which is the exact framing this feature exists to
 * remove. Here the dashboard stays lit and visible behind, and the panel
 * reads as the system waking up next to their work rather than replacing it.
 *
 * Because it is not a modal there is no scrim to click, so it closes the two
 * ways a non-modal surface should: Escape, and a pointer press outside it.
 * Focus is not trapped either — tabbing out of the panel and back to the page
 * is legitimate, since the page is still there.
 */
export function DropAnythingPanel() {
  const { dict } = useI18n();
  const { open, setOpen } = useQuickCapture();
  const panelRef = React.useRef<HTMLDivElement>(null);

  const [subjects, setSubjects] = React.useState<{ id: string; name: string }[]>([]);
  const [aiConfigured, setAiConfigured] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    void getQuickCaptureContext().then((ctx) => setSubjects(ctx.subjects));
    void getAiAvailability().then((status) => setAiConfigured(status.configured));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    // Deferred a tick: the click that opened the panel is still propagating,
    // and binding synchronously would have it close itself immediately.
    const id = window.setTimeout(() => window.addEventListener("pointerdown", onPointerDown), 0);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.clearTimeout(id);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label={dict.inbox.dropAnything}
      // Shares the same glass material as the Focus Now hero card — the
      // panel and the dashboard it floats above read as one world.
      className="glass-surface orb-emerge fixed inset-x-3 bottom-24 z-50 mx-auto max-h-[80vh] w-auto max-w-md overflow-y-auto rounded-3xl border p-5 shadow-elevated sm:inset-x-auto sm:bottom-24 sm:end-6 sm:w-[26rem] md:bottom-20"
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(false)}
        aria-label={dict.quickCapture.back}
        className="absolute end-2 top-2 z-10"
      >
        <X className="size-4" />
      </Button>

      <DropAnything
        aiConfigured={aiConfigured}
        subjects={subjects}
        compact
        onFiled={() => setOpen(false)}
      />
    </div>
  );
}
