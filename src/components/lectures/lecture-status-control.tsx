"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateLectureStatus } from "@/app/actions/lecture";
import { useI18n } from "@/components/shared/i18n-provider";
import type { LectureStatus } from "@prisma/client";

const OPTIONS: LectureStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "NEEDS_REVIEW"];

export function LectureStatusControl({
  lectureId,
  status,
}: {
  lectureId: string;
  status: LectureStatus;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const [value, setValue] = React.useState(status);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    setValue(next as LectureStatus);
    startTransition(async () => {
      await updateLectureStatus(lectureId, next as LectureStatus);
      if (next === "COMPLETED") {
        toast.success(dict.lecture.markedComplete, {
          description: dict.lecture.reviewScheduleCreated,
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
          <SelectItem key={o} value={o}>
            {dict.status.lecture[o]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
