"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { parseOrThrow, shortText } from "@/lib/validation";
import {
  procedureQuery,
  subjectQuery,
  searchUrl,
  parseIsoDuration,
  rankHits,
  watchUrl,
  isVideoId,
  type VideoHit,
} from "@/lib/video-search";

/**
 * Search for a clip, and save the one he picks.
 *
 * NO MODEL IS IN THIS PATH, deliberately. `add_video` has been a tool on the
 * agent since the agent was built and the Video table holds zero rows, for the
 * same reason Procedure does: the agent is the only way in and it has had no
 * credit since 11 September. A search built on it would have shipped broken.
 *
 * YouTube's Data API costs 100 quota units for a search and 1 for the duration
 * lookup, against a free daily allowance of 10,000 — so roughly a hundred
 * searches a day, which is far past what one student does. The pure half of
 * this (queries, parsing, ordering) is in src/lib/video-search.ts and tested.
 */

/** Set in the deployment's environment. Absent is a supported state, not an error. */
const API_KEY = () => process.env.YOUTUBE_API_KEY?.trim() || null;

const MAX_RESULTS = 8;

export type VideoSearchResult =
  | { kind: "HITS"; query: string; hits: VideoHit[] }
  /* No key configured. The query is still returned with a YouTube URL, so the
     interface hands him the search instead of reporting a misconfiguration he
     cannot act on from inside the app. */
  | { kind: "NO_KEY"; query: string; url: string }
  /* The query reduced to nothing — a course called "Elective Course" has no
     searchable terms. Saying so beats searching for the qualifier alone. */
  | { kind: "NO_QUERY" }
  | { kind: "FAILED"; query: string; url: string };

/**
 * Clips for one procedure. Ownership is proved before the name is used,
 * because the name becomes an outbound request.
 */
export async function findVideosForProcedure(procedureId: string): Promise<VideoSearchResult> {
  const userId = await requireUserId();

  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, userId },
    select: { name: true },
  });
  if (!procedure) return { kind: "NO_QUERY" };

  return runSearch(procedureQuery(procedure.name));
}

/** Clips for a whole course — "the department", rather than one skill. */
export async function findVideosForSubject(subjectId: string): Promise<VideoSearchResult> {
  const userId = await requireUserId();

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId },
    select: { name: true },
  });
  if (!subject) return { kind: "NO_QUERY" };

  return runSearch(subjectQuery(subject.name));
}

async function runSearch(query: string): Promise<VideoSearchResult> {
  if (query === "") return { kind: "NO_QUERY" };

  const key = API_KEY();
  if (!key) return { kind: "NO_KEY", query, url: searchUrl(query) };

  try {
    const hits = await youtubeSearch(query, key);
    // An empty result set is reported as hits, not as a failure: "nothing
    // found" is a true answer and a different one from "the search broke".
    return { kind: "HITS", query, hits: rankHits(query, hits) };
  } catch {
    // Whatever went wrong out there, he still gets the search. Never surface
    // the key or the upstream message.
    return { kind: "FAILED", query, url: searchUrl(query) };
  }
}

async function youtubeSearch(query: string, key: string): Promise<VideoHit[]> {
  const search = new URL("https://www.googleapis.com/youtube/v3/search");
  search.searchParams.set("key", key);
  search.searchParams.set("q", query);
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("maxResults", String(MAX_RESULTS));
  // Embeddable only, so a result that cannot be opened is not offered.
  search.searchParams.set("videoEmbeddable", "true");
  search.searchParams.set("safeSearch", "strict");

  const res = await fetch(search, { cache: "no-store" });
  if (!res.ok) throw new Error(`search ${res.status}`);

  const body: unknown = await res.json();
  const items = Array.isArray((body as { items?: unknown }).items)
    ? ((body as { items: unknown[] }).items)
    : [];

  const partial: VideoHit[] = [];
  for (const raw of items) {
    const item = raw as {
      id?: { videoId?: unknown };
      snippet?: { title?: unknown; channelTitle?: unknown; thumbnails?: Record<string, { url?: unknown }> };
    };
    const videoId = item.id?.videoId;
    // Everything here crossed the network. An id that is not an id is dropped
    // rather than concatenated into a URL this app stores and renders.
    if (!isVideoId(videoId)) continue;

    const title = typeof item.snippet?.title === "string" ? item.snippet.title : "";
    if (title === "") continue;

    const thumb = item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url;

    partial.push({
      videoId,
      title,
      channel: typeof item.snippet?.channelTitle === "string" ? item.snippet.channelTitle : "",
      durationSeconds: null,
      thumbnailUrl: typeof thumb === "string" ? thumb : null,
    });
  }

  if (partial.length === 0) return [];

  /* Durations come from a second call because search.list does not carry
     them, and the length is the one fact that separates a demonstration from
     a forty-second clip. One unit of quota, and a failure here leaves the
     durations null rather than losing the results. */
  try {
    const videos = new URL("https://www.googleapis.com/youtube/v3/videos");
    videos.searchParams.set("key", key);
    videos.searchParams.set("part", "contentDetails");
    videos.searchParams.set("id", partial.map((h) => h.videoId).join(","));

    const dRes = await fetch(videos, { cache: "no-store" });
    if (dRes.ok) {
      const dBody: unknown = await dRes.json();
      const dItems = Array.isArray((dBody as { items?: unknown }).items)
        ? ((dBody as { items: unknown[] }).items)
        : [];
      const byId = new Map<string, number | null>();
      for (const raw of dItems) {
        const item = raw as { id?: unknown; contentDetails?: { duration?: unknown } };
        if (!isVideoId(item.id)) continue;
        const iso = item.contentDetails?.duration;
        byId.set(item.id, parseIsoDuration(typeof iso === "string" ? iso : null));
      }
      for (const hit of partial) {
        hit.durationSeconds = byId.get(hit.videoId) ?? null;
      }
    }
  } catch {
    // Durations are a nicety; the results are the point.
  }

  return partial;
}

/* ────────────────────────────────────────────────────────────────────────────
   Saving
   ──────────────────────────────────────────────────────────────────────────── */

export type SaveVideoResult = { ok: true } | { ok: false; reason: "BAD_ID" | "NOT_FOUND" };

/**
 * Keep a clip.
 *
 * The URL is rebuilt from the id rather than accepted from the client, so what
 * is stored cannot be an arbitrary link the page was talked into submitting.
 * `sourceCaptureId` stays null: this is his own choice, not an agent write,
 * and "undo that drop" must never remove it.
 */
export async function saveVideo(input: {
  videoId: string;
  title: string;
  procedureId?: string | null;
  subjectId?: string | null;
}): Promise<SaveVideoResult> {
  const userId = await requireUserId();

  if (!isVideoId(input.videoId)) return { ok: false, reason: "BAD_ID" };
  const title = parseOrThrow(shortText, input.title, "title");

  /* A procedure carries the course it is filed under, so saving against a
     procedure files the clip under the same course without asking again. */
  let subjectId: string | null = null;
  if (input.procedureId) {
    const procedure = await prisma.procedure.findFirst({
      where: { id: input.procedureId, userId },
      select: { subjectId: true },
    });
    if (!procedure) return { ok: false, reason: "NOT_FOUND" };
    subjectId = procedure.subjectId;
  } else if (input.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: input.subjectId, userId },
      select: { id: true },
    });
    if (!subject) return { ok: false, reason: "NOT_FOUND" };
    subjectId = subject.id;
  }

  const url = watchUrl(input.videoId);

  // Saving the same clip twice is a mis-tap, not a second video.
  const existing = await prisma.video.findFirst({
    where: { userId, url },
    select: { id: true },
  });
  if (existing) {
    if (subjectId) {
      await prisma.video.update({ where: { id: existing.id }, data: { subjectId } });
    }
  } else {
    await prisma.video.create({
      data: { userId, title, url, subjectId, platform: "YOUTUBE" },
    });
  }

  revalidatePath("/clinical");
  if (input.procedureId) revalidatePath(`/clinical/${input.procedureId}`);
  return { ok: true };
}
