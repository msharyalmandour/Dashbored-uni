/**
 * ARABIC DOES NOT HAVE ONE PLURAL, AND THE APP HAS BEEN PRETENDING IT DOES.
 *
 * Every counted phrase in the Arabic dictionary is written as if the noun has
 * a single form: "مستحق خلال {days} يوم" renders "خلال 4 يوم", and
 * "أجّلها {count} أيام" renders "أجّلها 1 أيام". Both are wrong, in opposite
 * directions, and neither is a typo — they are the same missing rule.
 *
 * Arabic counts in five buckets, not two:
 *
 *   0      no noun at all      "ما فيه أيام"
 *   1      the noun alone      يوم
 *   2      the DUAL            يومين        — the number is not written
 *   3-10   plural              ٤ أيام
 *   11+    singular accusative ١١ يومًا     — back to the singular form
 *
 * The 11+ bucket is the one that surprises people: the noun returns to its
 * singular shape, so "11 days" is يومًا and not أيام.
 *
 * This returns WHICH FORM to use, not the text, so the words stay in the
 * dictionaries where translators and the student can read them. English maps
 * every bucket but ONE and ZERO onto the same plural, which is why a single
 * `{days} days` string has always been enough there and never will be here.
 */
export type PluralForm = "zero" | "one" | "two" | "few" | "many";

/**
 * The bucket a count falls in.
 *
 * Negative counts are treated as their absolute value: a phrase like "3 days
 * overdue" is built from 3, and the sign belongs to the sentence rather than
 * to the grammar.
 */
export function pluralFormAr(count: number): PluralForm {
  const n = Math.abs(Math.trunc(count));
  if (n === 0) return "zero";
  if (n === 1) return "one";
  if (n === 2) return "two";
  /* 3-10 in every hundred: 103 days behaves like 3, not like 103. */
  const lastTwo = n % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return "few";
  return "many";
}

/** English has two buckets, and `zero` reads as the plural. */
export function pluralFormEn(count: number): PluralForm {
  return Math.abs(Math.trunc(count)) === 1 ? "one" : "many";
}

export function pluralForm(locale: "ar" | "en", count: number): PluralForm {
  return locale === "ar" ? pluralFormAr(count) : pluralFormEn(count);
}

/**
 * Pick the phrase for a count out of a bag of forms.
 *
 * Falls back along the chain many -> few -> one, so a dictionary that only
 * supplies the common forms still renders something grammatical-ish rather
 * than `undefined`. A missing string must never reach the screen.
 */
export function pick(forms: Partial<Record<PluralForm, string>>, form: PluralForm): string {
  return (
    forms[form] ??
    forms.many ??
    forms.few ??
    forms.one ??
    forms.two ??
    forms.zero ??
    ""
  );
}
