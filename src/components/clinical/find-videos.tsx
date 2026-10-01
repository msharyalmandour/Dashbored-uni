"use client";

import * as React from "react";
import { toast } from "sonner";
import { Video, Loader2, ExternalLink, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { useI18n } from "@/components/shared/i18n-provider";
import { findVideosForProcedure, saveVideo, type VideoSearchResult } from "@/app/actions/video";
import { formatDuration } from "@/lib/video-search";

/**
 * "Show me someone doing this."
 *
 * An OSPE station is performed, and a checklist read off a page is a poor
 * rehearsal for a thing you have to do with your hands. The clip is the half
 * the checklist cannot carry.
 *
 * Collapsed until asked. Every search spends real quota on an outbound API, so
 * it runs on a tap and never on page load — and a procedure page that fired a
 * search each time it opened would spend a hundred units to show results
 * nobody asked for.
 */
export function FindVideos({ procedureId }: { procedureId: string }) {
  const { dict } = useI18n();
  const t = dict.clinical.videos;

  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<VideoSearchResult | null>(null);
  const [saved, setSaved] = React.useState<Set<string>>(new Set());

  async function search() {
    setBusy(true);
    try {
      setResult(await findVideosForProcedure(procedureId));
    } catch {
      toast.error(dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  async function keep(videoId: string, title: string) {
    // Marked saved before the round trip, and rolled back on failure: the tap
    // is a one-way choice and waiting on a network call to acknowledge it
    // makes a fast action feel broken.
    setSaved((prev) => new Set(prev).add(videoId));
    try {
      const res = await saveVideo({ videoId, title, procedureId });
      if (!res.ok) throw new Error(res.reason);
      toast.success(t.saved);
    } catch {
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      toast.error(dict.common.somethingWentWrong);
    }
  }

  if (result === null) {
    return (
      <Button variant="outline" size="sm" onClick={search} disabled={busy} className="self-start">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
        {t.find}
      </Button>
    );
  }

  if (result.kind === "NO_QUERY") {
    return <p className="text-sm text-muted-foreground">{t.noQuery}</p>;
  }

  /* No key configured, or the call failed. Both end the same way for him —
     here is the search, already typed — so both say so plainly and hand it
     over rather than reporting a fault he cannot fix from in here. */
  if (result.kind === "NO_KEY" || result.kind === "FAILED") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          {result.kind === "NO_KEY" ? t.notConfigured : t.searchFailed}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={result.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            {t.openOnYoutube}
          </a>
        </Button>
      </div>
    );
  }

  if (result.hits.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">{t.nothingFound}</p>
        <Button variant="outline" size="sm" onClick={search} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t.searchAgain}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The query is shown, because he should be able to see what was asked
          before he judges what came back. */}
      <p className="text-xs text-muted-foreground" dir="auto">
        {t.resultsFor.replace("{query}", result.query)}
      </p>

      <ul className="flex flex-col divide-y divide-[color:var(--border)]">
        {result.hits.map((hit) => {
          const length = formatDuration(hit.durationSeconds);
          const isSaved = saved.has(hit.videoId);
          return (
            <li key={hit.videoId} className="flex items-start gap-3 py-2.5">
              {hit.thumbnailUrl && (
                /* eslint-disable-next-line @next/next/no-img-element --
                   A YouTube thumbnail host cannot be enumerated for
                   next.config remotePatterns without pinning Google's CDN
                   domains, and these are decorative 320px images. */
                <img
                  src={hit.thumbnailUrl}
                  alt=""
                  width={96}
                  height={54}
                  loading="lazy"
                  className="hidden h-[54px] w-24 shrink-0 rounded-[calc(var(--radius)-2px)] object-cover sm:block"
                />
              )}
              <div className="min-w-0 flex-1">
                <ContentText as="p" className="text-sm leading-snug">
                  {hit.title}
                </ContentText>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate" dir="auto">{hit.channel}</span>
                  {/* Length is shown and never used to hide a result: a
                      forty-second clip is sometimes exactly the step he
                      forgot, and the app cannot tell. */}
                  {length && (
                    <span className="flex shrink-0 items-center gap-1 tabular-nums">
                      <Clock className="size-3" />
                      {length}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`https://www.youtube.com/watch?v=${hit.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.watch}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button
                  variant={isSaved ? "ghost" : "outline"}
                  size="sm"
                  disabled={isSaved}
                  onClick={() => keep(hit.videoId, hit.title)}
                >
                  {isSaved ? <Check className="size-4" /> : null}
                  {isSaved ? t.kept : t.keep}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
