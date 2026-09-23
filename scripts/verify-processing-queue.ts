/**
 * A claim on a document is a lease, not a deed.
 *
 * Reading a file is claimed by flipping its row QUEUED → PROCESSING, so a
 * nightly sweep and a student dropping the same file cannot both read it. That
 * claim was correct and permanent: nothing in the app ever moved a row out of
 * PROCESSING.
 *
 * The claim is taken for a whole batch and the route taking it may run for 60
 * seconds. Nineteen PDFs downloaded and extracted in one pass will exceed that,
 * and a killed run left every row it claimed stranded — not FAILED, which is
 * visible and retryable, but PROCESSING, which the inbox renders as "📄 Reading
 * document" and the agent refuses to act on with "Still reading the file".
 * Forever. A failure that looks like work in progress is a failure nobody
 * reports, which makes it worse than the extraction bug it would be hiding.
 *
 * Measured before this existed: 19 documents QUEUED, one daily pass, batch size
 * 20, and no path back out of PROCESSING for any of them.
 *
 * Run: npx tsx scripts/verify-processing-queue.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLAIM_LEASE_MS,
  claimIsLive,
  claimsExpireBefore,
  expiredClaimUpdate,
  intoWaves,
  timeForAnotherWave,
  WAVE_SIZE,
} from "../src/lib/processing-queue";

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

console.log("Document processing queue\n");

const NOW = new Date("2026-09-24T03:00:00.000Z");

/* ── The lease boundary ───────────────────────────────────────────────────── */

check("a claim taken a moment ago belongs to whoever took it", () => {
  /* The failure in this direction is the loud one: releasing a row a worker is
     still reading means two workers read one file, and the second overwrites
     what the first extracted. */
  assert.equal(claimIsLive(new Date(NOW.getTime() - 1_000), NOW), true, "a one-second-old claim was released");
  assert.equal(claimIsLive(new Date(NOW.getTime() - 59_000), NOW), true, "a claim inside the route's own ceiling was released");
  assert.equal(claimIsLive(NOW, NOW), true, "a claim taken this instant was released");
});

check("a claim older than the lease belongs to nobody", () => {
  assert.equal(claimIsLive(new Date(NOW.getTime() - CLAIM_LEASE_MS - 1), NOW), false, "an abandoned claim was honoured");
  assert.equal(claimIsLive(new Date(NOW.getTime() - 24 * 3600_000), NOW), false, "a day-old claim was honoured");
});

check("the lease outlasts any run that could still hold a claim", () => {
  /* The route's ceiling is 60s and an interactive read is budgeted in seconds.
     A lease shorter than that would take a document off a live worker. */
  assert.ok(CLAIM_LEASE_MS > 60_000, "the lease is shorter than the route's own maxDuration");
});

check("the cutoff is behind now, not ahead of it", () => {
  // Reversed, this releases every row in the table on every pass.
  assert.ok(claimsExpireBefore(NOW) < NOW);
  assert.equal(NOW.getTime() - claimsExpireBefore(NOW).getTime(), CLAIM_LEASE_MS);
});

/* ── The update that releases them ────────────────────────────────────────── */

check("only PROCESSING rows are released, and only to QUEUED", () => {
  const { where, data } = expiredClaimUpdate(NOW);
  assert.equal(where.processingStatus, "PROCESSING", "a status other than PROCESSING would be rewritten");
  assert.equal(data.processingStatus, "QUEUED", "the row was not put back in the queue");
});

check("the release is bounded by the lease, in the right direction", () => {
  const { where } = expiredClaimUpdate(NOW);
  assert.ok("lt" in where.updatedAt, "the comparison is not `lt` — `gt` releases the rows in flight instead");
  assert.equal(where.updatedAt.lt.getTime(), NOW.getTime() - CLAIM_LEASE_MS);
});

check("an interrupted read is not recorded as a failure", () => {
  /* processingError is what the student is shown. "Read as unreadable" on a
     file nobody has read yet is a lie the app tells about their lecture. */
  const { data } = expiredClaimUpdate(NOW);
  assert.equal(data.processingError, null, "an interrupted read left an error message behind");
});

check("a genuine failure is not retried by this", () => {
  // Widening the released status to include FAILED would re-read every real
  // failure once a day forever, at cost, without anything having changed.
  const { where } = expiredClaimUpdate(NOW);
  assert.equal(JSON.stringify(where.processingStatus), '"PROCESSING"');
});

/* ── Waves ────────────────────────────────────────────────────────────────── */

check("every claimed document lands in exactly one wave", () => {
  /* The property that matters: a row claimed and then dropped on the floor is
     a row held out of the queue for a full lease for no reason. */
  const ids = Array.from({ length: 19 }, (_, i) => `doc_${i}`);
  const waves = intoWaves(ids);
  assert.deepEqual(waves.flat(), ids, "waves lost, reordered or duplicated a document");
  assert.ok(waves.every((w) => w.length <= WAVE_SIZE), "a wave exceeded WAVE_SIZE");
  assert.equal(waves.length, Math.ceil(19 / WAVE_SIZE));
});

check("a short queue is one wave, an empty one is none", () => {
  assert.deepEqual(intoWaves(["a"]), [["a"]]);
  assert.deepEqual(intoWaves([]), []);
});

check("a wave reads fewer documents than the batch claims", () => {
  // Waves that are the whole batch are the behaviour this replaced.
  assert.ok(WAVE_SIZE >= 1 && WAVE_SIZE < 20, `WAVE_SIZE of ${WAVE_SIZE} is the whole batch again`);
});

check("a wave of nothing is refused rather than looped over forever", () => {
  assert.throws(() => intoWaves(["a"], 0), /at least one/);
  assert.throws(() => intoWaves(["a"], -1), /at least one/);
});

/* ── Knowing when to stop ─────────────────────────────────────────────────── */

check("the first wave always runs", () => {
  /* Nothing has been measured yet, so there is no estimate to be cautious
     with. A pass that reads nothing because it cannot predict itself is not
     caution — it is the queue never clearing. */
  assert.equal(timeForAnotherWave(1, 0), true);
  assert.equal(timeForAnotherWave(18_000, 0), true);
});

check("another wave starts only if the last one's duration still fits", () => {
  assert.equal(timeForAnotherWave(10_000, 4_000), true, "there was room and the pass stopped");
  assert.equal(timeForAnotherWave(3_000, 4_000), false, "a wave was started that could not finish");
  assert.equal(timeForAnotherWave(4_000, 4_000), true, "exactly enough time was treated as not enough");
});

check("a spent budget stops the pass", () => {
  // `msRemaining` goes negative once the deadline passes.
  assert.equal(timeForAnotherWave(-1, 1), false);
  assert.equal(timeForAnotherWave(-5_000, 4_000), false);
});

/* ── The order the route does it in ────────────────────────────────────────
 *
 * Asserted against the source because the ordering IS the fix. Releasing after
 * claiming is the same code in the same file doing nothing: the rows this pass
 * just claimed are fresh, and the abandoned ones stay abandoned for another
 * day. Nothing else in this file would notice.
 */

const ROUTE = readFileSync(new URL("../src/app/api/cron/process-documents/route.ts", import.meta.url), "utf8");

/* The handler's body, not the whole file.
 *
 * Searching the file found `releaseExpiredClaims` in its own declaration, so
 * deleting the CALL left the checks below passing — caught by the mutation
 * sweep, which is the only reason this is a function and not an indexOf. What
 * is being asserted is the order things happen in when a request arrives, and
 * that lives in GET alone. */
const HANDLER = (() => {
  const start = ROUTE.indexOf("export async function GET(");
  assert.ok(start >= 0, "the route has no GET handler");
  const after = ROUTE.slice(start);
  /* The handler ends at the first line that closes a top-level block — the
     next declaration at column zero, or the end of the file. */
  const end = after.search(/\n\}\n/);
  return end >= 0 ? after.slice(0, end) : after;
})();

check("the handler releases expired claims on every request", () => {
  assert.match(HANDLER, /await releaseExpiredClaims\(/, "the handler never releases an expired claim");
});

check("claims are released before any are taken", () => {
  const release = HANDLER.indexOf("await releaseExpiredClaims(");
  const claim = HANDLER.indexOf("await claimQueuedDocuments(BATCH_SIZE)");
  assert.ok(release >= 0, "the handler never releases an expired claim");
  assert.ok(claim >= 0, "the handler never claims anything");
  assert.ok(release < claim, "the release runs after the claim, where it can only be a no-op");
});

check("releasing does not depend on storage being configured", () => {
  /* It needs no Supabase key. A deployment that lost its service key would
     otherwise leave every claimed row stuck with no path out — which is the
     same permanence this whole file exists to remove. */
  const release = HANDLER.indexOf("await releaseExpiredClaims(");
  const storageGate = HANDLER.indexOf("if (!isServiceStorageConfigured())");
  assert.ok(release >= 0, "the handler never releases an expired claim");
  assert.ok(storageGate >= 0, "the storage check moved or was renamed");
  assert.ok(release < storageGate, "an unconfigured deployment can never release a claim");
});

check("extraction is bounded, and leaves the agent its share", () => {
  const extract = /const EXTRACT_BUDGET_MS = ([\d_]+);/.exec(ROUTE);
  const agent = /const AGENT_PASS_BUDGET_MS = ([\d_]+);/.exec(ROUTE);
  const ceiling = /export const maxDuration = (\d+);/.exec(ROUTE);
  assert.ok(extract && agent && ceiling, "a budget or the route's ceiling is gone");
  const ms = (m: RegExpExecArray) => Number(m[1].replace(/_/g, ""));
  assert.ok(ms(extract) + ms(agent) <= ms(ceiling) * 1000, "the two budgets together exceed the route's own ceiling");
});

check("the response says what it deferred", () => {
  /* Otherwise the only difference between a queue that is clearing and one
     that is stuck is a number nobody is looking at. */
  assert.match(ROUTE, /deferred:/, "the route does not report what it left behind");
  assert.match(ROUTE, /released,/, "the route does not report what it handed back");
});

console.log("");
console.log(failures === 0 ? "A claim expires, and the queue clears." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
