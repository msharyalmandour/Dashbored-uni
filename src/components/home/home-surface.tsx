"use client";

import * as React from "react";
import { useI18n } from "@/components/shared/i18n-provider";
import { DropAnything } from "@/components/inbox/drop-anything";

/**
 * The top of Home: the one way in.
 *
 * This used to BE Home — a full screen holding a question and an orb, with the
 * day itself moved to a second page called "Dashboard". That was a mistake, and
 * the shape of it was plain in the code: this page read the whole day's data
 * and then deliberately showed one number out of it, while the page a student
 * actually needed sat behind a different word in the sidebar. They had two
 * homes and the real one was not called Home.
 *
 * So the day came back, and this became the band above it. The orb keeps its
 * weight — it is still the one object that can answer "what am I doing now?"
 * from anything a student throws at it — but it no longer occupies a whole
 * viewport to say so, because what it sits above is now worth seeing without
 * scrolling.
 *
 * The four links that used to sit at the bottom edge are gone. They were a
 * second navigation with the same destinations as the sidebar, and one of them
 * pointed at the other home. What replaces them is underneath: real things,
 * each of which is the way into its own world.
 *
 * `DropAnything` is unchanged — the same component doing the same work.
 */
export function HomeSurface({
  aiConfigured,
  canTranscribe,
}: {
  aiConfigured: boolean;
  canTranscribe: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.home;

  /* The name, the time of day and what is due are all still said — by the day's
     own header, immediately below, which knows the date as well. They used to
     be said here because this was the whole page. */

  return (
    <div className="relative flex flex-col">
      {/* No greeting here.
          There is one immediately below, in the day's own header, and it is the
          better of the two — it knows the time of day and the date. Two
          greetings on one page was the first thing the merge made obvious: each
          half had been written as the top of its own page. */}
      {/* The centre of gravity. Everything above and below is edge. */}
      <div className="flex flex-col items-center justify-center gap-2 pb-1 sm:gap-3">
        <h1
          className="on-env orb-word max-w-[18ch] text-balance text-center text-[clamp(1.25rem,2.6vw,1.75rem)] font-semibold leading-[1.1] tracking-tight"
          style={{ animationDelay: "120ms" }}
        >
          {t.ask}
        </h1>

        {/* The whole drop surface — orb, field, controls, and every state it
            can be in. Unchanged in behaviour; this page only decides where it
            lives and how much room it gets. */}
        <div className="w-full max-w-2xl">
          <DropAnything aiConfigured={aiConfigured} canTranscribe={canTranscribe} bare />
        </div>
        {/* The line that used to sit here said "give me anything and I'll sort
            it out". The field's own placeholder, four pixels above it, says
            "drop anything here, paste it, or tell me what's going on" — the
            same promise, in the place where it is acted on. Two sentences
            saying one thing cost the band that the day needed. */}
      </div>

    </div>
  );
}
