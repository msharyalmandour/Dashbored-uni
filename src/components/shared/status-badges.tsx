import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Variant = BadgeProps["variant"];

function badge(label: string, variant: Variant) {
  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {label}
    </Badge>
  );
}

const VARIANTS = {
  lecture: { NOT_STARTED: "muted", IN_PROGRESS: "secondary", COMPLETED: "success", NEEDS_REVIEW: "warning" },
  gap: { NOT_UNDERSTOOD: "destructive", LEARNING: "warning", PRACTICING: "secondary", UNDERSTOOD: "success", MASTERED: "default" },
  problem: { NOT_ATTEMPTED: "muted", CORRECT: "success", INCORRECT: "destructive", NEEDS_RETRY: "warning" },
  mistake: { OPEN: "destructive", REVIEWING: "warning", RESOLVED: "success" },
  task: { NOT_STARTED: "muted", IN_PROGRESS: "secondary", COMPLETED: "success", OVERDUE: "destructive" },
  flashcard: { NEW: "secondary", LEARNING: "warning", REVIEWING: "default", MASTERED: "success" },
  video: { WATCH_LATER: "muted", WATCHING: "secondary", COMPLETED: "success" },
} satisfies Record<string, Record<string, Variant>>;

const FALLBACK_EN: Record<keyof typeof VARIANTS, Record<string, string>> = {
  lecture: { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed", NEEDS_REVIEW: "Needs review" },
  gap: {
    NOT_UNDERSTOOD: "❌ Not understood",
    LEARNING: "🟡 Learning",
    PRACTICING: "🔵 Practicing",
    UNDERSTOOD: "🟢 Understood",
    MASTERED: "🏆 Mastered",
  },
  problem: { NOT_ATTEMPTED: "Not attempted", CORRECT: "Correct", INCORRECT: "Incorrect", NEEDS_RETRY: "Needs retry" },
  mistake: { OPEN: "Open", REVIEWING: "Reviewing", RESOLVED: "Resolved" },
  task: { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed", OVERDUE: "Overdue" },
  flashcard: { NEW: "New", LEARNING: "Learning", REVIEWING: "Reviewing", MASTERED: "Mastered" },
  video: { WATCH_LATER: "Watch later", WATCHING: "Watching", COMPLETED: "Completed" },
};

export function LectureStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.lecture[status as keyof Dictionary["status"]["lecture"]] ?? FALLBACK_EN.lecture[status] ?? status;
  return badge(label, VARIANTS.lecture[status as keyof typeof VARIANTS.lecture] ?? "muted");
}

export function GapStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.gap[status as keyof Dictionary["status"]["gap"]] ?? FALLBACK_EN.gap[status] ?? status;
  return badge(label, VARIANTS.gap[status as keyof typeof VARIANTS.gap] ?? "muted");
}

export function ProblemStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.problem[status as keyof Dictionary["status"]["problem"]] ?? FALLBACK_EN.problem[status] ?? status;
  return badge(label, VARIANTS.problem[status as keyof typeof VARIANTS.problem] ?? "muted");
}

export function MistakeStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.mistake[status as keyof Dictionary["status"]["mistake"]] ?? FALLBACK_EN.mistake[status] ?? status;
  return badge(label, VARIANTS.mistake[status as keyof typeof VARIANTS.mistake] ?? "muted");
}

export function TaskStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.task[status as keyof Dictionary["status"]["task"]] ?? FALLBACK_EN.task[status] ?? status;
  return badge(label, VARIANTS.task[status as keyof typeof VARIANTS.task] ?? "muted");
}

export function FlashcardStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.flashcard[status as keyof Dictionary["status"]["flashcard"]] ?? FALLBACK_EN.flashcard[status] ?? status;
  return badge(label, VARIANTS.flashcard[status as keyof typeof VARIANTS.flashcard] ?? "muted");
}

export function VideoStatusBadge({ status, dict }: { status: string; dict?: Dictionary }) {
  const label = dict?.status.video[status as keyof Dictionary["status"]["video"]] ?? FALLBACK_EN.video[status] ?? status;
  return badge(label, VARIANTS.video[status as keyof typeof VARIANTS.video] ?? "muted");
}

export function DifficultyBadge({ difficulty, dict }: { difficulty: string; dict?: Dictionary }) {
  const map: Record<string, Variant> = { EASY: "success", MEDIUM: "warning", HARD: "destructive" };
  const label = dict
    ? dict.common[difficulty.toLowerCase() as "easy" | "medium" | "hard"] ?? difficulty
    : { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" }[difficulty] ?? difficulty;
  return badge(label, map[difficulty] ?? "muted");
}
