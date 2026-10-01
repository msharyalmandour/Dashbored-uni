import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Every knowledge gap belonging to a user, reduced to the three columns the
 * dashboard actually reads.
 *
 * Two callers once issued this identical query independently, so a single
 * dashboard load fetched the whole gap table twice; `cache()` collapsed it to
 * one query per request. The second caller — the academic-health score — has
 * since been deleted, so the dedupe currently has nothing to dedupe. The wrap
 * stays because it costs one closure and the next caller gets it for free.
 */
export const getUserGaps = cache(async function getUserGaps(userId: string) {
  return prisma.knowledgeGap.findMany({
    where: { subject: { userId } },
    select: { status: true, difficulty: true, resolvedAt: true },
  });
});
