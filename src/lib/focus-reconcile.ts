import { prisma } from "@/lib/prisma";
import { recordEvents } from "@/lib/student-events";

/**
 * Closing out sessions nobody ever finished.
 *
 * `FocusSessionStatus.ABANDONED` existed from the beginning and was written
 * nowhere, so a student who closed the tab mid-session left it ACTIVE forever.
 * That is not a tidiness problem — it is the reason no honest completion rate
 * could be computed. Only finished sessions carried an outcome, so "how often
 * do evening sessions work out?" could only ever be answered from the sessions
 * that worked out.
 *
 * Any pattern learned from that sample would have been flattering and wrong,
 * which is worse than learning nothing.
 */

/**
 * How long past its planned end a session must sit untouched before it is
 * treated as abandoned.
 *
 * Generous on purpose. Overrunning is normal — a student who planned 25
 * minutes and is still going at 40 is having a good session, not an abandoned
 * one. Two hours past the plan is not overrun; it is a tab someone closed.
 */
const STALE_GRACE_MINUTES = 120;

/** Cheap pre-filter, so the database is not asked for every ACTIVE row ever. */
const COARSE_CUTOFF_MINUTES = 60;

/**
 * Marks stale ACTIVE sessions as ABANDONED and records one event each.
 *
 * `actualMinutes` and `endedAt` are deliberately left null. We know the
 * session was started and never finished; we do not know when the student
 * stopped working, and writing the planned end as though it were observed
 * would put a measurement into the record that nobody measured. Null is the
 * honest value, and every consumer of this data already handles it.
 *
 * Returns how many were closed, so callers can log it without re-querying.
 */
export async function reconcileStaleSessions(userId: string, now = new Date()): Promise<number> {
  const coarse = new Date(now.getTime() - COARSE_CUTOFF_MINUTES * 60000);

  const active = await prisma.focusSession.findMany({
    where: { userId, status: "ACTIVE", startedAt: { lt: coarse } },
    select: { id: true, startedAt: true, plannedMinutes: true, subjectId: true },
  });

  // The precise rule needs startedAt + plannedMinutes, which is per-row
  // arithmetic; there are never many ACTIVE rows, so it is done here rather
  // than pushed into raw SQL.
  const stale = active.filter((s) => {
    const deadline = s.startedAt.getTime() + (s.plannedMinutes + STALE_GRACE_MINUTES) * 60000;
    return now.getTime() > deadline;
  });
  if (stale.length === 0) return 0;

  await prisma.focusSession.updateMany({
    where: { id: { in: stale.map((s) => s.id) }, userId },
    data: { status: "ABANDONED" },
  });

  await recordEvents(
    userId,
    stale.map((s) => ({
      type: "SESSION_ABANDONED" as const,
      // Dated to when the session started, not to this sweep. The behaviour
      // happened that evening; filing it under whenever the cron next ran
      // would put it in the wrong day and quietly corrupt time-of-day
      // patterns — the exact thing this data exists to support.
      occurredAt: s.startedAt,
      focusSessionId: s.id,
      subjectId: s.subjectId,
      context: { plannedMinutes: s.plannedMinutes, hour: s.startedAt.getHours() },
    }))
  );

  return stale.length;
}

/**
 * The same sweep, for every student at once.
 *
 * The per-user call on `startFocusSession` only fires for someone who came
 * back. A student who stopped using the app for a fortnight is exactly the
 * one whose unfinished sessions matter — leaving them ACTIVE would make the
 * quiet fortnight look like nothing ever went wrong.
 *
 * Returns a per-user tally so the cron can report what it did.
 */
export async function reconcileAllStaleSessions(now = new Date()): Promise<{
  users: number;
  sessions: number;
}> {
  const coarse = new Date(now.getTime() - COARSE_CUTOFF_MINUTES * 60000);

  const userIds = await prisma.focusSession.findMany({
    where: { status: "ACTIVE", startedAt: { lt: coarse } },
    select: { userId: true },
    distinct: ["userId"],
  });

  let sessions = 0;
  let users = 0;
  for (const { userId } of userIds) {
    const closed = await reconcileStaleSessions(userId, now);
    if (closed > 0) {
      users += 1;
      sessions += closed;
    }
  }
  return { users, sessions };
}
