/**
 * Every internal href points at a route that exists.
 *
 * WHY. This class of bug has now shipped twice in one project:
 *
 *   1. `?tab=topics` survived a tab rename, so search results and review rows
 *      led to a blank course page. Build, typecheck and 42 tests all passed.
 *   2. `/mistakes`, `/problems` and `/videos` were linked from the agent's own
 *      result list, and from the review page, and none of the three routes has
 *      ever existed. The agent reported a success and handed back a 404.
 *
 * Neither was catchable by the type system: a route is a string, and a string
 * is always a valid string. Nothing short of walking the app directory can
 * tell whether it resolves, so that is what this does.
 *
 * It is deliberately a *route* check and not a link checker. It does not visit
 * pages or care about query strings beyond stripping them — the second bug was
 * a missing segment and the first was a missing query value, and only the
 * first kind can be decided from the file system. `verify-tab-params.ts`
 * covers the other.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src";
const APP = join(SRC, "app");

/* ────────────────────────────────────────────────────────────────────────────
   What routes exist
   ──────────────────────────────────────────────────────────────────────────── */

/** Route groups — `(app)`, `(auth)` — are organisational and not in the URL. */
const GROUP = /^\(.+\)$/;
/** A dynamic segment matches anything, so it is recorded as a wildcard. */
const DYNAMIC = /^\[.+\]$/;

type Route = string[];

function collectRoutes(dir: string, segs: string[], out: Route[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  // A directory is a route when it holds a page or a route handler.
  if (entries.includes("page.tsx") || entries.includes("route.ts")) out.push([...segs]);

  for (const name of entries) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith("_") || name.startsWith("@")) continue; // private / parallel
    collectRoutes(full, GROUP.test(name) ? segs : [...segs, name], out);
  }
}

const routes: Route[] = [];
collectRoutes(APP, [], routes);

function resolves(path: string): boolean {
  const want = path.split("/").filter((s) => s !== "");
  return routes.some(
    (r) =>
      r.length === want.length &&
      r.every((seg, i) => DYNAMIC.test(seg) || seg === want[i])
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   What the app links to
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `href="/x"`, `href: "/x"` and `` href={`/x/${id}`} `` — the three shapes this
 * codebase actually writes. A template literal's `${...}` becomes a wildcard,
 * because what it interpolates is an id by construction and this check is
 * about the shape of the path, not the value of the id.
 */
const HREF = /href\s*[:=]\s*\{?\s*(?:"([^"]+)"|`([^`]+)`)/g;

function walk(dir: string, files: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(name)) files.push(full);
  }
  return files;
}

interface Bad {
  file: string;
  line: number;
  href: string;
}

const bad: Bad[] = [];

for (const file of walk(SRC, [])) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(HREF)) {
    const raw = m[1] ?? m[2] ?? "";
    // External, anchors, mail/tel and protocol-relative are nothing to do with
    // the route table.
    if (!raw.startsWith("/")) continue;
    if (raw.startsWith("//")) continue;

    const path = raw
      .split("?")[0]
      .split("#")[0]
      .replace(/\$\{[^}]*\}/g, "[x]"); // an interpolated id is a wildcard

    if (path === "/" || resolves(path)) continue;

    bad.push({
      file,
      line: text.slice(0, m.index).split("\n").length,
      href: raw,
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Report
   ──────────────────────────────────────────────────────────────────────────── */

if (routes.length === 0) {
  console.error("verify-internal-links: found no routes at all — is src/app there?");
  process.exit(1);
}

if (bad.length > 0) {
  console.error(`verify-internal-links: ${bad.length} link(s) point at no route\n`);
  for (const b of bad) console.error(`  ${b.file}:${b.line}  ->  ${b.href}`);
  console.error(
    "\nEither the route is missing or the link is stale. Do not point it at a" +
      "\npage that does not hold the thing either — that is the same broken" +
      "\npromise. A line with no destination is allowed; a wrong one is not."
  );
  process.exit(1);
}

console.log(`verify-internal-links: ${routes.length} routes, every internal href resolves`);
