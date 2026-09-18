/**
 * Turns whatever a Server Action threw into something worth showing a student.
 *
 * Every failure used to be surfaced as `err.message`, which is right for the
 * errors this app writes ("That file is larger than 4 MB") and badly wrong for
 * everything else. When a Server Action fails on the server, a production build
 * deliberately withholds the real message and React hands the client a
 * placeholder that reads:
 *
 *   Minified React error #441; visit https://react.dev/errors/441 for the full
 *   message or use the non-minified dev environment for full errors…
 *
 * That sentence went straight into a toast, in English, in an Arabic
 * interface, telling a student to open a developer console. It is the same
 * mistake as quoting a provider's HTTP error at them — the details belong in a
 * log, and what reaches the person has to be in their language and about their
 * situation.
 *
 * So a message is shown only when this app is the one that wrote it. Anything
 * else — a React placeholder, a stack, a framework string — falls back to the
 * caller's own translated line.
 */
export function studentFacingError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;

  const message = err.message.trim();
  if (!message) return fallback;

  // React's production placeholder, and anything else pointing at developer
  // tooling. None of it means anything to the person reading it.
  if (/minified react error|react\.dev\/errors|digest:|\bat\s+\w+\s*\(/i.test(message)) {
    return fallback;
  }

  // Next hides a Server Action's real message behind this exact wording.
  if (/An error occurred in the Server Components render/i.test(message)) return fallback;

  // A sentence is a sentence; a stack trace or a serialized blob is not.
  if (message.length > 200 || message.includes("\n")) return fallback;

  return message;
}
