import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

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
 * It then asked the browser instead, which fixed that case and left another:
 * `Accept-Language` on a phone or an iPad is usually whatever the device was
 * set up in, and an Arabic-speaking student with an English-configured iPad
 * still landed on English — which is exactly what the owner reported.
 *
 * So the browser no longer gets to choose. This app is Arabic: ar.ts is the
 * dictionary that is written and re-written, the type scale carries
 * `:lang(ar)` sizes of its own, and the document is RTL. English is the
 * translation. A first visit is Arabic, and English is one tap away in the
 * switcher — where choosing it writes the cookie, which still wins over
 * everything here.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  /* No cookie: Arabic. `negotiate` is kept and still tested — it is the right
     rule for a product with no first language, and this one has one. */
  return defaultLocale;
}
