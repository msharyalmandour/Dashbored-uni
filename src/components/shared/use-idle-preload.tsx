"use client";

import * as React from "react";

type Preloadable = { preload?: () => void };

/**
 * Warms a `next/dynamic` chunk once the browser is idle. Keeps the chunk out
 * of the critical hydration path — it is not parsed while the page is
 * becoming interactive — while making sure it is already in cache by the
 * time the user opens the thing it belongs to.
 */
export function useIdlePreload(component: unknown) {
  React.useEffect(() => {
    const preload = (component as Preloadable | undefined)?.preload;
    if (typeof preload !== "function") return;

    const ric = typeof window !== "undefined" ? window.requestIdleCallback : undefined;
    if (ric) {
      const handle = ric(() => preload(), { timeout: 3000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => preload(), 1500);
    return () => window.clearTimeout(handle);
  }, [component]);
}
