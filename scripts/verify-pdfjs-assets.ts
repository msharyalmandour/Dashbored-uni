/**
 * Finding pdf.js's own files, and the class of bug that hid there twice.
 *
 * Server-side PDF reading needs the worker module, the standard fonts and the
 * CMaps from the pdfjs-dist package on disk. Each was found with
 * `createRequire(import.meta.url).resolve("<literal>")`, which is correct in
 * Node and wrong after bundling: the bundler rewrites a literal specifier into
 * its own resolver, which does not return a path.
 *
 * Both call sites then failed in ways nothing reported honestly. The worker id
 * was truthy, so `if (worker)` handed it to a setter that throws on anything
 * but a string, and every PDF in production failed with `Invalid \`workerSrc\`
 * type.` The assets path called `.slice()` on the same value, threw inside its
 * own `try`, and returned `{}` — so the CMaps were silently absent and every
 * Arabic lecture extracted as nothing, which the pipeline reads as a scan.
 *
 * An earlier fix traced the worker file into the deployment and verified the
 * trace contained it. It did. The file was deployed and the code could not
 * name it, so the check confirmed the half that already worked — which is why
 * the tests below are about the SHAPE of the value and not about the happy
 * path. Every one of them fails if a non-string can reach pdf.js, whatever
 * route produced it.
 *
 * Run: npx tsx scripts/verify-pdfjs-assets.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  assetsIn,
  candidateRoots,
  configureWorker,
  packageRoot,
  resolvePdfAssets,
  resolveWorkerPath,
  rootContaining,
  usablePath,
} from "../src/lib/pdfjs-assets";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let failures = 0;
function check(label: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("pdf.js asset resolution\n");

/* ── The shape of the answer ──────────────────────────────────────────────── */

check("the worker path is a string or null, never anything else", () => {
  const worker = resolveWorkerPath();
  assert.ok(worker === null || typeof worker === "string", `got ${typeof worker}`);
});

check("a path that is returned is a file that exists", () => {
  // The distinction the last fix missed: resolving and being there are two
  // different facts, and only the second one reads a PDF.
  const worker = resolveWorkerPath();
  if (worker !== null) assert.ok(existsSync(worker), `${worker} does not exist`);
});

check("asset directories are strings that exist, with a trailing separator", () => {
  // pdf.js concatenates a file name onto whatever it is given, so a missing
  // separator silently produces a path one directory up.
  const assets = resolvePdfAssets();
  for (const [key, value] of Object.entries(assets)) {
    assert.equal(typeof value, "string", `${key} is ${typeof value}`);
    assert.ok(existsSync(value as string), `${key} points at ${value}, which is not there`);
    assert.ok(/[/\\]$/.test(value as string), `${key} has no trailing separator: ${value}`);
  }
});

/* ── The guard, driven with what a broken machine actually produces ───────── */

check("a module id is rejected, whatever it looks like", () => {
  /* This is the bug, in one line. The bundler's resolver returned one of
     these; it was truthy, so it reached a setter that accepts only strings,
     and every PDF in production failed. Numbers, objects and symbols are all
     truthy and none of them is a path. */
  for (const hostile of [1, 42, 0, {}, [], () => {}, Symbol("m"), true, null, undefined, NaN]) {
    assert.equal(usablePath(hostile), null, `${String(hostile)} was accepted as a path`);
  }
});

check("a string that does not name a real file is rejected", () => {
  // Resolving and existing are two different facts. The earlier fix verified
  // the first and shipped believing it had the second.
  assert.equal(usablePath("/definitely/not/here/pdf.worker.mjs"), null);
  assert.equal(usablePath(""), null);
});

check("a real path is accepted unchanged", () => {
  const real = resolveWorkerPath();
  if (real) assert.equal(usablePath(real), real);
});

check("configureWorker leaves the option untouched when there is no worker", () => {
  /* The failure path, which on a healthy machine is never taken — so without
     injecting it, removing the check changes nothing a test can see. */
  const options = { workerSrc: "untouched" };
  assert.equal(configureWorker(options, null), false);
  assert.equal(options.workerSrc, "untouched", "it reported failure and assigned anyway");
});

check("configureWorker refuses a module id rather than handing it to pdf.js", () => {
  let assigned: unknown = "untouched";
  const pdfjsLike = {
    set workerSrc(value: unknown) {
      if (typeof value !== "string") throw new Error("Invalid `workerSrc` type.");
      assigned = value;
    },
    get workerSrc() {
      return assigned as string;
    },
  };
  const ok = configureWorker(pdfjsLike as { workerSrc: string }, 42 as unknown as string);
  assert.equal(ok, false, "a module id was accepted");
  assert.equal(assigned, "untouched");
});

check("assets are omitted when the directories are not there", () => {
  // An empty object is the honest answer: pdf.js then uses its own defaults
  // instead of being pointed at a directory that does not exist.
  const empty = mkdtempSync(path.join(tmpdir(), "pdfjs-none-"));
  assert.deepEqual(assetsIn(empty), {});
  assert.deepEqual(assetsIn(null), {});
});

/* ── The guard itself ─────────────────────────────────────────────────────── */

check("configureWorker never assigns a non-string", () => {
  /* The exact production failure, reproduced: pdf.js's setter throws on
     anything but a string. This stands in for it and fails the test if
     anything else is ever assigned. */
  let assigned: unknown = "untouched";
  const hostile = {
    set workerSrc(value: unknown) {
      if (typeof value !== "string") throw new Error("Invalid `workerSrc` type.");
      assigned = value;
    },
    get workerSrc() {
      return assigned as string;
    },
  };
  const ok = configureWorker(hostile as { workerSrc: string });
  assert.equal(typeof ok, "boolean");
  if (ok) {
    assert.equal(typeof assigned, "string");
    assert.ok(existsSync(assigned as string));
  } else {
    assert.equal(assigned, "untouched", "it reported failure and assigned anyway");
  }
});

check("configureWorker reports failure rather than throwing", () => {
  // A cron sweep must survive a machine without the package: one unreadable
  // file is one file, an exception is the whole batch.
  assert.doesNotThrow(() => configureWorker({ workerSrc: "" }));
});

/* ── The fallback, which is the route production actually takes ───────────── */

check("the directory walk finds the package when the resolver cannot", () => {
  /* In the deployed bundle the resolve above is replaced with a thrown
     "Cannot find module as expression is too dynamic" — read out of the
     emitted chunk — so this walk is what runs. Locally the resolver always
     succeeds, which means without this test the whole fallback could be
     deleted and nothing would notice until the next deploy. */
  const base = mkdtempSync(path.join(tmpdir(), "pdfjs-root-"));
  const pkg = path.join(base, "node_modules", "pdfjs-dist");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(path.join(pkg, "package.json"), "{}");

  assert.equal(rootContaining([base]), pkg);
  assert.equal(rootContaining(["/nowhere", base]), pkg, "it must keep looking past a miss");
});

check("the package is still found when the resolver throws, as it does in production", () => {
  /* The deployed condition, exactly: the bundler replaces the dynamic resolve
     with a thrown MODULE_NOT_FOUND. Everything then depends on the walk, and
     this is the only test that proves the walk carries it. */
  const bundlerStub = () => {
    const err = new Error("Cannot find module as expression is too dynamic") as Error & { code?: string };
    err.code = "MODULE_NOT_FOUND";
    throw err;
  };
  const root = packageRoot(bundlerStub);
  assert.ok(root, "the package could not be found without the resolver");
  assert.ok(existsSync(path.join(root as string, "package.json")), `${root} has no package.json`);
});

check("a resolver that returns a module id is not mistaken for a path", () => {
  // The other half of the original bug: not a throw, a truthy non-path.
  const root = packageRoot(() => 4711);
  assert.ok(root === null || existsSync(path.join(root, "package.json")));
});

check("the walk returns null rather than a directory that is not there", () => {
  const empty = mkdtempSync(path.join(tmpdir(), "pdfjs-empty-"));
  assert.equal(rootContaining([empty]), null);
  assert.equal(rootContaining([]), null);
});

check("a root that is not a string cannot crash the walk", () => {
  // path.join throws on a non-string, and a throw here loses the whole batch.
  const hostile = [42, null, undefined, {}] as unknown as string[];
  assert.doesNotThrow(() => rootContaining(hostile));
  assert.equal(rootContaining(hostile), null);
});

check("the module's own directory chain is among the places searched", () => {
  /* `process.cwd()` is a convention, not a guarantee — a platform may run the
     handler from anywhere. Walking up from this module finds the package the
     way Node itself would, and is the part that does not depend on where the
     process happens to have started. */
  const roots = candidateRoots();
  assert.ok(roots.length > 3, `only ${roots.length} candidate roots`);
  assert.ok(roots.includes(process.cwd()), "the working directory is not searched");
  const here = path.dirname(new URL(import.meta.url).pathname);
  const walksUpward = roots.some((root) => here.startsWith(root) && root !== process.cwd());
  assert.ok(walksUpward, "no ancestor of this module is searched");
});

check("candidate roots are unique, so the same directory is not probed twice", () => {
  const roots = candidateRoots();
  assert.equal(new Set(roots).size, roots.length);
});

/* ── The class of bug, not the instance ───────────────────────────────────── */

/**
 * The file with its comments removed.
 *
 * These checks are about what runs, and this file's own documentation quotes
 * the broken line on purpose so the next person can see what it looked like.
 * Matching prose would make the guard fire on an explanation of the bug it
 * exists to prevent — a test that cannot tell code from a comment is a test
 * that gets deleted the first time it is wrong.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const SOURCES = [
  "src/lib/processors/pdf-text-processor.ts",
  "src/lib/annotation-reader.ts",
  "src/lib/pdfjs-assets.ts",
];

check("no server file resolves a pdfjs path from a literal specifier", () => {
  /* This is the regression guard. A literal `require.resolve("pdfjs-dist/…")`
     is what the bundler rewrites, and reading correct in review is exactly how
     it survived: the line looks right, and is only wrong once built. */
  for (const file of SOURCES) {
    const text = code(file);
    const literal = /\.resolve\(\s*["'`]pdfjs-dist/.test(text);
    assert.ok(!literal, `${file} resolves a literal pdfjs-dist specifier`);
  }
});

check("workerSrc is only ever set through the guarded helper", () => {
  for (const file of SOURCES) {
    const text = code(file);
    // Assignments in this repo go through configureWorker; a direct one is
    // the shape that shipped the outage.
    const direct = /GlobalWorkerOptions\.workerSrc\s*=/.test(text);
    assert.ok(!direct, `${file} assigns workerSrc directly instead of via configureWorker`);
  }
});

check("the extraction path refuses to run without pdf.js rather than failing oddly", () => {
  // The original message sent two rounds of investigation at fonts. A
  // deployment missing its own package should say so.
  const text = code("src/lib/processors/pdf-text-processor.ts");
  assert.ok(/if \(!configureWorker\(/.test(text), "the processor does not check whether the worker was found");
  assert.ok(/could not be found on the server/.test(text), "there is no legible message for a missing package");
});

check("the annotation reader asks for the CMaps too", () => {
  /* It never did. Without them a CID-keyed font has no mapping, so the text
     under a pen mark on an Arabic lecture came back empty — and an empty
     region is indistinguishable from a mark drawn over a picture. */
  const text = code("src/lib/annotation-reader.ts");
  assert.ok(/resolvePdfAssets\(\)/.test(text), "the annotation reader has no font or CMap paths");
  assert.ok(/cMapPacked/.test(text), "the annotation reader does not say the CMaps are packed");
});

/* ── Which functions get pdf.js's files ────────────────────────────────────
 *
 * Read the header of this file before adding anything here. An earlier fix
 * traced the worker into the deployment, checked the trace contained it, and
 * the check passed while every PDF in production failed — because the file was
 * deployed and the code could not name it. A trace assertion proves the file
 * arrived. It proves nothing about extraction working, and the tests above are
 * where that lives.
 *
 * What it does prove is a NECESSARY condition that a config edit can silently
 * remove. Reading a PDF now happens on two kinds of path: the nightly route,
 * and — since the inbox's "read my waiting files" button — an ordinary request
 * under the app group. `outputFileTracingIncludes` keys on route patterns, so
 * narrowing `"/*"` to `"/api/*"` would leave the button's function without a
 * worker. Nothing would type-check differently, no test below would notice, and
 * the failure would appear as a student pressing a button and being told their
 * lectures are unreadable.
 */

/**
 * The traced paths, as entries — not as text anywhere in the file.
 *
 * The first version of this asked `config.includes("pdf.worker.mjs")`, and the
 * mutation sweep caught it: next.config.ts *explains* what it traces, in prose,
 * right above the list. So deleting the worker from the list left the check
 * passing on the comment describing it. That is the second time in one sitting
 * a check of mine matched a declaration or a sentence instead of the thing
 * itself, which is the argument for parsing rather than grepping.
 */
function tracedPaths(config: string): { pattern: string; entries: string[] } {
  const start = config.indexOf("outputFileTracingIncludes:");
  assert.ok(start >= 0, "outputFileTracingIncludes is gone");
  const open = config.indexOf("[", start);
  const close = config.indexOf("]", open);
  assert.ok(open > 0 && close > open, "the traced list is not an array literal any more");

  const key = /"([^"]+)"\s*:\s*\[/.exec(config.slice(start, open + 1));
  assert.ok(key, "the traced list is no longer keyed by a route pattern");

  const entries = [...config.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { pattern: key[1], entries };
}

check("the trace pattern covers every route, not only the API", () => {
  const { pattern } = tracedPaths(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"));
  assert.equal(
    pattern,
    "/*",
    `the trace pattern is "${pattern}" — a PDF is read from request paths as well as the cron route`
  );
});

check("the worker, the CMaps and the fonts are each a traced entry", () => {
  const { entries } = tracedPaths(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"));
  for (const asset of ["pdf.worker.mjs", "standard_fonts", "cmaps"]) {
    assert.ok(
      entries.some((e) => e.includes(asset)),
      `${asset} is not in the traced list (entries: ${entries.join(", ") || "none"})`
    );
  }
});

check("a real build gives the button's own function the worker and the CMaps", () => {
  /* Against the build output, when there is one. Skipped rather than failed
     without it: this script runs before a build in CI, and a check that demands
     one would be turned off rather than fixed. */
  const traces = [
    ".next/server/app/(app)/inbox/page.js.nft.json",
    ".next/server/app/api/cron/process-documents/route.js.nft.json",
  ];
  const present = traces.filter((t) => existsSync(new URL(`../${t}`, import.meta.url)));
  if (present.length === 0) {
    console.log("      (no build output — run `npm run build` to check this against a real trace)");
    return;
  }
  for (const trace of present) {
    const files: string[] = JSON.parse(
      readFileSync(new URL(`../${trace}`, import.meta.url), "utf8")
    ).files ?? [];
    const where = trace.includes("inbox") ? "the inbox page" : "the cron route";
    assert.ok(
      files.some((f) => f.includes("pdf.worker")),
      `${where} was deployed without pdf.js's worker`
    );
    assert.ok(
      files.some((f) => f.includes("/cmaps/")),
      `${where} was deployed without the CMaps — an Arabic lecture extracts as nothing`
    );
    assert.ok(
      files.some((f) => f.includes("standard_fonts")),
      `${where} was deployed without the standard fonts`
    );
  }
});

console.log("");
console.log(failures === 0 ? "pdf.js is found by path, or not at all." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
