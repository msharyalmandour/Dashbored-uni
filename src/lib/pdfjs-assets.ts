/**
 * Where pdf.js's own files are, on a machine that is not this one.
 *
 * WHAT WENT WRONG, AND WHY IT SURVIVED A FIX
 *
 * Server-side PDF reading needs three things from the pdfjs-dist package on
 * disk: the worker module, the standard fonts, and the CMaps that every
 * non-Latin PDF is encoded with. Each was found the obvious way:
 *
 *     createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
 *
 * which is correct in Node and wrong after bundling. The bundler rewrites a
 * literal `require.resolve("…")` into its own resolver, and that returns a
 * MODULE ID — not a path, and not necessarily a string. Measured in the
 * deployed build: the literal specifier is absent from the emitted JavaScript
 * entirely; it survives only in the file-trace manifest.
 *
 * The two call sites then failed differently, and both silently:
 *
 *   - The worker id was truthy, so `if (worker)` passed it to pdf.js, whose
 *     setter throws `Invalid \`workerSrc\` type.` on anything but a string.
 *     Every PDF failed, and the row recorded that sentence.
 *   - The assets path called `.slice()` on the same non-string, threw inside
 *     its own try, and returned `{}` — so cMapUrl and standardFontDataUrl were
 *     quietly absent. Nothing failed loudly; Arabic and CJK text simply came
 *     back as nothing, which the pipeline reads as "a scan".
 *
 * A previous fix traced the worker file into the deployment and checked that
 * the trace contained it. It did, and still does. The file was deployed and
 * the code could not name it — so the fix verified the half that was already
 * working. That is the reason this module exists rather than another patch at
 * the call site: one place to resolve, one place to be wrong.
 *
 * WHAT THIS DOES INSTEAD
 *
 * Three rules, and the third is the one that would have caught the original:
 *
 *   1. The specifier is assembled at runtime, never written as a literal, so
 *      there is nothing for a bundler to statically rewrite.
 *   2. Anything that is not a string is discarded, at every step. A module id
 *      is truthy and it is not a path.
 *   3. The result must exist on disk. A path that resolves and is not there is
 *      the same as no path, and is the difference between "it looked right"
 *      and "it works" — which is exactly the gap the last fix fell into.
 *
 * Everything returns null rather than throwing. A PDF whose text cannot be
 * extracted is still a PDF the student can read in the browser; losing search
 * over a deck is worth reporting, losing the deck is not.
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The package, and the three things we need out of it. */
const PACKAGE = "pdfjs-dist";
const WORKER_PARTS = ["legacy", "build", "pdf.worker.mjs"];

/**
 * Only a string that is actually there. Everything else is not an answer.
 *
 * Exported because it is the entire fix, and a guard that cannot be handed a
 * module id in a test is a guard nobody can show is working. On this machine
 * every route returns a valid path, so removing this function changes nothing
 * observable — which is precisely how the original bug survived review and a
 * previous round of tests.
 */
export function usablePath(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && existsSync(value) ? value : null;
}

/**
 * The package's root directory, or null.
 *
 * Two independent routes, because the first one is the one that broke. The
 * runtime-assembled specifier defeats static rewriting; the directory walk
 * defeats a resolver that has been replaced entirely. Both end at the same
 * check: does this directory exist and does it contain the package manifest.
 */
export function packageRoot(
  /* Injectable so the production condition can be reproduced. In the deployed
     bundle route 1 does not return a bad value — it throws, because the
     bundler replaces the dynamic resolve with `Cannot find module as
     expression is too dynamic` (read out of the emitted chunk). Locally it
     always succeeds, so without this seam the fallback below could be deleted
     and every test would still pass, which is precisely how the last fix
     shipped believing itself correct. */
  resolve: (specifier: string) => unknown = (specifier) =>
    createRequire(import.meta.url).resolve(specifier)
): string | null {
  // Route 1: ask Node, with a specifier no bundler can see as a literal.
  try {
    const specifier = [PACKAGE, "package.json"].join("/");
    const resolved = resolve(specifier);
    const manifest = usablePath(resolved);
    if (manifest) return path.dirname(manifest);
  } catch {
    // Falls through to the walk.
  }

  /* Route 2: look where a deployed function actually keeps its dependencies.
     `serverExternalPackages` leaves pdfjs-dist as a real directory in
     node_modules, and file tracing copies it next to the function, so the
     package is on disk even when the resolver cannot name it.

     This is the route that runs in production, and the reason is worth
     recording: the bundler does not merely rewrite the resolve above, it
     replaces it with a thrown "Cannot find module as expression is too
     dynamic" — verified by reading the emitted chunk. The throw is caught and
     execution arrives here, which is the design rather than an accident. */
  return rootContaining(candidateRoots());
}

/**
 * The first of these directories that actually holds the package.
 *
 * Separated out and exported because this is the route that runs in
 * production — the resolve above is replaced by the bundler with a throw —
 * and a path nothing exercises is a path nobody knows works. Locally the
 * first route always succeeds, so without this seam the fallback could be
 * deleted and every test would still pass. That is the same blindness that
 * shipped the original bug.
 */
export function rootContaining(roots: string[]): string | null {
  for (const root of roots) {
    if (typeof root !== "string" || !root) continue;
    const candidate = path.join(root, "node_modules", PACKAGE);
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return null;
}

/**
 * Every directory a deployed function might keep node_modules in.
 *
 * `process.cwd()` is the obvious one and is not always the function root; a
 * platform is free to run the handler from anywhere. So the module's own
 * location is walked upwards as well, which finds the package whatever the
 * working directory happens to be — the same way Node's own resolution works,
 * and the part that does not depend on a convention holding.
 */
export function candidateRoots(): string[] {
  const roots: string[] = [process.cwd(), path.dirname(process.cwd()), "/var/task"];

  try {
    // Only ever a file: URL here; anything else is not a path and is skipped.
    const here = import.meta.url;
    if (typeof here === "string" && here.startsWith("file:")) {
      let dir = path.dirname(fileURLToPath(here));
      // Bounded: a runaway loop on a path that never reaches its own root is
      // a hang, and a hang in a cron sweep is worse than a missed file.
      for (let i = 0; i < 8; i += 1) {
        roots.push(dir);
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  } catch {
    // The working-directory routes above stand on their own.
  }

  return [...new Set(roots)];
}

/** The worker module's path, or null when it cannot be found on this machine. */
export function resolveWorkerPath(): string | null {
  const root = packageRoot();
  if (!root) return null;
  return usablePath(path.join(root, ...WORKER_PARTS));
}

/**
 * The font and character-map directories, as paths with the trailing separator
 * pdf.js expects — it concatenates a file name onto whatever it is given.
 *
 * Absent CMaps are not cosmetic. A CID-keyed font has no code-to-glyph mapping
 * without them, and CID-keyed is what almost every non-Latin PDF uses — so an
 * Arabic lecture extracts as nothing while pdf.js logs a warning no one reads,
 * and the pipeline writes the deck off as a scan.
 */
export function resolvePdfAssets(): { standardFontDataUrl?: string; cMapUrl?: string } {
  return assetsIn(packageRoot());
}

/**
 * The same, for a root supplied rather than discovered — so the existence
 * checks can be driven against a directory that deliberately lacks them.
 */
export function assetsIn(root: string | null): { standardFontDataUrl?: string; cMapUrl?: string } {
  if (!root) return {};

  const assets: { standardFontDataUrl?: string; cMapUrl?: string } = {};
  const fonts = path.join(root, "standard_fonts");
  const cmaps = path.join(root, "cmaps");
  if (existsSync(fonts)) assets.standardFontDataUrl = fonts + path.sep;
  if (existsSync(cmaps)) assets.cMapUrl = cmaps + path.sep;
  return assets;
}

/**
 * Point pdf.js at the worker, and say whether it worked.
 *
 * The assignment is guarded rather than trusted: `GlobalWorkerOptions.workerSrc`
 * throws on a non-string, and that throw is what took every server-side PDF
 * read down. Nothing reaches the setter here that has not already been proved
 * to be a string naming a file that exists.
 */
export function configureWorker(
  options: { workerSrc: string },
  /* Injectable so a test can supply what a broken machine would: null, or a
     module id. The default is the real thing, so no caller has to know. */
  workerPath: string | null = resolveWorkerPath()
): boolean {
  const worker = usablePath(workerPath);
  if (!worker) return false;
  options.workerSrc = worker;
  return true;
}
