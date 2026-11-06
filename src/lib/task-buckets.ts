/**
 * Which pile a task is in: متأخرة · هالأسبوع · بعدين · خلصت.
 *
 * TWO WAYS THIS GOES QUIETLY WRONG, and both are live on this account.
 *
 * ONE — A FINISHED TASK WITH A PAST DEADLINE IS NOT LATE. Five of his
 * fifteen tasks are COMPLETED and every one of them is dated in the past:
 * the midterm on 12 October, the staffing rota on 11 October. Bucketing by
 * date before checking status puts all five under "متأخرة", and a screen
 * that opens with five red rows for work he has already handed in is a
 * screen he stops opening.
 *
 * TWO — A DEADLINE IS A DAY, NOT A MOMENT. Every deadline in this database
 * is stored at 00:00, because that is what a date with no time becomes. At
 * three in the afternoon a task due TODAY is eleven hours "past" by
 * timestamp. Comparing instants marks it late; comparing calendar days puts
 * it where he can still do something about it.
 */

export type Bucket = "overdue" | "thisWeek" | "later" | "done";

export interface BucketableTask {
  id: string;
  deadline: Date;
  status: string;
  estimatedMinutes: number | null;
}

/** Midnight at the start of a day, local. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from today to the deadline. Negative is past. */
export function daysUntil(deadline: Date, now: Date): number {
  return Math.round(
    (startOfDay(deadline).getTime() - startOfDay(now).getTime()) / 86400000
  );
}

/**
 * "هالأسبوع" is today plus the next six days.
 *
 * SEVEN AND NOT "UNTIL SUNDAY". A week that resets on a fixed weekday means
 * the pile is nearly empty every Thursday and alarming every Saturday, for
 * reasons that have nothing to do with his work. Seven days from now is the
 * same horizon whatever day he opens it.
 */
export const WEEK_DAYS_AHEAD = 7;

export function bucketOf(task: BucketableTask, now: Date): Bucket {
  /* Status first. A finished task is finished, whatever its date says. */
  if (task.status === "COMPLETED") return "done";
  const days = daysUntil(task.deadline, now);
  if (days < 0) return "overdue";
  if (days < WEEK_DAYS_AHEAD) return "thisWeek";
  return "later";
}

export interface Buckets<T> {
  overdue: T[];
  thisWeek: T[];
  later: T[];
  done: T[];
}

/**
 * Every task, sorted into its pile and ordered inside it.
 *
 * ORDERING DIFFERS BY PILE, on purpose. Everything ahead of him reads
 * soonest-first, because the next thing is the thing. The late pile reads
 * OLDEST-first: the one that has been late longest is the one that has been
 * ignored longest, and putting the freshest miss at the top is how a task
 * from October slides under three from this week and is never seen again.
 * Finished work reads most-recent-first — it is a record, not a queue.
 */
export function bucketTasks<T extends BucketableTask>(tasks: T[], now: Date): Buckets<T> {
  const out: Buckets<T> = { overdue: [], thisWeek: [], later: [], done: [] };
  for (const task of tasks) out[bucketOf(task, now)].push(task);

  const byDeadline = (a: T, b: T) => a.deadline.getTime() - b.deadline.getTime();
  out.overdue.sort(byDeadline);
  out.thisWeek.sort(byDeadline);
  out.later.sort(byDeadline);
  out.done.sort((a, b) => b.deadline.getTime() - a.deadline.getTime());
  return out;
}

export interface TimeKnown {
  /** Minutes across tasks that carry an estimate. */
  estimatedMinutes: number;
  /** How many carry one. */
  estimatedCount: number;
  /** How many do not — the number the ring cannot account for. */
  unknownCount: number;
}

/**
 * How much of what is ahead of him is actually measurable.
 *
 * THE UNKNOWN COUNT IS RETURNED, NOT SWALLOWED. All fifteen of his tasks
 * have `estimatedMinutes` null, so every total this could produce is zero —
 * and "0 س من الشغل" next to ten open tasks is the most confident lie this
 * screen could tell. The caller gets both numbers and has to say the second.
 */
export function timeKnown(tasks: BucketableTask[]): TimeKnown {
  let estimatedMinutes = 0;
  let estimatedCount = 0;
  let unknownCount = 0;
  for (const t of tasks) {
    if (t.status === "COMPLETED") continue;
    if (typeof t.estimatedMinutes === "number" && t.estimatedMinutes > 0) {
      estimatedMinutes += t.estimatedMinutes;
      estimatedCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return { estimatedMinutes, estimatedCount, unknownCount };
}

/**
 * Whether a column is worth its width.
 *
 * MEASURED, NOT ASSUMED. Priority is MEDIUM on all fifteen of his rows and
 * "where it came from" is manual on all fifteen. A column with one value in
 * it costs width on a phone and tells him nothing — but it will start to
 * discriminate the moment he sets a priority, so it is hidden by what the
 * data does today rather than removed from the design.
 */
export function columnVaries<T>(rows: T[], read: (row: T) => unknown): boolean {
  if (rows.length < 2) return false;
  const first = read(rows[0]);
  return rows.some((r) => read(r) !== first);
}
