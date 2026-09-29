import Link from "next/link";
import { RotateCcw, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ContentText } from "@/components/ui/content-text";
import { resumable, type SessionRow, type TargetKind } from "@/lib/follow-through";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * "You stopped part way." The offer to pick it up again.
 *
 * Measured on the real account: nine study sessions, seven abandoned, and not
 * one of those seven recorded a single minute — they stopped before any work
 * registered. Nothing in the app ever mentioned it again. Every competitor
 * optimises the moment material arrives; this is the moment the student
 * stopped, which is the one the numbers say actually happens.
 *
 * ONE, NOT A LIST. Seven abandonments offered back as a list is a ledger of
 * failures, and nobody needs to be handed that on opening an app. The most
 * recent one is the only one with any claim on now.
 *
 * AND ONLY IF IT CAN BE FINISHED. `resumable` refuses a session whose target
 * was a bare timer or a free-typed intention, which on the real history is all
 * seven of them — so this renders nothing today, and that is the honest
 * outcome rather than a bug. "Carry on with 'I study the lecture'" resumes
 * nothing; there is no page to open and no condition under which it ends. Once
 * sessions start from a task or a card, which is what targetKind now records,
 * this has something true to offer.
 *
 * No progress figure, deliberately. The abandoned sessions carry
 * actualMinutes = null, so any "you were 40% through" would be invented — and
 * inventing a number about how far someone got before giving up is a
 * particularly bad place to start lying.
 */
export async function ResumeSession({ userId, dict }: { userId: string; dict: Dictionary }) {
  const now = new Date();

  /* Only what `resumable` needs, and only recent rows. The window in
     follow-through.ts is four days; a fortnight is fetched so the module makes
     the cut-off decision rather than the query silently making it twice. */
  const rows = await prisma.focusSession.findMany({
    where: {
      userId,
      status: "ABANDONED",
      startedAt: { gte: new Date(now.getTime() - 14 * 86_400_000) },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      actualMinutes: true,
      taskLabel: true,
      targetKind: true,
      targetRefId: true,
      subject: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  const sessions: SessionRow[] = rows.map((r) => ({
    id: r.id,
    status: "ABANDONED",
    startedAt: r.startedAt,
    actualMinutes: r.actualMinutes,
    target: {
      /* Null targetKind means the session predates the column. It is mapped to
         NONE rather than guessed at from the label — the same rule the column's
         own comment sets, and the reason `resumable` will decline it. */
      kind: (r.targetKind ?? "NONE") as TargetKind,
      refId: r.targetRefId ?? undefined,
      label: r.taskLabel ?? undefined,
    },
  }));

  const pick = resumable(sessions, now);
  if (!pick) return null;

  const row = rows.find((r) => r.id === pick.id)!;
  const href = hrefFor(pick.target.kind, pick.target.refId);
  const t = dict.home.resume;

  return (
    <Link
      href={href}
      className="group/res flex items-center gap-4 rounded-[var(--radius-lg)] border border-[color:var(--border-active)] bg-[color:var(--card)] px-5 py-4 transition-colors hover:border-[color:var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[color:var(--accent)] text-[color:var(--primary)]">
        <RotateCcw className="size-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
          {t.heading}
        </p>
        <ContentText as="p" className="mt-1 truncate font-medium">
          {pick.target.label ?? t.body}
        </ContentText>
        {row.subject?.name && (
          <ContentText as="p" className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.subject.name}
          </ContentText>
        )}
      </div>

      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-[color:var(--primary)]">
        {t.action}
        <ArrowRight className="size-4 transition-transform group-hover/res:translate-x-0.5 rtl:rotate-180 rtl:group-hover/res:-translate-x-0.5" />
      </span>
    </Link>
  );
}

/**
 * Where picking it up actually goes.
 *
 * Every branch names a route that exists. `resumable` has already refused FREE
 * and NONE, so those cannot reach here — and the fallback is /today rather
 * than a guess, because a link that lands nowhere is worse than no link.
 */
function hrefFor(kind: TargetKind, refId?: string): string {
  if (!refId) return "/today";
  switch (kind) {
    case "TASK":
      return "/tasks";
    case "CARD":
      return "/flashcards";
    case "GAP":
      return `/knowledge-gaps?gap=${refId}`;
    case "LECTURE_SECTION":
      return `/lectures/${refId}`;
    default:
      return "/today";
  }
}
