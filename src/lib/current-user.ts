import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the Prisma `User` row for the currently authenticated Supabase
 * session. Middleware already redirects unauthenticated requests to
 * /login, but this is called from Server Actions too (which middleware
 * does not gate as reliably), so it independently verifies the session
 * via `auth.getUser()` — this revalidates the JWT against Supabase rather
 * than trusting an unverified cookie value.
 *
 * On first sign-in for a given Supabase account, this either:
 *  - adopts an existing Prisma `User` row with the same email (lets a
 *    developer claim the seeded demo account by signing up with its
 *    email), or
 *  - creates a fresh `User` row (new real accounts).
 *
 * Throws if there is no session — callers must be reachable only from
 * authenticated routes/actions.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Not authenticated.");
  }

  const existing = await prisma.user.findUnique({ where: { authUserId: authUser.id } });
  if (existing) return existing;

  const email = authUser.email;
  if (!email) {
    throw new Error("Authenticated account has no email.");
  }

  const unclaimed = await prisma.user.findUnique({ where: { email } });
  if (unclaimed) {
    if (unclaimed.authUserId && unclaimed.authUserId !== authUser.id) {
      // Email collision with a different, already-claimed account — should not
      // happen since Supabase enforces unique emails, but never silently merge.
      throw new Error("This email is already linked to a different account.");
    }
    return prisma.user.update({
      where: { id: unclaimed.id },
      data: { authUserId: authUser.id },
    });
  }

  return prisma.user.create({
    data: {
      authUserId: authUser.id,
      name: (authUser.user_metadata?.name as string | undefined) ?? email.split("@")[0],
      email,
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
