/**
 * The four decisions that decide whether a student finishes anything.
 *
 * THE MEASUREMENT THIS COMES FROM, on the real account, 2026-09-29.
 *
 *     started            finished
 *     9 study sessions   2          (7 abandoned, none with a minute recorded)
 *     12 knowledge gaps  0          (every one still NOT_UNDERSTOOD, ~18 days)
 *     42 flashcards      15 touched (27 never once)
 *     15 tasks           2
 *
 * Everything in this product, and in every product it competes with, is built
 * around the moment material arrives. Nothing was built around the moment the
 * student stops — and the numbers say stopping is what actually happens. A
 * competitor with no record of yesterday cannot address this at all; that is
 * the whole reason it is worth addressing here.
 *
 * WHAT IS A FINDING AND WHAT IS A DESIGN DECISION. The difference matters, and
 * patterns.ts sets the bar: `MIN_OBSERVATIONS = 4`, below which nothing is
 * concluded.
 *
 *   - FINDING, at n=9: session length carries no signal. Measured, 20 minutes
 *     finished, 30 finished, five 25s abandoned, two 45s abandoned. "Offer
 *     shorter sessions" was the obvious move and the data does not support it.
 *   - NOT A FINDING, at n=2: both finished sessions had a target the app had
 *     written from a record ("إكمال <task title>", "حل اللي يحتاج مراجعة:
 *     <card>"), and the seven abandoned ones had either no target or one the
 *     student free-typed ("اذاكر اليكتشير" — "I study the lecture", which has
 *     no condition under which it is done). Two observations is below the bar,
 *     so `finishable` below is a DESIGN DECISION defended on its own terms: a
 *     target with no completion condition cannot be completed. The data is
 *     consistent with it. It does not prove it.
 *
 * And the most useful thing to build when the evidence is thin is not the
 * feature — it is the instrument. Nothing currently records whether a session
 * began from a record or from a blank timer, which is exactly the column that
 * would settle the question. `TargetKind` is that instrument.
 */

// ---------------------------------------------------------------------------
// 1. What the student abandoned, and can pick up again
// ---------------------------------------------------------------------------

export type SessionRow = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  startedAt: Date;
  /** Null on every abandoned session measured — they stopped before a minute
   *  was recorded, which is why elapsed time is no use as a resume anchor. */
  actualMinutes: number | null;
  /** What it was for, if anything. See TargetKind. */
  target: Target;
};

/**
 * How long an abandoned session stays worth offering back.
 *
 * Four days, and the number is a judgement rather than a measurement — there
 * is no data on when a resumed session succeeds because none has ever been
 * resumed. It is set from what the offer costs when it is wrong: "carry on
 * with X?" about something from last week is noise the student has to dismiss,
 * and noise is how a helpful prompt becomes an ignored one. Short enough to be
 * about this week; long enough to survive a weekend.
 */
export const RESUME_WINDOW_DAYS = 4;

/**
 * The one thing worth offering to resume, or nothing.
 *
 * Most recent first, and only one. Seven abandoned sessions offered back as a
 * list is a list of failures; the student does not need a ledger of every time
 * they stopped, they need the next move to be one tap. An untargeted session
 * is never offered, because "resume" has to resume something.
 */
export function resumable(sessions: SessionRow[], now: Date): SessionRow | null {
  const cutoff = now.getTime() - RESUME_WINDOW_DAYS * 86_400_000;
  let best: SessionRow | null = null;
  for (const s of sessions) {
    if (s.status !== "ABANDONED") continue;
    if (s.startedAt.getTime() < cutoff) continue;
    if (!finishable(s.target)) continue;
    if (!best || s.startedAt > best.startedAt) best = s;
  }
  return best;
}

// ---------------------------------------------------------------------------
// 2. A session needs something it can be finished
// ---------------------------------------------------------------------------

/**
 * Where a session's target came from — the instrument, not the answer.
 *
 * This distinction is not currently stored, and storing it is the point. On
 * the measured history it can only be reconstructed by reading the shape of a
 * label, which is guesswork over two languages. Recorded at the moment the
 * session starts, it is a fact, and in a month it is enough observations to
 * either confirm or kill the design decision above.
 *
 *   TASK / CARD / GAP / LECTURE_SECTION — chosen from the student's records.
 *     Each has a condition under which it is done.
 *   FREE — typed by the student. May be perfectly clear to them, and is still
 *     recorded separately, because whether it works is the open question.
 *   NONE — a timer with nothing attached. Five of the seven abandoned.
 */
export type TargetKind = "TASK" | "CARD" | "GAP" | "LECTURE_SECTION" | "FREE" | "NONE";

export type Target = {
  kind: TargetKind;
  /** The row it points at, when it points at one. */
  refId?: string;
  /** What the student sees. Never parsed to decide anything. */
  label?: string;
};

/**
 * Whether this target can be finished.
 *
 * A task is done when it is submitted. A card is done when it is graded. A
 * lecture section is done at its last page. "I study the lecture" is done
 * never, which is not a criticism of the student — it is a property of the
 * sentence, and it is the app's job to offer something better before the timer
 * starts rather than to record another abandonment afterwards.
 *
 * FREE is deliberately allowed through as NOT finishable rather than blocked.
 * The student may type whatever they like; what changes is that the app does
 * not pretend a timer over an open-ended intention is a study session it can
 * help them complete, and does not offer it back for resuming.
 */
export function finishable(target: Target): boolean {
  switch (target.kind) {
    case "TASK":
    case "CARD":
    case "GAP":
    case "LECTURE_SECTION":
      /* A reference is required, not optional. A target that claims to be a
         task without naming one is exactly the failure this prevents: a label
         that reads specific with nothing behind it. */
      return typeof target.refId === "string" && target.refId.length > 0;
    case "FREE":
    case "NONE":
      return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Nothing stays open forever
// ---------------------------------------------------------------------------

export type GapRow = {
  id: string;
  status: "NOT_UNDERSTOOD" | "PARTIALLY_UNDERSTOOD" | "MASTERED" | string;
  createdAt: Date;
  /** Bumped whenever the student did something about it. */
  updatedAt: Date;
};

/**
 * When an untouched gap stops being a gap and starts being a question.
 *
 * Fourteen days, from the shape of the real history rather than a round
 * number: twelve gaps were created on 2026-09-11 and not one has moved in the
 * eighteen days since. At a week it is still plausibly on the list for this
 * week. At a fortnight the student has either learned it elsewhere and never
 * said so, or has been avoiding it — and those need opposite help, which is
 * why the app must ask instead of deciding.
 */
export const STALE_GAP_DAYS = 14;

/**
 * What to do about a gap nobody has touched.
 *
 *   ESCALATE    — young enough to still be this week's work: raise it.
 *   ASK_TO_CLOSE— old and untouched: ask whether it is still true. Not close
 *                 it. A gap silently marked mastered is a lie about what the
 *                 student knows, and this record is meant to be the one thing
 *                 that does not lie to them.
 *   LEAVE       — recently worked on, or already mastered.
 *
 * The asymmetry is deliberate: the system may raise its own voice, and may ask
 * a question, and may never quietly decide that something the student said
 * they did not understand is fine now.
 */
export type GapAction = "ESCALATE" | "ASK_TO_CLOSE" | "LEAVE";

export function gapAction(gap: GapRow, now: Date): GapAction {
  if (gap.status === "MASTERED") return "LEAVE";

  const daysSinceTouched = (now.getTime() - gap.updatedAt.getTime()) / 86_400_000;
  /* Measured against updatedAt, not createdAt. An old gap that was worked on
     yesterday is alive; a gap created yesterday and untouched is simply new. */
  if (daysSinceTouched >= STALE_GAP_DAYS) return "ASK_TO_CLOSE";
  if (daysSinceTouched >= 3) return "ESCALATE";
  return "LEAVE";
}

// ---------------------------------------------------------------------------
// 4. Show three, not forty-two
// ---------------------------------------------------------------------------

/**
 * The most items to put in front of a student at once.
 *
 * Measured: 42 cards due, 27 of them never once reviewed. A counter reading 42
 * is not information, it is a wall — and the evidence that it is a wall is
 * that two thirds of the pile has never been opened. Nobody clears 42. Almost
 * anybody clears 3.
 *
 * The ceiling is not the point on its own; the point is that the number shown
 * must be one a person can finish in one sitting, because finishing is the
 * behaviour this whole module exists to produce. A batch that is always
 * completed teaches "this is doable". A queue that is never emptied teaches
 * the opposite, every single day.
 */
export const BATCH_CEILING = 10;
const BATCH_FLOOR = 3;

/**
 * How many to offer, given how the student has been doing lately.
 *
 * Grows with success and shrinks with failure, and the asymmetry matters:
 * it grows slowly (one at a time, earned) and drops straight back to the
 * floor. Someone who just failed to clear a batch is not helped by being
 * offered nearly as many again.
 *
 * `recentlyCleared` is how many of the last offered batches were finished. No
 * history means the floor — the first batch a student ever sees should be one
 * they will certainly finish, because it sets what they expect of the app.
 */
export function batchSize(dueCount: number, recentlyCleared: number, recentlyOffered: number): number {
  if (dueCount <= 0) return 0;
  if (recentlyOffered <= 0) return Math.min(BATCH_FLOOR, dueCount);

  const clearRate = recentlyCleared / recentlyOffered;
  /* Below a half, the batches are not being finished and the size is part of
     why. Straight to the floor rather than a gentle taper: a student in this
     state has been failing repeatedly, and a fourth near-miss is worse than
     an easy win. */
  if (clearRate < 0.5) return Math.min(BATCH_FLOOR, dueCount);

  const earned = BATCH_FLOOR + recentlyCleared;
  return Math.min(earned, BATCH_CEILING, dueCount);
}

/**
 * What the student is told about the rest of the pile.
 *
 * Never hidden, never led with. "3 now, 39 waiting" is honest and still
 * actionable; showing only 3 would be a system quietly deciding what the
 * student is allowed to know about their own backlog, and showing 42 is the
 * wall. The remainder belongs in the sentence, not in the button.
 */
export function batchCaption(dueCount: number, shown: number): { shown: number; waiting: number } {
  return { shown, waiting: Math.max(0, dueCount - shown) };
}
