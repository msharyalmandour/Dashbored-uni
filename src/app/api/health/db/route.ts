import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";

/**
 * Connection diagnostics for the deployed environment.
 *
 * When the app fails in production the useful detail — the Prisma error
 * code, whether the URL is actually pointing at the pooler, how long a
 * trivial query takes — is only visible in platform logs. This endpoint
 * puts that same detail behind a signed-in request so it can be read
 * without log access.
 *
 * It is deliberately narrow about what it reveals. It never returns the
 * connection string, the host, the project ref, the username or the
 * password; only the shape of the configuration (port, whether the host is
 * a pooler host, which flags are set) plus the error code of a failed
 * query. Everything returned here is either a boolean, a small integer, or
 * a Prisma error code.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Describes DATABASE_URL without disclosing any part of it. */
function describeConnection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { configured: false as const };

  try {
    const u = new URL(raw);
    const params = u.searchParams;
    return {
      configured: true as const,
      port: u.port || "(default)",
      isPoolerHost: u.hostname.endsWith(".pooler.supabase.com"),
      isDirectSupabaseHost: u.hostname.startsWith("db.") && u.hostname.endsWith(".supabase.co"),
      // The transaction pooler requires a tenant-qualified username
      // ("postgres.<project-ref>"). We report only whether it looks
      // qualified, never the value itself.
      usernameLooksTenantQualified: decodeURIComponent(u.username).includes("."),
      pgbouncer: params.get("pgbouncer"),
      connectionLimit: params.get("connection_limit"),
      poolTimeout: params.get("pool_timeout"),
    };
  } catch {
    return { configured: true as const, parseable: false as const };
  }
}

/** Prisma errors carry a stable `code`; everything else is classified loosely. */
function describeError(error: unknown) {
  const e = error as { code?: unknown; name?: unknown; message?: unknown };
  const code = typeof e?.code === "string" ? e.code : undefined;
  const name = typeof e?.name === "string" ? e.name : "Error";

  const hints: Record<string, string> = {
    P1000: "Authentication failed. Check the username and password. The transaction pooler needs the tenant-qualified username postgres.<project-ref>.",
    P1001: "The database host is unreachable from this runtime.",
    P1002: "The database host was reached but timed out while connecting.",
    P1017: "The server closed the connection.",
    P2024: "Timed out waiting for a connection from Prisma's pool. connection_limit is too low for how many queries this page runs in parallel.",
  };

  return {
    name,
    code: code ?? null,
    likelyCause: code ? (hints[code] ?? null) : null,
  };
}

export async function GET() {
  // Signed-in only. This reports nothing sensitive, but it also has no
  // reason to be readable by anyone who is not using the app.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const connection = describeConnection();

  // A single trivial round trip: this isolates "can we talk to the
  // database at all" from anything about the app's own queries.
  const startedAt = Date.now();
  let simpleQuery: Record<string, unknown>;
  try {
    await prisma.$queryRaw`SELECT 1`;
    simpleQuery = { ok: true, durationMs: Date.now() - startedAt };
  } catch (error) {
    simpleQuery = { ok: false, durationMs: Date.now() - startedAt, ...describeError(error) };
  }

  // A realistic parallel burst. The dashboard fans out to roughly 25
  // concurrent queries, so a configuration that survives one query can
  // still fail here — which is exactly the failure mode a low
  // connection_limit produces.
  const burstStartedAt = Date.now();
  let parallelBurst: Record<string, unknown>;
  try {
    await Promise.all(Array.from({ length: 25 }, () => prisma.$queryRaw`SELECT 1`));
    parallelBurst = { ok: true, queries: 25, durationMs: Date.now() - burstStartedAt };
  } catch (error) {
    parallelBurst = {
      ok: false,
      queries: 25,
      durationMs: Date.now() - burstStartedAt,
      ...describeError(error),
    };
  }

  return NextResponse.json(
    { connection, simpleQuery, parallelBurst },
    { headers: { "cache-control": "no-store" } }
  );
}
