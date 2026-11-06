import Link from "next/link";
import { cn } from "@/lib/utils";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { Chip } from "@/components/ui/controls";
import { ProgressRing, TutorOrb } from "@/components/ui/progress-ring";
import { worldVars } from "@/lib/world";
import { currentMilestone, currentStage, isFinished, projectProgress } from "@/lib/project";
import type { ProjectScreen } from "@/lib/project-store";
import type { TutorAvailability } from "@/lib/sheet-tutor";
import type { Locale } from "@/lib/i18n/config";

/**
 * The project, as a place with a path through it.
 *
 * THE STAIRS ARE THE SCREEN. A project is the one thing in this app that is
 * genuinely a sequence, so the stages are drawn as steps climbing away from
 * the reader — finished ones lit and settled, the current one raised and
 * breathing, the rest flat and waiting. Everywhere else in this product a
 * numbered list would be decoration pretending to be structure; here the
 * order is the information.
 *
 * NOTHING HERE IS INVENTED. His project row exists and his milestones table
 * is empty, so this screen mostly says so — and says what to do about it,
 * rather than drawing five grey placeholder steps that look like data.
 *
 * A SERVER COMPONENT. There is nothing to click: no state, no fetch, no
 * handlers. Shipping it as a client component would send React for a page
 * that never changes after it is drawn.
 */

export interface ProjectStrings {
  crumbWeek: string;
  weight: string;
  teamCount: Record<string, string>;
  stageOf: string;
  finished: string;
  progressLabel: string;
  doneOfTotal: string;
  fromSteps: string;
  fromTyped: string;
  stepsHeading: string;
  noSteps: string;
  teamHeading: string;
  noTeam: string;
  noWorkingOn: string;
  meetingHeading: string;
  noMeeting: string;
  filesHeading: string;
  filesNote: string;
  noFiles: string;
  tutorHeading: string;
  tutorNoKey: string;
  tutorNoCredit: string;
  tutorNext: string;
  tutorDone: string;
  tutorNoSteps: string;
}

function countPhrase(bag: Record<string, string>, count: number, locale: Locale): string {
  return pick(bag, pluralForm(locale, count)).replace("{count}", String(count));
}

export function ProjectWorld({
  project,
  locale,
  t,
  weekdayNames,
  tutor,
}: {
  project: ProjectScreen;
  locale: Locale;
  t: ProjectStrings;
  weekdayNames: readonly string[];
  tutor: TutorAvailability;
}) {
  const progress = projectProgress(project.milestones, project.typedPercent);
  const stage = currentStage(project.milestones);
  const current = currentMilestone(project.milestones);
  const done = isFinished(project.milestones);

  const ordered = [...project.milestones].sort((a, b) => a.orderIndex - b.orderIndex);

  const advice =
    tutor === "no-key"
      ? t.tutorNoKey
      : tutor === "no-credit"
        ? t.tutorNoCredit
        : ordered.length === 0
          ? t.tutorNoSteps
          : current
            ? t.tutorNext.replace("{step}", current.title)
            : t.tutorDone;

  return (
    <div
      className="pj-screen world world-ground"
      style={project.course ? worldVars(project.course.world) : undefined}
    >
      <nav className="pj-crumbs" aria-label={t.crumbWeek}>
        <Link href="/time" className="pj-crumb">
          {t.crumbWeek}
        </Link>
        {project.course && (
          <>
            <span aria-hidden className="pj-sep">
              ›
            </span>
            <Link href={`/subjects/${project.course.id}`} className="pj-crumb">
              {project.course.name}
            </Link>
          </>
        )}
      </nav>

      <header className="pj-hero">
        <div className="pj-hero-text">
          {/* The class goes on a SPAN inside the paragraph, never on the
              paragraph. `.t-figure` sets `direction: ltr`, and on a block
              that also flips where the text aligns: "NURP 431" was pinned to
              the far left of an otherwise right-aligned hero. */}
          {project.course?.code && (
            <p className="pj-code">
              <span className="t-figure">{project.course.code}</span>
            </p>
          )}
          <h1 className="pj-title">{project.title}</h1>
          <div className="pj-badges">
            {project.weight !== null && (
              <Chip tone="warm">{t.weight.replace("{n}", String(project.weight))}</Chip>
            )}
            {project.team.length > 0 && (
              <Chip>{countPhrase(t.teamCount, project.team.length, locale)}</Chip>
            )}
            {stage !== null && (
              <Chip>
                {t.stageOf
                  .replace("{n}", String(stage))
                  .replace("{total}", String(ordered.length))}
              </Chip>
            )}
            {done && <Chip tone="warm">{t.finished}</Chip>}
          </div>
        </div>

        {/* The ring floats clear of the hero's text, which is the one piece
            of the reference's motion that earns its place: it is the number
            the whole screen is about. */}
        <div className="pj-ring c-floaty">
          <ProgressRing
            value={progress.percent}
            size={104}
            label={t.progressLabel}
            /* NOT "2 / 5". A bare figure like that sits in an RTL line and
               is reordered to "5 / 2" — the right glyphs in the wrong order,
               which reads as a real number and is the opposite one. The
               dictionary's own phrase carries a word, so it has a direction
               of its own. */
            sublabel={
              progress.from === "milestones"
                ? t.doneOfTotal
                    .replace("{done}", String(progress.done))
                    .replace("{total}", String(progress.total))
                : t.progressLabel
            }
          />
        </div>
      </header>

      <p className="pj-note">
        {progress.from === "milestones" ? t.fromSteps : t.fromTyped}
      </p>

      <div className="pj-layout">
        <section className="pj-main">
          <h2 className="pj-h2">{t.stepsHeading}</h2>
          {ordered.length === 0 ? (
            <p className="pj-empty">{t.noSteps}</p>
          ) : (
            <ol className="pj-stairs">
              {ordered.map((step, i) => {
                const isDone = step.doneAt !== null;
                const isHere = current?.id === step.id;
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "pj-step",
                      isDone && "pj-step-done",
                      isHere && "pj-step-here c-pulse"
                    )}
                    /* Each stair sits one notch further up and in. The lift
                       is small on purpose: a dramatic one turns the last
                       step into a thing you cannot read. */
                    style={{ "--i": i } as React.CSSProperties}
                    aria-current={isHere ? "step" : undefined}
                  >
                    <span className="t-figure pj-step-n">{i + 1}</span>
                    <span className="pj-step-title">{step.title}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <h2 className="pj-h2">{t.teamHeading}</h2>
          {project.team.length === 0 ? (
            <p className="pj-empty">{t.noTeam}</p>
          ) : (
            <ul className="pj-team">
              {project.team.map((person) => (
                <li key={person.id} className="pj-person">
                  <span className="pj-person-name" dir="auto">
                    {person.name}
                  </span>
                  {person.role && <span className="pj-person-role">{person.role}</span>}
                  <span className={cn("pj-person-on", !person.workingOn && "pj-person-idle")}>
                    {person.workingOn ?? t.noWorkingOn}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="pj-side">
          <div className="pj-card">
            <p className="pj-kicker">{t.meetingHeading}</p>
            {project.nextMeeting ? (
              <p className="pj-line">
                {weekdayNames[project.nextMeeting.weekday]}{" "}
                <span className="t-figure">
                  {Math.floor(project.nextMeeting.startMinute / 60)}:
                  {String(project.nextMeeting.startMinute % 60).padStart(2, "0")}
                </span>
              </p>
            ) : (
              <p className="pj-line pj-quiet">{t.noMeeting}</p>
            )}
          </div>

          <div className="pj-card">
            <p className="pj-kicker">{t.filesHeading}</p>
            {project.files.length === 0 ? (
              <p className="pj-line pj-quiet">{t.noFiles}</p>
            ) : (
              <>
                <ul className="pj-files">
                  {project.files.map((f) => (
                    <li key={f.id} className="pj-file" dir="auto">
                      {f.title}
                    </li>
                  ))}
                </ul>
                {/* Said out loud, because these are the COURSE's files and
                    the screen must not imply a link the data does not make. */}
                <p className="pj-line pj-quiet mt-2">{t.filesNote}</p>
              </>
            )}
          </div>

          <div className="pj-card pj-tutor">
            <div className="flex items-center gap-2">
              <TutorOrb size={36} floaty={tutor === "ready"} />
              <p className="pj-kicker">{t.tutorHeading}</p>
            </div>
            <p className="pj-line mt-2">{advice}</p>
          </div>
        </aside>
      </div>

    </div>
  );
}
