/**
 * THE SITE TALKS LIKE A FRIEND WHO IS A YEAR AHEAD OF HIM.
 *
 * VOICE.md, the owner's standing instruction of 2026-10-14, is specific about
 * this and it is not a preference: the interface was written in formal
 * newsreader Arabic — "تم إنشاء المهمة", "لا توجد بطاقات بعد", "أسقط أي شيء" —
 * and he is a Saudi nursing student reading it at midnight after a clinical
 * shift. Formal Arabic is not more correct here, it is a different language
 * from the one he thinks in.
 *
 * ITS CHECKLIST NAMES FIVE WORDS, so this is the checklist made executable.
 * Prose in a markdown file gets read once; this runs every time.
 *
 * WHY VALUES AND NOT THE WHOLE FILE. The comments in ar.ts are written for
 * whoever maintains it, in the vocabulary of the codebase — "الإسقاط" there
 * means the drop FEATURE, and renaming it inside an explanation would make the
 * explanation wrong. Only what the student can actually read is held to this.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n").slice(0, 8).join("\n        ")}`);
  }
}

console.log("صوت الموقع");
console.log("");

const raw = readFileSync(join(process.cwd(), "src/lib/i18n/dictionaries/ar.ts"), "utf8");

/** Some values are stored as \uXXXX; the scan has to see the real letters. */
const unescaped = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
  String.fromCharCode(Number.parseInt(h, 16))
);

/**
 * Every quoted value in the file, with its line, skipping comment lines.
 *
 * Deliberately crude: a real parser would be better and this cannot miss a
 * string by failing to understand the syntax, which is the failure that
 * matters. A comment line that slips through can only produce a false
 * failure, never a false pass.
 */
function values(): { line: number; key: string; text: string }[] {
  const out: { line: number; key: string; text: string }[] = [];
  unescaped.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    const key = /(\w+):/.exec(trimmed)?.[1] ?? "?";
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      out.push({ line: i + 1, key, text: m[1] });
    }
  });
  return out;
}

/* The five the checklist names, each with what to say instead. "تم" needs a
   boundary or it fires inside تمريض, المعتمدة and يتم. */
const BANNED: { what: string; re: RegExp; instead: string }[] = [
  { what: "تم", re: /(?<![\w؀-ۿ])تم(?![\w؀-ۿ])/, instead: "انضاف / انحفظ / سجّلناها ✓" },
  { what: "لا توجد / لا يوجد", re: /لا\s+(توجد|يوجد)/, instead: "ما عندك … + الخطوة الجاية" },
  { what: "يرجى", re: /يرجى/, instead: "a plain imperative" },
  { what: "قم بـ", re: /قم\s*ب/, instead: "the verb on its own" },
  { what: "أسقط / إسقاط", re: /[أإا]سقط|إسقاط/, instead: "ارمِ" },
  { what: "التقاط / التقط", re: /التقاط|التقط/, instead: "أضف" },
];

check("NOT ONE BANNED WORD REACHES THE SCREEN", () => {
  const hits = values().flatMap((v) =>
    BANNED.filter((b) => b.re.test(v.text)).map(
      (b) => `ar.ts:${v.line} ${v.key} — "${b.what}" in ${JSON.stringify(v.text.slice(0, 48))} → ${b.instead}`
    )
  );
  assert.deepEqual(hits, [], `${hits.length} banned:\n${hits.join("\n")}`);
});

check("the scan actually reads the dictionary, rather than nothing", () => {
  /* Guard the guard: a regex that matches no line, or a file that moved,
     would make the check above pass by reading an empty list. */
  const all = values();
  assert.ok(all.length > 400, `only ${all.length} values read — the file or the scan moved`);
  assert.ok(
    all.some((v) => /[؀-ۿ]/.test(v.text)),
    "no Arabic found at all — the unescaping is broken"
  );
});

check("THE WORDS HE USES ARE THE WORDS ON SCREEN", () => {
  /* The replacements VOICE.md names by hand. Not a style preference: each of
     these is the word a student says out loud, against the word a university
     brochure prints. */
  for (const [phrase, where] of [
    ["ما عندك حساب؟", "auth.noAccount"],
    ["هلا فيك", "auth.signInTitle"],
    ["موادي", "nav academics"],
    ["ارمِ ملف", "nav inbox"],
    ["المستشفى", "nav clinical"],
    ["صار شي غلط من عندنا، جرّب مرة ثانية", "auth.genericError"],
  ] as const) {
    assert.ok(unescaped.includes(phrase), `"${phrase}" is gone from ${where}`);
  }
});

check("AN EMPTY SCREEN OFFERS THE NEXT STEP, IT DOES NOT JUST REPORT NOTHING", () => {
  /* Rule 6: "ما عندك بطاقات" on its own is a dead end. Every empty state a
     student lands on has to say what to do about it. */
  for (const key of ["noFlashcardsYet", "noVideosYet", "academicsEmpty", "notesEmpty"]) {
    const found = values().find((v) => v.key === key);
    assert.ok(found, `${key} is gone`);
    assert.ok(
      /ارمِ|سوّ|أضف|اضغط/.test(found.text),
      `${key} says what is missing but not what to do: ${JSON.stringify(found.text)}`
    );
  }
});

/* ── mutations ──────────────────────────────────────────────────────────── */

function mutationBites(name: string, probe: () => void) {
  try {
    probe();
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites("putting a formal toast back", () => {
  const banned = BANNED.find((b) => b.what === "تم");
  assert.ok(banned && !banned.re.test("تم إنشاء المهمة"));
});

mutationBites("matching تم without a word boundary, which fires on تمريض", () => {
  /* The naive version flags "تمريض", "المعتمدة" and "يتم", so it would have
     to be weakened until it caught nothing. */
  assert.ok(!/تم/.test("تمريض حرج"));
});

mutationBites("scanning comments as if they were screen copy", () => {
  /* ar.ts explains the drop feature in its own comments; a scan that read
     them would force the explanation to be renamed into nonsense. */
  const comment = '     /* الخطأ يأتي من إجابة خاطئة أو من إسقاط */';
  const trimmed = comment.trim();
  assert.ok(!(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")));
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("الموقع يتكلم زي صاحبه، مو زي نشرة الأخبار.");
}
