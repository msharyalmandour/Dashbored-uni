/**
 * المحاكاة — a lecture, played as decisions.
 *
 * The shape is taken from the study app the student brought: you are a head
 * nurse in your first week, the ward has a few meters on it, and each step is
 * a situation with a question and three answers. Every answer moves the meters
 * and every explanation cites the slide it came from — which is the thing that
 * makes it study rather than a game. "صح. Organizing = توزيع الشغل والصلاحيات
 * (سلايد 10)".
 *
 * WHY THIS FILE IS MOSTLY VALIDATION. The content is written by the agent from
 * an uploaded deck, so it is the one kind of content in this product that
 * nobody proof-reads before a student sees it. A broken summary is a bad
 * paragraph; a broken simulation is a student three steps in, clicking an
 * answer that goes nowhere, during the week of an exam. Every way the
 * generated graph can be wrong is refused here, before it reaches the database.
 *
 * EFFECTS REPLACE, THEY DO NOT ADD. In the source material a choice sets
 * `{Staff:"8/8", Patients:34}` — values are display strings as often as
 * numbers ("6/7", "78%", "😐"), and a ward whose morale is an emoji cannot be
 * incremented. The author says what the meter now reads, and this applies it.
 */

/** The ward's dials. Values are shown as written — "6/7", "78%", "😐". */
export type Meters = Record<string, string | number>;

/** Where a choice leads when the simulation is over. */
export const END = "end";

export interface Choice {
  text: string;
  /** A node key, or END. */
  next: string;
  /** What this answer is worth. 0 for wrong. */
  score: number;
  /** Why, in the student's words. */
  why: string;
  /** The slide it comes from. Absent when the point is not on one slide. */
  slide?: number;
  /** Meters this answer rewrites. */
  effects?: Meters;
}

export interface Node {
  key: string;
  /** What has happened. */
  situation: string;
  /** What you are being asked. */
  question: string;
  choices: Choice[];
}

export interface Simulation {
  title: string;
  /** The key of the first node. */
  start: string;
  /** The meters, and what they read before anything happens. */
  meters: Meters;
  nodes: Node[];
}

/* ────────────────────────────────────────────────────────────────────────────
   The limits, and why each one is where it is
   ──────────────────────────────────────────────────────────────────────────── */

/** Fewer than this is not a story, it is a quiz with a theme. */
export const MIN_NODES = 3;
/**
 * The source material runs to eight. Past a dozen a student abandons it
 * half-way, which is worse than a shorter one they finish — and an abandoned
 * run teaches nothing and records nothing.
 */
export const MAX_NODES = 12;
/** A question with one answer is not a question. */
export const MIN_CHOICES = 2;
/** Four is already a lot to read on a phone between two paragraphs. */
export const MAX_CHOICES = 4;
export const MAX_SITUATION = 320;
export const MAX_QUESTION = 160;
export const MAX_CHOICE_TEXT = 160;
export const MAX_WHY = 400;
export const MAX_METERS = 5;

export type SimProblem =
  | { kind: "NO_TITLE" }
  | { kind: "TOO_FEW_NODES"; count: number }
  | { kind: "TOO_MANY_NODES"; count: number }
  | { kind: "DUPLICATE_KEY"; key: string }
  | { kind: "RESERVED_KEY" }
  | { kind: "START_MISSING"; key: string }
  | { kind: "DEAD_END"; node: string; next: string }
  | { kind: "UNREACHABLE"; node: string }
  | { kind: "NEVER_ENDS" }
  | { kind: "SELF_LOOP"; node: string }
  | { kind: "TOO_FEW_CHOICES"; node: string; count: number }
  | { kind: "TOO_MANY_CHOICES"; node: string; count: number }
  | { kind: "NO_RIGHT_ANSWER"; node: string }
  | { kind: "ALL_RIGHT_ANSWERS"; node: string }
  | { kind: "NEGATIVE_SCORE"; node: string }
  | { kind: "UNKNOWN_METER"; node: string; meter: string }
  | { kind: "NO_METERS" }
  | { kind: "TOO_MANY_METERS"; count: number }
  | { kind: "SLIDE_OUT_OF_RANGE"; node: string; slide: number; pages: number }
  | { kind: "MISSING_WHY"; node: string }
  | { kind: "TOO_LONG"; node: string; field: string; length: number; max: number };

/**
 * Everything wrong with a simulation, in the order a reader would meet it.
 *
 * `pages` is the deck's length when it is known, so a cited slide can be
 * checked against a real document rather than merely being a number.
 */
export function problemsWith(sim: Simulation, pages?: number): SimProblem[] {
  const problems: SimProblem[] = [];

  if (!sim.title?.trim()) problems.push({ kind: "NO_TITLE" });

  const meterKeys = Object.keys(sim.meters ?? {});
  if (meterKeys.length === 0) problems.push({ kind: "NO_METERS" });
  if (meterKeys.length > MAX_METERS) {
    problems.push({ kind: "TOO_MANY_METERS", count: meterKeys.length });
  }

  if (sim.nodes.length < MIN_NODES) {
    problems.push({ kind: "TOO_FEW_NODES", count: sim.nodes.length });
  }
  if (sim.nodes.length > MAX_NODES) {
    problems.push({ kind: "TOO_MANY_NODES", count: sim.nodes.length });
  }

  const byKey = new Map<string, Node>();
  for (const node of sim.nodes) {
    /* `end` is how a choice says the simulation is over. A node answering to
       that name would be arrived at instead of the ending, and the run would
       carry on past its own finish — scoring, and never stopping. */
    if (node.key === END) problems.push({ kind: "RESERVED_KEY" });
    if (byKey.has(node.key)) problems.push({ kind: "DUPLICATE_KEY", key: node.key });
    else byKey.set(node.key, node);
  }

  if (!byKey.has(sim.start)) problems.push({ kind: "START_MISSING", key: sim.start });

  const tooLong = (node: string, field: string, value: string, max: number) => {
    if (value && value.length > max) {
      problems.push({ kind: "TOO_LONG", node, field, length: value.length, max });
    }
  };

  let anyEnd = false;
  for (const node of sim.nodes) {
    tooLong(node.key, "situation", node.situation, MAX_SITUATION);
    tooLong(node.key, "question", node.question, MAX_QUESTION);

    if (node.choices.length < MIN_CHOICES) {
      problems.push({ kind: "TOO_FEW_CHOICES", node: node.key, count: node.choices.length });
    }
    if (node.choices.length > MAX_CHOICES) {
      problems.push({ kind: "TOO_MANY_CHOICES", node: node.key, count: node.choices.length });
    }

    const scores = node.choices.map((c) => c.score);
    if (scores.some((s) => s < 0)) problems.push({ kind: "NEGATIVE_SCORE", node: node.key });
    if (node.choices.length > 0 && scores.every((s) => s <= 0)) {
      /* Every answer wrong means the step cannot be passed, which reads to a
         student as the app being broken rather than as them being wrong. */
      problems.push({ kind: "NO_RIGHT_ANSWER", node: node.key });
    }
    if (node.choices.length > 1 && scores.every((s) => s > 0)) {
      /* Every answer right teaches nothing and inflates the score. */
      problems.push({ kind: "ALL_RIGHT_ANSWERS", node: node.key });
    }

    for (const choice of node.choices) {
      tooLong(node.key, "choice", choice.text, MAX_CHOICE_TEXT);
      tooLong(node.key, "why", choice.why, MAX_WHY);
      if (!choice.why?.trim()) problems.push({ kind: "MISSING_WHY", node: node.key });

      if (choice.next === END) anyEnd = true;
      else if (choice.next === node.key) problems.push({ kind: "SELF_LOOP", node: node.key });
      else if (!byKey.has(choice.next)) {
        problems.push({ kind: "DEAD_END", node: node.key, next: choice.next });
      }

      for (const meter of Object.keys(choice.effects ?? {})) {
        if (!meterKeys.includes(meter)) {
          problems.push({ kind: "UNKNOWN_METER", node: node.key, meter });
        }
      }

      if (choice.slide !== undefined && pages !== undefined) {
        if (!Number.isInteger(choice.slide) || choice.slide < 1 || choice.slide > pages) {
          problems.push({
            kind: "SLIDE_OUT_OF_RANGE",
            node: node.key,
            slide: choice.slide,
            pages,
          });
        }
      }
    }
  }

  if (!anyEnd && sim.nodes.length > 0) problems.push({ kind: "NEVER_ENDS" });

  /* Reachability, from the start, following every choice. A node nobody can
     arrive at is content the agent wrote and no student will ever see. */
  if (byKey.has(sim.start)) {
    const seen = new Set<string>([sim.start]);
    const queue = [sim.start];
    while (queue.length > 0) {
      const node = byKey.get(queue.shift()!);
      if (!node) continue;
      for (const choice of node.choices) {
        if (choice.next === END || seen.has(choice.next)) continue;
        if (!byKey.has(choice.next)) continue;
        seen.add(choice.next);
        queue.push(choice.next);
      }
    }
    for (const node of sim.nodes) {
      if (!seen.has(node.key)) problems.push({ kind: "UNREACHABLE", node: node.key });
    }
  }

  return problems;
}

export function isSound(sim: Simulation, pages?: number): boolean {
  return problemsWith(sim, pages).length === 0;
}

/** A problem in the student's language, for the agent's refusal message. */
export function describeProblem(problem: SimProblem): string {
  switch (problem.kind) {
    case "NO_TITLE":
      return "المحاكاة بدون عنوان.";
    case "TOO_FEW_NODES":
      return `${problem.count} مواقف قليلة — الأقل ${MIN_NODES}.`;
    case "TOO_MANY_NODES":
      return `${problem.count} موقف كثير — الأكثر ${MAX_NODES}، وبعدها الطالب يتركها في النص.`;
    case "DUPLICATE_KEY":
      return `الموقف "${problem.key}" مكرر.`;
    case "RESERVED_KEY":
      return `"${END}" اسم محجوز للنهاية — ما ينفع يكون اسم موقف.`;
    case "START_MISSING":
      return `البداية "${problem.key}" ما لها موقف.`;
    case "DEAD_END":
      return `خيار في "${problem.node}" يودّي لـ"${problem.next}" وهو غير موجود.`;
    case "UNREACHABLE":
      return `الموقف "${problem.node}" ما يوصل له أحد.`;
    case "NEVER_ENDS":
      return "ما فيه ولا خيار ينهي المحاكاة.";
    case "SELF_LOOP":
      return `خيار في "${problem.node}" يرجّع لنفس الموقف.`;
    case "TOO_FEW_CHOICES":
      return `"${problem.node}" فيه ${problem.count} خيار — السؤال يحتاج ${MIN_CHOICES} على الأقل.`;
    case "TOO_MANY_CHOICES":
      return `"${problem.node}" فيه ${problem.count} خيارات — الأكثر ${MAX_CHOICES}.`;
    case "NO_RIGHT_ANSWER":
      return `"${problem.node}" كل خياراته غلط — ما تنعدّى.`;
    case "ALL_RIGHT_ANSWERS":
      return `"${problem.node}" كل خياراته صح — ما يعلّم شي.`;
    case "NEGATIVE_SCORE":
      return `"${problem.node}" فيه درجة بالسالب.`;
    case "UNKNOWN_METER":
      return `"${problem.node}" يغيّر مؤشر "${problem.meter}" وهو مو معرّف.`;
    case "NO_METERS":
      return "ما فيه مؤشرات تتغير مع القرارات.";
    case "TOO_MANY_METERS":
      return `${problem.count} مؤشرات كثيرة — الأكثر ${MAX_METERS}.`;
    case "SLIDE_OUT_OF_RANGE":
      return `"${problem.node}" يشير لسلايد ${problem.slide} والملف ${problem.pages} صفحة.`;
    case "MISSING_WHY":
      return `خيار في "${problem.node}" بدون تفسير.`;
    case "TOO_LONG":
      return `"${problem.node}" — ${problem.field} طوله ${problem.length} والحد ${problem.max}.`;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Playing it
   ──────────────────────────────────────────────────────────────────────────── */

export interface Run {
  /** The node being answered, or END when it is over. */
  at: string;
  meters: Meters;
  score: number;
  /** Every step taken, for the review afterwards. */
  taken: { node: string; choice: number; score: number }[];
}

export function start(sim: Simulation): Run {
  return { at: sim.start, meters: { ...sim.meters }, score: 0, taken: [] };
}

export function isOver(run: Run): boolean {
  return run.at === END;
}

/**
 * Answer the current question.
 *
 * Returns the run UNCHANGED when the index is not a choice on the current
 * node, rather than throwing or guessing: a stale click from a page that has
 * already moved on must not score, and must not take the student somewhere.
 *
 * The `isOver` guard is what makes this safe on content that was never
 * validated. `problemsWith` refuses a node keyed `end`, but this function does
 * not require that it was run — and without the guard, such a node would be
 * found by the lookup below and the run would continue past its own ending,
 * scoring for ever.
 */
export function choose(sim: Simulation, run: Run, index: number): Run {
  if (isOver(run)) return run;
  const node = sim.nodes.find((n) => n.key === run.at);
  if (!node) return run;
  const choice = node.choices[index];
  if (!choice) return run;

  return {
    at: choice.next,
    meters: { ...run.meters, ...(choice.effects ?? {}) },
    score: run.score + choice.score,
    taken: [...run.taken, { node: node.key, choice: index, score: choice.score }],
  };
}

/** The best score obtainable, for showing a result out of something. */
export function bestScore(sim: Simulation): number {
  /* The best single answer at every node that can be reached. Not the best
     path — a branching graph's best path is a longest-path problem, and this
     content always converges, so the sum over nodes is both right and
     explainable. Where it ever differs it over-states the maximum, which is
     the safe direction: a student can reach 100% but never exceed it. */
  let best = 0;
  for (const node of sim.nodes) {
    best += Math.max(0, ...node.choices.map((c) => c.score));
  }
  return best;
}

/** How far through, 0..1, by nodes answered rather than by score. */
export function progressOf(sim: Simulation, run: Run): number {
  if (sim.nodes.length === 0) return 0;
  return Math.min(1, run.taken.length / sim.nodes.length);
}
