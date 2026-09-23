/**
 * The things that are half-filed, named out loud.
 *
 * An app that organises material for you can leave it in a state that is not
 * wrong and not finished, and say nothing. Measured on the real account:
 *
 *     46  topics with no lecture in them
 *      4  lectures filed under no topic
 *     25  files attached to no lecture
 *      5  courses with no topics at all
 *
 * None of that is an error. Every screen was correct. The topic page listed
 * forty-six headings and each one opened onto nothing, and there was no screen
 * anywhere that would tell you that — you had to click into forty-six of them
 * to find out.
 *
 * So this is not a health score and not a nag. It is a list of loose ends with
 * a real count and somewhere to go, and it says plainly when there are none.
 *
 * Two rules it holds to:
 *
 *   Only what nothing else already surfaces. Unread files have a button in the
 *   inbox and due reviews have a tile on the dashboard; repeating them here
 *   would turn a short list into a wall nobody reads.
 *
 *   Never a demand the student cannot act on. A topic with no lecture resolves
 *   when material arrives, so it is stated as information. A lecture under no
 *   topic is one the student can file in a click, so it links there.
 */

/** One loose end: what it is, how many, and where to go about it. */
export interface LooseEnd {
  /** Which kind — the interface looks up its wording by this. */
  kind: "coursesWithoutTopics" | "topicsWithoutLectures" | "lecturesWithoutTopic" | "filesWithoutLecture";
  count: number;
  /** Where the student goes to deal with it, or null when there is nothing to click. */
  href: string | null;
}

export interface LooseEndCounts {
  coursesWithoutTopics: number;
  topicsWithoutLectures: number;
  lecturesWithoutTopic: number;
  filesWithoutLecture: number;
}

/**
 * Where each kind sends the student.
 *
 * `null` is deliberate and is the honest half of this. A topic with no lecture
 * is resolved by dropping material for it, not by visiting a page — and a link
 * that goes somewhere you cannot do anything is worse than no link, because it
 * spends a click to tell you so.
 */
const DESTINATIONS: Record<LooseEnd["kind"], string | null> = {
  coursesWithoutTopics: "/academics",
  topicsWithoutLectures: null,
  lecturesWithoutTopic: "/academics",
  filesWithoutLecture: "/studio",
};

/**
 * The loose ends worth showing, largest first.
 *
 * Zero counts are dropped rather than shown as "0", which is the difference
 * between a list of four things to look at and a list of four things where
 * three of them are the word zero.
 */
export function looseEnds(counts: LooseEndCounts): LooseEnd[] {
  const kinds = Object.keys(DESTINATIONS) as LooseEnd["kind"][];
  return kinds
    .map((kind) => ({ kind, count: counts[kind], href: DESTINATIONS[kind] }))
    .filter((end) => end.count > 0)
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

/** Whether there is anything to say at all. */
export function hasLooseEnds(counts: LooseEndCounts): boolean {
  return looseEnds(counts).length > 0;
}
