"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateLectureStatus } from "@/app/actions/lecture";
import type { LectureStatus } from "@prisma/client";

const OPTIONS: { value: LectureStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
];

export function LectureStatusControl({
  lectureId,
  status,
}: {
  lectureId: string;
  status: LectureStatus;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    setValue(next as LectureStatus);
    startTransition(async () => {
      await updateLectureStatus(lectureId, next as LectureStatus);
      if (next === "COMPLETED") {
        toast.success("Lecture marked complete", {
          description: "A review schedule (Day 1, 3, 7, 14, 30) was created automatically.",
        });
      }
      router.refresh();
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
