import { Inbox as InboxIcon, PlugZap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { getInbox } from "@/lib/inbox";
import { getAiStatus } from "@/lib/ai/provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { DropZone } from "@/components/inbox/drop-zone";
import { InboxItem } from "@/components/inbox/inbox-item";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

/**
 * The one place anything can land.
 *
 * The drop surface comes first and the queue second, because the cost this
 * page is built to remove is the moment of hesitation before capturing —
 * deciding which of a dozen modules a half-formed thought belongs to. Here
 * there is nothing to decide: it goes in, and sorting is a separate act you
 * do when you have the attention for it.
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <DropZone aiConfigured={ai.configured} />

      {/* Said plainly, on the page, rather than hidden in a README: when no
          provider is connected nothing is analysed, and the app does not
          pretend otherwise. */}
      {!ai.configured && (
        <Card variant="quiet" className="flex items-start gap-3 p-4">
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

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <InboxIcon className="size-4 text-primary" />
          {t.waiting}
          {waiting.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {format(t.itemCount, { count: waiting.length })}
            </span>
          )}
        </h2>

        {waiting.length === 0 ? (
          <Card variant="quiet" className="p-6 text-center text-sm text-muted-foreground">
            {t.empty}
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {waiting.map((item) => (
              <InboxItem key={item.id} item={item} subjects={subjects} aiConfigured={ai.configured} />
            ))}
          </div>
        )}
      </section>

      {filed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.filed}</h2>
          <div className="flex flex-col gap-2">
            {filed.map((item) => (
              <Card key={item.id} variant="quiet" className="p-3 text-sm text-muted-foreground">
                {item.fileName ?? item.text?.slice(0, 120)}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
