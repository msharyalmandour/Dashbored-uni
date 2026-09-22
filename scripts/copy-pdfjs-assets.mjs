/**
 * Copy pdf.js's font and character-map data into public/ before a build.
 *
 * This exists because of a failure with no error message.
 *
 * A PDF is allowed to *not* embed the fourteen standard fonts — Helvetica,
 * Times, Courier and friends — on the understanding that every reader already
 * has them. pdf.js does not: it ships its own copies as separate files and
 * needs to be told where they are served from. Told nothing, it throws
 * "Ensure that the `standardFontDataUrl` API parameter is provided" the moment
 * it tries to draw a glyph. The same is true of CMaps, which is how a PDF with
 * CID-keyed fonts — most non-Latin text, and plenty of Latin text exported by
 * older tools — maps codes to glyphs.
 *
 * The viewer awaited that render inside an effect, so the rejection was an
 * unhandled promise rejection: no console error, no crash, no fallback. The
 * slide simply said "Loading slide…" for as long as you were willing to look
 * at it. Two of the three PDFs most likely to come out of a university — a
 * deck exported from an old version of PowerPoint, and anything typeset in
 * Arabic — land in exactly that case.
 *
 * Copied at build time rather than committed, because it is 2.5MB of somebody
 * else's binary data that npm already put on disk, and because a copy pinned
 * in git is a copy that drifts from the version in package.json.
 */

import { cp, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "pdfjs-dist");
const to = join(root, "public", "pdfjs");

/**
 * `wasm` is the one added after the first version of this script shipped.
 *
 * pdfjs-dist 6 decodes JBIG2, JPEG 2000 and ICC colour profiles in WebAssembly
 * and defaults `wasmUrl` to the relative string "wasm", which resolves against
 * the current document rather than the library — so on any nested route it
 * points at nothing. Two of the three have JavaScript fallbacks, so the failure
 * is silent and partial: the page still renders, with approximated colour. See
 * the note at the `wasmUrl` option in src/lib/pdf.ts.
 */
const DIRS = ["standard_fonts", "cmaps", "wasm"];

/**
 * The worker, copied to a fixed path for the same reason.
 *
 * It used to be addressed as `new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs",
 * import.meta.url)` and left for the bundler to resolve. Under `next dev` with
 * Turbopack that produced a URL nothing served, and pdf.js's failure mode for a
 * worker it cannot start is not an error — it is silence. Measured: the module
 * chunk loads, and then no request is made for the worker, none for the PDF,
 * and `getDocument().promise` never settles. The viewer says "Loading slide…"
 * until you give up.
 *
 * A file at a path we choose and serve ourselves takes every bundler out of the
 * question, in dev and in production alike.
 */
const FILES = [["legacy/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"]];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(to, { recursive: true });

for (const dir of DIRS) {
  const src = join(from, dir);
  if (!(await exists(src))) {
    // Loud, and not fatal. A build that stops here helps nobody; a build that
    // succeeds while silently shipping the bug this file exists to fix is
    // worse. So: say it, clearly, and let the build continue.
    console.warn(`[pdfjs] ${dir} not found in pdfjs-dist — PDFs using standard or CID fonts will fail to render.`);
    continue;
  }
  await cp(src, join(to, dir), { recursive: true, force: true });
  console.log(`[pdfjs] copied ${dir}`);
}

for (const [from_, name] of FILES) {
  const src = join(from, from_);
  if (!(await exists(src))) {
    console.warn(`[pdfjs] ${from_} not found in pdfjs-dist — the slide viewer will not render anything.`);
    continue;
  }
  await cp(src, join(to, name), { force: true });
  console.log(`[pdfjs] copied ${name}`);
}
