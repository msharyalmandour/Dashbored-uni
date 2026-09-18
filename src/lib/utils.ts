import { localeTag, type Locale } from "@/lib/i18n/config";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A date, in the language the student is reading.
 *
 * The locale is a required argument and has no default on purpose. It used to
 * be hardcoded to "en-US" here — one line, in the one formatter the whole app
 * shares — so every date on every page came out in English however the
 * interface was set. An Arabic app with "Apr 22" scattered through it does not
 * read as a small bug to a student; it reads as an app that is not really in
 * their language. A default value is exactly how that happened, so there is
 * none: a caller that has not thought about the locale will not compile.
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  opts?: Intl.DateTimeFormatOptions
) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(localeTag[locale], opts ?? { month: "short", day: "numeric" });
}

/**
 * The human-facing date shapes, all through `Intl` and all taking a locale.
 *
 * These replace `date-fns` `format` at the places a person reads the result.
 * date-fns is still right for keys like "yyyy-MM-dd" — those are machine
 * strings and must not change with the language — but its month and weekday
 * names are English unless a locale object is threaded to every call site, and
 * one forgotten call is a month name in the wrong language on an otherwise
 * Arabic page. Routing every readable date through here leaves one place to be
 * right, and the required `locale` argument means a new caller cannot skip it.
 */
export function formatMonthYear(date: Date, locale: Locale) {
  return date.toLocaleDateString(localeTag[locale], { month: "long", year: "numeric" });
}

export function formatDayMonth(date: Date, locale: Locale) {
  return date.toLocaleDateString(localeTag[locale], { month: "short", day: "numeric" });
}

export function formatWeekdayDay(date: Date, locale: Locale) {
  return date.toLocaleDateString(localeTag[locale], { weekday: "short", day: "numeric" });
}

export function daysBetween(a: Date, b: Date) {
  const MS = 1000 * 60 * 60 * 24;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end.getTime() - start.getTime()) / MS);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function pct(value: number) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}
