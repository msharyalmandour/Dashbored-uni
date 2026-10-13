/**
 * How far through a lecture a student actually is.
 *
 * WHY THIS IS NOT THE LECTURE'S STATUS. A `Lecture` already carries one, and
 * on a thirty-three-slide lecture it says almost nothing: untouched, or
 * finished. A student three topics into twenty-one is neither, and the honest
 * answer — "7 of 21" — is the one that makes the next sitting feel possible.
 *
 * It is also what lets the daily dose stop saying "study lecture 2". That
 * sentence is the thing he has been avoiding all week; "three topics" is not.
 */

import { pick, pluralForm, type PluralForm } from "@/lib/i18n/plural";

export interface TopicProgress {
  done: number;
  total: number;
  /** 0..1, and 0 when there is nothing to be through. */
  fraction: number;
}

export function progressOf(done: number, total: number): TopicProgress {
  const safeTotal = Math.max(0, Math.floor(total) || 0);
  /* Clamped against its own total: a stale progress row for a topic that was
     deleted in a regeneration would otherwise read 22 of 21. */
  const safeDone = Math.min(safeTotal, Math.max(0, Math.floor(done) || 0));
  return {
    done: safeDone,
    total: safeTotal,
    fraction: safeTotal === 0 ? 0 : safeDone / safeTotal,
  };
}

/**
 * Which topics to study next.
 *
 * In the lecture's own order rather than by any cleverness: the sections build
 * on each other — Planning before Organizing before Controlling — and a dose
 * that hands him Controlling first is a dose he cannot do.
 */
export function nextTopics<T>(
  sections: T[],
  isDone: (section: T) => boolean,
  howMany: number
): T[] {
  if (howMany <= 0) return [];
  return sections.filter((s) => !isDone(s)).slice(0, howMany);
}

/**
 * "٧ من ٢١ موضوع" — counted in the student's own grammar.
 *
 * The word agrees with the TOTAL, not with how many are done: the sentence is
 * about a lecture of twenty-one topics, seven of which are read. Agreeing with
 * `done` gives "٢ من ٢١ موضوعان", which is a different and wrong claim.
 */
export function describeProgress(
  p: TopicProgress,
  locale: "ar" | "en",
  forms: Partial<Record<PluralForm, string>>,
  template: string
): string {
  return template
    .replace("{done}", String(p.done))
    .replace("{total}", String(p.total))
    .replace("{word}", pick(forms, pluralForm(locale, p.total)));
}
