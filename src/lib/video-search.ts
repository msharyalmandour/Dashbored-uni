/**
 * Finding a clip for a procedure or a course — the pure half.
 *
 * ARCHITECTURE, and the reason it is this way: the obvious build is a tool on
 * the agent. `add_video` already is one. It has written zero rows, like every
 * other agent-only output on this account, because the agent has had no credit
 * since 11 September. Putting the search there too would ship a feature born
 * dead on the day it merged.
 *
 * So the search talks to YouTube's Data API directly from a server action, and
 * no model is in the path. A model would earn its place at exactly one job —
 * mapping an Arabic term to the English one the clips are titled in — and that
 * is an improvement on a thing that already works, not a dependency.
 *
 * Everything in this file is pure and offline. The fetch lives in
 * src/app/actions/video.ts; what is hard to get right is the query and the
 * reading of the response, and those are here where they can be tested.
 */

/* ────────────────────────────────────────────────────────────────────────────
   The query
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * A course code as his university writes it: "NURC (410)", "NURP (431)".
 *
 * Stripped from any query built off a course name. "NURC 410" is an identifier
 * inside one institution and nowhere else; leaving it in a video search is the
 * difference between searching for critical care nursing and searching for
 * nothing at all.
 */
const COURSE_CODE = /\b[A-Z]{2,5}\s*\(?\s*\d{3,4}\s*\)?/g;

/**
 * Words that say where a thing sits in a curriculum rather than what it is.
 * They make a course name readable and a search query worse.
 */
const CURRICULUM_NOISE = new Set([
  "course",
  "elective",
  "module",
  "unit",
  "level",
  "semester",
  "theory",
  "practical",
  "lab",
  "i",
  "ii",
  "iii",
  "iv",
]);

/**
 * What a clinical teaching clip is usually titled with, appended so the
 * results are demonstrations rather than lectures about the concept.
 *
 * One qualifier, not a pile. Stuffing a query with synonyms narrows it to
 * videos whose title happens to carry all of them, which is the opposite of
 * the intent.
 */
const CLINICAL_QUALIFIER = "nursing procedure";

/** Strip a course code and the curriculum furniture from a name. */
export function subjectTerms(name: string): string {
  const withoutCode = name.replace(COURSE_CODE, " ");
  const words = withoutCode
    .replace(/[()[\]{}]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w !== "" && !CURRICULUM_NOISE.has(w.toLowerCase()));
  return words.join(" ");
}

/**
 * The query for a procedure.
 *
 * The procedure's own name carries the whole subject, so the course adds
 * nothing and is deliberately not mixed in: "Nasogastric tube insertion" is
 * already unambiguous, and "Nasogastric tube insertion Critical Care Nursing"
 * is a narrower search for no gain.
 */
export function procedureQuery(procedureName: string): string {
  const name = procedureName.trim().replace(/\s+/g, " ");
  if (name === "") return "";
  // Already asks for a demonstration — do not say it twice.
  if (/\b(procedure|technique|demonstration|skill)\b/i.test(name)) return name;
  return `${name} ${CLINICAL_QUALIFIER}`;
}

/**
 * The query for a whole course, used when the student wants clips for the
 * department rather than for one skill.
 */
export function subjectQuery(subjectName: string): string {
  const terms = subjectTerms(subjectName);
  if (terms === "") return "";
  return `${terms} ${CLINICAL_QUALIFIER}`;
}

/**
 * Where to send the student when no API key is configured.
 *
 * This is the honest fallback and not a stub: it is the same query, run by
 * YouTube itself. The feature degrades from "pick a result here and save it"
 * to "here is the search, already typed" — which is strictly better than a
 * button that reports a misconfiguration the student cannot fix.
 */
export function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Reading the response
   ──────────────────────────────────────────────────────────────────────────── */

export interface VideoHit {
  videoId: string;
  title: string;
  channel: string;
  /** Seconds. Null when the API did not say — never zero, which means instant. */
  durationSeconds: number | null;
  thumbnailUrl: string | null;
}

/**
 * ISO 8601 duration, which is how YouTube reports length: PT4M13S, PT1H2M,
 * PT45S, and for a livestream sometimes P0D.
 *
 * Returned in seconds, or null when the string says no length. Null rather
 * than 0 because the interface shows duration and "0:00" is a claim about a
 * video; an absence is not.
 */
export function parseIsoDuration(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso.trim());
  if (!m) return null;

  const [, d, h, min, s] = m;
  // A match with no component at all is "P" or "PT" — a shape, not a length.
  if (!d && !h && !min && !s) return null;

  const total =
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Math.floor(Number(s ?? 0));

  return total > 0 ? total : null;
}

/** mm:ss, or h:mm:ss past the hour. Never a bare number of seconds. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Ordering
   ──────────────────────────────────────────────────────────────────────────── */

/** Words too common to carry any signal about what a clip shows. */
const STOPWORDS = new Set(["the", "a", "an", "of", "for", "and", "in", "on", "to", "with", "how"]);

function terms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Order the hits by how much of the query their title actually carries.
 *
 * This is the ONLY ranking signal, and the restraint is the point. View count,
 * channel size and upload date are all available and none of them says whether
 * a clip teaches this procedure correctly — a popular video of the wrong
 * technique is the worst possible result to put first. Title overlap is
 * mechanical, explainable in one sentence, and does not pretend to judge
 * teaching quality, which the app cannot do and should not imply it can.
 *
 * Nothing is filtered out. A hit that matches nothing goes last and stays
 * visible, because the student can tell at a glance what the app cannot.
 */
export function rankHits(query: string, hits: VideoHit[]): VideoHit[] {
  const wanted = new Set(terms(query));
  if (wanted.size === 0) return [...hits];

  const scored = hits.map((hit, i) => {
    const got = new Set(terms(hit.title));
    let overlap = 0;
    for (const w of wanted) if (got.has(w)) overlap += 1;
    return { hit, overlap, i };
  });

  // A stable sort on (overlap desc, original index asc): ties keep the order
  // YouTube returned them in, which is its relevance ranking and a better
  // tiebreak than anything invented here.
  scored.sort((a, b) => (b.overlap - a.overlap) || (a.i - b.i));
  return scored.map((s) => s.hit);
}

/** The watch URL to store, built from the id rather than trusted from a payload. */
export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/**
 * A YouTube video id, as a shape.
 *
 * Checked because the id comes back over the network and ends up in a URL this
 * app stores and later renders as a link. Eleven characters of the URL-safe
 * alphabet is the documented form.
 */
export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}
