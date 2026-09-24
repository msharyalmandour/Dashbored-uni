import { pageTitle } from "@/lib/i18n/page-title";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { OSPageHeader } from "@/components/shared/os-page-header";
import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { continueWith, positionOf, recent, resumePage, showsAsFinished, type Deck } from "@/lib/study-position";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import { UnattachedFiles } from "@/components/studio/unattached-files";

export const generateMetadata = pageTitle((dict) => dict.studio.title);
export const dynamic = "force-dynamic";

/**
 * STUDIO — where the reading happens.
 *
 * It answers one question: what was I reading? Not what should I do next, not
 * what is due — those belong to Home, and putting them here would make this a
 * second home rather than a world.
 *
 * Everything on this page comes from StudyPosition, which is the thing the
 * product was missing: before it, every deck opened at page one and "you
 * stopped at slide 18" was not a feature that had been built badly, it was a
 * sentence the database could not say.
 */
export default async function StudioPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();
  const S = dict.studio;

  const rows = await prisma.lectureSlide.findMany({
    where: { lecture: { subject: { userId } } },
    select: {
      id: true,
      title: true,
      pageCount: true,
      lecture: {
        select: { id: true, title: true, subject: { select: { id: true, name: true } } },
      },
      positions: {
        where: { userId },
        select: { lastPage: true, furthestPage: true, lastViewedAt: true, completedAt: true },
        take: 1,
      },
    },
    // Only what has been touched, plus enough untouched decks to get started
    // from. A student with two hundred slides does not want all of them here.
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  type Row = (typeof rows)[number];
  const byId = new Map<string, Row>(rows.map((r) => [r.id, r]));
  const decks: Deck[] = rows.map((r) => ({
    slideId: r.id,
    pageCount: r.pageCount,
    position: r.positions[0] ?? null,
  }));

  const next = continueWith(decks);
  const history = recent(decks, 8);

  const href = (slideId: string) => {
    const row = byId.get(slideId)!;
    return `/lectures/${row.lecture.id}/slides/${slideId}`;
  };
  const say = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader title={S.title} state={S.subtitle} />

      {/* Continue — one deck, not a list. The whole point is that the student
          does not have to choose. */}
      {next && (
        <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <p className="t-label mb-2 text-muted-foreground">{S.continueTitle}</p>
          <ContentText as="p" className="t-title">
            {byId.get(next.slideId)!.lecture.title}
          </ContentText>
          <ContentText as="p" className="t-meta mt-0.5 text-muted-foreground">
            {byId.get(next.slideId)!.lecture.subject.name} · {byId.get(next.slideId)!.title}
          </ContentText>

          <p className="t-body mt-3">
            {say(S.stoppedAt, { page: next.position!.lastPage, count: next.pageCount })}
          </p>

          {/* Drawn from where they ARE, not from how much they have seen — the
              two are different numbers and both are true, but a bar at 100%
              beside "you stopped at page 2 of 3" reads as a bug. */}
          <Progress value={positionOf(next)} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button asChild variant="default">
              <Link href={`${href(next.slideId)}`}>
                {S.resume}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </Button>
            {/* The escape hatch the architecture asks for by name: never restart
                from slide one unless the student explicitly chooses to. */}
            <Button asChild variant="ghost">
              <Link href={`${href(next.slideId)}?from=start`}>{S.startOver}</Link>
            </Button>
          </div>
        </section>
      )}

      {/* After Continue and before Recent: it is about material that is not yet
          part of anything, which is a different question from what to read next.
          Renders nothing when every file is attached. */}
      <UnattachedFiles userId={userId} dict={dict} />

      <section>
        <p className="t-label mb-2 text-muted-foreground">{S.recentTitle}</p>
        {history.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center">
            <p className="t-body">{S.empty}</p>
            <p className="t-meta mt-1 text-muted-foreground">{S.emptyHint}</p>
            <Button asChild variant="secondary" className="mt-4">
              <Link href="/academics">
                <BookOpen className="size-4" />
                {S.browse}
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((d) => {
              const row = byId.get(d.slideId)!;
              const done = showsAsFinished(d);
              return (
                <li key={d.slideId}>
                  <Link
                    href={href(d.slideId)}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 transition-colors hover:border-[color:var(--border-active)]"
                  >
                    <div className="min-w-0 flex-1">
                      <ContentText as="p" className="t-body truncate">
                        {row.lecture.title}
                      </ContentText>
                      <ContentText as="p" className="t-meta truncate text-muted-foreground">
                        {row.lecture.subject.name} · {row.title}
                      </ContentText>
                    </div>
                    <span className="t-meta shrink-0 text-muted-foreground" dir="ltr">
                      {done ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="size-3.5" />
                          {S.finished}
                        </span>
                      ) : (
                        `${resumePage(d)} / ${d.pageCount}`
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * How far through, with no number attached.
 *
 * The architecture is explicit that system concepts are not student concepts:
 * the student sees how far along the bar is, not "47%". A percentage invites
 * being compared and optimised, which is not what reading a lecture is.
 */
function Progress({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[oklch(100%_0_0_/_8%)]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
