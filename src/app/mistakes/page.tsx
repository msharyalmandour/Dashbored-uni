import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { detectRepeatedWeaknesses } from "@/lib/mistake-patterns";
import { StatCard } from "@/components/shared/stat-card";
import { RepeatedWeaknessBanner } from "@/components/mistakes/repeated-weakness-banner";
import { MistakeRow } from "@/components/mistakes/mistake-row";
import { AlertTriangle, CheckCircle2, Repeat } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata = { title: "Mistake Journal" };
export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());

  const [mistakes, weaknesses, openCount, resolvedCount] = await Promise.all([
    prisma.mistake.findMany({
      where: { userId },
      include: { subject: true, topic: true },
      orderBy: [{ frequency: "desc" }, { createdAt: "desc" }],
    }),
    detectRepeatedWeaknesses(userId),
    prisma.mistake.count({ where: { userId, status: { not: "RESOLVED" } } }),
    prisma.mistake.count({ where: { userId, status: "RESOLVED" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.mistakes.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.mistakes.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={dict.mistakes.openMistakes} value={openCount} icon={AlertTriangle} tone={openCount > 0 ? "warning" : "default"} />
        <StatCard label={dict.mistakes.resolved} value={resolvedCount} icon={CheckCircle2} tone="success" />
        <StatCard label={dict.mistakes.repeatedWeaknesses} value={weaknesses.length} icon={Repeat} tone={weaknesses.length > 0 ? "destructive" : "default"} />
      </div>

      <RepeatedWeaknessBanner weaknesses={weaknesses} dict={dict} />

      <div className="flex flex-col gap-2.5">
        {mistakes.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {dict.mistakes.noMistakesYet}
          </p>
        )}
        {mistakes.map((m) => (
          <MistakeRow
            key={m.id}
            mistake={{
              id: m.id,
              mistakeType: m.mistakeType,
              whyIGotItWrong: m.whyIGotItWrong,
              correctConcept: m.correctConcept,
              whatIShouldReview: m.whatIShouldReview,
              frequency: m.frequency,
              status: m.status,
              subjectName: m.subject.name,
              topicName: m.topic?.name ?? null,
            }}
          />
        ))}
      </div>
    </div>
  );
}
