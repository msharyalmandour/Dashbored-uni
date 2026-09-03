import { Badge, type BadgeProps } from "@/components/ui/badge";

type Variant = BadgeProps["variant"];

function badge(label: string, variant: Variant) {
  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {label}
    </Badge>
  );
}

export function LectureStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    NOT_STARTED: ["Not started", "muted"],
    IN_PROGRESS: ["In progress", "secondary"],
    COMPLETED: ["Completed", "success"],
    NEEDS_REVIEW: ["Needs review", "warning"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function GapStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    NOT_UNDERSTOOD: ["❌ Not understood", "destructive"],
    LEARNING: ["🟡 Learning", "warning"],
    PRACTICING: ["🔵 Practicing", "secondary"],
    UNDERSTOOD: ["🟢 Understood", "success"],
    MASTERED: ["🏆 Mastered", "default"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function ProblemStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    NOT_ATTEMPTED: ["Not attempted", "muted"],
    CORRECT: ["Correct", "success"],
    INCORRECT: ["Incorrect", "destructive"],
    NEEDS_RETRY: ["Needs retry", "warning"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function MistakeStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    OPEN: ["Open", "destructive"],
    REVIEWING: ["Reviewing", "warning"],
    RESOLVED: ["Resolved", "success"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    NOT_STARTED: ["Not started", "muted"],
    IN_PROGRESS: ["In progress", "secondary"],
    COMPLETED: ["Completed", "success"],
    OVERDUE: ["Overdue", "destructive"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function FlashcardStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    NEW: ["New", "secondary"],
    LEARNING: ["Learning", "warning"],
    REVIEWING: ["Reviewing", "default"],
    MASTERED: ["Mastered", "success"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function VideoStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    WATCH_LATER: ["Watch later", "muted"],
    WATCHING: ["Watching", "secondary"],
    COMPLETED: ["Completed", "success"],
  };
  const [label, variant] = map[status] ?? [status, "muted"];
  return badge(label, variant);
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, [string, Variant]> = {
    EASY: ["Easy", "success"],
    MEDIUM: ["Medium", "warning"],
    HARD: ["Hard", "destructive"],
  };
  const [label, variant] = map[difficulty] ?? [difficulty, "muted"];
  return badge(label, variant);
}
