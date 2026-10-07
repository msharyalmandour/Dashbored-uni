import type { Recommendation } from "@/lib/priority-engine";

/**
 * Where "Start" goes, decided in one place.
 *
 * WHY THIS IS A MODULE. Three components answered this question separately —
 * the home page's focus card, "what should I do", and "save my day" — and two
 * of the three sent a repeated-mistake recommendation to `/mistakes`, a route
 * that has never existed. One rule in three copies is how a dead link survives
 * being fixed: `focus-now.tsx` already routed MISTAKE to a focus session and
 * the other two did not, so the same recommendation led somewhere real from
 * one button and to a 404 from the other two.
 */

/**
 * The kinds that begin as a timed session rather than a page.
 *
 * Start used to drop the student on the module page — `/tasks`, a list of
 * forty rows — which is the screen they were already avoiding. Handing the
 * work over in the URL means Start begins the thing it just named.
 */
export const RUNS_AS_SESSION = new Set<Recommendation["type"]>([
  "TASK",
  "KNOWLEDGE_GAP",
  "MISTAKE",
]);

/**
 * The destination for one recommendation's Start button.
 *
 * `reason` is passed through so the focus screen can show *why* this was the
 * thing to do, which is the part a student forgets between tapping Start and
 * the timer appearing.
 *
 * The `"/"` fallback is unreachable today and deliberate: the only type with
 * no `href` is MISTAKE, which is in `RUNS_AS_SESSION`, so the second branch
 * never sees it. Home must not break if that set is ever edited.
 */
export function startHref(rec: Recommendation, reason: string): string {
  if (!RUNS_AS_SESSION.has(rec.type)) return rec.href ?? "/";

  const params = new URLSearchParams({
    do: rec.title,
    minutes: String(rec.estimatedMinutes),
    why: reason,
  });
  if (rec.subjectId) params.set("subject", rec.subjectId);
  if (rec.taskId) params.set("task", rec.taskId);
  return `/focus?${params.toString()}`;
}
