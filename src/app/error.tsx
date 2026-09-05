"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary for everything under the root layout.
 *
 * Without this file, any thrown error in a Server Component — a failed
 * database query, an unreachable Supabase call — escapes to the hosting
 * platform and the user sees the platform's opaque "a server error
 * occurred" page with a number that means nothing to them and nothing to
 * whoever is debugging it.
 *
 * This deliberately does not swallow the error. React still reports it, the
 * server still logs the full stack (which is what reaches the Vercel
 * runtime logs), and the `digest` shown below is the id that ties this
 * render to that log line. Next.js redacts server error messages in
 * production on purpose, so the digest is the only safe thing to put on
 * screen — and it is exactly what makes the log searchable.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surfaces in the browser console in development and in the client
    // error stream in production; the server-side stack is logged by Next.
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-5 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            This page failed to load. The error has been recorded on the server.
          </p>
        </div>

        {error.digest && (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Error reference
            </span>
            <code className="break-all font-mono text-xs">{error.digest}</code>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
