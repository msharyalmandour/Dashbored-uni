/**
 * The four lines that decide whether a lecture looks like the lecturer's.
 *
 * All four are options passed to `getDocument`, all four are silent when wrong,
 * and three of the four have already been wrong in this app at some point. None
 * of them can be caught by looking at the screen on the machine that built it —
 * which is the entire reason this file exists, and the reason it checks the
 * source rather than a rendering.
 *
 * Run: npx tsx scripts/verify-pdf-config.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const root = join(import.meta.dirname, "..");
const loader = readFileSync(join(root, "src", "lib", "pdf.ts"), "utf8");
const copier = readFileSync(join(root, "scripts", "copy-pdfjs-assets.mjs"), "utf8");

console.log("pdf.js configuration\n");

/* --------------------------------------------------- the reader's fonts --- */
/**
 * MEASURED, and the reason this check is first.
 *
 * With pdf.js's default `useSystemFonts: true`, the canvas is told to draw with
 *
 *     normal bold 22px "Helvetica", g_d0_sf2, sans-serif
 *
 * — the READER's Helvetica first, pdf.js's own copy only as a fallback. The
 * glyphs then come from whatever that machine has installed while the positions
 * come from the `Widths` array in the PDF, which describes the font the author
 * used. Where the two disagree, every glyph after the first is placed slightly
 * wrong and the error accumulates along the line:
 *
 *     "Student Learning Objectives"  ->  "S tuden t Lea m ing O b jectives"
 *     "is a measurement of"          ->  "is am easu rem en to f"
 *
 * On a Mac, where Helvetica and Times both exist, that is what a student sees.
 * On a Linux container, which has neither, pdf.js falls through to its own
 * bundled copies and is correct — which is why this was invisible in testing and
 * why the check is a static one on the option rather than on a rendering.
 */
check(
  "the reader's own system fonts are never used",
  /useSystemFonts:\s*false/.test(loader),
  'getDocument must pass `useSystemFonts: false`, or a PDF renders with whatever\n        fonts the reader happens to have installed and the letter spacing goes wrong.'
);

/* ------------------------------------------------- the fonts it uses instead */
// With system fonts off, pdf.js needs its own copies, and it has to be told
// where they are served from. Told nothing, it throws on the first glyph.
check(
  "pdf.js is told where its own standard fonts are",
  /standardFontDataUrl:\s*"\/pdfjs\/standard_fonts\/"/.test(loader)
);
check(
  "...and those fonts are copied into public/ before a build",
  /"standard_fonts"/.test(copier)
);

/* ----------------------------------------------------------------- CMaps --- */
// How a CID-keyed font maps codes to glyphs, which is most non-Latin text —
// including Arabic, in an app whose user reads Arabic.
check("CMaps are configured", /cMapUrl:\s*"\/pdfjs\/cmaps\/"/.test(loader) && /cMapPacked:\s*true/.test(loader));
check("...and copied", /"cmaps"/.test(copier));

/* ------------------------------------------------------------------ wasm --- */
// pdfjs-dist 6 decodes JBIG2 (every scanned handout), JPEG 2000 and ICC colour
// profiles in WebAssembly, and defaults the path to the bare relative string
// "wasm" — which resolves against the current document, so on a route like
// /lectures/<id>/slides/<id> it fetches the app's own HTML. Two of the three
// have JavaScript fallbacks, so the failure is partial and silent: the page
// still renders, with approximated colour.
check("the WebAssembly decoders are configured", /wasmUrl:\s*"\/pdfjs\/wasm\/"/.test(loader));
check("...and copied", /"wasm"/.test(copier));

/* ---------------------------------------------------------------- worker --- */
// Served from a path we choose. Left to the bundler it produced a URL nothing
// answered under Turbopack, and pdf.js does not report a worker it cannot start:
// the promise simply never settles and the viewer says "Loading slide…" forever.
check("the worker is served from a fixed path", /workerSrc\s*=\s*"\/pdfjs\/pdf\.worker\.min\.mjs"/.test(loader));
check("...and copied", /pdf\.worker\.min\.mjs/.test(copier));

/* ------------------------------------------------------- the legacy build --- */
// pdfjs-dist 6.3 calls Map.prototype.getOrInsertComputed, which is Stage 3 and
// absent from Safari — the browser on the device this feature exists for.
check("the legacy build is used", /pdfjs-dist\/legacy\/build\/pdf\.mjs/.test(loader));
check("...and the worker matches it", /legacy\/build\/pdf\.worker\.min\.mjs/.test(copier));
check("the upsert polyfill is installed explicitly", /getOrInsertComputed/.test(loader));

{
  /* The browser must not be in the drawing path at all.
  
     useSystemFonts:false stops pdf.js using the READER's fonts; it does not
     stop it handing the document's embedded fonts to the browser's FontFace
     API, whose success depends on the browser. When that load fails the
     positions still come from the PDF's Widths and the text pulls apart —
     "G as Exchange and Resp ira to ry Func tion". disableFontFace makes
     pdf.js draw the glyph outlines itself, which is the only setting that
     renders identically on every device. */
  const src = readFileSync("src/lib/pdf.ts", "utf8");
  check("glyphs are drawn by pdf.js, not by the browser's font machinery",
    /disableFontFace:\s*true/.test(src));
  check("and the reader's own fonts are still never used",
    /useSystemFonts:\s*false/.test(src));
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A lecture renders from the document's own fonts and never the reader's, so\n" +
    "  it looks the same on every machine. The standard fonts, CMaps, WebAssembly\n" +
    "  decoders and worker are all configured and all copied before a build, and\n" +
    "  the build is the legacy one Safari can run."
);
