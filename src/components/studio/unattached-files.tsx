import Link from "next/link";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { TtSection } from "@/components/shared/tt";
import { ProcessingStatusBadge } from "@/components/shared/status-badges";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Files that are stored and belong to nothing.
 *
 * Measured on the real account: 25 of 34 documents attached to no lecture, 19
 * of those never read at all. Every one was uploaded on purpose and none
 * appeared on any screen — Studio listed decks, which by definition means files
 * that ARE attached to a lecture, so the ones that are not were invisible by
 * construction.
 *
 * This section exists because of a link I shipped an hour before it. Home now
 * says "N files are not attached to a lecture" and pointed here, at a page that
 * could not show them. A link that goes somewhere the thing is not is worse than
 * no link: it spends a click to demonstrate the absence it promised to fix.
 *
 * It lists rather than fixes, deliberately. Which lecture a file belongs to is a
 * judgement — the names here are "Document.pdf" and "المحاضره 2" — and guessing
 * wrong files a student's syllabus under somebody's lecture 3. The route that
 * decides correctly already exists: drop it in and let the agent read it, which
 * is what the button offers.
 */
export async function UnattachedFiles({ userId, dict }: { userId: string; dict: Dictionary }) {
  const t = dict.studio.unattached;

  const [files, total] = await Promise.all([
    prisma.document.findMany({
      where: { userId, lectureId: null },
      select: {
        id: true,
        originalName: true,
        processingStatus: true,
        pageCount: true,
        subject: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.document.count({ where: { userId, lectureId: null } }),
  ]);
  if (files.length === 0) return null;

  return (
    <section>
      {/* One card per file became one row per file. Pages go in the figure
          column — the same unit the course page and the exam band use. */}
      <TtSection
        title={format(t.title, { count: total })}
        meta={<span className="tt-meta">{t.hint}</span>}
      >
        <ul className="contents">
          {files.map((file) => (
            <li key={file.id} className="tt-row">
              <span className="tt-n tt-latin">{file.pageCount ?? ""}</span>
              <div className="tt-label min-w-0">
                <ContentText className="truncate">{file.originalName}</ContentText>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                {/* The course it sits under, when it has one. Two thirds of
                    these have none, and saying so is the point of the line. */}
                <span className="tt-meta hidden sm:inline">
                  {file.subject?.name ?? t.noCourse}
                </span>
                <ProcessingStatusBadge status={file.processingStatus} dict={dict} />
              </span>
            </li>
          ))}
        </ul>
      </TtSection>

      {/* Where a file actually becomes part of a lesson. Which lecture that is
          remains a judgement this page does not make. */}
      <Button asChild variant="secondary" className="mt-3">
        <Link href="/inbox">
          <Inbox className="size-4" />
          {t.cta}
        </Link>
      </Button>

      {total > files.length && (
        <p className="t-meta mt-2 text-muted-foreground">
          {format(t.andMore, { count: total - files.length })}
        </p>
      )}
    </section>
  );
}
