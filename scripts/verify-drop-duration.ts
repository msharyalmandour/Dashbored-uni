/**
 * The wait estimate, and the silence it starts in.
 *
 * On 2026-10-01 this account had recorded exactly zero run durations, because
 * nothing had ever written one. The proxy everyone reaches for first —
 * `updatedAt - createdAt` — produced these, in seconds, for real rows:
 *
 *     1700830   (twenty days; the row was re-read by the cron)
 *     1700825   (twenty days, same reason)
 *        1049
 *         971
 *          48 / 21 / 14   (the three that are plausibly real)
 *
 * An estimate drawn from that sample would have told the student his drop
 * takes four days. That is why the column exists and why this file refuses to
 * say anything until four real runs have been measured.
 *
 * Run: npx tsx scripts/verify-drop-duration.ts
 */

import {
  estimateFrom,
  quantile,
  sayableSeconds,
  MIN_RUNS_FOR_ESTIMATE,
  QUOTED_QUANTILE,
} from "../src/lib/drop-duration";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Drop duration\n");

/* ── The state it starts in ───────────────────────────────────────────────── */

{
  ok("an account that has never run anything is told nothing",
    estimateFrom([]).kind === "UNKNOWN");
  ok("and neither is one with three runs",
    estimateFrom([12000, 14000, 16000]).kind === "UNKNOWN");
  ok("the floor follows the constant, not a literal",
    estimateFrom(Array.from({ length: MIN_RUNS_FOR_ESTIMATE }, () => 12000)).kind === "SECONDS" &&
    estimateFrom(Array.from({ length: MIN_RUNS_FOR_ESTIMATE - 1 }, () => 12000)).kind === "UNKNOWN");
}

{
  // Nulls are the normal state of the column: every row written before it
  // existed, every run refused by the budget. They are absences, not zeroes.
  ok("nulls do not count toward the floor",
    estimateFrom([null, null, null, null, null, 12000]).kind === "UNKNOWN");
  ok("and neither do zeroes — a run that happened took time",
    estimateFrom([0, 0, 0, 0, 12000]).kind === "UNKNOWN");
  ok("a negative duration is discarded rather than trusted",
    estimateFrom([-5000, -1, 0, 12000]).kind === "UNKNOWN");
}

/* ── What it quotes ───────────────────────────────────────────────────────── */

{
  const e = estimateFrom([10000, 15000, 20000, 40000]);
  ok("four runs produce a number", e.kind === "SECONDS", JSON.stringify(e));
  ok("and it says how many runs it came from",
    e.kind === "SECONDS" && e.fromRuns === 4, JSON.stringify(e));
  // Nearest rank: ceil(0.75 x 4) = 3, so the third of four. The first draft
  // of this test asserted the fourth and was wrong about its own arithmetic;
  // the code was right.
  ok("it quotes the third of four runs, by nearest rank",
    e.kind === "SECONDS" && e.seconds === 20, JSON.stringify(e));
}

{
  /* The case that actually separates the quartile from the median, which the
     four-run sample above does not: eight runs where most are quick and the
     tail is long. Quoting the median here would tell the student fifteen
     seconds for a wait that exceeds it half the time. */
  const spread = [8000, 9000, 10000, 12000, 15000, 30000, 55000, 90000];
  const e = estimateFrom(spread);
  const median = sayableSeconds(quantile(spread, 0.5));
  ok("on a long tail the quoted number is well above the median",
    e.kind === "SECONDS" && e.seconds === 30 && median === 10,
    `quoted ${JSON.stringify(e)} vs median ${median}`);
  ok("and most runs come in under what was quoted",
    spread.filter((d) => d / 1000 <= 30).length >= spread.length * 0.75,
    String(spread.filter((d) => d / 1000 <= 30).length));
}

{
  // The quantile is tied to the constant, so changing it cannot leave this
  // asserting the old behaviour.
  const sample = [1000, 2000, 3000, 4000, 100000];
  ok("the quoted quantile follows its constant",
    quantile(sample, QUOTED_QUANTILE) === quantile(sample.slice().sort((a, b) => a - b), QUOTED_QUANTILE));

  // Nearest rank, never interpolated: every number quoted is a duration some
  // run actually took, not an average of two that no run did.
  ok("the quoted value is a real observation",
    sample.includes(quantile(sample, QUOTED_QUANTILE)), String(quantile(sample, QUOTED_QUANTILE)));
}

/* ── A number a person would say ──────────────────────────────────────────── */

{
  ok("anything very fast still promises five seconds", sayableSeconds(400) === 5);
  ok("a promise is never below five", sayableSeconds(1) === 5);
  ok("seconds round to five", sayableSeconds(23000) === 25, String(sayableSeconds(23000)));
  ok("past a minute they round to ten", sayableSeconds(97000) === 100, String(sayableSeconds(97000)));
  ok("a precise-looking number is never produced",
    [sayableSeconds(23000), sayableSeconds(47000), sayableSeconds(188000)].every((s) => s % 5 === 0));
}

{
  // The real rows, had they been measurable. The two twenty-day proxies are
  // exactly what this must never quote, and the floor is what stops it: with
  // only three plausible runs recorded, there is no estimate at all.
  const proxy = [1700830000, 1700825000, 1049000, 971000, 48000, 21000, 14000];
  const e = estimateFrom(proxy);
  ok("the proxy sample would have produced an absurd promise",
    e.kind === "SECONDS" && e.seconds > 3600, JSON.stringify(e));
  ok("…which is why the real column is measured instead of derived",
    estimateFrom([48000, 21000, 14000]).kind === "UNKNOWN");
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
