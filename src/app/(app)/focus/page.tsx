import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { FocusModeClient } from "@/components/focus/focus-mode-client";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { SessionPreset } from "@/components/focus/focus-mode-client";

export const metadata = { title: "Focus Mode" };
export const dynamic = "force-dynamic";

/** How long a session runs when the caller did not say. */
const DEFAULT_MINUTES = 25;

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ do?: string; minutes?: string; subject?: string; why?: string }>;
}) {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());
  const sp = await searchParams;

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

  // The homepage hands the session over in the URL, so pressing Start on the
  // one recommended action lands on "here is what you are doing and why"
  // instead of an empty form. A bare /focus visit still gets the form.
  const parsedMinutes = Number(sp.minutes);
  const preset: SessionPreset | undefined = sp.do
    ? {
        title: sp.do,
        minutes:
          Number.isFinite(parsedMinutes) && parsedMinutes > 0
            ? Math.min(Math.round(parsedMinutes), 180)
            : DEFAULT_MINUTES,
        // Only honour a subject the student actually owns — the id arrives
        // from a URL anyone can edit, and a foreign id would otherwise be
        // written onto their session.
        subjectId: subjects.some((s) => s.id === sp.subject) ? sp.subject : undefined,
        why: sp.why,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.focus.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.focus.subtitle}</p>
      </div>
      <FocusModeClient subjects={subjects} lectures={lectures} preset={preset} />
    </div>
  );
}
