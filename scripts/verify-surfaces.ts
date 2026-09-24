import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * One rule, enforced: a surface is made of the system, or it is not made.
 *
 * The redesign's finding was that Home used six card materials at once —
 * `.panel`, Card `quiet`, Card `glass`, `glass-quiet`, and two hand-rolled
 * `bg-surface-*` fills — with no rule about which meant what. That is what
 * "everything looks the same but nothing matches" is actually made of, and it
 * is invisible in review because each individual line looks reasonable.
 *
 * So the rule lives here rather than in a style guide nobody opens:
 *
 *   1. `.chrome-bar` — the one translucent material — is only for bars that
 *      float ABOVE content. Three of those exist. A fourth is a content
 *      surface that has been built out of the wrong thing.
 *   2. No component invents a surface out of a fractional fill. `bg-surface-
 *      elevated/80` is a card someone drew by hand instead of taking one.
 *   3. `Card variant="glass"` stays rare — the variant's own comment calls it
 *      "the one or two hero surfaces per screen", and a rule that is written
 *      down and never checked is a rule that decays.
 */

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Surfaces\n");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const ROOT = join(process.cwd(), "src");
const FILES = walk(ROOT);

/** Comments describe the rule and must not be mistaken for breaking it. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* ── 1. The translucent material, and its three legitimate homes ────────── */

const CHROME_ALLOWED = new Set([
  "src/components/shared/app-shell.tsx", // the mobile tab bar
  "src/components/lectures/slide-workspace.tsx", // the toolbar over a slide
  "src/components/lectures/slide-annotator.tsx", // the pen's palette
]);

const usingChrome = FILES.filter((f) => /\bchrome-bar\b/.test(code(readFileSync(f, "utf8"))))
  .map((f) => f.replace(process.cwd() + "/", ""))
  .sort();

ok(
  "the translucent material is only on bars that float over content",
  usingChrome.every((f) => CHROME_ALLOWED.has(f)),
  `unexpected: ${usingChrome.filter((f) => !CHROME_ALLOWED.has(f)).join(", ")}\n        ` +
    `A content surface is a Card or a .panel. See the .chrome-bar comment in globals.css.`
);

/* The inverse, so the allow-list cannot rot into a list of files that stopped
   using it — which would quietly make rule 1 vacuous. */
ok(
  "every file on the allow-list still uses it",
  [...CHROME_ALLOWED].every((f) => usingChrome.includes(f)),
  `stale entries: ${[...CHROME_ALLOWED].filter((f) => !usingChrome.includes(f)).join(", ")}`
);

/* The old name must not come back alongside the new one. */
const oldName = FILES.filter((f) => /\bglass-quiet\b/.test(readFileSync(f, "utf8")));
ok("the old name is gone", oldName.length === 0, oldName.join(", "));

/* ── 2. Nobody draws their own card ─────────────────────────────────────── */

const handRolled: string[] = [];
for (const f of FILES) {
  const src = code(readFileSync(f, "utf8"));
  // A fractional opacity on a surface token is a card drawn by hand.
  if (/bg-surface-(elevated|secondary|primary)\/\d/.test(src)) {
    handRolled.push(f.replace(process.cwd() + "/", ""));
  }
}
ok(
  "no component invents a surface out of a fractional fill",
  handRolled.length === 0,
  `${handRolled.join(", ")}\n        Take the token: bg-[color:var(--surface-elevated)], or use a Card.`
);

/* ── 3. The hero material stays rare ────────────────────────────────────── */

const glassUses: string[] = [];
for (const f of FILES) {
  const src = code(readFileSync(f, "utf8"));
  const n = (src.match(/variant="glass"/g) ?? []).length;
  if (n > 0) glassUses.push(`${f.replace(process.cwd() + "/", "")} (${n})`);
}
/* Pinned at the actual count rather than at the documented ceiling.
 
   "One or two per screen" was the ceiling this asserted first, and a mutation
   adding a second use passed it — a check with slack in it is a check that
   only fires after the drift it was meant to prevent. There is exactly one
   glass surface in the product (Focus Now, the single next action), so one is
   what this holds. Adding a genuine second hero means changing this line, on
   purpose, in a diff someone reads. */
ok(
  "the hero material is still rare",
  glassUses.length <= 1,
  `${glassUses.join(", ")}\n        See the 'glass' note in src/components/ui/card.tsx.`
);

console.log("");
console.log(failed === 0 ? "One system, one rule per material." : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
