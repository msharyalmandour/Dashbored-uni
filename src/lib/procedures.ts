import { prisma } from "@/lib/prisma";
import { practiceOrder, type ProcedureRow, type Step } from "@/lib/ospe";

/**
 * Reading procedures for the clinical section.
 *
 * The miss counts come from `Mistake`, which is the whole point of pointing
 * the two at each other: there is no second table counting the same thing, so
 * "I keep missing step 4" and "what do I keep getting wrong" are one fact with
 * one source, and `mistake-patterns.ts` can already read it.
 */

export interface ProcedureListItem extends ProcedureRow {
  subjectName: string | null;
  /** Whether the checklist came from one of the student's own files. */
  fromDocument: boolean;
}

export async function listProcedures(userId: string): Promise<ProcedureListItem[]> {
  const rows = await prisma.procedure.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      lastPracticedAt: true,
      sourceDocumentId: true,
      subject: { select: { name: true } },
      _count: { select: { steps: true } },
      steps: {
        where: { critical: true },
        select: { _count: { select: { mistakes: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: ProcedureListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    stepCount: r._count.steps,
    lastPracticedAt: r.lastPracticedAt,
    /* Misses on CRITICAL steps only. A count of every miss would be dominated
       by the long tail of minor omissions, and it is the critical ones that
       decide a station — so it is the critical ones that decide the order. */
    criticalMisses: r.steps.reduce((sum, s) => sum + s._count.mistakes, 0),
    subjectName: r.subject?.name ?? null,
    fromDocument: r.sourceDocumentId !== null,
  }));

  // The ordering rule lives in ospe.ts, tested, and is applied here rather
  // than reimplemented as an `orderBy` the database would have to guess at.
  return practiceOrder(items) as ProcedureListItem[];
}

export interface ProcedureDetail {
  id: string;
  name: string;
  subjectId: string | null;
  subjectName: string | null;
  fromDocument: boolean;
  lastPracticedAt: Date | null;
  steps: Step[];
  /** Step id to how many times it has been missed. */
  missCounts: Map<string, number>;
}

export async function getProcedure(
  userId: string,
  procedureId: string
): Promise<ProcedureDetail | null> {
  const row = await prisma.procedure.findFirst({
    // userId in the where clause, not checked after the read: the ownership
    // test and the fetch are the same query, so there is no window in which a
    // row belonging to someone else has been loaded.
    where: { id: procedureId, userId },
    select: {
      id: true,
      name: true,
      subjectId: true,
      sourceDocumentId: true,
      lastPracticedAt: true,
      subject: { select: { name: true } },
      steps: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          text: true,
          critical: true,
          _count: { select: { mistakes: true } },
        },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    subjectId: row.subjectId,
    subjectName: row.subject?.name ?? null,
    fromDocument: row.sourceDocumentId !== null,
    lastPracticedAt: row.lastPracticedAt,
    steps: row.steps.map((s) => ({
      id: s.id,
      order: s.position,
      text: s.text,
      critical: s.critical,
    })),
    /* A Mistake row per step carries `frequency`, so one row can stand for
       several misses. The count here is rows, not frequency, and the two can
       differ — which is why the interface says "missed before" rather than a
       number it would have to be precise about. */
    missCounts: new Map(row.steps.map((s) => [s.id, s._count.mistakes])),
  };
}
