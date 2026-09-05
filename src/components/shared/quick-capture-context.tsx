"use client";

import * as React from "react";

interface QuickCaptureState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const QuickCaptureContext = React.createContext<QuickCaptureState | null>(null);

/**
 * Shared open-state for the Quick Capture dialog, so both the floating
 * action button and the sidebar's Capture entry point can trigger the
 * exact same dialog instead of each owning a duplicate instance.
 */
export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return <QuickCaptureContext.Provider value={value}>{children}</QuickCaptureContext.Provider>;
}

export function useQuickCapture() {
  const ctx = React.useContext(QuickCaptureContext);
  if (!ctx) throw new Error("useQuickCapture must be used within QuickCaptureProvider");
  return ctx;
}
