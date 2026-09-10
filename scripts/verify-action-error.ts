/**
 * Checks that nothing written for a developer ever reaches a student.
 *
 * This exists because of one screenshot. A drop failed, and what appeared in
 * the Arabic interface was:
 *
 *   Minified React error #441; visit https://react.dev/errors/441 for the full
 *   message or use the non-minified dev environment for full errors…
 *
 * That is React's placeholder for a server-side failure whose real message a
 * production build deliberately hides. It reached the screen because every
 * catch did `toast.error(err.message)` — right for the sentences this app
 * writes ("that file is too big"), and wrong for everything a framework
 * throws.
 *
 * Run with: npx tsx scripts/verify-action-error.ts
 */
import assert from "node:assert/strict";
import { studentFacingError } from "../src/lib/action-error";

const FALLBACK = "ما قدرت أرتّبه.";

const shown: [string, string][] = [
  ["That file is larger than 4 MB.", "our own size message"],
  ["Not found: Capture", "our own ownership message"],
  ["The AI account has no credit left. Add credit to continue.", "our own provider message"],
];

const hidden: [unknown, string][] = [
  [
    new Error(
      "Minified React error #441; visit https://react.dev/errors/441 for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    ),
    "React's production placeholder — the one that actually shipped",
  ],
  [
    new Error("An error occurred in the Server Components render. The specific message is omitted."),
    "Next's own withheld-message wording",
  ],
  [new Error("TypeError: x is not a function\n    at Object.<anonymous> (/app/.next/server/page.js:1:1)"), "a stack trace"],
  [new Error(""), "an empty message"],
  [new Error("x".repeat(400)), "a blob far too long to be a sentence"],
  ["a bare string, not an Error", "a non-Error throw"],
  [undefined, "nothing at all"],
];

let failures = 0;

for (const [message, why] of shown) {
  try {
    assert.equal(studentFacingError(new Error(message), FALLBACK), message);
    console.log(`  ok  shows ${why}`);
  } catch {
    failures += 1;
    console.log(`FAIL  should show ${why}: "${message}"`);
  }
}

for (const [thrown, why] of hidden) {
  try {
    assert.equal(studentFacingError(thrown, FALLBACK), FALLBACK);
    console.log(`  ok  hides ${why}`);
  } catch {
    failures += 1;
    console.log(`FAIL  should have hidden ${why}`);
  }
}

console.log("");
if (failures > 0) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log("Only sentences this app wrote reach the student.");
