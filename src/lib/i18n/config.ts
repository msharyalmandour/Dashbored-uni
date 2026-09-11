export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

export const localeLabel: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/**
 * The tag handed to `Intl` for dates and numbers.
 *
 * Not the same string as the locale itself, and the difference matters twice.
 *
 * `ar-SA` renders Arabic-Indic digits — ٢٢ أبريل — while every other number in
 * this app is a JavaScript number and comes out Western. A date reading ٢٢ next
 * to a count reading 12 on the same card is worse than either choice made
 * consistently, so plain `ar` is used: Arabic month names, Western digits.
 *
 * `ar-SA` also resolves to the Islamic calendar in some browsers, which would
 * quietly move every deadline in a university timetable that runs on the
 * Gregorian one. `ar` does not.
 */
export const localeTag: Record<Locale, string> = {
  en: "en-US",
  ar: "ar",
};

export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
