import { PlugZap, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { getInbox } from "@/lib/inbox";
import { getAiStatus } from "@/lib/ai/provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { DropAnything } from "@/components/inbox/drop-anything";
import { InboxItem } from "@/components/inbox/inbox-item";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Drop Anything" };
export const dynamic = "force-dynamic";

/**
 * The input gateway.
 *
 * The orb is the page — everything else is deliberately quieter and further
 * down. That ordering is the product argument: the student's first move is to
 * hand the system something, not to survey a queue. What is still waiting sits
 * below, and what has already been organised sits below that, so the page
 * reads top to bottom as give → pending → done.
 */
export default async function InboxPage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());
  const t = dict.inbox;
  const ai = getAiStatus();

  const [{ waiting, filed }, subjects] = await Promise.all([
    getInbox(userId),
    prisma.subject.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-10">
      <header className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t.pageHeading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.pageSubtitle}</p>
      </header>

      <DropAnything aiConfigured={ai.configured} subjects={subjects} />

      {/* Stated once, on the page, rather than left for someone to discover by
          wondering why nothing was understood. */}
      {!ai.configured && (
        <Card variant="quiet" className="flex w-full items-start gap-3 p-4">
          <PlugZap className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t.aiOffTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.aiOffBody}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {format(t.aiOffEnv, { envVar: ai.requiredEnvVar })}
            </p>
          </div>
        </Card>
      )}

      {waiting.length > 0 && (
        <section className="w-full">
          <h2 className="mb-3 text-sm font-semibold">
            {t.waiting}{" "}
            <span className="font-normal text-muted-foreground">
              {format(t.itemCount, { count: waiting.length })}
            </span>
          </h2>
          <div className="flex flex-col gap-3">
            {waiting.map((item) => (
              <div key={item.id} id={`capture-${item.id}`}>
                <InboxItem item={item} subjects={subjects} aiConfigured={ai.configured} />
              </div>
            ))}
          </div>
        </section>
      )}

      {filed.length > 0 && (
        <section className="w-full">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="size-3.5" />
            {t.recentActivity}
          </h2>
          <div className="flex flex-col gap-2">
            {filed.map((item) => (
              <Card key={item.id} variant="quiet" className="flex items-center gap-3 p-3">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                  {item.analysis?.title ?? item.fileName ?? item.text?.slice(0, 120)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.savedAsNote}</span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
