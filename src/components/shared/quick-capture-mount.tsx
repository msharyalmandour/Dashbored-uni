"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useQuickCapture } from "@/components/shared/quick-capture-context";
import { useIdlePreload } from "@/components/shared/use-idle-preload";

const loadCapturePanel = () => import("@/components/inbox/drop-anything-panel");
const DropAnythingPanel = dynamic(() => loadCapturePanel().then((m) => m.DropAnythingPanel), {
  ssr: false,
});

/**
 * Defers the Drop Anything panel until it is first opened. It is invisible on
 * every page until invoked, but statically imported it would still ship and
 * hydrate the orb's canvas on every navigation. The chunk is warmed at idle so
 * the first open is not a network wait.
 */
export function QuickCaptureMount() {
  const { open } = useQuickCapture();
  const [mounted, setMounted] = React.useState(false);

  useIdlePreload(loadCapturePanel);

  React.useEffect(() => {
    // Latch: once opened it stays mounted so reopening is free.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;
  return <DropAnythingPanel />;
}
