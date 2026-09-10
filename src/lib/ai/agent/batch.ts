/**
 * The order an armful of files should be read in.
 *
 * A student's first real use of this feature is not one file: it is "here is
 * everything I have". Ten files organised in whatever order the file picker
 * happened to list them is the case where the agent is weakest, because the one
 * document that explains all the others — the syllabus, the timetable — is as
 * likely to be read tenth as first. Read tenth, its course structure arrives
 * after nine lectures have already been filed by guesswork.
 *
 * So the structural documents go first. This is a heuristic on file names and
 * types and nothing more: it cannot be wrong in a way that loses data, it only
 * changes what the agent knows when it makes each decision.
 */

/** Names that announce a document explaining a whole course, in either language. */
const STRUCTURAL_WORDS = [
  "syllabus",
  "timetable",
  "schedule",
  "outline",
  "curriculum",
  "course plan",
  "study plan",
  "semester",
  "calendar",
  "جدول",
  "خطة",
  "توصيف",
  "مقرر",
  "الفصل",
  "منهج",
];

/**
 * How early a file should be read. Lower goes first.
 *
 * The type matters as well as the name: a spreadsheet in an academic drop is
 * almost always a timetable, and a photograph is almost always of one specific
 * thing rather than an account of the whole course.
 */
export function readingPriority(fileName: string): number {
  const name = fileName.toLowerCase();
  const extension = name.slice(name.lastIndexOf(".") + 1);

  if (STRUCTURAL_WORDS.some((word) => name.includes(word))) return 0;
  if (extension === "xlsx" || extension === "csv" || extension === "tsv") return 1;
  if (extension === "docx" || extension === "doc" || extension === "rtf") return 2;
  if (extension === "pdf" || extension === "pptx" || extension === "ppt") return 3;
  return 4;
}

/**
 * Sorts one drop into the order it should be read.
 *
 * Stable within a priority band, so files the student picked together stay in
 * the order they picked them — a folder of `Lecture 1` … `Lecture 9` keeps its
 * sequence, which is exactly the information the lecture numbering needs.
 */
export function orderDrop<T extends { name: string }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, priority: readingPriority(item.name) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map((entry) => entry.item);
}
