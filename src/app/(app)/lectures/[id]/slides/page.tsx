import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Image as ImageIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { SlideUploadDialog } from "@/components/lectures/slide-upload-dialog";
import { DeleteSlideButton } from "@/components/lectures/delete-slide-button";
import { ProcessingStatusBadge } from "@/components/shared/status-badges";

export const metadata = { title: "Slides" };
export const dynamic = "force-dynamic";

export default async function LectureSlidesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dict = getDictionary(await getLocale());
  const userId = await requireUserId();

  const lecture = await prisma.lecture.findFirst({
    where: { id, subject: { userId } },
    include: {
      slides: {
        orderBy: { createdAt: "desc" },
        include: { document: { select: { processingStatus: true } } },
      },
    },
  });
  if (!lecture) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/lectures/${lecture.id}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> {dict.slides.backToLecture}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.slides.title}</h1>
            <p className="text-sm text-muted-foreground">{dict.slides.subtitle}</p>
          </div>
          <SlideUploadDialog
            lectureId={lecture.id}
            addLabel={dict.slides.addSlide}
            dict={{
              title: dict.slides.uploadTitle,
              titleLabel: dict.slides.titleLabel,
              fileLabel: dict.slides.fileLabel,
              hint: dict.slides.fileHint,
              save: dict.slides.save,
            }}
          />
        </div>
      </div>

      {lecture.slides.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {dict.slides.noSlides}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lecture.slides.map((slide) => {
            const Icon = slide.fileType === "pdf" ? FileText : ImageIcon;
            return (
              <div
                key={slide.id}
                className="hover-elevate group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
              >
                <Link href={`/lectures/${lecture.id}/slides/${slide.id}`} className="flex flex-col gap-2">
                  <div className="flex items-center justify-center rounded-lg border border-border bg-muted/40 py-8">
                    <Icon className="size-8 text-muted-foreground" />
                  </div>
                  <p className="truncate text-sm font-medium">{slide.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{format(dict.slides.pages, { count: slide.pageCount })}</p>
                    {slide.document && <ProcessingStatusBadge status={slide.document.processingStatus} dict={dict} />}
                  </div>
                </Link>
                <DeleteSlideButton slideId={slide.id} lectureId={lecture.id} label={dict.slides.delete} confirmText={dict.slides.deleteConfirm} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
