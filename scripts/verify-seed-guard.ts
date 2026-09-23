/**
 * The seed script cannot erase a database someone is using.
 *
 * `prisma/seed.ts` deletes every row in fifteen tables, `user.deleteMany()`
 * among them — unscoped, cascading into every file, card and note a student
 * owns. That is correct for a scratch database and catastrophic anywhere else,
 * and until this guard existed nothing separated the two: `npm run seed` sits
 * in package.json, a developer's .env routinely holds the production
 * DATABASE_URL, and one command would have taken a real account with no
 * confirmation and no undo.
 *
 * Nothing here runs the seed. The script is executed as a child process with a
 * DATABASE_URL pointed at hosts it must refuse, and the assertion is that it
 * exits non-zero having printed why — before Prisma opens a connection.
 *
 * Run: npx tsx scripts/verify-seed-guard.ts
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Runs the seed against a database URL, without letting it reach one. */
function seedAgainst(databaseUrl: string | undefined, extra: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  if (databaseUrl === undefined) delete env.DATABASE_URL;
  else env.DATABASE_URL = databaseUrl;
  // Never inherited: a real key here would let a refusing run still connect.
  delete env.DIRECT_URL;

  const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    env,
    encoding: "utf8",
    timeout: 60_000,
  });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

console.log("Seed guard\n");

const REMOTE = [
  ["a Supabase project", "postgresql://u:p@db.tlkebxkjghzytdbulzwj.supabase.co:5432/postgres"],
  ["a pooled Supabase connection", "postgresql://u:p@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"],
  ["some other managed host", "postgresql://u:p@prod-db.internal.example.com:5432/app"],
  ["an IP that is not loopback", "postgresql://u:p@10.0.0.7:5432/app"],
] as const;

/** The host, as the refusal should print it. */
function hostOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "5432"}`;
}

for (const [what, url] of REMOTE) {
  check(`it refuses ${what}`, () => {
    const { code, out } = seedAgainst(url);
    assert.notEqual(code, 0, `it ran against ${url}`);
    assert.match(out, /Refusing to seed/, out.slice(0, 300));

    /* It stopped BEFORE touching the database, not after failing to reach it.
       A guard that prints its refusal and then carries on looks identical
       here — the run still exits non-zero, because Prisma cannot connect — and
       is the one shape that still wipes a database it CAN reach. Prisma says
       so in its own words when it gets that far, so the absence of those words
       is the evidence that it never did. */
    assert.doesNotMatch(
      out,
      /PrismaClient|Can't reach database|P1001|P1000|ECONNREFUSED|getaddrinfo/i,
      `it tried to connect:\n${out.slice(0, 400)}`
    );

    /* The host is named. A refusal that will not say which database it is
       protecting is one somebody overrides blind. */
    assert.ok(
      out.includes(hostOf(url)),
      `the refusal never named ${hostOf(url)}:\n${out.slice(0, 400)}`
    );
  });
}

check("it refuses when the connection string is empty", () => {
  /* Named for what it actually tests. The first version of this check unset
     DATABASE_URL and claimed to cover "no URL at all" — but dotenv then loads
     .env, so the script saw a perfectly good production URL and refused for
     the ordinary reason. The check passed and its label was a lie, which is
     worse than no check: a mutation that made an absent URL count as safe went
     straight through it. An empty string is set, so dotenv leaves it alone. */
  const { code, out } = seedAgainst("");
  assert.notEqual(code, 0);
  assert.match(out, /Refusing to seed/, out.slice(0, 300));
});

check("a .env holding production credentials does not get past it", () => {
  /* The real configuration of this repository, and the reason the guard
     exists. `.env` here carries the production DATABASE_URL, so unsetting the
     variable changes nothing: `npm run seed` from a normal checkout pointed
     straight at the student's live database. */
  const { code, out } = seedAgainst(undefined);
  assert.notEqual(code, 0, "it ran against whatever .env supplies");
  assert.match(out, /Refusing to seed/, out.slice(0, 300));
  assert.doesNotMatch(out, /localhost|127\.0\.0\.1/, "the fallback URL was local — re-check this on a real checkout");
});

check("it refuses a DATABASE_URL it cannot parse", () => {
  const { code, out } = seedAgainst("not a url at all");
  assert.notEqual(code, 0);
  assert.match(out, /Refusing to seed/, out.slice(0, 300));
});

check("the refusal names the override, so nobody has to guess", () => {
  const { out } = seedAgainst(REMOTE[0][1]);
  assert.match(out, /SEED_ERASE_REMOTE=/, out.slice(0, 400));
});

check("a wrong override value is still a refusal", () => {
  const { code, out } = seedAgainst(REMOTE[0][1], { SEED_ERASE_REMOTE: "yes" });
  assert.notEqual(code, 0, "a casual 'yes' was accepted");
  assert.match(out, /Refusing to seed/, out.slice(0, 300));
});

check("the destructive block is still behind the guard in the source", () => {
  /* Belt and braces on the ordering: the guard is only a guard if it runs
     before the transaction. A refactor that moves the delete above it would
     leave every test above passing and the database gone. */
  const src = readFileSync("prisma/seed.ts", "utf8");
  const guard = src.indexOf("refuseUnlessDisposable();");
  const wipe = src.indexOf("prisma.user.deleteMany()");
  assert.ok(guard > 0, "the guard is not called at all");
  assert.ok(wipe > 0, "the wipe moved — re-point this check");
  assert.ok(guard < wipe, "the wipe now runs before the guard");
});

check("localhost is still allowed, or the script is useless", () => {
  // The guard must not be so broad that nobody can seed a dev database. This
  // gets past the refusal and fails later, on the connection.
  const { out } = seedAgainst("postgresql://u:p@localhost:5999/nope");
  assert.doesNotMatch(out, /Refusing to seed/, out.slice(0, 300));
});

console.log("");
console.log(failures === 0 ? "The seed script cannot reach a real database." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
