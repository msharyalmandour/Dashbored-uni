import type { DashboardData } from "@/lib/dashboard";

/**
 * What the four tiles under the hero say, decided here rather than in JSX.
 *
 * The reason this is a module and not four lines of markup is that every one
 * of these numbers has a way of being subtly wrong, and the wrong version is
 * invisible on screen. A count taken off a preview array reads as a total. A
 * zero from "you have none" looks identical to a zero from "we could not load
 * it". A tile that links somewhere is indistinguishable from one that does
 * not until you click it.
 *
 * So the rules live in one testable place: scripts/verify-home-metrics.ts
 * pins them, and the mutation sweep checks that the pins would fail if the
 * rules changed.
 */

export type SnapshotKind = "courses" | "tasks" | "reviews" | "gaps";

export type SnapshotTile = {
  kind: SnapshotKind;
  value: number;
  /** Where the number can be inspected. Every tile has one — see `HREF`. */
  href: string;
  /**
   * True when the number is zero *and* zero is the whole story, so the tile
   * can say "nothing here yet, do this" instead of printing a bare 0. A 0 on
   * a dashboard is the least informative thing a dashboard can show.
   */
  empty: boolean;
  /** Set when the figure is urgent enough to carry the accent. */
  accent: boolean;
};

/**
 * Each tile's destination. Held as a table rather than inline so that
 * "does every tile go somewhere real?" is one assertion over one object, and
 * so a route rename breaks in a place a person is looking.
 */
const HREF: Record<SnapshotKind, string> = {
  courses: "/academics",
  tasks: "/tasks",
  reviews: "/review",
  gaps: "/knowledge-gaps",
};

/**
 * The threshold at which a pile stops being a number and starts being a
 * problem worth colouring. Chosen from the real account rather than as a
 * round figure: 42 reviews and 22 open tasks were both backlogs the student
 * had not been told about, and 12 unresolved gaps was the smallest of the
 * three that still mattered. Ten is under all of them.
 */
export const ACCENT_AT = 10;

export function snapshotTiles(data: {
  activeSubjectsCount: number;
  activeTasksCount: number;
  reviewsDueTotal: number;
  gapsSummary: { unresolved: number };
}): SnapshotTile[] {
  const rows: Array<[SnapshotKind, number]> = [
    ["courses", data.activeSubjectsCount],
    ["tasks", data.activeTasksCount],
    ["reviews", data.reviewsDueTotal],
    ["gaps", data.gapsSummary.unresolved],
  ];

  return rows.map(([kind, value]) => ({
    kind,
    value,
    href: HREF[kind],
    empty: value === 0,
    /* Gaps and courses never take the accent.

       Zero unresolved gaps is good news and five courses is just a fact;
       neither is a thing to do. The accent means "this is a pile waiting for
       you", which only tasks and reviews can be. */
    accent: (kind === "tasks" || kind === "reviews") && value >= ACCENT_AT,
  }));
}

/**
 * The figure in the hero's ring.
 *
 * NOT "semester progress". There is no semester model in this schema — no
 * start date, no credit load, no completion definition — so a percentage
 * labelled that way would be invented, which is the one thing this page is
 * not allowed to do. What does exist is `computeAcademicHealth`, a real
 * weighted score over completion, reviews, gaps, deadlines and practice, and
 * the ring shows that, under its own name.
 */
export function heroRing(health: { score: number }): { pct: number; band: "low" | "mid" | "high" } {
  const pct = Math.max(0, Math.min(100, Math.round(health.score)));
  return { pct, band: pct < 40 ? "low" : pct < 70 ? "mid" : "high" };
}

/**
 * Whether the hero's primary button can promise anything.
 *
 * "Continue where you left off" is only honest when there is somewhere to
 * continue. With no reading position the button becomes the secondary one and
 * the page stops pretending to remember something it does not.
 */
export function primaryCta(resumeHref: string | null): { href: string; kind: "resume" | "day" } {
  return resumeHref ? { href: resumeHref, kind: "resume" } : { href: "/today", kind: "day" };
}

/**
 * Prompts offered under the AI input.
 *
 * Every one of these maps to a tool the agent actually has in
 * src/lib/ai/agent/tools.ts. That constraint is the whole point of the
 * function: the reference designs suggest things like "plan my study week"
 * and "summarise my lecture", and this agent has no planner and no
 * summariser. Offering them would be the interface writing a cheque the
 * backend cannot cash, and the student would read one failure as the product
 * being broken rather than as that one thing being absent.
 *
 * `available` gates the whole set — with no API key the agent cannot run at
 * all, and suggestions under a dead input are worse than no suggestions.
 */
export const AI_PROMPT_KEYS = ["timetable", "task", "flashcards", "gap", "material"] as const;
export type AiPromptKey = (typeof AI_PROMPT_KEYS)[number];

/** The agent tool each prompt is a plain-language name for. */
export const PROMPT_TOOL: Record<AiPromptKey, string> = {
  timetable: "import_timetable",
  task: "create_task",
  flashcards: "create_flashcards",
  gap: "create_knowledge_gap",
  material: "read_my_material",
};

export function aiPrompts(available: boolean): AiPromptKey[] {
  return available ? [...AI_PROMPT_KEYS] : [];
}

/**
 * The hero's greeting slot, by hour.
 *
 * Shares `getTimePeriod`'s four bands rather than inventing a fifth, so the
 * greeting on Home and the greeting in the day's header can never disagree
 * about what time it is.
 */
export function greetingKey(
  period: "morning" | "day" | "evening" | "night"
): "greetingMorning" | "greetingDay" | "greetingEvening" | "greetingNight" {
  switch (period) {
    case "morning":
      return "greetingMorning";
    case "day":
      return "greetingDay";
    case "evening":
      return "greetingEvening";
    case "night":
      return "greetingNight";
  }
}

/** The first name, or a fallback that is not a fake name. */
export function firstName(userName: string | null | undefined): string | null {
  const trimmed = (userName ?? "").trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}

export type { DashboardData };
