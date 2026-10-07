/**
 * What each thing in a course is worth.
 *
 * ── WHY THIS IS A MODULE AND NOT A REGEX ────────────────────────────────────
 *
 * Read out of the owner's own two syllabi on 2026-10-07. Both carry ten lines
 * containing a percentage, and in both of them **most of those lines are not
 * grade weights**:
 *
 *     Clinical Evaluation 30%                        <- a weight
 *     Problem Solving project 10%                    <- a weight
 *     Excessive absences ... more than 25% ... "F"   <- a grade cap
 *     attend all clinical experiences, 50% of the…   <- an attendance rule
 *     Total 100%                                     <- a sum, not a part
 *
 * So "find the percentages" is not the problem; telling a weight from a number
 * that merely has a percent sign next to it is. Pulled in by pattern, a
 * student's course would be priced with a 25% absence threshold as though it
 * were a quarter of their grade.
 *
 * ── THE RULE THAT DOES THE WORK ─────────────────────────────────────────────
 *
 * **A set of weights is the set that sums to 100.** Everything else in the
 * document is something else, whatever it looks like. It held exactly in both
 * syllabi, and the arithmetic is what proves the table was read whole rather
 * than sampled:
 *
 *     NURC 411   Semester work 60  +  Final 40                      = 100
 *                of which 60:  Clinical 30 + Problem 10 + Docs 20   =  60
 *     NURC 410   Semester Work 60  +  Final 40                      = 100
 *                of which 60:  Midterm 30 + CBL 20 + MCQs 10        =  60
 *
 * A reading that does not add up has either missed a row or taken one that is
 * not a weight, and in both cases the honest outcome is to say so rather than
 * store a course priced to 85% or 130%. A number nobody checked is exactly how
 * the academic-health score — a weighted average that substituted 70 and 80
 * wherever an axis had no data — survived for weeks.
 *
 * ── WEIGHTS ARE OF THE COURSE, NOT OF THE PARENT ────────────────────────────
 *
 * In NURC 411, Clinical Evaluation is 30% and its parent, Semester work, is
 * 60%. 30 is thirty per cent **of the course**, not of the 60 — which the
 * arithmetic above settles: the three children sum to 60, their parent, and
 * not to 100. Storing it the other way would make the one figure a student
 * actually wants ("what is this worth to me") a calculation rather than a
 * value, and the first thing to get it wrong would be the orb.
 */

/** One graded thing. `parent` groups it; `weight` is percent OF THE COURSE. */
export interface Component {
  label: string;
  weight: number;
  /** The label of the thing it sits under, or null for a top-level row. */
  parent: string | null;
}

/** 0.01 — a tenth of the smallest weight either syllabus uses, so rounding in
 *  a float sum can never be mistaken for a missing row. */
const TOLERANCE = 0.01;

export type GradeProblem =
  | { kind: "EMPTY" }
  | { kind: "NOT_100"; total: number }
  | { kind: "CHILDREN_MISMATCH"; parent: string; parentWeight: number; childrenTotal: number }
  | { kind: "UNKNOWN_PARENT"; label: string; parent: string }
  | { kind: "DUPLICATE_LABEL"; label: string }
  | { kind: "BAD_WEIGHT"; label: string; weight: number }
  | { kind: "CYCLE"; label: string };

/**
 * Everything wrong with a proposed set of weights, or an empty list.
 *
 * Returns every problem rather than the first, because a half-read table
 * usually has two — a missed row and the total that no longer adds up — and
 * reporting one at a time turns a single fix into three round trips with the
 * model.
 */
export function problemsWith(components: Component[]): GradeProblem[] {
  const problems: GradeProblem[] = [];

  if (components.length === 0) return [{ kind: "EMPTY" }];

  // A weight outside 0–100 is not a share of anything. Zero is allowed and is
  // sometimes real: a syllabus can list an ungraded requirement.
  for (const c of components) {
    if (!Number.isFinite(c.weight) || c.weight < 0 || c.weight > 100) {
      problems.push({ kind: "BAD_WEIGHT", label: c.label, weight: c.weight });
    }
  }

  const seen = new Set<string>();
  for (const c of components) {
    if (seen.has(c.label)) problems.push({ kind: "DUPLICATE_LABEL", label: c.label });
    seen.add(c.label);
  }

  for (const c of components) {
    if (c.parent !== null && !seen.has(c.parent)) {
      problems.push({ kind: "UNKNOWN_PARENT", label: c.label, parent: c.parent });
    }
  }

  // A row that is its own ancestor would make both sums below loop forever.
  // Cheaper to refuse than to defend against downstream.
  const parentOf = new Map(components.map((c) => [c.label, c.parent]));
  for (const c of components) {
    const walked = new Set<string>([c.label]);
    let at = c.parent;
    while (at !== null && at !== undefined) {
      if (walked.has(at)) {
        problems.push({ kind: "CYCLE", label: c.label });
        break;
      }
      walked.add(at);
      at = parentOf.get(at) ?? null;
    }
  }

  if (problems.length > 0) return problems;

  // THE RULE: the top level sums to the course.
  const roots = components.filter((c) => c.parent === null);
  const total = roots.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(total - 100) > TOLERANCE) problems.push({ kind: "NOT_100", total });

  // And each group sums to the row above it. This is the half that catches a
  // missed child, which the 100 check alone cannot see.
  for (const parent of components) {
    const children = components.filter((c) => c.parent === parent.label);
    if (children.length === 0) continue;
    const childrenTotal = children.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(childrenTotal - parent.weight) > TOLERANCE) {
      problems.push({
        kind: "CHILDREN_MISMATCH",
        parent: parent.label,
        parentWeight: parent.weight,
        childrenTotal,
      });
    }
  }

  return problems;
}

export function isSound(components: Component[]): boolean {
  return problemsWith(components).length === 0;
}

/**
 * The problems, in the student's language, as one line each.
 *
 * Written for the orb to read back and act on, so each line says what is wrong
 * and what would fix it — "the parts add up to 85, so a row is missing" is
 * actionable; "invalid" is not.
 */
export function describeProblem(p: GradeProblem): string {
  switch (p.kind) {
    case "EMPTY":
      return "No graded components were found at all.";
    case "NOT_100":
      return `The top-level parts add up to ${round(p.total)}%, not 100%. ${
        p.total < 100 ? "A row is missing" : "Something was counted that is not a weight"
      } — re-read the assessment table.`;
    case "CHILDREN_MISMATCH":
      return `"${p.parent}" is ${round(p.parentWeight)}% but the parts under it add up to ${round(
        p.childrenTotal
      )}%. Weights are a share of the whole course, not of the row above.`;
    case "UNKNOWN_PARENT":
      return `"${p.label}" sits under "${p.parent}", which is not one of the rows.`;
    case "DUPLICATE_LABEL":
      return `"${p.label}" appears twice. Each graded thing is one row.`;
    case "BAD_WEIGHT":
      return `"${p.label}" is ${p.weight}%, which is not a share of a grade.`;
    case "CYCLE":
      return `"${p.label}" is listed under itself.`;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ────────────────────────────────────────────────────────────────────────────
   Reading a sound set
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The heaviest things first, parents excluded.
 *
 * Parents are left out because they are containers, not work: "Semester work
 * 60%" is not a thing a student can go and do, and putting it at the top of a
 * list of what matters most pushes the four things they CAN do below it.
 *
 * Ties keep their original order, which is the syllabus's own order and a
 * better tiebreak than anything invented here.
 */
export function heaviestFirst(components: Component[]): Component[] {
  const parents = new Set(components.map((c) => c.parent).filter((p): p is string => p !== null));
  return components
    .filter((c) => !parents.has(c.label))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.weight - a.c.weight || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * How much of the course one group is worth, counting only the leaves.
 *
 * Used for the question the owner's own syllabus raised: NURC 411's final IS
 * the OSCE and OSPE, and Clinical Evaluation is a separate 30%, so "how much
 * of this course is clinical" is 70 — a number no single row carries.
 */
export function weightOf(components: Component[], labels: string[]): number {
  const wanted = new Set(labels);
  const parents = new Set(components.map((c) => c.parent).filter((p): p is string => p !== null));
  return components
    .filter((c) => wanted.has(c.label) && !parents.has(c.label))
    .reduce((sum, c) => sum + c.weight, 0);
}
