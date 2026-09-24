import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAiStatus } from "@/lib/ai/provider";
import { resumeHrefFor } from "@/lib/resume";
import { Hero } from "@/components/home/hero";
import { AcademicSnapshot } from "@/components/home/academic-snapshot";
import { AiCommand } from "@/components/home/ai-command";
import { ContinueReading } from "@/components/home/continue-reading";
import { LooseEnds } from "@/components/home/loose-ends";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * Home. One of them, now.
 *
 * There were two. `/` held a greeting, a question and an orb, and read the
 * whole day's data only to show a single number out of it; `/today` — labelled
 * "Dashboard" in the sidebar — held the day itself. The reasoning at the time
 * was that the two questions are asked at different rates: "what now?" every
 * day in ten seconds, "how does it all look?" every few days for a few minutes.
 *
 * That reasoning was wrong in the way that only shows up in use. A student
 * opening the app does not know which of their two homes has the thing they
 * came for, and the one named Home was the one that had almost nothing. The
 * cost of guessing wrong every time is far higher than the cost of scrolling
 * past an orb.
 *
 * So: one page. The orb stays at the top, because a way in that is always in
 * the same place is worth a band of screen. Under it is the day — which is
 * what the student actually came for, and which each card carries a door into.
 *
 * Both halves come from one `getDashboardData` call, which is what they were
 * both doing separately before.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [data, resumeHref] = await Promise.all([
    getDashboardData(userId, dict),
    resumeHrefFor(userId),
  ]);
  const ai = getAiStatus();
  const now = new Date();

  return (
    <div className="flex flex-col gap-10">
      <Hero
        dict={dict}
        now={now}
        locale={locale}
        userName={data.userName}
        health={data.health}
        resumeHref={resumeHref}
      />

      <AcademicSnapshot dict={dict} data={data} />

      {/* Where you stopped reading. Renders nothing when nothing is mid-read,
          rather than spending a band on an absence. */}
      <ContinueReading userId={userId} dict={dict} />

      {/* The day. Unchanged in what it fetches or what it can do — this
          redesign rebuilt the page around it, not instead of it. */}
      <DashboardView dict={dict} locale={locale} now={now} data={data} />

      {/* Below the day on purpose. The assistant is the product's most
          distinctive capability and the brief asked for it to read as
          first-class — but a student opening this at 8am wants to know what is
          due, and a page that leads with a prompt box makes them scroll past
          the tool to reach the facts. First-class is expressed by giving it a
          whole band with its own ground, not by putting it first. */}
      <AiCommand aiConfigured={ai.configured} canTranscribe={ai.canTranscribe} />

      {/* Last, because it is about the shape of the material rather than about
          today. Renders nothing when nothing is loose. */}
      <LooseEnds userId={userId} dict={dict} />
    </div>
  );
}
