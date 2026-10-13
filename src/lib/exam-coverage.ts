/**
 * What an exam actually covers, and how much of it he has read.
 *
 * THE QUESTION THIS ANSWERS. His Final OSPE is 40% of a course and sits on 13
 * December. "An exam in N days" is the thing the app already says, and it is
 * not actionable: it does not say what to open. This says it — the topics the
 * exam covers, and which of them have never been read.
 *
 * WHAT COUNTS AS COVERED, and it is a judgement rather than a fact. An exam
 * covers the lectures of its own course dated on or before it. The university
 * does not publish a syllabus-to-exam mapping anywhere this app can read, and
 * inventing a cleverer rule — "the last five lectures", "whatever shares a
 * keyword" — would be a claim about the exam that nobody made. Everything in
 * the course up to the day is the rule the student would use himself.
 *
 * A LECTURE WITH NO BREAKDOWN STILL COUNTS, as one unread unit. Dropping it
 * because it has no topics would quietly shrink the exam, and "you have 14
 * topics left" under-states an exam that also has three lectures nobody has
 * broken up yet.
 */

export interface CoverageLecture {
  id: string;
  title: string;
  /** Null when this lecture has no breakdown. */
  topics: { done: number; total: number } | null;
  /** True when it counts as read: all topics, or the lecture's own status. */
  studied: boolean;
}

export interface Coverage {
  /** Every topic the exam covers, across its lectures. */
  topicsTotal: number;
  topicsDone: number;
  /** Lectures with no breakdown at all — unread units of unknown size. */
  lecturesWithoutTopics: number;
  /** How many of those are not marked studied. */
  unreadLectures: number;
  /** The lectures it covers, in teaching order. */
  lectures: CoverageLecture[];
}

export function coverageOf(lectures: CoverageLecture[]): Coverage {
  let topicsTotal = 0;
  let topicsDone = 0;
  let lecturesWithoutTopics = 0;
  let unreadLectures = 0;

  for (const lecture of lectures) {
    if (lecture.topics) {
      topicsTotal += lecture.topics.total;
      /* Clamped per lecture, not at the end: a stale progress row on one
         lecture must not be able to pay for an unread topic on another. */
      topicsDone += Math.min(lecture.topics.total, Math.max(0, lecture.topics.done));
    } else {
      lecturesWithoutTopics += 1;
      if (!lecture.studied) unreadLectures += 1;
    }
  }

  return { topicsTotal, topicsDone, lecturesWithoutTopics, unreadLectures, lectures };
}

/**
 * Which lectures an exam covers: same course, dated on or before the exam.
 *
 * `onOrBefore` compares DAYS, not instants. A lecture at 08:00 on the exam's
 * own date is covered; comparing timestamps would drop it because 08:00 is
 * before the exam but the Date objects differ by hours, and a lecture taught
 * the morning of an exam is exactly the one he needs.
 */
export function coveredBy<T extends { subjectId: string; date: Date }>(
  lectures: T[],
  exam: { subjectId: string; date: Date }
): T[] {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const limit = day(exam.date);
  return lectures.filter((l) => l.subjectId === exam.subjectId && day(l.date) <= limit);
}
