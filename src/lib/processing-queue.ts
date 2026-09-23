/**
 * Who owns a document while it is being read, and what happens when nobody does.
 *
 * Reading a file is claimed by flipping its row from QUEUED to PROCESSING in
 * one UPDATE, so a nightly sweep and a student dropping the same file cannot
 * both read it. That claim is correct and it was also permanent: nothing in
 * the app ever moved a row out of PROCESSING.
 *
 * Which matters because the claim is taken for a whole batch at once and the
 * route that takes it has a 60-second ceiling. A run killed at that ceiling —
 * nineteen PDFs downloaded and extracted in one pass will do it — leaves every
 * row it claimed stranded. Not FAILED, which would at least be visible and
 * retryable: PROCESSING, which the inbox renders as "📄 Reading document" and
 * the agent refuses to act on with "Still reading the file." Forever. That is
 * worse than the extraction bug it would be hiding, because a failure that
 * looks like work in progress is a failure nobody reports.
 *
 * So a claim is a LEASE, not a deed. It is honoured for CLAIM_LEASE_MS and
 * then it is nobody's, and the next pass picks the row up again.
 */

/**
 * How long a claim is honoured before the row is considered abandoned.
 *
 * The bound that makes this safe is the platform's, not a guess: the cron
 * route may run for 60 seconds and an interactive read is budgeted in
 * seconds too, so no live worker can still hold a claim fifteen minutes
 * later. Being generous costs a row one extra pass; being tight would steal
 * a document from a worker still reading it and process it twice.
 */
export const CLAIM_LEASE_MS = 15 * 60_000;

/**
 * The `updatedAt` cutoff: a PROCESSING row older than this has no live owner.
 *
 * Returned rather than compared here so the caller can put it straight into a
 * query, and so the direction of the comparison is testable on its own — this
 * is a boundary where `<` and `>` are both plausible-looking and one of them
 * releases every row in flight.
 */
export function claimsExpireBefore(now: Date): Date {
  return new Date(now.getTime() - CLAIM_LEASE_MS);
}

/**
 * The update that hands expired claims back to the queue.
 *
 * A value rather than a call, so the two things that are easy to get wrong here
 * are testable without a database: the direction of the `updatedAt` comparison
 * (`gt` releases every row in flight instead of the abandoned ones, and looks
 * just as reasonable on the page) and the status it releases FROM — widening it
 * to include FAILED would silently retry every genuine failure once a day
 * forever.
 *
 * `processingError` is cleared, not set. An interrupted read is not a failure
 * to report to the student; it is a read that has not happened yet.
 */
export function expiredClaimUpdate(now: Date) {
  return {
    where: {
      processingStatus: "PROCESSING" as const,
      updatedAt: { lt: claimsExpireBefore(now) },
    },
    data: {
      processingStatus: "QUEUED" as const,
      processingError: null,
    },
  };
}

/** Whether a claim taken at `claimedAt` is still that worker's, as of `now`. */
export function claimIsLive(claimedAt: Date, now: Date): boolean {
  return claimedAt > claimsExpireBefore(now);
}

/**
 * How many documents one wave reads at once.
 *
 * The whole batch used to go through `Promise.allSettled` together: nineteen
 * concurrent downloads, nineteen pdf.js instances, nineteen database
 * connections through the pooler, all contending for the same 60 seconds. Four
 * at a time finishes more of the queue than nineteen at once does, because the
 * run returns instead of being killed with its work half recorded.
 */
export const WAVE_SIZE = 4;

/**
 * Whether there is time for another wave.
 *
 * No hardcoded idea of how long a PDF takes — the last wave's own duration is
 * the estimate, so a queue of small syllabi clears in one run and a queue of
 * hundred-page decks stops early instead of being cut off mid-write. No safety
 * margin is invented either: if the next wave behaves like the last one it
 * finishes, and if it does not, the lease above is what recovers it.
 *
 * `lastWaveMs` of 0 (nothing measured yet) means the first wave always runs —
 * a pass that reads nothing because it cannot predict itself is not caution.
 */
export function timeForAnotherWave(msRemaining: number, lastWaveMs: number): boolean {
  return msRemaining >= lastWaveMs;
}

/** Splits a claimed batch into the waves it will be read in. */
export function intoWaves<T>(items: T[], size = WAVE_SIZE): T[][] {
  if (size < 1) throw new Error("A wave must read at least one document.");
  const waves: T[][] = [];
  for (let i = 0; i < items.length; i += size) waves.push(items.slice(i, i + size));
  return waves;
}
