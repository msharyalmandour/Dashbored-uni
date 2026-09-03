"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ANY = "__any__";

export function SubjectFilterSelect({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("subject") ?? ANY;

  function onChange(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === ANY) params.delete("subject");
    else params.set("subject", v);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue placeholder="Subject" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>All Subjects</SelectItem>
        {subjects.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
