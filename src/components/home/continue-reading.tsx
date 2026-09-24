import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { resumeTarget } from "@/lib/resume";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * "You stopped at page 18." On Home, where it is actually seen.
 *
 * The sidebar lost nine entries, and the target architecture is explicit about
 * why that is allowed: what was in the sidebar has to be on Home, or it has not
 * been simplified, it has been hidden. This is the first of those — Studio is
 * still a world with its own page, but the one sentence that matters most from
 * it belongs on the page the student opens.
 *
 * The query moved to src/lib/resume.ts, shared with the hero's primary button
 * and request-cached, so the button and this card can never point at different
 * decks. See the note there.
 *
 * Deliberately smaller than Studio's version of the same card: no progress
 * number, no "start over". Those are decisions, and Home is not where decisions
 * about a deck get made; it is where you get back into one.
 */
export async function ContinueReading({ userId, dict }: { userId: string; dict: Dictionary }) {
  const next = await resumeTarget(userId);
  if (!next) return null;

  const S = dict.studio;
  const stopped = S.stoppedAt
    .replace("{page}", String(next.lastPage))
    .replace("{count}", String(next.pageCount));

  return (
    <Link
      href={next.href}
      className="group/cont flex items-center gap-4 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] px-5 py-4 transition-colors hover:border-[color:var(--border-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[color:var(--accent)] text-[color:var(--primary)]">
        <BookOpen className="size-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {S.continueTitle}
        </p>
        <ContentText as="p" className="mt-1 truncate font-medium">
          {next.lectureTitle}
        </ContentText>
        <ContentText as="p" className="mt-0.5 truncate text-xs text-muted-foreground">
          {next.subjectName} · {stopped}
        </ContentText>
        {/* The bar reads from where they are, not from how far they have ever
            got. Both numbers are true and they are different; a full bar beside
            "you stopped at page 2 of 3" reads as a bug. */}
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[color:var(--surface-elevated)]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.round(next.progress * 100)}%`,
              backgroundImage: "var(--brand-gradient)",
            }}
          />
        </div>
      </div>

      <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/cont:translate-x-0.5 rtl:rotate-180 rtl:group-hover/cont:-translate-x-0.5" />
    </Link>
  );
}
