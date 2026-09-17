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
import type { Stroke } from "@/lib/ink";

export const generateMetadata = pageTitle((dict) => dict.lecture.slides);
export const dynamic = "force-dynamic";

export default async function SlideAnnotatorPage({
  params,
}: {
  params: Promise<{ id: string; slideId: string }>;
}) {
  const { id, slideId } = await params;
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
    },
  });
  if (!slide || slide.lectureId !== id) notFound();

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
        fileUrl={signedFileUrl}
        fileType={slide.fileType}
        initialPageCount={slide.pageCount}
        initialAnnotations={initialAnnotations}
        notes={slide.lecture.quickNotes}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
