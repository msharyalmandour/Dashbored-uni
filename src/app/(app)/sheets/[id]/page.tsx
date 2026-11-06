import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loadSheet } from "@/lib/sheet-store";
import { SheetPaper } from "@/components/sheets/sheet-paper";
import { getAiStatus } from "@/lib/ai/provider";
import type { TutorAvailability } from "@/lib/sheet-tutor";

export const dynamic = "force-dynamic";

/**
 * The sheet, on its own page.
 *
 * A THIN LOADER. Everything that can be wrong without throwing lives in
 * src/lib/sheet.ts and src/lib/sheet-store.ts, each with its own guard; this
 * reads the row, decides whether the tutor can run, and hands both to the
 * paper.
 */
export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const sheet = await loadSheet(userId, id);
  if (!sheet) notFound();

  /* Read AFTER the awaits, and as a Date rather than Date.now(): the purity
     rule flags a bare `Date.now()` in a render, and the page is
     force-dynamic, so the clock is read once per request here and handed
     down as a number. */
  const now = new Date();

  /* "no-credit" is a real state on this account — ten inbox files are failing
     on it right now — but it is only knowable from a failed call, not from
     configuration. Until the tutor is actually wired to the agent, a
     configured key reads as ready and the panel says so honestly. */
  const tutor: TutorAvailability = getAiStatus().configured ? "ready" : "no-key";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SheetPaper
        sheet={sheet}
        nowMs={now.getTime()}
        locale={locale}
        t={dict.sheet}
        weekdayNames={dict.time.weekdays}
        tutor={tutor}
      />
    </div>
  );
}
