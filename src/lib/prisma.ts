import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Warns, once, when DATABASE_URL points at a Supabase transaction-pooler
 * host without `pgbouncer=true`.
 *
 * That flag tells Prisma's query engine to stop using named prepared
 * statements. Without it, the pooler's transaction mode hands each
 * statement to a different backend connection, so a statement prepared on
 * one backend is missing on the next — surfacing as intermittent
 * `prepared statement "sNN" does not exist` errors from Postgres. Those are
 * easy to misread as a database or code bug when the real cause is one
 * missing query parameter in an environment variable, so this makes the
 * misconfiguration visible in the Vercel function logs immediately rather
 * than after a multi-day investigation.
 */
function warnIfPoolerMissingPgbouncerFlag() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  try {
    const url = new URL(raw);
    const isTransactionPooler = url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";
    if (isTransactionPooler && url.searchParams.get("pgbouncer") !== "true") {
      console.error(
        "[prisma] DATABASE_URL points at the Supabase transaction pooler (port 6543) " +
          'but is missing "?pgbouncer=true". This will cause intermittent ' +
          '"prepared statement does not exist" errors under concurrent queries. ' +
          "Add pgbouncer=true to the connection string's query parameters."
      );
    }
  } catch {
    // Not a parseable URL — Prisma will raise its own clear error on connect.
  }
}

warnIfPoolerMissingPgbouncerFlag();

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
