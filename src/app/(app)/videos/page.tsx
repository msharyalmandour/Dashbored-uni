import { pageTitle } from "@/lib/i18n/page-title";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { SubjectFilterSelect } from "@/components/flashcards/subject-filter-select";
import { CreateVideoDialog } from "@/components/videos/create-video-dialog";
import { VideoStatusSelect } from "@/components/videos/video-status-select";
import { DeleteThing } from "@/components/shared/delete-thing";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const generateMetadata = pageTitle((dict) => dict.nav.items.videos.label);

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());

  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [videos, total, watching] = await Promise.all([
    prisma.video.findMany({
      where: { userId, subjectId: subject },
      include: { subject: true, lecture: true, topic: true, knowledgeGaps: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.video.count({ where: { userId } }),
    prisma.video.count({ where: { userId, status: "WATCHING" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader
        title={dict.videos.title}
        state={
          <StateLine
            template={watching > 0 ? dict.videos.stateLine : dict.videos.stateLineClear}
            values={{ watching, total }}
          />
        }
        actions={
          <>
            <SubjectFilterSelect subjects={subjects} />
            <CreateVideoDialog subjects={subjects} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            {dict.videos.noVideosYet}
          </p>
        )}
        {videos.map((v) => (
          <div key={v.id} className="flex flex-col gap-2.5 rounded-xl border border-border p-4">
            <a href={v.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-primary">
              {v.title}
            </a>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {v.subject && (
                <span style={{ color: v.subject.color }}>{v.subject.name}</span>
              )}
              {v.lecture && <span>· {v.lecture.title}</span>}
              {v.topic && <span>· {v.topic.name}</span>}
            </div>
            {v.knowledgeGaps.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {v.knowledgeGaps.map((g) => (
                  <Link key={g.id} href={`/knowledge-gaps?gap=${g.id}`}>
                    <Badge variant="warning" className="hover:opacity-80">
                      <Lightbulb className="size-3" /> {g.title}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <VideoStatusSelect videoId={v.id} status={v.status} />
              <DeleteThing kind="video" id={v.id} name={v.title} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
