import en from "./dictionaries/en";
import ar from "./dictionaries/ar";
import type { Locale } from "./config";

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Simple `{placeholder}` interpolation for the handful of parameterized strings. */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
