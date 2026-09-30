-- Give the decks their real page counts, and withdraw the completions that
-- depended on the wrong ones.
--
-- `LectureSlide.pageCount` defaults to 1 and was corrected only by the VIEWER,
-- the first time a student opened the deck, from what pdf.js reported in their
-- browser. Three things had to go right for that — the deck opened in the
-- annotator specifically, the PDF parsed there, and the write succeeded (it was
-- fired as `void`, so a failure was silent). On the real account, measured
-- 2026-09-30, it had not:
--
--     lecture                  slide said   the file has
--     Cardiovascular system         1            42
--     mechanical ventilation        1            51
--     GAS EXCHANGE                  1             1   (genuinely one page)
--
-- The server knew all three counts the whole time: the PDF processor wrote them
-- to `Document.pageCount` when it read the file. So this is not new
-- information, it is information that never crossed the two tables.
--
-- The damage was not cosmetic. A 51-page deck claiming 1 page is a deck the
-- reader will not page through, that "continue reading" can never offer back
-- (`isResumable` needs somewhere to continue TO), and one the student is
-- recorded as having FINISHED the moment they look at page one — because
-- reaching the end of a one-page document is what reaching page one IS. That
-- false completion then propagated into course progress as a lecture done.
--
-- src/lib/processors/index.ts now writes the count at the moment the file is
-- parsed, for every route in, so this backfill is for the rows that predate
-- it. Statement 2 mirrors `advance` in src/lib/study-position.ts exactly.

-- 1. The counts. Only upward: the viewer may already have recorded the true
--    count from the real PDF, and a processor that undercounts (an image-only
--    PDF read by OCR) must not overwrite a larger true count with a smaller
--    guess.
UPDATE "LectureSlide" s
   SET "pageCount" = d."pageCount"
  FROM "Document" d
 WHERE d.id = s."documentId"
   AND d."pageCount" IS NOT NULL
   AND d."pageCount" > s."pageCount";

-- 2. The completions that are now provably wrong. `furthestPage` only ever
--    grows, so it can fall short of `pageCount` only if the count went UP —
--    which means the end was never reached and the stamp was made on bad
--    information. Clearing it withdraws a claim the app should not have made;
--    the reading itself (`lastPage`, `furthestPage`) is untouched.
UPDATE "StudyPosition" sp
   SET "completedAt" = NULL
  FROM "LectureSlide" s
 WHERE s.id = sp."slideId"
   AND sp."completedAt" IS NOT NULL
   AND sp."furthestPage" < s."pageCount";
