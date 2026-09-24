import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ContentText } from "@/components/ui/content-text";
import { continueWith, positionOf, type Deck } from "@/lib/study-position";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * "You stopped at page 18." On Home, where it is actually seen.
 *
 * The sidebar lost nine entries, and the target architecture is explicit about
 * why that is allowed: what was in the sidebar has to be on Home, or it has not
 * been simplified, it has been hidden. This is the first of those — Studio is
 * still a world with its own page, but the one sentence that matters most from
 * it belongs above the fold on the page the student opens.
 *
 * ONE deck, and only when it is genuinely mid-read. `continueWith` picks the
 * most recent resumable one; a deck finished or never opened is not a thing to
 * continue and this renders nothing rather than inventing a prompt. Home has a
 * strict budget — it is already the orb plus the whole day — and a band that
 * says "nothing to continue" spends that budget on an absence.
 *
 * Deliberately smaller than Studio's version of the same card: no progress
 * number, no "start over". Those are decisions, and Home is not where decisions
 * about a deck get made; it is where you get back into one.
 */
export async function ContinueReading({ userId, dict }: { userId: string; dict: Dictionary }) {
  /* Read from StudyPosition rather than from the decks.
     Studio scans two hundred slides because it lists history and has to show
     untouched decks too. Home needs exactly one deck, and only one that has
     been read — which is precisely what a position row IS. It also lands on the
     [userId, lastViewedAt] index, so "most recently read" is the ordering
     rather than a sort after the fact. */
  const rows = await prisma.studyPosition.findMany({
    where: { userId, slide: { lecture: { subject: { userId } } } },
    select: {
      lastPage: true,
      furthestPage: true,
      lastViewedAt: true,
      completedAt: true,
      slide: {
        select: {
          id: true,
          title: true,
          pageCount: true,
          lecture: { select: { id: true, title: true, subject: { select: { name: true } } } },
        },
      },
    },
    orderBy: { lastViewedAt: "desc" },
    take: 25,
  });

  const decks: Deck[] = rows.map((r) => ({
    slideId: r.slide.id,
    pageCount: r.slide.pageCount,
    position: {
      lastPage: r.lastPage,
      furthestPage: r.furthestPage,
      lastViewedAt: r.lastViewedAt,
      completedAt: r.completedAt,
    },
  }));

  const next = continueWith(decks);
  if (!next) return null;

  const row = rows.find((r) => r.slide.id === next.slideId)!.slide;
  const S = dict.studio;
  const stopped = S.stoppedAt
    .replace("{page}", String(next.position!.lastPage))
    .replace("{count}", String(next.pageCount));

  /* The panel material, like every other thing on Home you press.

     This was `glass-quiet` — a 30% tint over the forest — and it was the only
     surface on the page made of it. Beside the stat tiles, which are `.panel`
     at 94–97%, it read as a different product: you could see tree trunks
     through the one and not the other. globals.css states the rule in the
     `.panel` comment ("a surface you can see a forest through is cellophane,
     not a material"); this was the page's one exception to it. */
  return (
    <Link
      href={`/lectures/${row.lecture.id}/slides/${row.id}`}
      className="panel panel-3d group/cont flex items-center gap-4 px-5 py-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="min-w-0 flex-1">
        <p className="t-label text-muted-foreground">{S.continueTitle}</p>
        <ContentText as="p" className="t-title mt-1 truncate">
          {row.lecture.title}
        </ContentText>
        <ContentText as="p" className="t-meta mt-0.5 truncate text-muted-foreground">
          {row.lecture.subject.name} · {stopped}
        </ContentText>
        {/* The bar reads from where they are, not from how far they have ever
            got. Both numbers are true and they are different; a full bar beside
            "you stopped at page 2 of 3" reads as a bug. */}
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[oklch(100%_0_0_/_8%)]">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.round(positionOf(next) * 100)}%` }}
          />
        </div>
      </div>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/cont:translate-x-0.5 rtl:rotate-180 rtl:group-hover/cont:-translate-x-0.5" />
    </Link>
  );
}
