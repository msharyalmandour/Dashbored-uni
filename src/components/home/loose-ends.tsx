import Link from "next/link";
import { ArrowRight, Unlink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { looseEnds, type LooseEndCounts } from "@/lib/loose-ends";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The half-filed things, counted and named.
 *
 * Measured on the real account before this existed: 46 topics with no lecture,
 * 4 lectures under no topic, 25 files attached to no lecture, 5 courses with no
 * topics. Nothing anywhere said so. The topics page listed forty-six headings
 * and each one opened onto nothing, and finding that out meant opening
 * forty-six of them.
 *
 * Renders nothing at all when there is nothing loose — an empty "all clear"
 * panel on every visit is how a section teaches you to stop reading it.
 */
export async function LooseEnds({ userId, dict }: { userId: string; dict: Dictionary }) {
  const t = dict.home.looseEnds;

  /* Four counts, one round trip. `none` on a relation is Prisma's "no related
     row exists", which is exactly the question being asked in three of these
     and is cheaper than reading the rows to count them in memory. */
  const [coursesWithoutTopics, topicsWithoutLectures, lecturesWithoutTopic, filesWithoutLecture] =
    await Promise.all([
      prisma.subject.count({ where: { userId, topics: { none: {} } } }),
      prisma.topic.count({ where: { subject: { userId }, lectures: { none: {} } } }),
      prisma.lecture.count({ where: { subject: { userId }, topicId: null } }),
      prisma.document.count({ where: { userId, lectureId: null } }),
    ]);

  const counts: LooseEndCounts = {
    coursesWithoutTopics,
    topicsWithoutLectures,
    lecturesWithoutTopic,
    filesWithoutLecture,
  };
  const ends = looseEnds(counts);
  if (ends.length === 0) return null;

  return (
    <section className="w-full">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Unlink className="size-3.5" />
        {t.heading}
      </h2>
      <Card variant="quiet" className="divide-y divide-border/60 p-0">
        {ends.map((end) => {
          const line = format(t.kinds[end.kind], { count: end.count });
          return end.href ? (
            <Link
              key={end.kind}
              href={end.href}
              className="flex items-center gap-3 p-3.5 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1">{line}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
            </Link>
          ) : (
            /* No link, on purpose. This one is resolved by dropping material,
               not by visiting a page, and a link that goes somewhere you cannot
               act spends a click to tell you so. */
            <p key={end.kind} className="p-3.5 text-sm text-muted-foreground">
              {line}
            </p>
          );
        })}
      </Card>
    </section>
  );
}
