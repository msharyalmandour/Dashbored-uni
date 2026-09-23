"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { hasArabic, normalizeArabicText } from "@/lib/pdf-text";
import { pickMatching, rowsToRead } from "@/lib/search-fold";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResults {
  subjects: SearchResult[];
  lectures: SearchResult[];
  topics: SearchResult[];
  knowledgeGaps: SearchResult[];
  flashcards: SearchResult[];
  problems: SearchResult[];
  videos: SearchResult[];
  tasks: SearchResult[];
}

const EMPTY: SearchResults = {
  subjects: [],
  lectures: [],
  topics: [],
  knowledgeGaps: [],
  flashcards: [],
  problems: [],
  videos: [],
  tasks: [],
};

export async function searchEverything(query: string): Promise<SearchResults> {
  /* Normalised for the same reason extracted text is: a student typing
     الضغط الجزئي and a lecture stored as ﺍﻝﺽﻍﻁ ﺍﻝﺝﺯﺉﻱ are the same words in
     two different sets of codepoints, and `contains` compares codepoints.
     Extraction now stores the letters (see normalizeArabicText), but decks
     read before that fix are still in the database, and a student can paste
     presentation forms straight out of a PDF viewer into this box. Doing it on
     both sides costs one pass over a short string and removes the whole class
     of "I searched for it and it is not there". */
  const q = normalizeArabicText(query.trim());
  if (q.length < 2) return EMPTY;

  const userId = await requireUserId();

  /* Two ways to match, and which one runs depends on the query.
   *
   * `contains` is a SQL LIKE: it compares codepoints, which is exactly right
   * for Latin text and not enough for Arabic. Arabic is written with several
   * distinctions readers treat as optional — الحموضة and الحموضه, أهداف and
   * اهداف, يُعطى and يعطي — and `"الحموضة".includes("الحموضه")` is false.
   * Measured: seven out of seven ordinary respellings find nothing.
   *
   * The fold that fixes it (foldArabicForSearch) cannot run inside SQL without
   * a generated column, so an Arabic query is answered by reading the
   * student's own rows and folding both sides in memory. That is a real cost
   * and it is paid ONLY when the query contains Arabic: a Latin search issues
   * exactly the queries it always did, with no extra row read.
   *
   * Bounded at SCAN_LIMIT per table, and the filtering that turns those rows
   * into results is pickMatching — both in src/lib/search-fold.ts, because a
   * `"use server"` module may only export async Server Functions. */
  const folded = hasArabic(q);

  const [subjects, lectures, topics, gaps, flashcards, problems, videos, tasks] = await Promise.all([
    prisma.subject.findMany({
      where: folded ? { userId } : { userId, name: { contains: q } },
      take: rowsToRead(folded),
    }),
    prisma.lecture.findMany({
      where: folded ? { subject: { userId } } : { subject: { userId }, title: { contains: q } },
      include: { subject: true },
      take: rowsToRead(folded),
    }),
    prisma.topic.findMany({
      where: folded ? { subject: { userId } } : { subject: { userId }, name: { contains: q } },
      include: { subject: true },
      take: rowsToRead(folded),
    }),
    prisma.knowledgeGap.findMany({
      where: folded ? { subject: { userId } } : { subject: { userId }, title: { contains: q } },
      include: { subject: true },
      take: rowsToRead(folded),
    }),
    prisma.flashcard.findMany({
      where: folded ? { userId } : { userId, front: { contains: q } },
      include: { subject: true },
      take: rowsToRead(folded),
    }),
    prisma.problem.findMany({
      where: folded ? { userId } : { userId, question: { contains: q } },
      include: { subject: true },
      take: rowsToRead(folded),
    }),
    prisma.video.findMany({
      where: folded ? { userId } : { userId, title: { contains: q } },
      take: rowsToRead(folded),
    }),
    prisma.task.findMany({
      where: folded ? { userId } : { userId, title: { contains: q } },
      take: rowsToRead(folded),
    }),
  ]);

  return {
    subjects: pickMatching(subjects, folded, q, (s) => `${s.name} ${s.code ?? ""}`).map((s) => ({ id: s.id, title: s.name, subtitle: s.code ?? "Subject", href: `/subjects/${s.id}` })),
    lectures: pickMatching(lectures, folded, q, (l) => l.title).map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: l.subject.name,
      href: `/lectures/${l.id}`,
    })),
    topics: pickMatching(topics, folded, q, (t) => t.name).map((t) => ({
      id: t.id,
      title: t.name,
      subtitle: t.subject.name,
      href: `/subjects/${t.subjectId}?tab=topics`,
    })),
    knowledgeGaps: pickMatching(gaps, folded, q, (g) => g.title).map((g) => ({
      id: g.id,
      title: g.title,
      subtitle: g.subject.name,
      href: `/knowledge-gaps?gap=${g.id}`,
    })),
    flashcards: pickMatching(flashcards, folded, q, (f) => f.front).map((f) => ({
      id: f.id,
      title: f.front,
      subtitle: f.subject.name,
      href: `/flashcards?subject=${f.subjectId}`,
    })),
    problems: pickMatching(problems, folded, q, (p) => p.question).map((p) => ({
      id: p.id,
      title: p.question,
      subtitle: p.subject.name,
      href: `/problems?problem=${p.id}`,
    })),
    videos: pickMatching(videos, folded, q, (v) => v.title).map((v) => ({ id: v.id, title: v.title, subtitle: "Video", href: `/videos?video=${v.id}` })),
    tasks: pickMatching(tasks, folded, q, (t) => t.title).map((t) => ({ id: t.id, title: t.title, subtitle: "Task", href: `/tasks?task=${t.id}` })),
  };
}
