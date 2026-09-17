"use client";

/**
 * One PDF, loaded once.
 *
 * The slide workspace draws the same document in two places at the same time:
 * the page you are writing on, and the thumbnail rail beside it. Each asking
 * pdf.js for its own copy would fetch and parse a lecture deck twice, hold two
 * of it in memory, and — because the signed Storage URL is time-limited — give
 * the two copies different lifetimes.
 *
 * So the document is cached by URL. The cache holds the promise rather than the
 * resolved document, which is what makes a second caller arriving mid-load wait
 * for the first load instead of starting another.
 *
 * Keyed by URL and not by slide id on purpose: a signed URL is re-issued on
 * every page load, so a new URL genuinely is a new fetch, and the old entry
 * falls out when the component unmounts.
 */

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

/**
 * The legacy build, deliberately, and this is not a style choice.
 *
 * pdfjs-dist 6.3 calls `Map.prototype.getOrInsertComputed` — the TC39 "upsert"
 * proposal — in eighty-two places across its main and worker bundles. That
 * method is Stage 3: it is not in Safari, not in Firefox, and not in Chrome
 * before ~144. On anything older, every one of those calls throws
 * `getOrInsertComputed is not a function`, the render fails, and the slide
 * viewer shows an empty box.
 *
 * Measured, not assumed: in Chromium 141 the method is `undefined` before
 * importing pdf.js, the modern build leaves it `undefined` and throws on
 * render, and the legacy build — which bundles core-js — makes it a `function`
 * for both Map and WeakMap. So the legacy build is the one that works on an
 * iPad, which is the device this whole feature exists for.
 *
 * The worker has to match the build, since it is a separate realm with its own
 * globals: a legacy main thread with a modern worker fails in exactly the same
 * way, just out of sight.
 *
 * The legacy build alone turned out not to be enough. Loaded directly as a
 * module it installs core-js and the method appears; loaded through this app's
 * bundler it does not — the polyfill's assignments look side-effect-free and
 * are dropped. Measured both ways: `function` standalone, `undefined` after
 * bundling, and the render still threw. So the polyfill is installed here,
 * explicitly, where no bundler can decide it is unused.
 */

/**
 * `Map.prototype.getOrInsert` / `getOrInsertComputed`, per the TC39 upsert
 * proposal, for engines that do not have them yet — which is most of them.
 *
 * Guarded, so a browser that has the real thing keeps it. Defined the way a
 * built-in is (non-enumerable, writable, configurable) rather than by plain
 * assignment, so nothing that walks these prototypes sees a surprise.
 */
function installUpsertPolyfill() {
  const targets: { prototype: object }[] = [Map, WeakMap];
  for (const ctor of targets) {
    const proto = ctor.prototype as Record<string, unknown>;

    if (typeof proto.getOrInsert !== "function") {
      Object.defineProperty(proto, "getOrInsert", {
        value: function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
          if (this.has(key)) return this.get(key);
          this.set(key, value);
          return value;
        },
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }

    if (typeof proto.getOrInsertComputed !== "function") {
      Object.defineProperty(proto, "getOrInsertComputed", {
        value: function (
          this: Map<unknown, unknown>,
          key: unknown,
          callback: (key: unknown) => unknown
        ) {
          if (this.has(key)) return this.get(key);
          const computed = callback(key);
          this.set(key, computed);
          return computed;
        },
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }
  }
}

/* The loading task is kept alongside the document, not discarded once it
   resolves: `destroy()` — the thing that actually tears down the worker and
   frees the parsed deck — lives on the task. The document only has `cleanup()`,
   which drops cached page bitmaps and leaves the worker running. */
type Entry = { task: PDFDocumentLoadingTask; doc: Promise<PDFDocumentProxy> };

const cache = new Map<string, Entry>();

let workerConfigured = false;

export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const existing = cache.get(url);
  if (existing) return existing.doc;

  // Before the import, not after: pdf.js touches these during module
  // evaluation as well as during render.
  installUpsertPolyfill();

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerConfigured = true;
  }

  // Re-check: two callers can both miss the cache and then await the dynamic
  // import above, and the second must not start a second fetch.
  const raced = cache.get(url);
  if (raced) return raced.doc;

  const task = pdfjsLib.getDocument({ url });
  const entry: Entry = { task, doc: task.promise };
  cache.set(url, entry);
  // A failed load must not be remembered as the answer, or one dropped
  // connection would make the slide permanently unopenable for this session.
  entry.doc.catch(() => cache.delete(url));
  return entry.doc;
}

/**
 * Drop a document and free its worker.
 *
 * Called when the workspace unmounts. Without it, a study session that opens
 * six decks keeps all six parsed and all six workers alive for as long as the
 * tab is open.
 */
export function releasePdf(url: string) {
  const entry = cache.get(url);
  if (!entry) return;
  cache.delete(url);
  void entry.task.destroy().catch(() => {});
}
