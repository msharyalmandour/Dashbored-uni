import Link from "next/link";
import { CalendarPlus, CheckSquare, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { ProgressRing } from "@/components/ui/progress-ring";
import { CinematicCard } from "@/components/ui/cinematic-card";
import { twoWeeks } from "@/lib/mini-calendar";
import type { Locale } from "@/lib/i18n/config";

/**
 * The approved home layout, panel by panel.
 *
 * ONE FILE, because these six are the same object: a left column and a main
 * column laid out against one reference drawing, sharing one set of card
 * rules. Split across six files the shared rules get copied five times and
 * drift, which is the failure this whole reskin exists to undo.
 *
 * EVERY PANEL DRAWS WHEN IT IS EMPTY. The brief says so by name: a card that
 * disappears when there is nothing in it makes the page a different shape
 * every morning, and the student stops knowing where anything is. Each one
 * keeps its box and says what is missing.
 */

export interface HomeStrings {
  searchHint: string;
  stats: { subjects: string; exams: string; tasks: string; progress: string };
  today: string;
  todayEmpty: string;
  next: string;
  nextEmpty: string;
  all: string;
  continueHeading: string;
  continueEmpty: string;
  breathTitle: string;
  breathCount: string;
  breathLabel: string;
  breathStart: string;
  shortcuts: string;
  addTask: string;
  uploadSource: string;
  askTutor: string;
  addEvent: string;
  examChip: string;
  inDays: Record<string, string>;
  weekdayLetters: string[];
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/* ── the four figures ─────────────────────────────────────────────────── */

export interface StatsData {
  subjects: number;
  exams: number;
  tasks: number;
  /** 0–100, or null when there is nothing to average. */
  progress: number | null;
}

/**
 * The strip of four, 84px tall.
 *
 * EACH FIGURE CARRIES ITS WORD. "5" alone is the bug this product has hit
 * twice; the word is not a caption, it is what makes the number a fact.
 * A percentage with nothing to average shows a dash rather than a confident
 * zero.
 */
export function StatsStrip({ data, t }: { data: StatsData; t: HomeStrings }) {
  const items = [
    { n: String(data.subjects), label: t.stats.subjects, icon: "□" },
    { n: String(data.exams), label: t.stats.exams, icon: "▤" },
    { n: String(data.tasks), label: t.stats.tasks, icon: "☑" },
    { n: data.progress === null ? "—" : `${data.progress}%`, label: t.stats.progress, icon: "▥" },
  ];
  return (
    <div className="hx-stats">
      {items.map((it) => (
        <div key={it.label} className="hx-stat">
          <span aria-hidden className="hx-stat-icon">{it.icon}</span>
          <span className="hx-stat-text">
            <span className="t-figure hx-stat-n">{it.n}</span>
            <span className="hx-stat-label">{it.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── today ────────────────────────────────────────────────────────────── */

export interface TodayRow {
  id: string;
  title: string;
  kind: string;
  startMinute: number;
  minutes: number | null;
  location: string | null;
  /** True for the one happening now — the row the design rings in orange. */
  current: boolean;
}

export function TodayCard({
  rows,
  dateLine,
  t,
}: {
  rows: TodayRow[];
  dateLine: string;
  t: HomeStrings;
}) {
  return (
    <section className="hx-card">
      <header className="hx-card-head">
        <h2 className="t-kufi hx-card-title">
          {t.today}
          {rows.length > 0 && <span className="t-figure hx-count">{rows.length}</span>}
        </h2>
        <span className="hx-card-note">{dateLine}</span>
      </header>

      {rows.length === 0 ? (
        <p className="hx-empty">{t.todayEmpty}</p>
      ) : (
        <ul className="hx-today">
          {rows.map((row) => (
            <li key={row.id} className="hx-slot">
              <span aria-hidden className="hx-dot" />
              <span className="t-figure hx-slot-time">{clock(row.startMinute)}</span>
              {/* The one happening now is ringed, not merely tinted: a tint
                  is a second shade of the same brown at a glance. */}
              <span className={cn("hx-slot-body", row.current && "hx-slot-now")}>
                <span className="hx-slot-title" dir="auto">{row.title}</span>
                <span className="hx-slot-meta">
                  {[row.kind, row.location].filter(Boolean).join(" · ")}
                </span>
              </span>
              {row.minutes !== null && (
                <span className="t-figure hx-slot-len">{Math.round(row.minutes / 60)}h</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── what is coming ───────────────────────────────────────────────────── */

export interface NextItem {
  id: string;
  title: string;
  courseCode: string | null;
  daysAway: number;
  /** An exam gets the chip; everything else is a hand-in. */
  exam: boolean;
  weight: number | null;
}

export function NextCard({
  items,
  locale,
  t,
}: {
  items: NextItem[];
  locale: Locale;
  t: HomeStrings;
}) {
  const away = (n: number) =>
    pick(t.inDays, pluralForm(locale, n)).replace("{count}", String(n));

  return (
    <section className="hx-card">
      <header className="hx-card-head">
        <h2 className="t-kufi hx-card-title">{t.next}</h2>
        <Link href="/tasks" className="hx-card-note hx-link">{t.all}</Link>
      </header>

      {items.length === 0 ? (
        <p className="hx-empty">{t.nextEmpty}</p>
      ) : (
        <ul className="hx-next">
          {items.map((item, i) => (
            <li key={item.id} className={cn("hx-next-row", i === 0 && item.exam && "hx-next-lead")}>
              {i === 0 && item.exam && <span className="hx-chip">{t.examChip}</span>}
              <span className="hx-next-title" dir="auto">{item.title}</span>
              <span className="hx-next-meta">
                {away(item.daysAway)}
                {item.courseCode ? ` · ${item.courseCode}` : ""}
                {item.weight !== null ? ` · ${item.weight}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── pick up where you stopped ────────────────────────────────────────── */

export interface ContinueItem {
  id: string;
  title: string;
  courseCode: string | null;
  percent: number;
  href: string;
}

export function ContinueStrip({ items, t }: { items: ContinueItem[]; t: HomeStrings }) {
  return (
    <section className="hx-card">
      <header className="hx-card-head">
        <h2 className="t-kufi hx-card-title">{t.continueHeading}</h2>
        <Link href="/lectures" className="hx-card-note hx-link">{t.all}</Link>
      </header>

      {items.length === 0 ? (
        <p className="hx-empty">{t.continueEmpty}</p>
      ) : (
        <div className="hx-continue">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="hx-cont">
              <CinematicCard image={null} darkSide="bottom" ribbed className="hx-cont-card">
                <span className="hx-cont-inner">
                  <span className="hx-cont-title" dir="auto">{item.title}</span>
                  {item.courseCode && (
                    <span className="t-figure hx-cont-code">{item.courseCode}</span>
                  )}
                  <span className="hx-cont-bar">
                    <span className="t-figure hx-cont-pct">{item.percent}%</span>
                    <span aria-hidden className="hx-cont-track">
                      <span className="hx-cont-fill" style={{ width: `${item.percent}%` }} />
                    </span>
                  </span>
                </span>
              </CinematicCard>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── the left column ──────────────────────────────────────────────────── */

export function MiniCalendar({
  now,
  monthLabel,
  t,
}: {
  now: Date;
  monthLabel: string;
  t: HomeStrings;
}) {
  const cells = twoWeeks(now);
  return (
    <section className="hx-card hx-cal">
      <header className="hx-cal-head">
        <span className="t-kufi hx-cal-month">{monthLabel}</span>
      </header>
      <div className="hx-cal-grid" role="presentation">
        {t.weekdayLetters.map((letter, i) => (
          <span key={i} aria-hidden className="hx-cal-letter">{letter}</span>
        ))}
        {cells.map((c) => (
          <span
            key={c.date.toISOString()}
            className={cn("t-figure hx-cal-day", c.today && "hx-cal-today", !c.inMonth && "hx-cal-out")}
            aria-current={c.today ? "date" : undefined}
          >
            {c.day}
          </span>
        ))}
      </div>
    </section>
  );
}

/**
 * The breathing card.
 *
 * 318px tall and it carries a photograph in the design. `breath.jpg` has not
 * arrived, so `CinematicCard` draws its warm fallback — the case it exists
 * for — and the card keeps its height, its count and its control rather than
 * collapsing to a strip.
 */
export function BreathCard({ minutes, t }: { minutes: number; t: HomeStrings }) {
  return (
    <CinematicCard image={null} darkSide="bottom" ribbed className="hx-breath">
      <div className="hx-breath-inner">
        <div className="hx-breath-top">
          <span className="hx-breath-label">
            {t.breathLabel.replace("{n}", String(minutes))}
          </span>
        </div>
        <div className="hx-breath-mid">
          <span className="t-kufi hx-breath-title">{t.breathTitle}</span>
          <span className="hx-breath-count">{t.breathCount}</span>
        </div>
        <Link href="/focus" className="hx-breath-play" aria-label={t.breathStart}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </Link>
      </div>
    </CinematicCard>
  );
}

export function QuickActions({ t }: { t: HomeStrings }) {
  const items = [
    { href: "/tasks", label: t.addTask, Icon: CheckSquare },
    { href: "/inbox", label: t.uploadSource, Icon: Upload },
    { href: "/studio", label: t.askTutor, Icon: Sparkles },
    { href: "/calendar", label: t.addEvent, Icon: CalendarPlus },
  ];
  return (
    <section className="hx-card">
      <header className="hx-card-head">
        <h2 className="t-kufi hx-card-title">{t.shortcuts}</h2>
      </header>
      <ul className="hx-actions">
        {items.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className="hx-action">
              <span className="hx-action-icon" aria-hidden><Icon className="size-4" /></span>
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The ring the design puts beside the progress figure on a wide screen. */
export function ProgressDial({ percent, label }: { percent: number; label: string }) {
  return <ProgressRing value={percent} size={72} label={label} />;
}
