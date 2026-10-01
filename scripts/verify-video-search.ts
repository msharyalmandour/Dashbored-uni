/**
 * Finding a clip for a procedure.
 *
 * The queries are built from this student's real course names, because those
 * names are the reason the query layer exists: "NURC (410) Critical Care
 * Nursing" searched verbatim finds nothing, and the code that is wrong here is
 * wrong invisibly — a search simply returns the wrong clips and nobody can
 * tell whether the feature or the field is at fault.
 *
 * Run: npx tsx scripts/verify-video-search.ts
 */

import {
  subjectTerms,
  procedureQuery,
  subjectQuery,
  searchUrl,
  parseIsoDuration,
  formatDuration,
  rankHits,
  watchUrl,
  isVideoId,
  type VideoHit,
} from "../src/lib/video-search";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Video search\n");

/* ── The query, on his own six course names ───────────────────────────────── */

{
  // Verbatim from the Subject table on 2026-10-01.
  const real = [
    "NURC (410) Critical Care Nursing",
    "NURC (411) Critical Care Nursing",
    "NURP (431) Nursing Leadership",
    "NURP (432) Nursing Leadership",
    "NURM (410) Research Methods",
    "Elective Course",
  ];

  ok("the course code is stripped",
    subjectTerms(real[0]) === "Critical Care Nursing", subjectTerms(real[0]));
  ok("every code shape his university uses is stripped",
    real.slice(0, 5).every((n) => !/\d{3}/.test(subjectTerms(n))),
    JSON.stringify(real.slice(0, 5).map(subjectTerms)));
  ok("the two halves of one course reduce to the same terms",
    subjectTerms(real[0]) === subjectTerms(real[1]) &&
    subjectTerms(real[2]) === subjectTerms(real[3]));
  ok("curriculum furniture goes too",
    subjectTerms("Elective Course") === "", subjectTerms("Elective Course"));
  ok("a real course name survives whole",
    subjectTerms(real[4]) === "Research Methods", subjectTerms(real[4]));

  // Mutation: drop the COURSE_CODE strip and the first three assertions go
  // red, because "NURC" and "410" both survive into the query.
  ok("so the query is searchable text, not an internal identifier",
    subjectQuery(real[0]) === "Critical Care Nursing nursing procedure",
    subjectQuery(real[0]));
  ok("a course with no searchable terms yields no query rather than a bare qualifier",
    subjectQuery("Elective Course") === "", subjectQuery("Elective Course"));
  ok("and neither does an empty name",
    subjectQuery("") === "" && procedureQuery("   ") === "");
}

{
  ok("a procedure name gets one qualifier",
    procedureQuery("Nasogastric tube insertion") === "Nasogastric tube insertion nursing procedure",
    procedureQuery("Nasogastric tube insertion"));

  // The qualifier is there to ask for a demonstration. A name that already
  // asks is not made to ask twice.
  ok("a name that already says \"procedure\" is not padded",
    procedureQuery("Tracheostomy care procedure") === "Tracheostomy care procedure");
  ok("nor one that says technique, demonstration or skill",
    procedureQuery("Sterile gloving technique") === "Sterile gloving technique" &&
    procedureQuery("Hand hygiene demonstration") === "Hand hygiene demonstration" &&
    procedureQuery("IV cannulation skill") === "IV cannulation skill");
  ok("the course is NOT mixed into a procedure query",
    !procedureQuery("Nasogastric tube insertion").toLowerCase().includes("critical care"));
  ok("runs of whitespace collapse",
    procedureQuery("Foley   catheter    insertion") === "Foley catheter insertion nursing procedure",
    procedureQuery("Foley   catheter    insertion"));
}

{
  const url = searchUrl("Nasogastric tube insertion nursing procedure");
  ok("the fallback is a real YouTube search, properly encoded",
    url === "https://www.youtube.com/results?search_query=Nasogastric%20tube%20insertion%20nursing%20procedure",
    url);
  ok("and an Arabic query survives encoding",
    searchUrl("غسل اليدين").startsWith("https://www.youtube.com/results?search_query=%D8"),
    searchUrl("غسل اليدين"));
}

/* ── Duration: absence is not zero ────────────────────────────────────────── */

{
  ok("minutes and seconds", parseIsoDuration("PT4M13S") === 253);
  ok("an hour", parseIsoDuration("PT1H2M3S") === 3723);
  ok("seconds only — a short, which is worth seeing before you watch",
    parseIsoDuration("PT45S") === 45);
  ok("minutes only", parseIsoDuration("PT9M") === 540);
  ok("hours only", parseIsoDuration("PT2H") === 7200);
  ok("days, which long archive uploads carry", parseIsoDuration("P1DT1H") === 90000);
  ok("fractional seconds are floored, not rounded up past the real length",
    parseIsoDuration("PT10.75S") === 10);

  ok("a livestream's P0D is an absence, NOT a zero-length video",
    parseIsoDuration("P0D") === null, String(parseIsoDuration("P0D")));
  ok("so is a missing field", parseIsoDuration(null) === null && parseIsoDuration(undefined) === null);
  ok("and an empty or bare shape", parseIsoDuration("") === null && parseIsoDuration("PT") === null);
  ok("garbage is an absence rather than a guess",
    parseIsoDuration("4:13") === null && parseIsoDuration("253") === null);
}

{
  ok("mm:ss under an hour", formatDuration(253) === "4:13", String(formatDuration(253)));
  ok("seconds are zero-padded", formatDuration(245) === "4:05", String(formatDuration(245)));
  ok("h:mm:ss past the hour", formatDuration(3723) === "1:02:03", String(formatDuration(3723)));
  ok("an absence prints nothing rather than 0:00",
    formatDuration(null) === null && formatDuration(0) === null);
}

/* ── Ordering: overlap only, and nothing dropped ──────────────────────────── */

{
  const hit = (videoId: string, title: string, channel = "ch"): VideoHit => ({
    videoId, title, channel, durationSeconds: 300, thumbnailUrl: null,
  });

  const query = "Nasogastric tube insertion nursing procedure";
  const hits = [
    hit("aaaaaaaaaaa", "Top 10 nursing school tips"),
    hit("bbbbbbbbbbb", "Nasogastric tube insertion — full nursing procedure"),
    hit("ccccccccccc", "Nasogastric tube insertion"),
  ];

  const ranked = rankHits(query, hits);
  ok("the title carrying most of the query comes first",
    ranked[0].videoId === "bbbbbbbbbbb", ranked.map((h) => h.videoId).join(","));
  ok("the unrelated hit goes last", ranked[2].videoId === "aaaaaaaaaaa");
  ok("NOTHING is dropped — the student judges what the app cannot",
    ranked.length === hits.length);

  // The restraint, asserted: a popular clip of the wrong technique must not
  // be promoted by popularity, because this ranker has no popularity input
  // at all. If a viewCount ever appears in VideoHit, this is where it bites.
  ok("ranking reads the title and nothing else",
    rankHits(query, [hit("ddddddddddd", "Nasogastric tube insertion")])[0].videoId === "ddddddddddd");

  ok("equal overlap keeps YouTube's own order, rather than inventing one",
    rankHits("tube insertion", [hit("eeeeeeeeeee", "tube insertion"), hit("fffffffffff", "tube insertion")])
      .map((h) => h.videoId).join(",") === "eeeeeeeeeee,fffffffffff");
  ok("an empty query leaves the order untouched",
    rankHits("", hits).map((h) => h.videoId).join(",") === "aaaaaaaaaaa,bbbbbbbbbbb,ccccccccccc");
  ok("a query of only stopwords leaves it untouched too",
    rankHits("the a of for", hits).map((h) => h.videoId).join(",") === "aaaaaaaaaaa,bbbbbbbbbbb,ccccccccccc");
  ok("ranking does not mutate the caller's array",
    (() => { const before = hits.map((h) => h.videoId).join(","); rankHits(query, hits); return hits.map((h) => h.videoId).join(",") === before; })());
}

/* ── The id, which becomes a stored URL ───────────────────────────────────── */

{
  ok("a real id is accepted", isVideoId("dQw4w9WgXcQ"));
  ok("the wrong length is not", !isVideoId("short") && !isVideoId("dQw4w9WgXcQextra"));
  ok("and nor is anything that would escape the URL",
    !isVideoId("../../etc/passwd") && !isVideoId("a b c d e f g") && !isVideoId('"onerror="'));
  ok("a non-string is not", !isVideoId(null) && !isVideoId(undefined) && !isVideoId(11));
  ok("the stored URL is built from the id, never taken from the payload",
    watchUrl("dQw4w9WgXcQ") === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
}

console.log(failed === 0 ? "\nAll checks passed" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
