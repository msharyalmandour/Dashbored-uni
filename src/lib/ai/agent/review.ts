import type { AgentAction } from "./types";

/**
 * Reads back what the agent just wrote, and says what looks wrong.
 *
 * The mistakes that matter from a system like this are not the loud ones. A
 * crash gets noticed and retried. What does damage is a row that is plausible
 * and wrong: a deadline whose year was misread off a photo, a class at three in
 * the morning because a 24-hour timetable was read as 12-hour, a second course
 * called "anatomy" beside the student's "Anatomy", forty flashcards
 * manufactured from a two-page handout. Each of those is silently accepted,
 * planned around for weeks, and only discovered when the student misses
 * something.
 *
 * Nothing here is corrected automatically. Every one of these findings is a
 * suspicion, not a fact — a deadline in the past is genuinely normal for a
 * syllabus dropped mid-semester, and a 5am class exists in some clinical
 * rotations. Rewriting a row on a guess would replace a visible oddity with an
 * invisible fabrication, which is the trade this whole design refuses. So they
 * are shown to the one person who knows: the student.
 *
 * The checks are deterministic and take no model call. A second model pass
 * asked to review the first would be the same judgement twice, at twice the
 * cost, and confidently agreeing with itself.
 */

/**
 * A code, not a sentence.
 *
 * The sentence has to be in the student's language and this runs on the server,
 * which does not know it — the same reason capture failures travel as codes.
 * `detail` carries the specifics the sentence interpolates.
 */
export interface ReviewFinding {
  code:
    | "DEADLINE_IN_PAST"
    | "DEADLINE_FAR_OFF"
    | "CLASS_AT_ODD_HOUR"
    | "COURSE_LOOKS_DUPLICATE"
    | "LECTURE_NUMBER_TAKEN"
    | "A_LOT_OF_FLASHCARDS";
  detail: Record<string, string | number>;
}

/** Anything outside this is odd enough to mention for a university class. */
const EARLIEST_REASONABLE_HOUR = 6;
const LATEST_REASONABLE_HOUR = 22;

/** A deadline further out than this is usually a year read wrong. */
const FAR_OFF_DAYS = 400;

/**
 * How much source text one flashcard implies. Below this the cards are
 * outrunning the material, which is how invented answers get in.
 */
const CHARS_PER_CARD = 120;

/** Never worth mentioning below this many cards, however short the source. */
const FLASHCARD_FLOOR = 12;

export interface ReviewInput {
  today: Date;
  actions: AgentAction[];
  /** Tasks this drop created. */
  tasks: { title: string; deadline: Date }[];
  /** Classes this drop put in the week. */
  classes: { title: string; startsAt: Date }[];
  /** Courses this drop created. */
  newCourses: { id: string; name: string }[];
  /** Courses that already existed, to compare the new ones against. */
  existingCourses: { id: string; name: string }[];
  /** Lectures this drop created, with the course they went into. */
  newLectures: { id: string; title: string; lectureNumber: number; subjectId: string }[];
  /** Lectures that were already in those courses. */
  existingLectures: { id: string; lectureNumber: number; subjectId: string; title: string }[];
  /** How much text the item actually offered, for judging card counts. */
  contentChars: number;
}

/**
 * Two course names that are the same course.
 *
 * Case, punctuation and spacing are stripped because that is what actually
 * differs: "NURC-410" and "nurc 410", "Anatomy & Physiology" and "anatomy and
 * physiology". Containment is checked as well as equality, since "Pharmacology"
 * and "Pharmacology II" are worth a second look while being genuinely
 * different courses sometimes — which is exactly why this asks rather than
 * merges.
 */
function looksLikeSameCourse(a: string, b: string): boolean {
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/\band\b/g, "&")
      .replace(/[^a-z0-9؀-ۿ&]+/g, "")
      .trim();

  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function reviewWrites(input: ReviewInput): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const todayStart = new Date(input.today);
  todayStart.setHours(0, 0, 0, 0);

  for (const task of input.tasks) {
    if (task.deadline.getTime() < todayStart.getTime()) {
      findings.push({
        code: "DEADLINE_IN_PAST",
        detail: { title: task.title, date: task.deadline.toISOString().slice(0, 10) },
      });
      continue;
    }
    if (task.deadline.getTime() - todayStart.getTime() > FAR_OFF_DAYS * DAY_MS) {
      findings.push({
        code: "DEADLINE_FAR_OFF",
        detail: { title: task.title, date: task.deadline.toISOString().slice(0, 10) },
      });
    }
  }

  for (const klass of input.classes) {
    // Local hours, because a timetable is read and lived in local time — the
    // student's 8am class is 8am to them whatever the server thinks.
    const hour = klass.startsAt.getHours();
    if (hour < EARLIEST_REASONABLE_HOUR || hour >= LATEST_REASONABLE_HOUR) {
      findings.push({
        code: "CLASS_AT_ODD_HOUR",
        detail: {
          title: klass.title,
          time: `${String(hour).padStart(2, "0")}:${String(klass.startsAt.getMinutes()).padStart(2, "0")}`,
        },
      });
    }
  }

  for (const created of input.newCourses) {
    const twin =
      input.existingCourses.find((other) => looksLikeSameCourse(created.name, other.name)) ??
      // Also against each other: one drop reading a syllabus and a timetable
      // together has created the same course twice before.
      input.newCourses.find((other) => other.id !== created.id && looksLikeSameCourse(created.name, other.name));

    if (twin) {
      findings.push({
        code: "COURSE_LOOKS_DUPLICATE",
        detail: { created: created.name, existing: twin.name },
      });
    }
  }

  for (const lecture of input.newLectures) {
    const clash = input.existingLectures.find(
      (other) =>
        other.subjectId === lecture.subjectId &&
        other.id !== lecture.id &&
        other.lectureNumber === lecture.lectureNumber
    );
    if (clash) {
      findings.push({
        code: "LECTURE_NUMBER_TAKEN",
        detail: { title: lecture.title, number: lecture.lectureNumber, other: clash.title },
      });
    }
  }

  const cards = input.actions.reduce(
    (total, action) => (action.kind === "FLASHCARDS" ? total + action.count : total),
    0
  );
  if (cards >= FLASHCARD_FLOOR && cards * CHARS_PER_CARD > input.contentChars) {
    findings.push({
      code: "A_LOT_OF_FLASHCARDS",
      detail: { count: cards },
    });
  }

  return findings;
}
