import { prisma } from "@/lib/prisma";

/**
 * University OS is designed as a single-student command center.
 * There is exactly one operator; we resolve (and lazily create) that
 * user record instead of building a multi-tenant auth system.
 */
export async function getCurrentUser() {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: "Student",
      email: "student@university-os.app",
      profileSettings: {
        reviewIntervals: [1, 3, 7, 14, 30],
        theme: "system",
      },
    },
  });
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user.id;
}
