import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SlideAnnotator } from "@/components/lectures/slide-annotator";

export const metadata = { title: "Slide" };
export const dynamic = "force-dynamic";

export default async function SlideAnnotatorPage({
  params,
}: {
  params: Promise<{ id: string; slideId: string }>;
}) {
  const { id, slideId } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const slide = await prisma.lectureSlide.findUnique({
    where: { id: slideId },
    include: { annotations: true },
  });
  if (!slide || slide.lectureId !== id) notFound();

  const initialAnnotations: Record<number, { mode: "pen" | "eraser"; color: string; width: number; points: { x: number; y: number }[] }[]> = {};
  for (const a of slide.annotations) {
    initialAnnotations[a.pageNumber] = a.strokes as never;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/lectures/${id}/slides`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> {slide.title}
      </Link>

      <SlideAnnotator
        slideId={slide.id}
        fileUrl={slide.fileUrl}
        fileType={slide.fileType}
        initialPageCount={slide.pageCount}
        initialAnnotations={initialAnnotations}
        locale={locale}
        dict={{
          page: dict.slides.page,
          pen: dict.slides.pen,
          eraser: dict.slides.eraser,
          color: dict.slides.color,
          strokeWidth: dict.slides.strokeWidth,
          undo: dict.slides.undo,
          clearPage: dict.slides.clearPage,
          saved: dict.slides.saved,
          saving: dict.slides.saving,
          prevPage: dict.slides.prevPage,
          nextPage: dict.slides.nextPage,
          loadingSlide: dict.slides.loadingSlide,
          pages: dict.slides.pages,
        }}
      />
    </div>
  );
}
