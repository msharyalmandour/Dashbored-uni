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
    /* A path we serve, not one a bundler resolves.

       This was `new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs",
       import.meta.url)`. Under `next dev` with Turbopack that yielded a URL
       nothing answered, and pdf.js does not report a worker it cannot start:
       measured, the module chunk loads and then nothing else happens — no
       request for the worker, no request for the PDF, and the promise never
       settles. Silence, forever, on the feature this product exists for.

       The file is copied into public/pdfjs before every build by
       scripts/copy-pdfjs-assets.mjs, which is also where the standard fonts
       and CMaps come from. */
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    workerConfigured = true;
  }

  // Re-check: two callers can both miss the cache and then await the dynamic
  // import above, and the second must not start a second fetch.
  const raced = cache.get(url);
  if (raced) return raced.doc;

  const task = pdfjsLib.getDocument({
    url,
    /* Where pdf.js finds the fonts a PDF is allowed not to embed.

       A PDF may leave out the fourteen standard fonts — Helvetica, Times,
       Courier — on the understanding that every reader has them. pdf.js does
       not; it ships its own and has to be told where they are served from.
       Told nothing, it throws the moment it tries to draw a glyph, and because
       the viewer awaits that render inside an effect the rejection was an
       unhandled promise rejection: no console error, no crash, no fallback,
       just "Loading slide…" forever. A deck exported from an older version of
       PowerPoint lands in exactly this case.

       CMaps are the same story for CID-keyed fonts, which is how most
       non-Latin text is encoded — including Arabic, in a product whose user
       reads Arabic.

       The files are copied into public/pdfjs before every build; see
       scripts/copy-pdfjs-assets.mjs. */
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    /* Never the reader's own fonts. Always the document's.
     *
     * pdf.js defaults `useSystemFonts` to true, which means that for a font the
     * PDF does not embed — Arial, Helvetica, Calibri, Times, the ones a lecture
     * deck leaves out precisely because "everyone has them" — it emits an
     * `@font-face` rule with `src: local(...)` and draws with whatever that
     * machine happens to have installed under that name.
     *
     * The glyphs then come from the reader's font while the POSITIONS come from
     * the PDF's own `Widths` array, which describes the font the author used. If
     * the two disagree by even a fraction of an em, every glyph after the first
     * is placed slightly wrong, and the error accumulates along the line. The
     * result is text whose letters are all correct and whose spacing is not:
     * gaps opening inside words and closing between them —
     *
     *     "Student Learning Objectives"  ->  "S tuden t Lea m ing O b jectives"
     *     "is a measurement of"          ->  "is am easu rem en to f"
     *
     * — which is what a student sees on a Mac, where Helvetica and Arial are
     * installed, and not on a machine that has neither, where pdf.js falls back
     * to its own bundled copies and is correct by accident. A document viewer
     * that renders differently depending on what is installed on the reader's
     * computer is not showing them their lecture.
     *
     * So: off. pdf.js uses the metrically-correct copies it ships, which is what
     * `standardFontDataUrl` above points at, and the page looks the same on
     * every machine. */
    useSystemFonts: false,
    /* And not the browser's font machinery either.
     *
     * `useSystemFonts: false` stops pdf.js reaching for fonts the READER has
     * installed. It does not stop it handing the document's own EMBEDDED fonts
     * to the browser: pdf.js converts each one to OpenType and loads it through
     * the `FontFace` API, then draws text with `fillText` as normal. That
     * conversion is a lot of machinery, and whether the result loads is the
     * browser's decision — a decision that differs between Chrome on a laptop,
     * Chrome on Android, Safari, and every version of each.
     *
     * When that load fails, pdf.js has nothing to draw with but a fallback
     * face, while the POSITIONS still come from the PDF's own `Widths`. Every
     * glyph after the first lands slightly wrong and the error accumulates
     * along the line — gaps opening inside words and closing between them:
     *
     *     "Gas Exchange and Respiratory Function"
     *      -> "G as Exchange and Resp ira to ry Func tion"
     *
     * which is what a student photographed off an Android tablet while the
     * same file, the same build and the same library rendered perfectly on the
     * machine this was developed on. A failure that depends on the reader's
     * browser cannot be found by looking at the reader's document.
     *
     * `disableFontFace` takes the browser out of it. pdf.js walks the font
     * program itself and draws each glyph as vector paths — no conversion, no
     * `@font-face`, no load to fail, no substitution possible. The same
     * instructions produce the same marks on every device there is, which is
     * the only way a lecture viewer can promise that what the student sees is
     * what the lecturer wrote.
     *
     * Measured against MuPDF, an independent renderer, on the 47-page lecture
     * this was reported on: 11553 differing pixels with the browser drawing
     * the text, 6435 with pdf.js drawing it. Nearly half the disagreement was
     * the browser's font rasteriser, and it is now gone.
     *
     * The cost is real and worth naming: glyph outlines are slower to draw
     * than cached font bitmaps. For a page a student reads for minutes, a few
     * milliseconds at open is the cheaper half of the trade. */
    disableFontFace: true,
    /* The third asset path, and the one with the most direct bearing on whether
       a page looks like the lecturer's page.

       pdfjs-dist 6 moved three decoders out of JavaScript and into WebAssembly,
       and defaults `wasmUrl` to the bare relative string "wasm" — which
       resolves against the document, not the library, so on any route deeper
       than the root it points at nothing. What is behind those three files:

         - qcms_bg.wasm — colour management. A PDF that carries an ICC profile
           or uses a CMYK or Lab colour space needs it to convert to sRGB.
           Without it the colours are approximated. On a slide with the
           department's brand colour, or a histology photograph, that is a
           visible difference from the source, which is the one thing this phase
           is not allowed to have.
         - jbig2.wasm — JBIG2 images, which is what a scanner produces. A
           photocopied handout scanned to PDF is a stack of JBIG2 images.
         - openjpeg.wasm — JPEG 2000, which medical imaging exported into slides
           frequently is.

       pdf.js does ship `*_nowasm_fallback.js` for two of the three, so this is
       usually a degradation rather than a blank page — which is exactly why it
       would have gone unnoticed. Measured: without this line, requesting a
       lecture at /lectures/<id>/slides/<id> makes pdf.js look for
       /lectures/<id>/slides/wasm/qcms_bg.wasm and get the app's HTML back. */
    wasmUrl: "/pdfjs/wasm/",
  });
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
