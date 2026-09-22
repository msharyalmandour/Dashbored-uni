/**
 * The app speaking one language at a time.
 *
 * A student reported that "the language changed completely", and they were
 * right: the interface was Arabic while every date, every browser tab title and
 * the whole error screen were English. None of it was a translation that had
 * been missed — it was a handful of places where the language was decided by a
 * hardcoded string instead of by the student's setting.
 *
 * These checks exist because that class of bug is invisible in code review. A
 * date formatter with an "en-US" default compiles, passes types, renders, and
 * is wrong on every page at once.
 *
 * Run: npx tsx scripts/verify-language.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatDate, formatDayMonth, formatMonthYear } from "../src/lib/utils";
import en from "../src/lib/i18n/dictionaries/en";
import ar from "../src/lib/i18n/dictionaries/ar";
import { negotiate } from "../src/lib/i18n/get-locale";
import { defaultLocale } from "../src/lib/i18n/config";

let failures = 0;

function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const FILES = walk("src");

function main() {
  console.log("\nOne language at a time\n");

  check("a date is written in the language being read", () => {
    const d = new Date("2026-04-22T10:00:00Z");
    assert.equal(formatDate(d, "en"), "Apr 22");
    // Arabic month name, Western digits — the digits matter: every other number
    // on the same card is a JavaScript number and comes out Western, and one
    // date reading ٢٢ beside a count reading 12 is worse than either choice
    // made consistently.
    const arabic = formatDate(d, "ar");
    assert.ok(/أبريل/.test(arabic), `expected an Arabic month, got ${arabic}`);
    assert.ok(/22/.test(arabic), `expected Western digits, got ${arabic}`);
  });

  check("the Gregorian calendar is kept", () => {
    // ar-SA resolves to the Islamic calendar in some browsers, which would move
    // every deadline in a timetable that runs on the Gregorian one.
    const d = new Date("2026-04-22T10:00:00Z");
    assert.ok(/2026/.test(formatMonthYear(d, "ar")), formatMonthYear(d, "ar"));
    assert.ok(/أبريل/.test(formatDayMonth(d, "ar")));
  });

  check("no date formatter decides the language for itself", () => {
    // The original bug, in one line: a hardcoded locale inside the formatter
    // the whole app shares. A default would let the next one be added the same
    // way, so there is none — and none is allowed to creep back.
    const offenders: string[] = [];
    for (const file of FILES) {
      if (file.endsWith("i18n/config.ts")) continue;
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        if (line.trim().startsWith("*") || line.trim().startsWith("//")) return;
        if (/toLocaleDateString\(\s*["'`]/.test(line) || /toLocaleTimeString\(\s*["'`]/.test(line)) {
          offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    assert.deepEqual(offenders, [], `hardcoded locale at:\n${offenders.join("\n")}`);
  });

  check("every page names its tab in the student's language", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (!file.endsWith("page.tsx")) continue;
      const src = readFileSync(file, "utf8");
      if (/export const metadata\s*=\s*\{\s*title:\s*"/.test(src)) offenders.push(file);
    }
    // A tab title is not chrome a student ignores: it is what they scan when
    // six tabs are open at midnight.
    assert.deepEqual(offenders, [], `English tab title at:\n${offenders.join("\n")}`);
  });

  check("the two dictionaries say the same things", () => {
    // `const ar: typeof en` already enforces this at compile time; this catches
    // the other half — a key that exists in both but was never translated.
    const flatten = (obj: unknown, prefix = ""): Record<string, string> => {
      const out: Record<string, string> = {};
      if (!obj || typeof obj !== "object") return out;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof v === "string") out[`${prefix}${k}`] = v;
        // Null and undefined are legitimate in these dictionaries (an optional
        // string that a locale deliberately leaves unset); recursing into one
        // is what crashed the first run of this check.
        else if (v && typeof v === "object") Object.assign(out, flatten(v, `${prefix}${k}.`));
      }
      return out;
    };

    const e = flatten(en);
    const a = flatten(ar);

    // Guard the guard. The first version of this check imported the
    // dictionaries by the wrong name, so both sides were undefined, both
    // flattened to nothing, and it passed while comparing two empty objects.
    assert.ok(Object.keys(e).length > 200, `only ${Object.keys(e).length} keys read — the import is wrong`);
    assert.equal(Object.keys(e).length, Object.keys(a).length);
    /**
     * Keys that are the same in both languages on purpose.
     *
     * An allowlist rather than a looser rule: each entry is a decision with a
     * reason, and anything new that matches has to be argued for here instead
     * of slipping through a widened pattern.
     */
    const SAME_ON_PURPOSE = new Set([
      // The product's name. Translating a brand is not localisation.
      "shell.appName",
      // A course-code example. Codes are Latin on a Saudi transcript too, so
      // "NURC 410" is what the student will actually type.
      "forms.egSubjectCode",
    ]);

    const untranslated = Object.keys(e).filter((k) => {
      if (SAME_ON_PURPOSE.has(k)) return false;
      const value = a[k];
      if (value === undefined) return true;
      // Identical is only suspicious when the English has letters to translate.
      // "min", a brand name or a bare "{count}" legitimately match.
      return value === e[k] && /[a-z]{4}/i.test(value) && !/^\{[^}]+\}$/.test(value);
    });

    assert.deepEqual(untranslated, [], `still English in the Arabic dictionary:\n${untranslated.join("\n")}`);
  });

  check("a first visit asks the browser which language it reads", () => {
    // The bug this exists to stop: `defaultLocale` was English and nothing
    // consulted the browser, so an Arabic-speaking student landed on an
    // English interface and Chrome offered to translate it. The app has a
    // complete Arabic dictionary; the student never saw a word of it.
    assert.equal(negotiate("ar,en-US;q=0.9,en;q=0.8"), "ar", "an Arabic browser must get Arabic");
    assert.equal(negotiate("ar-SA"), "ar", "a region subtag is still Arabic");
    assert.equal(negotiate("AR-sa"), "ar", "the header is case-insensitive");
    assert.equal(negotiate("en-GB,en;q=0.9"), "en", "an English browser still gets English");
  });

  check("quality values decide, not the order they are written in", () => {
    // Read in order, this header says English. Read correctly, it says the
    // browser would much rather have Arabic. Getting this backwards is
    // invisible in review and glaring on a phone.
    assert.equal(negotiate("en;q=0.4, ar;q=0.9"), "ar");
    assert.equal(negotiate("fr;q=1.0, ar;q=0.7, en;q=0.6"), "ar", "skip languages we do not have");
    assert.equal(negotiate("ar;q=0"), defaultLocale, "q=0 means explicitly not this one");
  });

  check("an absent or unusable header falls back rather than throwing", () => {
    for (const header of [null, undefined, "", "   ", ",,,", "*", "zz-ZZ"]) {
      assert.equal(negotiate(header), defaultLocale, `header ${JSON.stringify(header)}`);
    }
  });

  console.log("");
  if (failures > 0) {
    console.log(`${failures} failed.\n`);
    process.exit(1);
  }
  console.log("The interface speaks one language at a time.\n");
}

main();
