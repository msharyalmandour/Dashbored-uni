/**
 * No file may travel inside a Server Action.
 *
 * This exists because the same mistake was made twice, and the second time it
 * shipped and stayed shipped.
 *
 * A Server Action's request body is capped. This app sets 2MB in
 * next.config.ts, and the deployment platform refuses anything over 4.5MB
 * whatever the config says — a ceiling nothing in the application chose and no
 * setting lifts. It has nothing to do with what the storage bucket holds
 * (25MB) or with what a student actually has. A lecture deck is essentially
 * never under either number.
 *
 * The failure is unusually cruel. It happens in the framework, before any
 * application code runs, so there is no application error to catch and nothing
 * to translate: the request comes back 413 with "Body exceeded 2mb limit", the
 * spinner stops, and the dialog sits there saying nothing at all. A student
 * cannot tell that from a slow connection, so they wait, then reload, then
 * conclude the feature is broken — and they are right.
 *
 * Drop Anything was moved to the correct shape (browser → Storage with a
 * signed slot, see lib/upload-direct.ts) and the config comment was updated to
 * say "files do not travel this way". One entry point was missed, and it was
 * the one actually called "attach a lecture". A stale `createDocument` sat
 * beside it with no callers, still taking a `File`, still documented as the
 * path slides used — the next person wiring an upload would have reached
 * straight for it.
 *
 * So the rule is enforced rather than remembered: nothing exported from
 * src/app/actions may accept a File or a Blob. Text FormData is fine — a login
 * form is a few hundred bytes — but a file is not, ever.
 *
 * Run: npx tsx scripts/verify-uploads.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ACTIONS_DIR = join(process.cwd(), "src/app/actions");

let failures = 0;
function fail(label: string, detail: string) {
  failures++;
  console.error(`  FAIL  ${label}\n        ${detail}`);
}

/**
 * The opening of each exported async function, from its name to the `{` that
 * begins its body — which is exactly the span its parameters live in.
 *
 * A brace-counting scan rather than a TypeScript parse: the shape here is
 * known and ours, and a check that needs a compiler to run is a check that
 * stops being run.
 */
function exportedSignatures(source: string): { name: string; params: string }[] {
  const out: { name: string; params: string }[] = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")" && --depth === 0) break;
    }
    out.push({ name: m[1], params: source.slice(start + 1, i) });
  }
  return out;
}

/** `File`, `File[]`, `Blob` — as a type, not as part of a longer word. */
const CARRIES_A_FILE = /(^|[^A-Za-z0-9_])(File|Blob)(\s*\[\s*\])?(\s*[|,)&}]|\s*$)/;

const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"));
if (files.length === 0) throw new Error(`No action files found in ${ACTIONS_DIR}`);

console.log("Server Actions\n");

let checked = 0;
for (const file of files) {
  const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
  // Only files that actually declare themselves as Server Actions.
  if (!/^\s*["']use server["']/m.test(source)) continue;

  for (const { name, params } of exportedSignatures(source)) {
    checked++;
    // Strip comments so a sentence about files is not read as a signature.
    const declared = params.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    if (CARRIES_A_FILE.test(declared)) {
      fail(
        `${file} → ${name}()`,
        "takes a File or Blob. A Server Action's body is capped at 2MB here and 4.5MB\n" +
          "        on the platform, and the failure is a framework 413 with no message to\n" +
          "        show the student. Use requestUploadSlot + an attach action instead —\n" +
          "        see src/lib/upload-direct.ts."
      );
    }
  }
}

console.log(
  `  ${checked} exported Server Actions across ${files.length} files, and none of them\n` +
    "  accepts a File — every upload goes browser → Storage and only a path\n" +
    "  crosses the request body."
);

console.log("");
if (failures) {
  console.error(`${failures} failure${failures === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("All upload checks passed.");
