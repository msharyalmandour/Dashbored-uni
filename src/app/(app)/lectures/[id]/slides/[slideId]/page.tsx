import { pageTitle } from "@/lib/i18n/page-title";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getAccessToken } from "@/lib/supabase/server";
import { getSignedDocumentUrl } from "@/lib/document-storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SlideWorkspace } from "@/components/lectures/slide-workspace";
import { LectureIdentity } from "@/components/lectures/lecture-identity";
import { resumePage, clampPage } from "@/lib/study-position";
import { loadSections } from "@/lib/lecture-sections-store";
import type { Stroke } from "@/lib/ink";

export const generateMetadata = pageTitle((dict) => dict.lecture.slides);
export const dynamic = "force-dynamic";

export default async function SlideAnnotatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; slideId: string }>;
  searchParams: Promise<{ from?: string; page?: string }>;
}) {
  const { id, slideId } = await params;
  /* "Start from the beginning", from Studio.
     The architecture asks for this by name — never restart from slide one
     unless the student explicitly chooses to — so the choice has to be
     expressible. It is a query parameter rather than state because it is a
     property of how this page was opened, not of the document. */
  const query = await searchParams;
  const fromStart = query.from === "start";
  /* "Open on this exact page", from a citation.
     المحاكاة explains every answer with the slide it came from — "سلايد 10" —
     and a citation the student has to go and find by hand is a citation he
     does not follow. Clamped below against the deck's real length, because
     the number arrives from a URL and a deck can be replaced by a shorter
     one after the simulation that cites it was written. */
  const citedPage = query.page ? Number(query.page) : null;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const userId = await requireUserId();

  const slide = await prisma.lectureSlide.findFirst({
    where: { id: slideId, lecture: { subject: { userId } } },
    // The lecture's notes come along so the split view can write to the
    // same text the lecture page shows, rather than a second store.
    include: {
      annotations: true,
      // The lecture and its course come along so the identity strip can say
      // which lecture this page belongs to. Before this, three steps into one
      // piece of work, nothing on screen still named the lecture.
      lecture: {
        select: {
          id: true,
          title: true,
          quickNotes: true,
          subject: { select: { id: true, name: true } },
        },
      },
      /* Where this student left off.
         Read here rather than in the browser so the first paint is already on
         the right page — resolving it client-side would render page one and
         then jump, which reads as a bug even when it lands on the right slide. */
      positions: {
        where: { userId },
        select: { lastPage: true, furthestPage: true, lastViewedAt: true, completedAt: true },
        take: 1,
      },
    },
  });
  if (!slide || slide.lectureId !== id) notFound();

  /* Where this deck opens.
     The rule lives in src/lib/study-position.ts and is asserted there, so the
     route and Studio cannot drift apart on it: the page they stopped ON, not
     the one after; page one if they were standing at the end; and completion is
     deliberately not consulted, because a student re-reading a deck they once
     finished is still somewhere in it. */
  const saved = slide.positions[0] ?? null;
  const initialPage = fromStart
    ? 1
    : citedPage !== null
      ? clampPage(citedPage, slide.pageCount)
      : resumePage({ slideId: slide.id, pageCount: slide.pageCount, position: saved });

  /* The lecture's topic breakdown, so the viewer can name the topic the
     current page belongs to. Absent for a lecture that has none, and the band
     simply is not drawn. */
  const breakdown = await loadSections(id, userId);

  const accessToken = await getAccessToken();
  const signedFileUrl = await getSignedDocumentUrl(slide.fileUrl, accessToken);

  // Strokes are a JSON blob, so strokes saved before pressure existed simply
  // have no `p` on their points and the renderer falls back to neutral.
  const initialAnnotations: Record<number, Stroke[]> = {};
  for (const a of slide.annotations) {
    initialAnnotations[a.pageNumber] = a.strokes as never;
  }

  return (
    <div className="flex flex-col gap-4">
      <LectureIdentity
        subject={slide.lecture.subject}
        lecture={{ id: slide.lecture.id, title: slide.lecture.title }}
        step={slide.title}
        backHref={`/lectures/${id}/slides`}
        backLabel={dict.slides.backToSlides}
      />

      <SlideWorkspace
        slideId={slide.id}
        lectureId={id}
        /* Only a sound breakdown is handed over: a band naming a topic from
           content that breaks its own rules would be a wrong label on a slide,
           which is worse than no label. */
        sections={breakdown && breakdown.problems.length === 0 ? breakdown.sections : []}
        fileUrl={signedFileUrl}
        fileType={slide.fileType}
        initialPageCount={slide.pageCount}
        initialPage={initialPage}
        initialAnnotations={initialAnnotations}
        notes={slide.lecture.quickNotes}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
