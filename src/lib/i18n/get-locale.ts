import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, locales, LOCALE_COOKIE, type Locale } from "./config";

/**
 * Which language to render in.
 *
 * The cookie wins, because a student who has used the switcher has said what
 * they want and nothing should argue with that. What changed is what happens
 * when there is no cookie — a first visit.
 *
 * It used to fall straight to English, and that was not a small default. An
 * Arabic-speaking student landed on an English interface, and Chrome offered
 * to translate it: "Capture" became "يأسر", "Home" became "بيت", "Academics"
 * became "الأكاديميون". The app has a complete, carefully written Arabic
 * dictionary and the student never saw a word of it — they saw a machine
 * translation of the English, which reads like a badly dubbed film.
 *
 * So a first visit now asks the browser. `Accept-Language` is the browser
 * saying, unprompted, which languages this person reads, and it is the closest
 * thing to knowing before they have told us.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  return negotiate((await headers()).get("accept-language"));
}

/**
 * The best supported language from an `Accept-Language` header.
 *
 * Exported so the rule can be tested: it decides what language a student's
 * very first impression is in, and "we fell back to English" is invisible in
 * code review and glaring on a phone.
 *
 * Quality values are honoured because that is what they are for — a browser
 * sending `en;q=0.9, ar;q=1.0` is saying it prefers Arabic, and reading the
 * list in order would get that exactly backwards.
 */
export function negotiate(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return {
        // "ar-SA" and "ar" are the same language for our purposes; only the
        // primary subtag decides which dictionary to use.
        base: tag.trim().toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (entry.base === "*") return defaultLocale;
    if ((locales as readonly string[]).includes(entry.base)) return entry.base as Locale;
  }
  return defaultLocale;
}
