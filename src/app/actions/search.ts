"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

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
  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const userId = await requireUserId();

  const [subjects, lectures, topics, gaps, flashcards, problems, videos, tasks] = await Promise.all([
    prisma.subject.findMany({
      where: { userId, name: { contains: q } },
      take: 5,
    }),
    prisma.lecture.findMany({
      where: { subject: { userId }, title: { contains: q } },
      include: { subject: true },
      take: 5,
    }),
    prisma.topic.findMany({
      where: { subject: { userId }, name: { contains: q } },
      include: { subject: true },
      take: 5,
    }),
    prisma.knowledgeGap.findMany({
      where: { subject: { userId }, title: { contains: q } },
      include: { subject: true },
      take: 5,
    }),
    prisma.flashcard.findMany({
      where: { userId, front: { contains: q } },
      include: { subject: true },
      take: 5,
    }),
    prisma.problem.findMany({
      where: { userId, question: { contains: q } },
      include: { subject: true },
      take: 5,
    }),
    prisma.video.findMany({
      where: { userId, title: { contains: q } },
      take: 5,
    }),
    prisma.task.findMany({
      where: { userId, title: { contains: q } },
      take: 5,
    }),
  ]);

  return {
    subjects: subjects.map((s) => ({ id: s.id, title: s.name, subtitle: s.code ?? "Subject", href: `/subjects/${s.id}` })),
    lectures: lectures.map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: l.subject.name,
      href: `/lectures/${l.id}`,
    })),
    topics: topics.map((t) => ({
      id: t.id,
      title: t.name,
      subtitle: t.subject.name,
      href: `/subjects/${t.subjectId}?tab=topics`,
    })),
    knowledgeGaps: gaps.map((g) => ({
      id: g.id,
      title: g.title,
      subtitle: g.subject.name,
      href: `/knowledge-gaps?gap=${g.id}`,
    })),
    flashcards: flashcards.map((f) => ({
      id: f.id,
      title: f.front,
      subtitle: f.subject.name,
      href: `/flashcards?subject=${f.subjectId}`,
    })),
    problems: problems.map((p) => ({
      id: p.id,
      title: p.question,
      subtitle: p.subject.name,
      href: `/problems?problem=${p.id}`,
    })),
    videos: videos.map((v) => ({ id: v.id, title: v.title, subtitle: "Video", href: `/videos?video=${v.id}` })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, subtitle: "Task", href: `/tasks?task=${t.id}` })),
  };
}
