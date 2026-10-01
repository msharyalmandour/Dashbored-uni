import { pageTitle } from "@/lib/i18n/page-title";
import { PlugZap } from "lucide-react";
import { getAiStatus } from "@/lib/ai/provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import { DropAnything } from "@/components/inbox/drop-anything";
import { Card } from "@/components/ui/card";

export const generateMetadata = pageTitle((dict) => dict.nav.items.inbox.label);
export const dynamic = "force-dynamic";

/**
 * The way in. Just the way in.
 *
 * WHAT WAS REMOVED AND WHY. This page used to read give → pending → done: the
 * orb, then a list of captures waiting on a decision, then a log of everything
 * the agent had filed. Measured on the real account, 2026-10-01, that queue
 * held:
 *
 *     FAILED        8   (every one of them an error)
 *     UNPROCESSED   2   (both carrying an error)
 *     NEEDS_REVIEW  1   (also an error, from 11 September)
 *     ORGANIZED     5   (the log, last written 10 September)
 *
 * Eleven rows, eleven errors. The "inbox" was a fault log wearing the name of
 * a workspace, and it asked the student to patrol it. Nothing has genuinely
 * needed his decision in three weeks.
 *
 * A queue is a thing you maintain. The promise of this app is that you hand it
 * something and it deals with it — so a queue is the interface admitting the
 * promise did not hold. When a drop fails, the fix is to say so once where the
 * student already is, or to retry; not to file the failure somewhere he is
 * expected to visit.
 *
 * So the page is now the orb and the one thing that stops it working. What the
 * agent did lands where the work lands — in the course, the lecture, the week
 * — which is where it is useful rather than in a second list of itself.
 */
export default async function InboxPage() {
  const dict = getDictionary(await getLocale());
  const t = dict.inbox;
  const ai = getAiStatus();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-10">
      <header className="text-center">
        <h1 className="t-display on-env">{t.pageHeading}</h1>
        <p className="t-meta on-env-quiet mt-1.5">{t.pageSubtitle}</p>
      </header>

      <DropAnything aiConfigured={ai.configured} canTranscribe={ai.canTranscribe} />

      {/* The one thing that stops the orb working, stated here rather than
          left for the student to infer from nothing happening. This is not a
          queue: it is a single fact about the machine, and it disappears the
          moment it stops being true. */}
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
    </div>
  );
}
