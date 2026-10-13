"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { loadSimulation } from "@/lib/simulation-store";
import { start, choose, isOver, bestScore } from "@/lib/simulation";

/**
 * Record a finished playthrough.
 *
 * THE SCORE IS NOT TAKEN FROM THE BROWSER. The client sends only the path —
 * which answer was clicked at each step — and this replays it through the
 * stored content with the same `choose` the screen used. Two reasons, and the
 * second is the one that matters:
 *
 *   1. A posted score is a number the student's own devtools can type. Not a
 *      threat to anybody but them, and still not something to write down as
 *      fact.
 *   2. There would be two scoring implementations. The screen's and this one
 *      would drift, and the day they disagreed the student's result would
 *      change when the page reloaded. Replaying means there is one.
 *
 * `choose` returns the run UNCHANGED on an index that is not a choice at the
 * current step, so a path with a stale click in it replays as a shorter path
 * rather than throwing — and the loop below ends when the run stops moving,
 * never spinning on a bad element.
 *
 * IT RESOLVES THE USER WITHOUT `requireUserId`, which is the one deviation
 * from every other action here and is deliberate. `requireUserId` calls
 * `redirect("/login")` when the session has gone — right for a page, wrong
 * for this: it is called the instant the eighth question is answered, and a
 * redirect thrown from a Server Action NAVIGATES the browser. So an expired
 * session turned "we could not save your score" into "your eight answers are
 * gone and here is a login screen". Measured, not guessed: playing the run
 * through with no session landed on /login with the result never drawn.
 *
 * Saving is a nicety; the result is already on his screen. A failure here
 * returns `ok: false` and the screen says one quiet line.
 */
export async function recordRun(lectureId: string, path: number[]) {
  const authUser = await getSessionUser();
  if (!authUser) return { ok: false as const };
  const user = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    select: { id: true },
  });
  if (!user) return { ok: false as const };
  const userId = user.id;

  const stored = await loadSimulation(lectureId, userId);
  if (!stored) return { ok: false as const };
  /* Refusing to write a run against content that does not satisfy its own
     rules: the score would be out of a maximum that may not be reachable. */
  if (stored.problems.length > 0) return { ok: false as const };

  let run = start(stored.sim);
  for (const index of path.slice(0, stored.sim.nodes.length)) {
    if (isOver(run)) break;
    const next = choose(stored.sim, run, index);
    if (next === run) break; /* not a real choice here — stop, do not guess */
    run = next;
  }

  await prisma.simulationRun.create({
    data: {
      simulationId: stored.id,
      userId,
      score: run.score,
      outOf: bestScore(stored.sim),
      path: run.taken,
      /* Only a run that reached the ending is finished. An abandoned one is
         still written — "I stopped at step two" is worth knowing — but it is
         not allowed to become a best score. */
      finishedAt: isOver(run) ? new Date() : null,
    },
  });

  return { ok: true as const, score: run.score, outOf: bestScore(stored.sim) };
}
