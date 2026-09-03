import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { CreateClinicalDialog } from "@/components/clinical/create-clinical-dialog";
import { ConvertToGapDialog } from "@/components/clinical/convert-to-gap-dialog";
import { Stethoscope, Building2, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Clinical Training" };
export const dynamic = "force-dynamic";

export default async function ClinicalPage() {
  const userId = await getCurrentUserId();

  const [entries, subjects, sitesCount] = await Promise.all([
    prisma.clinicalTraining.findMany({
      where: { userId },
      include: { knowledgeGaps: true },
      orderBy: { date: "desc" },
    }),
    prisma.subject.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.clinicalTraining.findMany({ where: { userId }, distinct: ["hospital"], select: { hospital: true } }),
  ]);

  const totalCases = entries.reduce((s, e) => s + e.casesSeen, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Clinical Training</h1>
          <p className="text-sm text-muted-foreground">Your rotation log — feeds knowledge gaps directly.</p>
        </div>
        <CreateClinicalDialog />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Entries" value={entries.length} icon={ClipboardList} />
        <StatCard label="Cases Seen" value={totalCases} icon={Stethoscope} />
        <StatCard label="Sites" value={sitesCount.length} icon={Building2} />
      </div>

      <div className="flex flex-col gap-4">
        {entries.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            No rotations logged yet.
          </p>
        )}
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {entry.department ?? "Rotation"} {entry.hospital ? `· ${entry.hospital}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.date)}
                    {entry.supervisor ? ` · ${entry.supervisor}` : ""}
                    {entry.casesSeen ? ` · ${entry.casesSeen} cases` : ""}
                  </p>
                </div>
                {entry.knowledgeGaps.length > 0 && (
                  <Badge variant="secondary">{entry.knowledgeGaps.length} gap{entry.knowledgeGaps.length === 1 ? "" : "s"} linked</Badge>
                )}
              </div>

              {entry.skillsPracticed && (
                <p className="text-sm"><span className="text-muted-foreground">Skills: </span>{entry.skillsPracticed}</p>
              )}
              {entry.whatILearned && (
                <p className="text-sm"><span className="text-muted-foreground">Learned: </span>{entry.whatILearned}</p>
              )}
              {entry.whatIDidNotUnderstand && (
                <p className="text-sm"><span className="text-muted-foreground">Didn&apos;t understand: </span>{entry.whatIDidNotUnderstand}</p>
              )}
              {entry.questionsToAsk && (
                <p className="text-sm"><span className="text-muted-foreground">Questions: </span>{entry.questionsToAsk}</p>
              )}
              {entry.reflection && (
                <p className="text-sm"><span className="text-muted-foreground">Reflection: </span>{entry.reflection}</p>
              )}
              {entry.nextAction && (
                <p className="text-sm font-medium">Next: {entry.nextAction}</p>
              )}

              {entry.whatIDidNotUnderstand && entry.knowledgeGaps.length === 0 && (
                <div className="pt-1">
                  <ConvertToGapDialog
                    trainingId={entry.id}
                    suggestedTitle={entry.whatIDidNotUnderstand}
                    subjects={subjects}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
