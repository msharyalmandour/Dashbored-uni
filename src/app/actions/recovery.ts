"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { computeRecommendations } from "@/lib/priority-engine";
import { buildRescuePlan } from "@/lib/recovery";
import {
  remainingCapacityToday,
  dayCapacity,
  summariseWorkload,
  type CommitmentRow,
} from "@/lib/time-intelligence";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { parseOrThrow } from "@/lib/validation";
import type { StatedEnergy } from "@/lib/decision-engine";

/** How far ahead "everything else" reaches when judging what is at risk. */
const HORIZON_DAYS = 7;

const inputSchema = z.object({
  minutes: z.number().int().min(5).max(600).nullable(),
  energy: z.enum(["LOW", "NORMAL", "HIGH"]).nullable(),
});

/**
 * "Save my day."
 *
 * Called when the plan has already gone wrong. Everything it reasons over is
 * real: the student's own commitments, their own outstanding work with the
 * estimates they gave, and the same ranking the rest of the app uses. The one
 * thing it takes on trust is how much time they say is left — and their word
 * outranks the timetable, because a free evening on a calendar is not a free
 * evening when the day has already fallen apart.
 *
 * Nothing is written. A rescue is advice, and the student has not agreed to
 * anything yet.
 */
export async function saveMyDay(input: { minutes: number | null; energy: StatedEnergy | null }) {
  const userId = await requireUserId();
  const { minutes, energy } = parseOrThrow(inputSchema, input, "request");

  const dict = getDictionary(await getLocale());
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000);

  const [ranked, commitments, tasks] = await Promise.all([
    computeRecommendations(userId, 8, dict),
    prisma.timeCommitment.findMany({
      where: { userId },
      select: { id: true, kind: true, label: true, weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" }, deadline: { lte: horizon } },
      select: { id: true, title: true, deadline: true, estimatedMinutes: true, completionPercentage: true },
    }),
  ]);

  const rows = commitments as CommitmentRow[];

  // Today is prorated from now; the days after it are whole. Counting all of
  // today when it is already 9pm is the same lie this feature exists to stop.
  let weekStudyMinutes = remainingCapacityToday(rows, now).studyMinutes;
  for (let offset = 1; offset < HORIZON_DAYS; offset += 1) {
    const day = new Date(now.getTime() + offset * 86400000);
    weekStudyMinutes += dayCapacity(rows, day).studyMinutes;
  }

  const plan = buildRescuePlan({
    ranked,
    statedMinutes: minutes,
    energy,
    workload: summariseWorkload(tasks, horizon),
    weekStudyMinutes,
    capacityKnown: rows.length > 0,
  });

  // Dates cross the server/client boundary as strings, and the UI only ever
  // shows them — it never does arithmetic on them.
  return {
    ...plan,
    rest: {
      ...plan.rest,
      atRisk: plan.rest.atRisk.map((item) => ({
        ...item,
        deadline: item.deadline.toISOString(),
      })),
    },
  };
}

export type RescueResult = Awaited<ReturnType<typeof saveMyDay>>;
