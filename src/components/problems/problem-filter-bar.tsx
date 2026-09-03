"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ANY = "__any__";

export function ProblemFilterBar({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
        <SelectTrigger className="w-40"><SelectValue placeholder="Subject" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All Subjects</SelectItem>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All Statuses</SelectItem>
          <SelectItem value="NOT_ATTEMPTED">Not Attempted</SelectItem>
          <SelectItem value="CORRECT">Correct</SelectItem>
          <SelectItem value="INCORRECT">Incorrect</SelectItem>
          <SelectItem value="NEEDS_RETRY">Needs Retry</SelectItem>
        </SelectContent>
      </Select>
      <Select value={difficulty} onValueChange={(v) => setParam("difficulty", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Difficulty" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All Difficulties</SelectItem>
          <SelectItem value="EASY">Easy</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="HARD">Hard</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
