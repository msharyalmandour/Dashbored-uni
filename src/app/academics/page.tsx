import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { Badge } from "@/components/ui/badge";
import { SubjectCard } from "@/components/academics/subject-card";
import { CreateSemesterDialog } from "@/components/academics/create-semester-dialog";
import { CreateSubjectDialog } from "@/components/academics/create-subject-dialog";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Academic Structure" };
export const dynamic = "force-dynamic";

export default async function AcademicsPage() {
  const userId = await getCurrentUserId();

  const semesters = await prisma.semester.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: {
      subjects: {
        include: {
          lectures: { select: { completionPercentage: true } },
          knowledgeGaps: { select: { status: true } },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Academic Structure</h1>
          <p className="text-sm text-muted-foreground">Your semesters and every subject inside them.</p>
        </div>
        <CreateSemesterDialog />
      </div>

      {semesters.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No semesters yet. Create one to start organizing subjects.
        </p>
      )}

      {semesters.map((semester) => (
        <section key={semester.id} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold">{semester.name}</h2>
              <Badge variant={semester.status === "ACTIVE" ? "default" : "muted"}>
                {semester.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(semester.startDate)} – {formatDate(semester.endDate)}
              </span>
            </div>
            <CreateSubjectDialog semesterId={semester.id} />
          </div>

          {semester.subjects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No subjects yet in this semester.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {semester.subjects.map((subject) => {
                const avgCompletion =
                  subject.lectures.length > 0
                    ? subject.lectures.reduce((s, l) => s + l.completionPercentage, 0) /
                      subject.lectures.length
                    : 0;
                const unresolvedGaps = subject.knowledgeGaps.filter(
                  (g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED"
                ).length;
                return (
                  <SubjectCard
                    key={subject.id}
                    subject={{
                      id: subject.id,
                      name: subject.name,
                      code: subject.code,
                      color: subject.color,
                      instructor: subject.instructor,
                      creditHours: subject.creditHours,
                      lectureCount: subject.lectures.length,
                      avgCompletion,
                      unresolvedGaps,
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
