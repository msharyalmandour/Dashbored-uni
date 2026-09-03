import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { FocusModeClient } from "@/components/focus/focus-mode-client";

export const metadata = { title: "Focus Mode" };
export const dynamic = "force-dynamic";

export default async function FocusPage() {
  const userId = await getCurrentUserId();

  const [subjects, lectures] = await Promise.all([
    prisma.subject.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.lecture.findMany({
      where: { subject: { userId } },
      select: { id: true, title: true, subjectId: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Focus Mode</h1>
        <p className="text-sm text-muted-foreground">One task. One timer. No distractions.</p>
      </div>
      <FocusModeClient subjects={subjects} lectures={lectures} />
    </div>
  );
}
