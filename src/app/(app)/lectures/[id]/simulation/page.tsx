import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { pageTitle } from "@/lib/i18n/page-title";
import { ContentText } from "@/components/ui/content-text";
import { LectureIdentity } from "@/components/lectures/lecture-identity";
import { TtEmpty } from "@/components/shared/tt";
import { accentMap, DEFAULT_ACCENT } from "@/lib/subject-accent";
import { loadSimulation } from "@/lib/simulation-store";
import { SimulationPlayer } from "@/components/simulation/simulation-player";

export const generateMetadata = pageTitle((dict) => dict.simulation.title);
export const dynamic = "force-dynamic";

/**
 * المحاكاة, one lecture.
 *
 * WHY THIS IS A ROUTE AND NOT A PANEL ON THE LECTURE PAGE. The lecture page is
 * a place you scan; this is a place you sit in for five minutes and answer
 * eight questions. Sharing a scroll position with notes and a deck means a
 * half-answered question scrolling off screen, and it means the back button
 * going somewhere other than out of the game.
 *
 * NO START SCREEN. A pane saying "ready?" with a button under it is a click
 * that teaches nothing — the first question IS the start screen. His best
 * score rides in the header instead, where it is context rather than a gate.
 *
 * THE CONTENT IS CHECKED HERE, BEFORE IT IS PLAYED. `loadSimulation` returns
 * every way the stored graph breaks its own rules, and a broken one is refused
 * rather than handed over: this is the one kind of content in the product the
 * agent writes and nobody proof-reads, and the failure mode without this check
 * is a student three questions in, during exam week, clicking an answer that
 * goes nowhere.
 */
export default async function SimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();

  const stored = await loadSimulation(id, userId);
  if (!stored) notFound();

  const S = dict.simulation;
  const roster = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, color: true },
    orderBy: { createdAt: "asc" },
  });
  const accent = accentMap(roster).get(stored.subjectId) ?? DEFAULT_ACCENT;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <LectureIdentity
          subject={{ id: stored.subjectId, name: stored.subjectName }}
          lecture={{ id: stored.lectureId, title: stored.lectureTitle }}
        />
        <div>
          <p className="t-label" style={{ color: accent }}>
            {S.title}
          </p>
          <h1 className="t-display mt-1">
            <ContentText>{stored.sim.title}</ContentText>
          </h1>
          <p className="t-body mt-2 max-w-[62ch] text-muted-foreground">{S.hint}</p>
          {/* Only once there is one. "Your best: 0 of 30" before a first
              attempt is a score he has not got yet, printed as if he had. */}
          {stored.best && (
            <p className="t-meta mt-1.5 tabular-nums text-muted-foreground">
              {format(S.best, { score: stored.best.score, outOf: stored.best.outOf })}
            </p>
          )}
        </div>
      </header>

      {stored.problems.length > 0 ? (
        /* Said plainly and then stopped. The reasons are listed because he is
           the one who will regenerate it, and "it is broken" with nothing
           after it is not something anybody can act on. */
        <div className="glass pb-4 pt-4">
          <TtEmpty>{S.broken}</TtEmpty>
          <ul className="t-meta mt-1 list-disc space-y-1 ps-5 text-muted-foreground">
            {stored.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : (
        <SimulationPlayer
          sim={stored.sim}
          lectureId={stored.lectureId}
          slideId={stored.deck?.id ?? null}
          accent={accent}
          labels={{
            step: S.step,
            right: S.right,
            notRight: S.notRight,
            slide: S.slide,
            next: S.next,
            finish: S.finish,
            result: S.result,
            resultNote: S.resultNote,
            again: S.again,
            review: S.review,
            backToLecture: S.backToLecture,
            saveFailed: S.saveFailed,
          }}
        />
      )}
    </div>
  );
}
