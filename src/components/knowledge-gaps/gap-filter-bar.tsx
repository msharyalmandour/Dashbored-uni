"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";

export interface FilterSubject {
  id: string;
  name: string;
}
export interface FilterLecture {
  id: string;
  title: string;
  subjectId: string;
}
export interface FilterTopic {
  id: string;
  name: string;
  subjectId: string;
}

const ANY = "__any__";

export function GapFilterBar({
  subjects,
  lectures,
  topics,
}: {
  subjects: FilterSubject[];
  lectures: FilterLecture[];
  topics: FilterTopic[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dict } = useI18n();
  const f = dict.knowledgeGaps.filters;

  const subjectId = searchParams.get("subject") ?? ANY;
  const lectureId = searchParams.get("lecture") ?? ANY;
  const topicId = searchParams.get("topic") ?? ANY;
  const difficulty = searchParams.get("difficulty") ?? ANY;
  const source = searchParams.get("source") ?? ANY;

  const filteredLectures = lectures.filter((l) => subjectId === ANY || l.subjectId === subjectId);
  const filteredTopics = topics.filter((t) => subjectId === ANY || t.subjectId === subjectId);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ANY) params.delete(key);
    else params.set(key, value);
    if (key === "subject") {
      params.delete("lecture");
      params.delete("topic");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = [subjectId, lectureId, topicId, difficulty, source].some((v) => v !== ANY);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={subjectId} onValueChange={(v) => setParam("subject", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder={f.subject} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{f.allSubjects}</SelectItem>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={lectureId} onValueChange={(v) => setParam("lecture", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder={f.lecture} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{f.allLectures}</SelectItem>
          {filteredLectures.map((l) => (
            <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={topicId} onValueChange={(v) => setParam("topic", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder={f.topic} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{f.allTopics}</SelectItem>
          {filteredTopics.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={difficulty} onValueChange={(v) => setParam("difficulty", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder={f.difficulty} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{f.allDifficulties}</SelectItem>
          <SelectItem value="EASY">{dict.common.easy}</SelectItem>
          <SelectItem value="MEDIUM">{dict.common.medium}</SelectItem>
          <SelectItem value="HARD">{dict.common.hard}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={source} onValueChange={(v) => setParam("source", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder={f.source} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{f.allSources}</SelectItem>
          {Object.entries(dict.knowledgeGaps.sourceLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-3.5" /> {f.clear}
        </Button>
      )}
    </div>
  );
}
