"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateVideoStatus } from "@/app/actions/videos";
import type { VideoStatus } from "@prisma/client";

export function VideoStatusSelect({ videoId, status }: { videoId: string; status: VideoStatus }) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    setValue(next as VideoStatus);
    startTransition(async () => {
      await updateVideoStatus(videoId, next as VideoStatus);
      router.refresh();
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="WATCH_LATER">Watch Later</SelectItem>
        <SelectItem value="WATCHING">Watching</SelectItem>
        <SelectItem value="COMPLETED">Completed</SelectItem>
      </SelectContent>
    </Select>
  );
}
