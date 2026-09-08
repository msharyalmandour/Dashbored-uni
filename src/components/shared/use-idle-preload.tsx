"use client";

import * as React from "react";

/**
 * Warms a lazily-imported chunk once the browser is idle.
 *
 * Pass the exact same loader function given to `next/dynamic`. The App
 * Router's `next/dynamic` is a thin wrapper over `React.lazy` and does not
 * expose the `.preload()` helper the Pages Router had, so calling the
 * `import()` directly is what actually fetches the chunk. The bundler
 * memoises the module promise, so this warms the cache and the later
 * `React.lazy` resolution completes without a network wait.
 *
 * The loader must be defined at module scope so its identity is stable and
 * the effect does not re-run on every render.
 */
export function useIdlePreload(load: () => Promise<unknown>) {
  React.useEffect(() => {
    let cancelled = false;

    function run() {
      if (cancelled) return;
      // A failed warm-up is not an error worth surfacing: the real import
      // will run again when the component actually mounts.
      void load().catch(() => {});
    }

    const ric = window.requestIdleCallback;
    if (ric) {
      const handle = ric(run, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(handle);
      };
    }

    const handle = window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [load]);
}
