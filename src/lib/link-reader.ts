import { lookup } from "node:dns/promises";

/**
 * Opens a link the student pasted, and brings back what it says.
 *
 * The attach menu has offered "paste a link" for a while and it did nothing:
 * `confirmLink` appended the URL to the note text, and the agent was handed a
 * string of characters. So a course page, a reading, a syllabus on the
 * university portal all reached the model as `https://…` and it guessed from
 * the path.
 *
 * Fetching a URL that a user supplied is the one place in this app where the
 * server can be talked into making a request on someone else's behalf, so the
 * rules are strict and all of them are enforced here rather than trusted to a
 * caller:
 *
 *   - **http and https only.** `file://` would read the server's disk;
 *     `gopher://` and friends can be used to talk to other protocols.
 *   - **No private address space.** The hostname is resolved and every address
 *     it resolves to is checked, because `internal.example.com` resolving to
 *     10.0.0.5 is the ordinary way this is abused — and a name can resolve
 *     differently from one moment to the next, so redirects are re-checked too.
 *   - **Redirects followed by hand.** Each hop goes through the same checks. A
 *     public URL that redirects to 169.254.169.254 is the textbook version of
 *     this attack.
 *   - **A timeout and a size cap.** A page that never finishes, or is a
 *     gigabyte, must cost this request nothing more than the budget it was
 *     given.
 *   - **Text only.** Anything else is reported honestly rather than guessed at.
 *
 * One gap is known and left open deliberately, because closing it properly is a
 * larger change than it looks: the name is resolved here and then handed to
 * fetch, which resolves it again, so a name that answers publicly the first
 * time and privately the second is not caught. Closing it means connecting to
 * the address this code checked and carrying the hostname separately, which
 * means taking over certificate verification — more ways to be wrong than the
 * hole it closes. What bounds it meanwhile is that nothing fetched is ever sent
 * anywhere: this only ever GETs a URL the student themselves put in a note, and
 * the result goes to the model fenced as untrusted text.
 */

/** Long enough for a slow university portal, short enough to leave the run room. */
const TIMEOUT_MS = 8_000;

/** Enough for any page worth reading; the tail of a huge page adds nothing. */
const MAX_BYTES = 1_500_000;

/** What survives into the agent's context. */
const MAX_TEXT_CHARS = 12_000;

/** Redirect chains longer than this are a loop or a tarpit. */
const MAX_HOPS = 4;

/** At most this many links from one note, so a wall of URLs cannot eat the run. */
export const MAX_LINKS_PER_ITEM = 2;

export type LinkFailure =
  | "NOT_A_WEB_LINK"
  | "PRIVATE_ADDRESS"
  | "TOO_MANY_REDIRECTS"
  | "TIMED_OUT"
  | "NOT_READABLE"
  | "UNREACHABLE";

export type LinkResult =
  | { ok: true; url: string; title: string | null; text: string }
  | { ok: false; url: string; reason: LinkFailure };

/**
 * URLs inside a note, in the order they appear.
 *
 * Deliberately only matches an explicit scheme. Bare `example.com` is far more
 * often a sentence about something than a request to go and read it, and
 * fetching on that guess is exactly the kind of surprise a student should never
 * get from typing a note.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of matches) {
    // Trailing punctuation belongs to the sentence, not the address.
    const url = raw.replace(/[.,;:!?]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * Whether an IP address is one the server must never be pointed at.
 *
 * Exported because it is the security boundary, and a boundary that cannot be
 * tested is a boundary nobody knows the state of.
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();

  // IPv6, including the mapped-IPv4 form that would otherwise slip past the
  // v4 checks below.
  if (ip.includes(":")) {
    if (ip === "::" || ip === "::1") return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(ip)) return true;
    if (/^fe[89ab]/.test(ip)) return true;
    return false;
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;

  if (a === 0) return true;                          // this network
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // private
  if (a === 192 && b === 168) return true;           // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
  if (a === 192 && b === 0) return true;             // protocol assignments
  if (a >= 224) return true;                         // multicast and reserved
  return false;
}

/** One hop's URL, checked as thoroughly as the first. */
async function checkTarget(url: string): Promise<{ ok: true; parsed: URL } | { ok: false; reason: LinkFailure }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "NOT_A_WEB_LINK" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "NOT_A_WEB_LINK" };
  }

  // A literal address is checked directly; a name is resolved first, and every
  // address it resolves to has to pass. `all: true` matters — a name that
  // resolves to one public and one private address must be refused, not raced.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    return isPrivateAddress(host) ? { ok: false, reason: "PRIVATE_ADDRESS" } : { ok: true, parsed };
  }

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return { ok: false, reason: "UNREACHABLE" };
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      return { ok: false, reason: "PRIVATE_ADDRESS" };
    }
  } catch {
    return { ok: false, reason: "UNREACHABLE" };
  }

  return { ok: true, parsed };
}

/** The readable prose inside an HTML document. */
export function htmlToText(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() || null : null;

  const text = decodeEntities(
    html
      // Removed wholesale rather than stripped of tags: their contents are code
      // and chrome, and leaving them in buries the page's actual words in
      // minified JavaScript.
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      // Block boundaries become line breaks before the tags go, so a table of
      // dates does not collapse into one unreadable line.
      .replace(/<\/(p|div|section|article|li|tr|h[1-6]|td|th|br)\s*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => safeCodePoint(parseInt(code, 16)))
    .replace(/&amp;/gi, "&");
}

function safeCodePoint(code: number): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

/**
 * Fetches one link and returns its readable text.
 *
 * Never throws: a link that cannot be read is a result, because the drop it
 * belongs to still has a note in it worth organising and a thrown error would
 * take the whole thing down with it.
 */
export async function readLink(url: string, fetchImpl: typeof fetch = fetch): Promise<LinkResult> {
  let target = url;

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const checked = await checkTarget(target);
    if (!checked.ok) return { ok: false, url, reason: checked.reason };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchImpl(checked.parsed.toString(), {
        // Followed by hand so every hop goes through the checks above. Letting
        // fetch follow them would mean the last URL is never validated, which
        // is the whole attack.
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Named honestly. A student's university portal may well decide what
          // to serve based on this, and pretending to be a browser to get
          // around that is not this app's business.
          "user-agent": "UniversityOS/1.0 (+link preview for the student who pasted it)",
          accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
          "accept-language": "en,ar;q=0.9",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return { ok: false, url, reason: aborted ? "TIMED_OUT" : "UNREACHABLE" };
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, url, reason: "UNREACHABLE" };
      target = new URL(location, checked.parsed).toString();
      continue;
    }

    if (!response.ok) return { ok: false, url, reason: "UNREACHABLE" };

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const readable =
      contentType.includes("text/html") ||
      contentType.includes("text/plain") ||
      contentType.includes("application/json") ||
      contentType.includes("xhtml");
    if (!readable) return { ok: false, url, reason: "NOT_READABLE" };

    // The declared length is a claim; the cap is enforced on what actually
    // arrives, because a lying header is the cheap way past a size limit.
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) return { ok: false, url, reason: "NOT_READABLE" };

    let body: string;
    try {
      body = await readCapped(response, MAX_BYTES);
    } catch {
      return { ok: false, url, reason: "UNREACHABLE" };
    }

    const { title, text } = contentType.includes("html") || contentType.includes("xhtml")
      ? htmlToText(body)
      : { title: null, text: body.trim() };

    if (text.length < 40) return { ok: false, url, reason: "NOT_READABLE" };
    return { ok: true, url, title, text: text.slice(0, MAX_TEXT_CHARS) };
  }

  return { ok: false, url, reason: "TOO_MANY_REDIRECTS" };
}

/** Reads at most `limit` bytes of a response, then stops pulling. */
async function readCapped(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, limit);

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  // Cancelled rather than drained: the point of the cap is not to receive the
  // rest.
  await reader.cancel().catch(() => {});

  const joined = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= joined.length) break;
    // Advanced by what was actually written, not by the chunk's own length.
    // The last chunk is usually truncated to fit, and counting its full size
    // would leave the offset past the end with bytes still unwritten — a
    // silently short page, which reads as a site that said less than it did.
    const written = chunk.subarray(0, joined.length - offset);
    joined.set(written, offset);
    offset += written.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(joined);
}
