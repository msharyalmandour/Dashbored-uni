import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { detectRepeatedWeaknesses } from "@/lib/mistake-patterns";
import { StatCard } from "@/components/shared/stat-card";
import { OSSection, OSEmptyState } from "@/components/shared/os-section";
import { OSRowGroup } from "@/components/shared/os-row-group";
import { RepeatedWeaknessBanner } from "@/components/mistakes/repeated-weakness-banner";
import { MistakeRow } from "@/components/mistakes/mistake-row";
import {
  AlertTriangle,
  CheckCircle2,
  Repeat,
  Lightbulb,
  HelpCircle,
  Brain,
  Zap,
  FileQuestion,
} from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format as formatDict } from "@/lib/i18n/dictionaries";
import type { MistakeType } from "@prisma/client";
import { SPAN_STYLE, POINT_STYLE, markerFor } from "@/lib/week-palette";

export const generateMetadata = pageTitle((dict) => dict.nav.items.mistakes.label);
export const dynamic = "force-dynamic";

/**
 * How many mistakes one page will draw.
 *
 * This query had no limit at all, which is fine on a seeded account and is not
 * fine in March: a mistake journal is append-only by design, so the one thing it
 * is guaranteed to do is grow. Ordered by frequency, the top of the list is also
 * the part worth reading — the mistakes made over and over — so a cap costs the
 * student the tail they were never going to scroll to.
 */
const PAGE_SIZE = 60;

/**
 * The five kinds of being wrong.
 *
 * `MistakeType` has always distinguished them, and the page showed the
 * distinction only as a badge repeated on every row — so a student could see
 * that *this* was a memory error but not that memory errors were half of
 * everything they got wrong. That second fact is the one that changes what they
 * do next, and it is the whole reason the column exists.
 *
 * Ordered by what it costs to fix: a gap in knowledge needs studying, a
 * misreading of the question needs a habit. Colours come from the week palette.
 */
const TYPES: { type: MistakeType; icon: typeof Lightbulb; accent: string }[] = [
  { type: "KNOWLEDGE_GAP", icon: Lightbulb, accent: POINT_STYLE.DEADLINE },
  { type: "MISUNDERSTANDING", icon: HelpCircle, accent: markerFor("CLASS") },
  { type: "MEMORY_ERROR", icon: Brain, accent: SPAN_STYLE.TUTORIAL.glow },
  { type: "CARELESS_MISTAKE", icon: Zap, accent: markerFor("CLINICAL") },
  { type: "QUESTION_MISINTERPRETATION", icon: FileQuestion, accent: SPAN_STYLE.LAB.glow },
];

export default async function MistakesPage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());

  const [mistakes, weaknesses, openCount, resolvedCount] = await Promise.all([
    prisma.mistake.findMany({
      where: { userId },
      // The lecture comes along so a mistake can lead back to what it was
      // about. `lectureId` was on the row and never selected.
      include: { subject: true, topic: true, lecture: { select: { id: true, title: true } } },
      orderBy: [{ frequency: "desc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
    }),
    detectRepeatedWeaknesses(userId),
    prisma.mistake.count({ where: { userId, status: { not: "RESOLVED" } } }),
    prisma.mistake.count({ where: { userId, status: "RESOLVED" } }),
  ]);

  const byType = new Map<MistakeType, typeof mistakes>();
  for (const m of mistakes) {
    const bucket = byType.get(m.mistakeType);
    if (bucket) bucket.push(m);
    else byType.set(m.mistakeType, [m]);
  }
  const present = TYPES.filter((t) => (byType.get(t.type)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.mistakes.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.mistakes.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label={dict.mistakes.openMistakes}
          value={openCount}
          icon={AlertTriangle}
          tone={openCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label={dict.mistakes.resolved}
          value={resolvedCount}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label={dict.mistakes.repeatedWeaknesses}
          value={weaknesses.length}
          icon={Repeat}
          tone={weaknesses.length > 0 ? "destructive" : "default"}
        />
      </div>

      <RepeatedWeaknessBanner weaknesses={weaknesses} dict={dict} />

      {openCount + resolvedCount > mistakes.length && (
        <p className="-mb-2 text-xs text-muted-foreground">
          {formatDict(dict.common.showingOf, {
            shown: mistakes.length,
            total: openCount + resolvedCount,
          })}
        </p>
      )}

      {present.length === 0 ? (
        <OSSection title={dict.mistakes.title}>
          <OSEmptyState icon={CheckCircle2} title={dict.mistakes.noMistakesYet} />
        </OSSection>
      ) : (
        present.map(({ type, icon, accent }) => (
          <OSSection
            key={type}
            title={dict.status.mistakeType[type]}
            count={byType.get(type)!.length}
            icon={icon}
            accent={accent}
          >
            <OSRowGroup limit={4}>
              {byType.get(type)!.map((m) => (
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
                  subjectId: m.subjectId,
                  lecture: m.lecture,
                  topicName: m.topic?.name ?? null,
                }}
              />
              ))}
            </OSRowGroup>
          </OSSection>
        ))
      )}
    </div>
  );
}
