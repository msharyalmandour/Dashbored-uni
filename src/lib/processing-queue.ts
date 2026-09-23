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

import type { DocumentProcessingStatus } from "@prisma/client";

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

/* ── Reading on request, rather than waiting for the sweep ─────────────────
 *
 * The sweep runs once a day (a Hobby-plan limit, not a design choice) and reads
 * in waves, so a student with nineteen unread files waits days for the queue to
 * clear on its own. The way out was already there and it was one file at a
 * time: pressing the button on an inbox item reads that item now.
 *
 * Nineteen presses is not a way out. This is the same read, asked for once, for
 * everything of theirs that nobody has managed to read.
 */

/**
 * How long a request may spend reading, below the app group's own ceiling.
 *
 * `export const maxDuration = 120` on src/app/(app)/layout.tsx is the hard
 * stop. A sweep that runs to that ceiling is killed with its last claim still
 * held — recoverable now, since a claim is a lease, but a student watching a
 * spinner die learns nothing from "recoverable". It stops early and says what
 * is left instead.
 */
export const REQUEST_READ_BUDGET_MS = 90_000;

/**
 * The documents one student has that nobody has managed to read.
 *
 * FAILED is included, and that is the whole point of offering this at all:
 * every PDF dropped before the worker could load was left FAILED, and a sweep
 * that only looked at QUEUED would walk straight past the files the student is
 * actually asking about. The nightly pass still claims QUEUED only, so a
 * genuine failure is retried when a person asks and not once a day forever.
 *
 * `userId` is not optional and not defaulted. This runs on a request path, and
 * a where-clause that forgets whose rows these are reads another student's
 * material — the one mistake here that is not recoverable by a retry.
 */
export const UNREAD_STATUSES: DocumentProcessingStatus[] = ["QUEUED", "FAILED"];

export function unreadDocumentsWhere(userId: string) {
  if (!userId) throw new Error("Reading unread documents needs to know whose they are.");
  /* A fresh array each call. Prisma's `in` takes a mutable array, and handing
     every caller the same one invites a query builder somewhere to sort or
     push into the list this module's other callers are relying on. */
  return {
    userId,
    processingStatus: { in: [...UNREAD_STATUSES] },
  };
}

/**
 * The conditional claim for one document, on a request path.
 *
 * Conditional, not a read followed by a write: whoever flips the status owns
 * the row, and a second caller — the nightly pass, another tab, the same
 * student pressing twice — sees zero rows changed and leaves it alone. The
 * status set matches `unreadDocumentsWhere` so a row cannot be claimed here
 * that this sweep was not offering to read.
 */
export function claimForReadingWhere(documentId: string, userId: string) {
  if (!documentId) throw new Error("A claim needs a document.");
  return { ...unreadDocumentsWhere(userId), id: documentId };
}
