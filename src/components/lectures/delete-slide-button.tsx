"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSlide } from "@/app/actions/slides";

export function DeleteSlideButton({
  slideId,
  lectureId,
  label,
  confirmText,
}: {
  slideId: string;
  lectureId: string;
  label: string;
  confirmText: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      try {
        await deleteSlide(slideId, lectureId);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      className="absolute end-3 top-3 rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-100"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}
