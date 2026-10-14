/**
 * The two numbers the موادي header states, and neither is invented.
 *
 * The approved header reads "الفصل الأول · 1448هـ · 6 مواد". The term's name
 * and its course count come straight out of the database; the Hijri year does
 * not exist in any column, and the temptation is to hard-code the one that
 * happens to be current. It is DERIVED from the term's own start date, so a
 * term that starts in another year says that year and nobody has to remember
 * to change a constant in July.
 */

/**
 * The Hijri year the term starts in, as digits.
 *
 * `formatToParts` rather than `format`: the formatted string carries an era
 * ("1448 هـ", "1448 AH") and the header template already writes the era
 * itself, so taking the whole string would print it twice.
 */
export function hijriYear(date: Date): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US-u-ca-islamic-nu-latn", {
    year: "numeric",
  }).formatToParts(date);
  return parts.find((p) => p.type === "year")?.value ?? null;
}

/**
 * How much of the term has gone, 0..1 — the bar under the countdown.
 *
 * NULL RATHER THAN A GUESS when the dates cannot carry it. A bar drawn at an
 * invented width under a real countdown is the kind of thing that looks like
 * data and is not, and this one sits directly beneath the single number the
 * whole screen is built around.
 *
 * Clamped at both ends because a term that has ended is 1, not 1.4, and a
 * term that has not started is 0, not negative — a negative width renders as
 * an empty track that reads as "no progress recorded" instead of "not yet".
 */
export function termProgress(start: Date, end: Date, now: Date): number | null {
  const a = start?.getTime?.();
  const b = end?.getTime?.();
  const t = now?.getTime?.();
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(t)) return null;
  /* Equal dates would divide by zero; reversed ones are a data error, and
     drawing 0% for them would hide it behind something that looks normal. */
  if (b <= a) return null;
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}
