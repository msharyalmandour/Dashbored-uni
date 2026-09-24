"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, PlugZap } from "lucide-react";
import { DropAnything } from "@/components/inbox/drop-anything";
import { useI18n } from "@/components/shared/i18n-provider";
import { aiPrompts, type AiPromptKey } from "@/lib/home-metrics";

/**
 * AI COMMAND — a section, not a card, and not the hero.
 *
 * The brief's requirement was that the assistant read as a first-class
 * capability rather than a search box with a spark on it, and the way this
 * earns that is by being the only section on Home with its own ground: a
 * bordered slab with the bloom behind it, its own eyebrow, its own headline,
 * and the orb at a size nothing else on the page competes with.
 *
 * What it is NOT is a second implementation. The input is the real
 * `DropAnything` — the same component /inbox runs, calling the same agent with
 * the same twenty tools, the same undo, the same review pass. A prettier copy
 * that posted somewhere else would be a second product to keep in step, and
 * the first time they diverged the student would find out by losing work.
 *
 * Honesty about capability is enforced in two places. `aiConfigured` is read
 * from the environment, and with no key this renders a plain statement instead
 * of a live-looking box that fails on submit. And the suggested prompts come
 * from `aiPrompts`, each of which verify-home-metrics.ts asserts maps to a
 * tool that exists in tools.ts — which is why "plan my study week" and
 * "summarise my lecture", both in the reference designs, are absent: this
 * agent has no planner and no summariser.
 */
export function AiCommand({
  aiConfigured,
  canTranscribe,
}: {
  aiConfigured: boolean;
  canTranscribe: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.home.ai;

  /* Re-seeding the field by remount. `DropAnything` owns its text once
     mounted — which is correct, the student is typing in it — so a suggestion
     arrives as a fresh mount carrying the words. Only reachable while idle,
     because the chips are only rendered then. */
  const [seed, setSeed] = React.useState("");
  const prompts = aiPrompts(aiConfigured);

  return (
    <section
      aria-labelledby="uos-ai"
      className="relative isolate overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--card)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-72"
        style={{ backgroundImage: "var(--brand-glow)" }}
      />

      <div className="relative flex flex-col items-center gap-2 px-5 pb-8 pt-9 text-center sm:px-8 sm:pt-11">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">
          {t.eyebrow}
        </p>

        <h2
          id="uos-ai"
          className="font-display mt-1 text-balance text-[clamp(1.5rem,3.4vw,2.25rem)] font-semibold leading-[1.1] tracking-tight"
        >
          {t.headline}{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--brand-gradient)" }}
          >
            {t.headlineAccent}
          </span>
        </h2>

        <p className="mt-2 max-w-[48ch] text-balance text-sm leading-relaxed text-muted-foreground">
          {t.sub}
        </p>

        {aiConfigured ? (
          <>
            {/* The orb and the field, at the size this section exists to give
                them. `bare` drops DropAnything's own headline — this section
                already said it, and twice would be the duplication the rest of
                this page just had removed. */}
            <div className="mt-6 w-full max-w-2xl">
              <DropAnything
                key={seed}
                initialNote={seed}
                aiConfigured={aiConfigured}
                canTranscribe={canTranscribe}
                bare
              />
            </div>

            {prompts.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">{t.promptsLabel}</span>
                {prompts.map((key: AiPromptKey) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeed(t.prompts[key])}
                    className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--border-active)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
                  >
                    {t.prompts[key]}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* No key, no pretence. The agent cannot run, so there is no input to
             offer — a box that accepts a question and then fails reads as a
             broken product rather than an unconfigured one. */
          <div className="mt-6 flex w-full max-w-md flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-6">
            <PlugZap className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">{t.unavailable}</p>
            <p className="text-xs text-muted-foreground">{t.unavailableHint}</p>
          </div>
        )}

        <Link
          href="/inbox"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          {t.open}
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
