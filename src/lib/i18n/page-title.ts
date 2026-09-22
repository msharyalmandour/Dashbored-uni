import type { Metadata } from "next";
import { getLocale } from "./get-locale";
import { getDictionary, type Dictionary } from "./dictionaries";

/**
 * A browser tab title in the student's own language.
 *
 * Every page declared its title as a hardcoded English string, so an Arabic
 * interface still sat in a tab reading "Tasks & Deadlines". A tab title is not
 * chrome a student ignores — it is what they scan when six tabs are open at
 * midnight, and it was the loudest remaining place the app spoke the wrong
 * language.
 *
 * It has to be `generateMetadata` rather than a `metadata` constant because the
 * locale lives in a cookie, which only an async function can read.
 *
 * The text comes from the navigation labels that already exist rather than a
 * second set of titles: the sidebar and the tab naming the same page
 * differently is its own small confusion, and two lists mean one of them drifts.
 */
export function pageTitle(pick: (dict: Dictionary) => string): () => Promise<Metadata> {
  return async () => {
    const dict = getDictionary(await getLocale());
    return { title: pick(dict) };
  };
}
