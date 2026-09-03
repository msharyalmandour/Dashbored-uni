"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateSelfAssessment } from "@/app/actions/lecture";

export function SelfAssessmentSlider({
  lectureId,
  value,
}: {
  lectureId: string;
  value: number | null;
}) {
  const router = useRouter();
  const [local, setLocal] = React.useState(value ?? 50);

  function commit() {
    updateSelfAssessment(lectureId, local).then(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[oklch(0.55_0.22_285)]"
      />
      <span className="w-10 shrink-0 text-right text-sm font-medium">{local}%</span>
    </div>
  );
}
