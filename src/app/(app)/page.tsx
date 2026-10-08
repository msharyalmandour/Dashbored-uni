import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAiStatus } from "@/lib/ai/provider";
import { resumeHrefFor } from "@/lib/resume";
import { Hero } from "@/components/home/hero";
import { ExamBand } from "@/components/home/exam-band";
import { TodayDoseBand } from "@/components/home/today-dose";
import { getTodayDose } from "@/lib/today-dose";
import { StuckFilesBand } from "@/components/home/stuck-files";
import { getStuckFiles } from "@/lib/stuck-files";
import { NextUp } from "@/components/home/next-up";
import { AiCommand } from "@/components/home/ai-command";
import { ContinueReading } from "@/components/home/continue-reading";
import { ResumeSession } from "@/components/home/resume-session";
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
  const now = new Date();
  const [data, resumeHref, dose, stuck] = await Promise.all([
    getDashboardData(userId, dict),
    resumeHrefFor(userId),
    getTodayDose(userId, now),
    getStuckFiles(userId),
  ]);
  const ai = getAiStatus();

  return (
    <div className="flex flex-col gap-10">
      <Hero
        dict={dict}
        now={now}
        locale={locale}
        userName={data.userName}
        resumeHref={resumeHref}
      />

      {/* First under the hero, because it is the only thing on this page with
          a deadline measured in minutes. An abandoned session and a standing
          total can both wait; a clinical that starts at eight, in a hospital,
          cannot — and for a fortnight this said nothing at all, because the
          day was read from a table holding one week. See
          src/lib/today-classes.ts. */}
      {/* Above the day, and above everything else, because it is the only
          thing on this page measured in days rather than in hours — and
          because on 2026-10-01 it was the one true sentence the app had never
          said: a midterm in eleven days with ninety-two unread pages behind
          it. Renders nothing at all while a page a day would still do. */}
      <ExamBand band={data.examBand} dict={dict} />

      {/* منع التراكم. Directly under the exam band because the two are one
          thought: the band says a midterm is close and ninety-two pages are
          unread, and this says which lectures that means tonight. A warning
          without an instruction is just pressure. */}
      <TodayDoseBand dose={dose} dict={dict} locale={locale} />

      {/* The inbox is no longer a sidebar row, so the one fact it held that
          could not wait is said here instead. Draws nothing at zero. */}
      <StuckFilesBand files={stuck} dict={dict} />

      <NextUp classes={data.todayClasses} now={now} dict={dict} />

      {/* Before the snapshot, because an unfinished thing has a claim on now
          that a standing total does not. Renders nothing when there is nothing
          abandoned worth offering back — which on the measured history is
          always, since none of the seven abandonments had a target that could
          be finished. See resume-session.tsx. */}
      <ResumeSession userId={userId} dict={dict} />

      {/* The academic snapshot was here: four figures — active courses, open
          tasks, reviews due, things to revisit — above an academic-health
          ring.

          Removed at the student's request, and the design argument agrees with
          him. On his own account those four read 6 / 12 / 42 / 11, which is a
          wall of accusation at the top of the page he opens every morning: a
          tile row earns its place only when those figures are the point of the
          screen, and the point of this screen is what to do next.

          The health ring was kept once, on the day panel. He asked for that to
          go too, and it went with its engine: the score was a weighted average
          over five axes, with 70 and 80 standing in wherever an axis had no
          data, so a student with an empty account scored 74 out of nothing.
          Every fact underneath it that was worth saying is still said where it
          can be acted on — unresolved gaps on the course card and the board,
          what is due in the Learn panel, overdue work on the timeline. */}

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
