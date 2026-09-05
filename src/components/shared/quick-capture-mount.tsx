"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useQuickCapture } from "@/components/shared/quick-capture-context";
import { useIdlePreload } from "@/components/shared/use-idle-preload";

const QuickCaptureDialog = dynamic(
  () => import("@/components/shared/quick-capture").then((m) => m.QuickCaptureDialog),
  { ssr: false }
);

/**
 * Defers the Quick Capture dialog until it is first opened. The dialog is
 * invisible on every page until invoked, but statically imported it still
 * shipped and hydrated its eight form variants on every navigation. The
 * chunk is warmed at idle so the first open is not a network wait.
 */
export function QuickCaptureMount() {
  const { open } = useQuickCapture();
  const [mounted, setMounted] = React.useState(false);

  useIdlePreload(QuickCaptureDialog);

  React.useEffect(() => {
    // Latch: once opened it stays mounted so reopening is free.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;
  return <QuickCaptureDialog />;
}
