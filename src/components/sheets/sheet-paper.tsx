"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { Chip } from "@/components/ui/controls";
import { ProgressRing, TutorOrb } from "@/components/ui/progress-ring";
import {
  answeredCount,
  canSubmit,
  isAnswered,
  lastSavedAt,
  nextUnanswered,
  savedMinutesAgo,
  timeLeft,
  type SheetAnswer,
} from "@/lib/sheet";
import type { SheetScreen } from "@/lib/sheet-store";
import type { TutorAvailability } from "@/lib/sheet-tutor";
import type { Locale } from "@/lib/i18n/config";

/**
 * The sheet, as a sheet of paper.
 *
 * A LIGHT PAGE INSIDE A DARK APP, which is the one place in this product
 * where that is right: everything else here is something you read, and this
 * is the only thing you WRITE. Paper is what you write on, and the switch in
 * ground is the whole signal that this screen wants something back from you.
 *
 * IT SAVES WHILE HE TYPES, AND IT SAYS SO QUIETLY. Two seconds after the last
 * keystroke, per field. The line at the top is the sheet's last real change,
 * not the last request — see `saveAnswer`, which refuses to move the
 * timestamp when the text did not change, or the line would read "الحين"
 * forever including an hour after he stopped.
 *
 * «سلّم» IS NOT THE PRIMARY BUTTON UNTIL IT IS TRUE. An orange submit button
 * over a half-finished sheet is the app asking for something it should not
 * want yet. It stays a ghost, with the reason beside it, and «كمّل السؤال N»
 * is the one lit control — which is also the one that moves him forward.
 *
 * THE TUTOR DOES NOT WRITE THE ANSWER, and nothing here lets it: there is no
 * control that moves its text into a field, the draft is never sent to it,
 * and scripts/verify-sheet-tutor.ts scans this file to keep it that way.
 */

export interface SheetStrings {
  crumbWeek: string;
  sheetN: string;
  sheetNoNumber: string;
  fromSchedule: string;
  answeredOf: string;
  answeredLabel: string;
  dueIn: string;
  dueNow: string;
  overdueBy: string;
  noDeadline: string;
  criteriaHeading: string;
  noCriteria: string;
  savedNow: string;
  savedAgo: string;
  savedNever: string;
  continueQ: string;
  submit: string;
  submitLocked: string;
  questionN: string;
  answerPlaceholder: string;
  noQuestions: string;
  tutorTitle: string;
  tutorRule: string;
  tutorAsk: string;
  tutorNoKey: string;
  tutorNoCredit: string;
  tutorFrom: string;
  days: Record<string, string>;
  hours: Record<string, string>;
  minutes: Record<string, string>;
}

function countPhrase(bag: Record<string, string>, count: number, locale: Locale): string {
  return pick(bag, pluralForm(locale, count)).replace("{count}", String(count));
}

/** "يومين و9 ساعات" — and never "2 يوم و57 س". */
function spanWords(
  days: number,
  hours: number,
  t: SheetStrings,
  locale: Locale,
  and: string
): string {
  const parts: string[] = [];
  if (days > 0) parts.push(countPhrase(t.days, days, locale));
  if (hours > 0 || days === 0) parts.push(countPhrase(t.hours, hours, locale));
  return parts.join(and);
}

export function SheetPaper({
  sheet,
  nowMs,
  locale,
  t,
  weekdayNames,
  tutor,
}: {
  sheet: SheetScreen;
  /** The server's clock, so the first paint does not disagree with it. */
  nowMs: number;
  locale: Locale;
  t: SheetStrings;
  weekdayNames: readonly string[];
  tutor: TutorAvailability;
}) {
  const and = locale === "ar" ? " و" : " and ";

  /* The answers live here while he types. The server's rows are the starting
     value and the autosave below is what makes them agree again. */
  const [answers, setAnswers] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(sheet.questions.map((q) => [q.id, q.answer ?? ""]))
  );
  const [savedAt, setSavedAt] = React.useState<Date | null>(() =>
    lastSavedAt(sheet.questions)
  );
  const [tick, setTick] = React.useState(0);

  /* The save line is a duration, so it has to be re-rendered to stay true.
     Once a minute, which is the resolution the line itself has. */
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const state: SheetAnswer[] = sheet.questions.map((q) => ({
    id: q.id,
    answer: answers[q.id] ?? null,
    answeredAt: q.answeredAt,
  }));
  const done = answeredCount(state);
  const total = sheet.questions.length;
  const next = nextUnanswered(state);
  const ready = canSubmit(state);

  const onSaved = React.useCallback((at: Date) => setSavedAt(at), []);

  const now = new Date(nowMs + tick * 60000);
  const left = sheet.deadline ? timeLeft(sheet.deadline, now) : null;
  const savedMinutes = savedMinutesAgo(savedAt, now);

  const dueLine = !left
    ? t.noDeadline
    : left.imminent
      ? t.dueNow
      : (left.late ? t.overdueBy : t.dueIn).replace(
          "{time}",
          spanWords(left.days, left.hours, t, locale, and)
        );

  const savedLine =
    savedMinutes === null
      ? t.savedNever
      : savedMinutes === 0
        ? t.savedNow
        : t.savedAgo.replace(
            "{ago}",
            savedMinutes < 60
              ? countPhrase(t.minutes, savedMinutes, locale)
              : countPhrase(t.hours, Math.floor(savedMinutes / 60), locale)
          );

  const sheetLabel = sheet.number
    ? t.sheetN.replace("{n}", String(sheet.number))
    : t.sheetNoNumber;

  return (
    <div className="sh-screen">
      {/* The trail back. It stops where the data stops: a course with no
          timetable row gets no "الأحد 8", because there is no Sunday 8. */}
      <nav className="sh-crumbs" aria-label={t.crumbWeek}>
        <Link href="/time" className="sh-crumb">
          {t.crumbWeek}
        </Link>
        {sheet.fromClass && (
          <>
            <span aria-hidden className="sh-sep">
              ›
            </span>
            <span className="sh-crumb">
              {weekdayNames[sheet.fromClass.weekday]}{" "}
              <span className="t-figure">{Math.floor(sheet.fromClass.startMinute / 60)}</span>
            </span>
          </>
        )}
        <span aria-hidden className="sh-sep">
          ›
        </span>
        <Link href={`/subjects/${sheet.course.id}`} className="sh-crumb">
          {sheet.course.name}
        </Link>
        <span aria-hidden className="sh-sep">
          ›
        </span>
        <span className="sh-crumb sh-crumb-here">{sheetLabel}</span>
      </nav>

      <div className="sh-layout">
        {/* ---- the paper ---- */}
        <div className="sh-stack">
          <span aria-hidden className="sh-under sh-under-2" />
          <span aria-hidden className="sh-under sh-under-1" />
          <article className="sh-paper">
            <header className="sh-head">
              <p className="sh-eyebrow">
                {sheetLabel}
                {sheet.course.code ? ` · ${sheet.course.code}` : ""}
              </p>
              <h1 className="sh-title">{sheet.title}</h1>
              <p className="sh-saved" role="status">
                {savedLine}
              </p>
            </header>

            {total === 0 ? (
              <p className="sh-empty">{t.noQuestions}</p>
            ) : (
              <ol className="sh-questions">
                {sheet.questions.map((q, i) => (
                  <Question
                    key={q.id}
                    id={q.id}
                    index={i + 1}
                    prompt={q.prompt}
                    value={answers[q.id] ?? ""}
                    label={t.questionN.replace("{n}", String(i + 1))}
                    placeholder={t.answerPlaceholder}
                    done={isAnswered(state[i])}
                    onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    onSaved={onSaved}
                  />
                ))}
              </ol>
            )}
          </article>
        </div>

        {/* ---- the side ---- */}
        <aside className="sh-side">
          {sheet.fromClass && (
            <div className="sh-card">
              <p className="sh-card-kicker">{t.fromSchedule}</p>
              <p className="sh-card-line">
                {weekdayNames[sheet.fromClass.weekday]}{" "}
                <span className="t-figure">
                  {Math.floor(sheet.fromClass.startMinute / 60)}:
                  {String(sheet.fromClass.startMinute % 60).padStart(2, "0")}
                </span>
                {" · "}
                {sheet.course.name}
              </p>
            </div>
          )}

          <div className="sh-card sh-card-ring">
            <ProgressRing
              value={total === 0 ? 0 : (done / total) * 100}
              size={84}
              label={t.answeredLabel}
              sublabel={t.answeredOf
                .replace("{done}", String(done))
                .replace("{total}", String(total))}
            />
            <p className={cn("sh-due", left?.late && "sh-due-late")}>{dueLine}</p>
          </div>

          <div className="sh-card">
            <p className="sh-card-kicker">{t.criteriaHeading}</p>
            <p className="sh-card-line">{sheet.criteria ?? t.noCriteria}</p>
          </div>

          <TutorCard sheet={sheet} t={t} tutor={tutor} />
        </aside>
      </div>

      {/* The bar is fixed on a phone, where the paper is long and the two
          controls would otherwise be a scroll away from the question he is
          on. It carries the safe-area inset itself. */}
      <div className="sh-bar">
        {next !== null && (
          <a href={`#q-${next}`} className="c-btn c-press">
            {t.continueQ.replace("{n}", String(next))}
          </a>
        )}
        <button
          type="button"
          disabled={!ready}
          className={cn(ready ? "c-btn" : "c-btn-ghost", "c-press")}
          aria-describedby={ready ? undefined : "sh-locked"}
        >
          {t.submit}
        </button>
        {!ready && (
          <span id="sh-locked" className="sh-locked">
            {t.submitLocked}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * One question and its field.
 *
 * THE TEXTAREA GROWS. A fixed four rows on an answer that runs to a page
 * means writing through a letterbox, and the student cannot see the argument
 * he is making. It grows to its content and never scrolls inside itself.
 */
function Question({
  id,
  index,
  prompt,
  value,
  label,
  placeholder,
  done,
  onChange,
  onSaved,
}: {
  id: string;
  index: number;
  prompt: string;
  value: string;
  label: string;
  placeholder: string;
  done: boolean;
  onChange: (v: string) => void;
  onSaved: (at: Date) => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const first = React.useRef(true);

  const grow = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(grow, [grow, value]);

  /* Two seconds after the last keystroke, not two seconds after the first.
     The timer is reset on every change, so a long paragraph is one save and
     not one save per word. */
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/sheets/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId: id, answer: value }),
        });
        if (!res.ok) return;
        const data: { answeredAt?: string } = await res.json();
        if (data.answeredAt) onSaved(new Date(data.answeredAt));
      } catch {
        /* Offline on a bus is the normal case, not an error state worth a
           dialog. The text is still in the field; the next keystroke tries
           again. */
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [id, value, onSaved]);

  return (
    <li className="sh-q" id={`q-${index}`}>
      <div className="sh-q-head">
        {/* NOT `.t-figure`. That class sets `direction: ltr; unicode-bidi:
            isolate` for figures, and "سؤال 1" is not a figure — it is an
            Arabic word with a digit in it, and inside an LTR isolate the
            shaping breaks: the ل detaches and it renders "سؤا ل 1". This
            project has hit that exact bug once before, on a date. */}
        <span className="sh-q-n">{label}</span>
        {done && <span aria-hidden className="sh-q-done" />}
      </div>
      <p className="sh-prompt" dir="auto">
        {prompt}
      </p>
      <textarea
        ref={ref}
        id={`a-${id}`}
        className="sh-field"
        dir="auto"
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
    </li>
  );
}

/**
 * The tutor's card.
 *
 * It lists the course's own lectures as what it would draw examples from,
 * because "I will help" is worth nothing and "I will help, out of Management
 * Process and Quality Improvement" is a promise he can check.
 *
 * There is no control here that fills a field. That is the rule, and it is
 * scanned for in scripts/verify-sheet-tutor.ts.
 */
function TutorCard({
  sheet,
  t,
  tutor,
}: {
  sheet: SheetScreen;
  t: SheetStrings;
  tutor: TutorAvailability;
}) {
  const off = tutor === "no-key" ? t.tutorNoKey : tutor === "no-credit" ? t.tutorNoCredit : null;
  return (
    <div className="sh-card sh-tutor">
      <div className="flex items-center gap-2">
        <TutorOrb size={36} floaty={!off} />
        <div>
          <p className="sh-card-kicker">{t.tutorTitle}</p>
          <p className="sh-rule">{t.tutorRule}</p>
        </div>
      </div>

      {off ? (
        <p className="sh-card-line mt-2">{off}</p>
      ) : (
        <>
          <button type="button" className="c-btn-ghost c-press mt-3 w-full">
            {t.tutorAsk}
          </button>
          {sheet.sources.length > 0 && (
            <>
              <p className="sh-card-kicker mt-3">{t.tutorFrom}</p>
              <ul className="sh-sources">
                {sheet.sources.slice(0, 4).map((s) => (
                  <li key={s.title}>
                    <Chip>{s.title}</Chip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
