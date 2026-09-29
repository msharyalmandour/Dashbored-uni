import { buildCorpus, conceptScore, linkFloor, type TextUnit } from "./concept-match";

/**
 * Turning the matcher into a pass over one student's record.
 *
 * concept-match.ts answers "which of these texts teaches this concept". This
 * decides which texts it is allowed to ask about, which is a separate question
 * and a policy one — and getting it wrong is how a good matcher produces bad
 * links.
 *
 * TWO SCOPES, AND THEY ARE NOT THE SAME SCOPE.
 *
 * The weighting corpus is EVERY lecture the student has text for, across all
 * their courses. Rarity is a fact about their material as a whole: "nursing"
 * is noise because it is everywhere in a nursing degree, and that is only
 * visible from the whole library. Narrowing it per course would also break the
 * floor outright — with two lectures in a course the only possible idf values
 * are ln(2) and 0, and ln(2) * 1 = 0.69 falls under a floor of ln(2) = 0.69
 * only by rounding. The statistics need documents.
 *
 * The candidate set is the lectures of the concept's OWN course. A critical
 * care deck cannot be where a nursing leadership concept is taught, however
 * the words fall, and letting it compete would trade a correct refusal for a
 * confident mistake.
 */

export type LectureWithText = {
  id: string;
  title: string;
  subjectId: string;
  /** Concatenated text of every readable document attached to this lecture. */
  text: string;
};

export type TopicRow = { id: string; name: string; subjectId: string };

export type ProposedLink = {
  lectureId: string;
  topicId: string;
  score: number;
  /** The best score among the other candidates, so a close call is visible. */
  runnerUp: number;
  /* Carried for the dry run and the log. Nothing decides on these. */
  lectureTitle: string;
  topicName: string;
};

export type LinkPlan = {
  links: ProposedLink[];
  /**
   * Concepts the text could not place, with why. These are not failures to be
   * hidden: a concept with no lecture is either material the student has not
   * uploaded yet ("Prone positioning", whose deck is still in the queue) or a
   * name made only of words the whole corpus shares. Both are worth seeing.
   */
  unplaced: Array<{ topicId: string; topicName: string; subjectId: string; reason: "NO_TEXT" | "BELOW_FLOOR"; best: number }>;
};

export function planLinks(lectures: LectureWithText[], topics: TopicRow[]): LinkPlan {
  const withText = lectures.filter((l) => l.text.trim().length > 0);
  const corpus = buildCorpus(withText.map((l): TextUnit => ({ id: l.id, text: l.text })));
  const floor = linkFloor(corpus);

  const byId = new Map(withText.map((l) => [l.id, l]));
  const bySubject = new Map<string, LectureWithText[]>();
  for (const l of withText) {
    const list = bySubject.get(l.subjectId) ?? [];
    list.push(l);
    bySubject.set(l.subjectId, list);
  }

  const links: ProposedLink[] = [];
  const unplaced: LinkPlan["unplaced"] = [];

  for (const topic of topics) {
    const candidates = bySubject.get(topic.subjectId) ?? [];
    if (candidates.length === 0) {
      unplaced.push({ topicId: topic.id, topicName: topic.name, subjectId: topic.subjectId, reason: "NO_TEXT", best: 0 });
      continue;
    }

    let bestId = "";
    let best = 0;
    let second = 0;
    for (const candidate of candidates) {
      /* Scored against the WHOLE corpus, chosen from within the course. */
      const score = conceptScore(corpus, candidate.id, topic.name);
      if (score > best) {
        second = best;
        best = score;
        bestId = candidate.id;
      } else if (score > second) {
        second = score;
      }
    }

    if (!bestId || best < floor) {
      unplaced.push({ topicId: topic.id, topicName: topic.name, subjectId: topic.subjectId, reason: "BELOW_FLOOR", best });
      continue;
    }

    links.push({
      lectureId: bestId,
      topicId: topic.id,
      score: best,
      runnerUp: second,
      lectureTitle: byId.get(bestId)?.title ?? "",
      topicName: topic.name,
    });
  }

  /* Sorted strongest first so a human reading a dry run sees the confident
     links before the marginal ones, and so the output is stable between runs
     on unchanged data. */
  links.sort((a, b) => b.score - a.score || a.topicId.localeCompare(b.topicId));
  unplaced.sort((a, b) => b.best - a.best || a.topicId.localeCompare(b.topicId));
  return { links, unplaced };
}
