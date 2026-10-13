import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { pageTitle } from "@/lib/i18n/page-title";
import { LectureIdentity } from "@/components/lectures/lecture-identity";
import { TtEmpty } from "@/components/shared/tt";
import { accentMap, DEFAULT_ACCENT } from "@/lib/subject-accent";
import { loadSections } from "@/lib/lecture-sections-store";
import { TopicList } from "@/components/lectures/topic-list";

export const generateMetadata = pageTitle((dict) => dict.topics.title);
export const dynamic = "force-dynamic";

/**
 * التوبيكس, one lecture.
 *
 * ITS OWN ROUTE, for the same reason المحاكاة has one: twenty-one sections is
 * a place you sit in, not a panel you scroll past on the way to the deck. On
 * the lecture page it would bury the summary, the notes and the slides under a
 * contents list longer than all three.
 *
 * NO TABS AND NO SEARCH BOX. The sections are collapsed to one line each, so
 * the whole lecture is already a readable list on one screen — and the
 * browser's own find-in-page opens a closed `<details>` onto its match, which
 * is a better search than one I would build and is already on his phone.
 */
export default async function TopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();

  const stored = await loadSections(id, userId);
  if (!stored) notFound();

  const T = dict.topics;
  const roster = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, color: true },
    orderBy: { createdAt: "asc" },
  });
  const accent = accentMap(roster).get(stored.subjectId) ?? DEFAULT_ACCENT;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <LectureIdentity
          subject={{ id: stored.subjectId, name: stored.subjectName }}
          lecture={{ id: stored.lectureId, title: stored.lectureTitle }}
          step={T.title}
          backHref={`/lectures/${stored.lectureId}`}
          backLabel={dict.slides.backToLecture}
        />
        <div>
          <p className="t-label" style={{ color: accent }}>
            {format(T.count, { count: stored.sections.length })}
          </p>
          <h1 className="t-display mt-1">{T.title}</h1>
          <p className="t-body mt-2 max-w-[62ch] text-muted-foreground">{T.hint}</p>
        </div>
      </header>

      {stored.problems.length > 0 ? (
        <div className="glass pb-4 pt-4">
          <TtEmpty>{T.broken}</TtEmpty>
          <ul className="t-meta mt-1 list-disc space-y-1 ps-5 text-muted-foreground">
            {stored.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : (
        <TopicList
          sections={stored.sections}
          lectureId={stored.lectureId}
          slideId={stored.deck?.id ?? null}
          accent={accent}
          labels={{
            slidesLabel: T.slidesLabel,
            watch: T.watch,
            openSlide: T.openSlide,
            points: T.points,
          }}
        />
      )}
    </div>
  );
}
