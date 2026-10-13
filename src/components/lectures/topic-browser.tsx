"use client";

import * as React from "react";
import Link from "next/link";
import { Star, Check, Search, HelpCircle, Layers, Printer, X } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { setTopicStudied, flagPoint, cardsFromTopic } from "@/app/actions/topics";
import { progressOf, describeProgress } from "@/lib/topic-progress";
import type { Section } from "@/lib/lecture-sections";

/**
 * The lecture, topic by topic — and the five things he does to it.
 *
 * Read it, search it, test himself on it, say a point did not land, and turn
 * a topic into cards. All five sit on this one screen because they are all the
 * same act: going through the lecture. Splitting them across tabs would make
 * him decide which tool he is using before he can use it.
 *
 * SEARCH IS A FILTER, NOT A RESULTS PAGE. Typing narrows the list in place and
 * opens what matches, so the lecture's shape stays on screen. 111 points and
 * no way to find "liaison" was the complaint; a separate results screen would
 * answer it by throwing away the structure that makes this useful.
 *
 * NOTHING HERE CALLS A MODEL. The self-test is the two halves of a point
 * swapped round, and the cards are the same two halves stored. The content is
 * already correct; generating it again would cost money to introduce risk.
 */

type Labels = Record<string, string>;

interface Topic extends Section {
  id: string;
  firstSlide?: number | null;
  studied: boolean;
}

export function TopicBrowser({
  sections,
  lectureId,
  slideId,
  accent,
  locale,
  labels,
}: {
  sections: Topic[];
  lectureId: string;
  slideId: string | null;
  accent: string;
  locale: "ar" | "en";
  labels: Labels;
}) {
  const [query, setQuery] = React.useState("");
  const [studied, setStudied] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, s.studied]))
  );
  const [quizOf, setQuizOf] = React.useState<string | null>(null);

  /* Matching is case- and diacritic-insensitive, and searches everything a
     student would type: the topic name, its idea, the exam warning, and both
     halves of every point. Searching only titles would miss "liaison", which
     is the exact word the complaint was about — it appears in a point, not in
     a heading. */
  const norm = React.useCallback(
    (s: string) =>
      s
        .toLowerCase()
        .replace(/[ً-ْٰ]/g, "")   // Arabic diacritics
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي"),
    []
  );

  const q = norm(query.trim());
  const shown = React.useMemo(() => {
    if (!q) return sections;
    return sections.filter((s) => {
      const hay = [
        s.title,
        s.idea,
        s.watch ?? "",
        ...s.points.flatMap((p) => [p.heading, p.source, p.note ?? ""]),
      ].join(" ");
      return norm(hay).includes(q);
    });
  }, [q, sections, norm]);

  const p = progressOf(Object.values(studied).filter(Boolean).length, sections.length);
  const words = {
    zero: labels.wordZero, one: labels.wordOne, two: labels.wordTwo,
    few: labels.wordFew, many: labels.wordMany,
  };

  async function toggleStudied(id: string) {
    const next = !studied[id];
    setStudied((s) => ({ ...s, [id]: next }));          // optimistic
    const result = await setTopicStudied(id, next).catch(() => ({ ok: false as const }));
    if (!result.ok) setStudied((s) => ({ ...s, [id]: !next }));  // put it back
  }

  const quiz = quizOf ? sections.find((s) => s.id === quizOf) : null;
  if (quiz) {
    return <Quiz topic={quiz} accent={accent} labels={labels} onClose={() => setQuizOf(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The bar: where he is, and how to find something. Printed pages drop
          it — see `print:hidden` — because a sheet of paper has no search. */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="t-meta tabular-nums text-muted-foreground">
            {describeProgress(p, locale, words, labels.progress)}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="t-meta inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Printer className="size-3.5" />
            {labels.print}
          </button>
        </div>
        <div
          className="h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: "rgb(255 255 255 / 12%)" }}
          role="presentation"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${p.fraction * 100}%`, background: accent }}
          />
        </div>

        <label className="glass flex items-center gap-2.5 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search}
            className="t-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            dir="auto"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="clear">
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </label>
        {q && (
          <p className="t-meta text-muted-foreground">
            {shown.length === 0
              ? labels.noMatch
              : labels.matches.replace("{count}", String(shown.length))}
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-2.5">
        {shown.map((section) => (
          <li key={section.id}>
            <TopicRow
              section={section}
              index={sections.indexOf(section) + 1}
              /* A search opens what it found: a closed match is a match the
                 student cannot see, which is the same as no match. */
              open={Boolean(q)}
              studied={Boolean(studied[section.id])}
              onToggleStudied={() => toggleStudied(section.id)}
              onQuiz={() => setQuizOf(section.id)}
              lectureId={lectureId}
              slideId={slideId}
              accent={accent}
              labels={labels}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One topic, closed to a line and openable.
 *
 * `<details>`/`<summary>` as before, for the same three reasons: it works
 * before the JavaScript arrives, the browser's own find-in-page opens a closed
 * one onto its match, and the keyboard behaviour is correct for free.
 */
function TopicRow({
  section,
  index,
  open,
  studied,
  onToggleStudied,
  onQuiz,
  lectureId,
  slideId,
  accent,
  labels,
}: {
  section: Topic;
  index: number;
  open: boolean;
  studied: boolean;
  onToggleStudied: () => void;
  onQuiz: () => void;
  lectureId: string;
  slideId: string | null;
  accent: string;
  labels: Labels;
}) {
  const [cards, setCards] = React.useState<string | null>(null);
  const [flagged, setFlagged] = React.useState<Record<number, boolean>>({});

  async function makeCards() {
    setCards("…");
    const r = await cardsFromTopic(section.id).catch(() => ({ ok: false as const, made: 0 }));
    setCards(
      !r.ok || r.made === 0
        ? labels.noCards
        : labels.madeCards.replace("{count}", String(r.made))
    );
  }

  async function flag(i: number) {
    setFlagged((f) => ({ ...f, [i]: true }));   // optimistic; see below
    const r = await flagPoint(section.id, i).catch(() => ({ ok: false as const }));
    /* Rolled back on failure. The point of the button is that he can trust
       the thing was written down — showing "saved" over nothing would be the
       one failure that matters here. */
    if (!r.ok) setFlagged((f) => ({ ...f, [i]: false }));
  }

  return (
    <details className="glass group overflow-hidden pb-0 pt-0" open={open || undefined}>
      <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]">
        <span
          aria-hidden
          className="mt-0.5 w-7 shrink-0 text-end text-[13px] font-semibold tabular-nums text-muted-foreground"
        >
          {index}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="t-body font-semibold">
              <ContentText>{section.title}</ContentText>
            </span>
            {section.slides && (
              <span className="t-meta tabular-nums text-muted-foreground" dir="auto">
                {labels.slidesLabel.replace("{slides}", section.slides)}
              </span>
            )}
            {section.starred && (
              <Star className="size-3.5 shrink-0" style={{ color: accent }} fill={accent} />
            )}
            {/* The tick is the one thing on a closed row that is about HIM
                rather than about the lecture, so it is the one thing allowed
                to take the accent colour out here. */}
            {studied && <Check className="size-3.5 shrink-0" style={{ color: accent }} />}
          </span>
          <ContentText as="div" className="t-meta text-muted-foreground">
            {section.idea}
          </ContentText>
        </span>
        <span
          aria-hidden
          className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 print:hidden"
        >
          ⌄
        </span>
      </summary>

      <div className="flex flex-col gap-3 pb-4 pe-1 ps-10">
        {section.watch && (
          <div
            className="t-meta rounded-[14px] border p-3"
            style={{ borderColor: "rgb(255 255 255 / 14%)", background: "rgb(255 255 255 / 5%)" }}
          >
            <span className="t-label block" style={{ color: accent }}>
              {labels.watch}
            </span>
            <ContentText as="div" className="mt-1">
              {section.watch}
            </ContentText>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {section.points.map((point, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <ContentText as="div" className="t-label text-muted-foreground">
                {point.heading}
              </ContentText>
              <ContentText as="div" className="t-body">
                {point.source}
              </ContentText>
              {point.note && (
                <ContentText as="div" className="t-meta text-muted-foreground">
                  {point.note}
                </ContentText>
              )}
              {/* One button per point, and it stays out of the way until it is
                  wanted: no colour, no border, the size of the note above it.
                  A row of loud buttons down 111 points would be louder than
                  the lecture. */}
              <button
                type="button"
                onClick={() => flag(i)}
                disabled={flagged[i]}
                className="t-meta mt-0.5 self-start text-muted-foreground underline decoration-dotted underline-offset-4 disabled:no-underline print:hidden"
              >
                {flagged[i] ? (
                  labels.flagged
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <HelpCircle className="size-3" />
                    {labels.notClear}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* The three things to do with a topic once it has been read. */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={onToggleStudied}
            className="t-meta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium"
            style={{
              borderColor: studied ? accent : "rgb(255 255 255 / 18%)",
              color: studied ? accent : undefined,
            }}
            aria-pressed={studied}
          >
            <Check className="size-3.5" />
            {studied ? labels.studied : labels.markStudied}
          </button>
          <button
            type="button"
            onClick={onQuiz}
            className="t-meta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium"
            style={{ borderColor: "rgb(255 255 255 / 18%)" }}
          >
            {labels.quiz}
          </button>
          <button
            type="button"
            onClick={makeCards}
            disabled={cards !== null}
            className="t-meta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium disabled:opacity-60"
            style={{ borderColor: "rgb(255 255 255 / 18%)" }}
          >
            <Layers className="size-3.5" />
            {cards ?? labels.makeCards}
          </button>
          {slideId && section.firstSlide && (
            <Link
              href={`/lectures/${lectureId}/slides/${slideId}?page=${section.firstSlide}`}
              className="t-meta font-medium underline decoration-dotted underline-offset-4"
              style={{ color: accent }}
            >
              {labels.openSlide}
            </Link>
          )}
        </div>
      </div>
    </details>
  );
}

/**
 * اختبرني — the same points, asked instead of told.
 *
 * The Arabic note becomes the question and the slide's English becomes the
 * answer, which is the right way round rather than the convenient one: in the
 * exam he will be shown a situation in his own head and asked for the term,
 * not shown the term and asked what it means.
 *
 * Points with no note are skipped. A card whose question is its own answer is
 * worse than one fewer question.
 */
function Quiz({
  topic,
  accent,
  labels,
  onClose,
}: {
  topic: Topic;
  accent: string;
  labels: Labels;
  onClose: () => void;
}) {
  const asked = React.useMemo(
    () => topic.points.filter((p) => p.note && p.note.trim().length > 0),
    [topic]
  );
  const [at, setAt] = React.useState(0);
  const [shown, setShown] = React.useState(false);

  const point = asked[at];
  const over = !point;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="t-label text-muted-foreground">
          <ContentText>{topic.title}</ContentText>
        </span>
        <button type="button" onClick={onClose} className="t-meta text-muted-foreground">
          {labels.quizBack}
        </button>
      </div>

      <section className="glass pb-5 pt-4">
        {over ? (
          <>
            <p className="t-body">{labels.quizDone}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-full px-5 py-2.5 text-[15px] font-semibold"
              style={{ background: accent, color: "var(--background)" }}
            >
              {labels.quizBack}
            </button>
          </>
        ) : (
          <>
            <p className="t-label tabular-nums text-muted-foreground">
              {labels.quizOf.replace("{n}", String(at + 1)).replace("{total}", String(asked.length))}
            </p>
            <ContentText as="div" className="t-title mt-3">
              {point.note!}
            </ContentText>

            {/* The answer is hidden until he asks, and once shown it stays —
                he is checking himself, not being marked. */}
            {shown ? (
              <ContentText
                as="div"
                className="t-body mt-4 rounded-[14px] border p-3.5"
                style={{ borderColor: accent }}
              >
                {point.source}
              </ContentText>
            ) : (
              <button
                type="button"
                onClick={() => setShown(true)}
                className="mt-4 w-full rounded-full px-5 py-3 text-[15px] font-semibold"
                style={{ background: accent, color: "var(--background)" }}
              >
                {labels.show}
              </button>
            )}

            {shown && (
              <button
                type="button"
                onClick={() => {
                  setShown(false);
                  setAt((i) => i + 1);
                }}
                className="mt-3 w-full rounded-full border px-5 py-3 text-[15px] font-medium"
                style={{ borderColor: "rgb(255 255 255 / 18%)" }}
              >
                {labels.nextQ}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
