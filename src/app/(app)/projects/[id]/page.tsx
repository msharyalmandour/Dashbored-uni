import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loadProject } from "@/lib/project-store";
import { ProjectWorld } from "@/components/projects/project-world";
import { getAiStatus } from "@/lib/ai/provider";
import type { TutorAvailability } from "@/lib/sheet-tutor";

export const dynamic = "force-dynamic";

/** A thin loader. The rules are in src/lib/project.ts, with their guard. */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const project = await loadProject(userId, id);
  if (!project) notFound();

  const tutor: TutorAvailability = getAiStatus().configured ? "ready" : "no-key";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <ProjectWorld
        project={project}
        locale={locale}
        t={dict.project}
        weekdayNames={dict.time.weekdays}
        tutor={tutor}
      />
    </div>
  );
}
