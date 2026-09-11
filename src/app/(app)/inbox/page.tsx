import { pageTitle } from "@/lib/i18n/page-title";
import { PlugZap, Sparkles } from "lucide-react";
import { getCurrentUserId } from "@/lib/current-user";
import { getInbox } from "@/lib/inbox";
import { getAiStatus } from "@/lib/ai/provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { DropAnything } from "@/components/inbox/drop-anything";
import { InboxItem } from "@/components/inbox/inbox-item";
import { UndoDrop } from "@/components/inbox/undo-drop";
import { Card } from "@/components/ui/card";

export const generateMetadata = pageTitle((dict) => dict.nav.items.inbox.label);
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

  // Subjects used to be fetched here to fill a course dropdown on every
  // waiting item. Nothing on this page asks the student to pick a course any
  // more, so the query went with the form.
  const { waiting, filed } = await getInbox(userId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-10">
      <header className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t.pageHeading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.pageSubtitle}</p>
      </header>

      <DropAnything aiConfigured={ai.configured} canTranscribe={ai.canTranscribe} />

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
                <InboxItem item={item} aiConfigured={ai.configured} />
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
                {/* The agent's own account of what it did comes first: for
                    anything it organised, "put 6 classes into your week" says
                    more than the file name it came from. Older rows have no
                    such account, so they fall back to what they always
                    showed. */}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                  {item.agentSummary ?? item.analysis?.title ?? item.fileName ?? item.text?.slice(0, 120)}
                </span>
                {item.agentActions.length > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(t.itemCount, { count: item.agentActions.length })}
                  </span>
                )}
                {/* Undo lives here as well as in the panel, and this is the
                    copy that matters for an armful: a batch has no single row
                    for the panel to offer it on, and its items leave the
                    waiting list the moment they are organised. This is the only
                    place a student can find the sixth file of ten and take
                    just that one back. */}
                {item.agentActions.length > 0 && (
                  <UndoDrop captureId={item.id} className="shrink-0 text-muted-foreground" />
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
