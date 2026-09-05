"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { useQuickCapture } from "@/components/shared/quick-capture-context";

/**
 * Lives apart from the dialog so the shell can render the floating trigger
 * without pulling the dialog's eight form variants (and their select,
 * textarea and server-action dependencies) into the always-loaded bundle.
 */
export function QuickCaptureButton() {
  const { dict } = useI18n();
  const { setOpen } = useQuickCapture();
  return (
    <Button
      onClick={() => setOpen(true)}
      size="lg"
      className="fixed bottom-20 end-5 z-40 h-14 w-14 rounded-full p-0 shadow-[0_0_28px_var(--glow-primary-strong)] md:bottom-6 md:end-6 md:h-12 md:w-auto md:px-5"
    >
      <Plus className="size-5" />
      <span className="hidden md:inline">{dict.shell.quickCapture}</span>
    </Button>
  );
}
