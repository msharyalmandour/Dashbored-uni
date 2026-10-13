"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { recordRun } from "@/app/actions/simulation";
import {
  start,
  choose,
  isOver,
  bestScore,
  progressOf,
  END,
  type Run,
  type Simulation,
} from "@/lib/simulation";

/**
 * المحاكاة, played.
 *
 * THE SCREEN HOLDS NO RULES. Every state change goes through `choose` in
 * src/lib/simulation.ts, which 24 checks already hold. That is deliberate and
 * it is the reason this file is mostly layout: scoring, where a choice leads,
 * how the meters move and when the run is over are one implementation used by
 * the screen, by the server action that writes the result, and by the tests.
 * A second copy here would be a second answer to "what did I score".
 *
 * ONE QUESTION, AND NOTHING ELSE MOVING. The student asked for a design that
 * never confuses him, and the thing that would confuse him here is a branching
 * story drawn as a branching story. So: the situation, the question, the
 * answers. Pick one and the page does not jump — the answers stay exactly
 * where they are, the one he picked is marked, and the explanation opens
 * underneath it. He reads why, then presses once to go on.
 *
 * WHY THE WRONG ANSWER IS NOT RED. A wrong answer here is the most valuable
 * event in the product: it is the student finding out, four days before the
 * exam, that he was sure and he was wrong. Painting it in the destructive
 * colour makes it a failure to get past. It gets the warning colour and its
 * explanation, which is the thing he came for.
 */

/**
 * "سلايد 10" — a link when there is a deck to open it in, words when there
 * is not.
 *
 * Both halves are needed. The slide number is where the answer came from and
 * is worth printing even with no file attached (he has the deck on his
 * laptop); but a citation he has to find by hand is a citation he does not
 * follow, so when the lecture has exactly one deck this opens it ON that
 * page. With several decks there is no way to tell which one slide 10 means,
 * so it prints rather than guessing and sending him to the wrong document.
 */
function Citation({
  slide,
  lectureId,
  slideId,
  label,
  accent,
}: {
  slide: number;
  lectureId: string;
  slideId: string | null;
  label: string;
  accent: string;
}) {
  const text = label.replace("{n}", String(slide));
  if (!slideId) {
    return <span className="t-meta mt-2 inline-block text-muted-foreground">{text}</span>;
  }
  return (
    <Link
      href={`/lectures/${lectureId}/slides/${slideId}?page=${slide}`}
      className="t-meta mt-2 inline-block font-medium underline decoration-dotted underline-offset-4"
      style={{ color: accent }}
    >
      {text}
    </Link>
  );
}

interface Labels {
  step: string; /** "سؤال {n} من {total}" */
  right: string;
  notRight: string;
  slide: string; /** "سلايد {n}" */
  next: string;
  finish: string;
  result: string;
  resultNote: string; /** "{score} من {outOf}" */
  again: string;
  review: string;
  backToLecture: string;
  saveFailed: string;
}

export function SimulationPlayer({
  sim,
  lectureId,
  slideId,
  labels,
  accent,
}: {
  sim: Simulation;
  lectureId: string;
  /** The one deck a citation can open, or null when there isn't exactly one. */
  slideId: string | null;
  labels: Labels;
  accent: string;
}) {
  const [run, setRun] = useState<Run>(() => start(sim));
  /** The answer being read, before it is committed. Null while choosing. */
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [saveFailed, setSaveFailed] = useState(false);

  const node = sim.nodes.find((n) => n.key === run.at);
  const total = sim.nodes.length;
  const outOf = bestScore(sim);
  const over = isOver(run) || !node;

  /* The path as indices, which is all the server is sent — it replays it
     through the stored content rather than trusting a score from here.

     THE try/catch IS THE POINT OF THIS FUNCTION. Without it, a rejected
     Server Action inside `startTransition` is an unhandled error, React hands
     it to the nearest error boundary, and the student who just answered eight
     questions gets "Something went wrong" where his score should be. Found by
     playing the run through with the database unreachable: eight steps, then
     an error page, and the result never drawn once.

     So every failure — no session, database down, a refusal because the
     content does not satisfy its own rules — lands in the same place: the
     result stays on screen and one quiet line says it was not saved. There is
     nothing here worth losing the result over. */
  function save(finished: Run) {
    const path = finished.taken.map((t) => t.choice);
    startSaving(async () => {
      try {
        const result = await recordRun(lectureId, path);
        if (!result.ok) setSaveFailed(true);
      } catch {
        setSaveFailed(true);
      }
    });
  }

  function commit() {
    if (picked === null || !node) return;
    const next = choose(sim, run, picked);
    setPicked(null);
    setRun(next);
    if (isOver(next)) save(next);
  }

  function restart() {
    setRun(start(sim));
    setPicked(null);
    setSaveFailed(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* THE WARD, across the top. Four dials, read as written — "6/7", 28,
          "😐" — because a choice replaces a meter and the author decides what
          it now says. Numbers are tabular so a dial does not twitch as it
          changes. */}
      <div className="glass flex flex-wrap gap-x-6 gap-y-2 pb-3.5 pt-3.5">
        {Object.entries(run.meters).map(([name, value]) => (
          <div key={name} className="flex min-w-0 flex-col">
            <span className="t-label text-muted-foreground">{name}</span>
            <span className="text-[17px] font-semibold tabular-nums" dir="auto">
              {value}
            </span>
          </div>
        ))}
      </div>

      {over ? (
        <Result
          sim={sim}
          run={run}
          outOf={outOf}
          labels={labels}
          lectureId={lectureId}
          slideId={slideId}
          accent={accent}
          onAgain={restart}
          saveFailed={saveFailed}
          saving={saving}
        />
      ) : (
        <section className="glass pb-5 pt-4">
          {/* Where he is. By question number, not by a bar — eight steps is a
              number a person can hold, and "٣ من ٨" says the same thing a bar
              says without asking him to estimate it. The bar underneath is
              the same fact for the corner of the eye. */}
          <p className="t-label text-muted-foreground">
            {labels.step
              .replace("{n}", String(run.taken.length + 1))
              .replace("{total}", String(total))}
          </p>
          <div
            className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
            style={{ background: "rgb(255 255 255 / 12%)" }}
            role="presentation"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progressOf(sim, run) * 100}%`, background: accent }}
            />
          </div>

          <h2 className="t-body mt-4 font-medium">
            <ContentText>{node!.situation}</ContentText>
          </h2>
          <p className="t-title mt-3">
            <ContentText>{node!.question}</ContentText>
          </p>

          {/* The answers. They do not reorder, disappear or grey out when one
              is picked: the page staying still is what makes the explanation
              feel like an answer to what he clicked rather than a new screen. */}
          <ul className="mt-4 flex flex-col gap-2.5">
            {node!.choices.map((choice, index) => {
              const chosen = picked === index;
              const right = choice.score > 0;
              return (
                <li key={index}>
                  <button
                    type="button"
                    /* PICKING IS FINAL. The first version let him click an
                       answer again to un-pick it, and that made the whole
                       thing worthless: the explanation opens on click, so he
                       could tap all three, read why each one is right or
                       wrong, and then pick the one marked صح. Answering a
                       question with its own answer sheet open is not
                       studying. Once one is picked the rest stop responding,
                       and the only way forward is the button below. */
                    onClick={() => { if (picked === null) setPicked(index); }}
                    disabled={picked !== null && !chosen}
                    aria-pressed={chosen}
                    aria-describedby={chosen ? `why-${index}` : undefined}
                    className="w-full rounded-[18px] border p-3.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
                    style={{
                      borderColor: chosen
                        ? right
                          ? "var(--success)"
                          : "var(--warning)"
                        : "rgb(255 255 255 / 14%)",
                      background: chosen ? "rgb(255 255 255 / 7%)" : "transparent",
                      /* The ones not taken stay legible rather than fading
                         out: after answering, "what were the other options"
                         is part of what he is reading. They just stop being
                         pressable. */
                      opacity: picked !== null && !chosen ? 0.72 : 1,
                      /* The explanation sits under the button and belongs to
                         it, so the two join into one shape rather than
                         reading as a button with a loose paragraph below. */
                      borderEndEndRadius: chosen ? 0 : undefined,
                      borderStartEndRadius: chosen ? 0 : undefined,
                      borderBlockEndWidth: chosen ? 0 : undefined,
                    }}
                  >
                    <span className="t-body flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold"
                        style={{
                          borderColor: chosen
                            ? right
                              ? "var(--success)"
                              : "var(--warning)"
                            : "rgb(255 255 255 / 22%)",
                          color: chosen ? (right ? "var(--success)" : "var(--warning)") : undefined,
                        }}
                      >
                        {/* A TICK ONLY WHEN IT IS RIGHT. The first version
                            marked whatever he picked with a tick, so a wrong
                            answer came back ticked, in amber, over the words
                            "مو صح" — three signals, one of them saying the
                            opposite of the other two. The mark now says which
                            it was, and the colour agrees with it. */}
                        {chosen ? (
                          right ? (
                            <Check className="size-3" />
                          ) : (
                            <X className="size-3" />
                          )
                        ) : (
                          index + 1
                        )}
                      </span>
                      <ContentText className="min-w-0">{choice.text}</ContentText>
                    </span>
                  </button>

                  {/* WHY — the only part of this that is studying, so it is
                      set as body text and not as a toast. The slide is a
                      LINK, which is why this is a sibling of the button and
                      not inside it: an anchor nested in a button is invalid
                      markup, and the browser is free to decide which of the
                      two a tap hit. Out here, the link is a link.

                      With a link inside the button, a tap meant for the
                      citation would also have counted as a tap on the
                      answer. */}
                  {chosen && (
                    <div
                      id={`why-${index}`}
                      className="rounded-b-[18px] border border-t-0 p-3.5 pt-3"
                      style={{
                        borderColor: right ? "var(--success)" : "var(--warning)",
                        background: "rgb(255 255 255 / 7%)",
                      }}
                    >
                      <p
                        className="t-label"
                        style={{ color: right ? "var(--success)" : "var(--warning)" }}
                      >
                        {right ? labels.right : labels.notRight}
                      </p>
                      <p className="t-body mt-1.5 text-muted-foreground">
                        <ContentText>{choice.why}</ContentText>
                      </p>
                      {choice.slide !== undefined && (
                        <Citation
                          slide={choice.slide}
                          lectureId={lectureId}
                          slideId={slideId}
                          label={labels.slide}
                          accent={accent}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* One button, and it only exists once he has read something. It is
              disabled rather than hidden while nothing is picked, so the row
              does not appear and shift the answers he is reading. */}
          <button
            type="button"
            onClick={commit}
            disabled={picked === null}
            className="mt-4 w-full rounded-full px-5 py-3 text-[15px] font-semibold transition-opacity disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            style={{ background: accent, color: "var(--background)" }}
          >
            {picked !== null && node!.choices[picked].next === END
              ? labels.finish
              : labels.next}
          </button>
        </section>
      )}
    </div>
  );
}

/**
 * The end: the score, and then every step again with what he picked.
 *
 * The review is the reason a run is worth finishing. A score on its own is a
 * grade; the list underneath is the eight things he now knows he did or did
 * not know, each one still carrying its slide.
 */
function Result({
  sim,
  run,
  outOf,
  labels,
  lectureId,
  slideId,
  accent,
  onAgain,
  saveFailed,
  saving,
}: {
  sim: Simulation;
  run: Run;
  outOf: number;
  labels: Labels;
  lectureId: string;
  slideId: string | null;
  accent: string;
  onAgain: () => void;
  saveFailed: boolean;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="glass pb-5 pt-4">
        <p className="t-label text-muted-foreground">{labels.result}</p>
        <p className="t-display mt-1" dir="auto">
          {labels.resultNote
            .replace("{score}", String(run.score))
            .replace("{outOf}", String(outOf))}
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onAgain}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            style={{ background: accent, color: "var(--background)" }}
          >
            <RotateCcw className="size-4" />
            {labels.again}
          </button>
          <Link
            href={`/lectures/${lectureId}`}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-medium"
            style={{ borderColor: "rgb(255 255 255 / 18%)" }}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {labels.backToLecture}
          </Link>
        </div>

        {/* Said once, quietly, and only when it happened. The run is already
            on screen; a failed write costs the record of it, not the result. */}
        {saveFailed && !saving && (
          <p className="t-meta mt-3 text-muted-foreground">{labels.saveFailed}</p>
        )}
      </section>

      <section className="glass tt-ground pb-2 pt-4">
        <p className="t-label pb-3 text-muted-foreground">{labels.review}</p>
        <ul className="flex flex-col">
          {run.taken.map((step, order) => {
            const node = sim.nodes.find((n) => n.key === step.node);
            const choice = node?.choices[step.choice];
            if (!node || !choice) return null;
            const right = choice.score > 0;
            return (
              <li
                key={`${step.node}-${order}`}
                className="border-t py-3.5 first:border-t-0"
                style={{ borderColor: "rgb(255 255 255 / 10%)" }}
              >
                <p className="t-meta text-muted-foreground">
                  <ContentText>{node.question}</ContentText>
                </p>
                <p
                  className="t-body mt-1 font-medium"
                  style={{ color: right ? "var(--success)" : "var(--warning)" }}
                >
                  <ContentText>{choice.text}</ContentText>
                </p>
                <p className="t-meta mt-1 text-muted-foreground">
                  <ContentText>{choice.why}</ContentText>
                </p>
                {choice.slide !== undefined && (
                  <Citation
                    slide={choice.slide}
                    lectureId={lectureId}
                    slideId={slideId}
                    label={labels.slide}
                    accent={accent}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
