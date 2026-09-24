import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  snapshotTiles,
  heroRing,
  primaryCta,
  aiPrompts,
  firstName,
  greetingKey,
  PROMPT_TOOL,
  AI_PROMPT_KEYS,
  ACCENT_AT,
} from "../src/lib/home-metrics";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("Home metrics\n");

/* The real account's measured numbers, 2026-09-24. Using the student's own
   figures rather than round ones keeps the test honest about the case that
   actually ships. */
const REAL = {
  activeSubjectsCount: 7,
  activeTasksCount: 22,
  reviewsDueTotal: 42,
  gapsSummary: { unresolved: 12 },
};

const tiles = snapshotTiles(REAL);

ok("four tiles", tiles.length === 4, `got ${tiles.length}`);
ok(
  "values come straight from the data",
  tiles.map((t) => t.value).join(",") === "7,22,42,12",
  tiles.map((t) => t.value).join(",")
);

/* The bug this pins: reading a count off `subjectWorld`, which is capped at 4.
   On the real account that would print 4 where the truth is 7. */
ok("course count is the total, not the preview length", tiles[0].value === 7);

ok(
  "every tile links somewhere",
  tiles.every((t) => t.href.startsWith("/") && t.href.length > 1),
  JSON.stringify(tiles.map((t) => t.href))
);

/* Destinations must be routes that exist. Read off the filesystem rather than
   listed here, so deleting a page breaks this instead of rotting quietly. */
const ROUTES = new Set(
  readFileSync(join(process.cwd(), "scripts/verify-home-metrics.ts"), "utf8") && []
);
for (const t of tiles) {
  const path = join(process.cwd(), "src/app/(app)", t.href.replace(/^\//, ""), "page.tsx");
  let exists = true;
  try {
    readFileSync(path);
  } catch {
    exists = false;
  }
  ok(`${t.kind} -> ${t.href} is a real page`, exists, path);
}
void ROUTES;

ok("accent only on a real backlog", tiles[1].accent && tiles[2].accent);
ok("courses never take the accent", tiles[0].accent === false);
ok("gaps never take the accent", tiles[3].accent === false);

const quiet = snapshotTiles({
  activeSubjectsCount: 3,
  activeTasksCount: ACCENT_AT - 1,
  reviewsDueTotal: 0,
  gapsSummary: { unresolved: 0 },
});
ok("under the threshold, no accent", quiet.every((t) => !t.accent));
ok("zero is marked empty, not printed as a 0", quiet[2].empty && quiet[3].empty);
ok("a non-zero is never empty", quiet[0].empty === false && quiet[1].empty === false);

/* The ring. */
ok("ring reports the health score", heroRing({ score: 54 }).pct === 54);
ok("ring clamps above", heroRing({ score: 140 }).pct === 100);
ok("ring clamps below", heroRing({ score: -5 }).pct === 0);
ok("bands split at 40 and 70", heroRing({ score: 39 }).band === "low" && heroRing({ score: 40 }).band === "mid" && heroRing({ score: 70 }).band === "high");

/* The ring must not be sold as something the schema cannot support. */
const metricsSrc = readFileSync(join(process.cwd(), "src/lib/home-metrics.ts"), "utf8");
ok(
  "no semester-progress claim in the metrics layer",
  !/semester\s*progress/i.test(metricsSrc.replace(/NOT "semester progress"/i, "")),
  "a semester model does not exist in this schema"
);

/* The primary button. */
ok("resume wins when there is a position", primaryCta("/lectures/a/slides/b").kind === "resume");
ok("falls back to the day, not a dead link", primaryCta(null).kind === "day" && primaryCta(null).href === "/today");

/* AI prompts must map to tools the agent really has. */
const toolsSrc = readFileSync(join(process.cwd(), "src/lib/ai/agent/tools.ts"), "utf8");
for (const key of AI_PROMPT_KEYS) {
  const tool = PROMPT_TOOL[key];
  ok(`prompt "${key}" maps to a real tool (${tool})`, toolsSrc.includes(`name: "${tool}"`), tool);
}
ok("no prompts offered when the agent cannot run", aiPrompts(false).length === 0);
ok("prompts offered when it can", aiPrompts(true).length === AI_PROMPT_KEYS.length);

/* Names. */
ok("first name only", firstName("MSHARY Almandour") === "MSHARY");
ok("blank name yields null, never a placeholder person", firstName("   ") === null && firstName(null) === null);

ok(
  "greeting keys cover all four periods",
  greetingKey("morning") === "greetingMorning" &&
    greetingKey("day") === "greetingDay" &&
    greetingKey("evening") === "greetingEvening" &&
    greetingKey("night") === "greetingNight"
);

console.log(failed === 0 ? "\nAll home-metric checks passed." : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
