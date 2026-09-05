import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Every knowledge gap belonging to a user, reduced to the three columns the
 * dashboard and the academic-health score actually read.
 *
 * Both callers previously issued this identical query independently, so a
 * single dashboard load fetched the whole gap table twice. React `cache()`
 * collapses that to one query per request; the returned rows are identical
 * for both consumers.
 */
export const getUserGaps = cache(async function getUserGaps(userId: string) {
  return prisma.knowledgeGap.findMany({
    where: { subject: { userId } },
    select: { status: true, difficulty: true, resolvedAt: true },
  });
});
