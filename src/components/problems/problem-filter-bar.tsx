"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/components/shared/i18n-provider";

const ANY = "__any__";

export function ProblemFilterBar({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dict } = useI18n();

  const subject = searchParams.get("subject") ?? ANY;
  const status = searchParams.get("status") ?? ANY;
  const difficulty = searchParams.get("difficulty") ?? ANY;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ANY) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={subject} onValueChange={(v) => setParam("subject", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={dict.common.subject} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{dict.common.allSubjects}</SelectItem>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={dict.common.status} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{dict.common.allStatuses}</SelectItem>
          <SelectItem value="NOT_ATTEMPTED">{dict.problems.notAttempted}</SelectItem>
          <SelectItem value="CORRECT">{dict.problems.correct}</SelectItem>
          <SelectItem value="INCORRECT">{dict.problems.incorrect}</SelectItem>
          <SelectItem value="NEEDS_RETRY">{dict.problems.needsRetry}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={difficulty} onValueChange={(v) => setParam("difficulty", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder={dict.common.difficulty} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{dict.common.allDifficulties}</SelectItem>
          <SelectItem value="EASY">{dict.common.easy}</SelectItem>
          <SelectItem value="MEDIUM">{dict.common.medium}</SelectItem>
          <SelectItem value="HARD">{dict.common.hard}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
