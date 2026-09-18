import Link from "next/link";
import { BookOpen, GraduationCap } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { cn } from "@/lib/utils";

/**
 * Where a thing came from, as a way back to it.
 *
 * A crawl of every route found six pages — flashcards, questions, mistakes,
 * gaps, tasks and focus — with no internal links at all. Not broken links:
 * none. You could be looking at a flashcard about loading dose and there was
 * no way from there to the lecture it was made from, even though `lectureId`
 * has been on the row since the schema was written.
 *
 * That is the shape of the problem the brief describes as shallow: the
 * connections exist in the database and stop at the query. This is the one
 * component that spends them, so a card, a question, a mistake and a gap all
 * point home the same way and a student learns the gesture once.
 *
 * It degrades honestly. With a lecture it names the lecture; with only a
 * subject it names the subject; with neither it renders nothing at all rather
 * than a link to a page that would shrug.
 */
export function OriginLink({
  lecture,
  subject,
  className,
}: {
  lecture?: { id: string; title: string } | null;
  subject?: { id: string; name: string; color?: string } | null;
  className?: string;
}) {
  if (lecture) {
    return (
      <Link
        href={`/lectures/${lecture.id}`}
        className={cn(
          "flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary",
          className
        )}
      >
        <BookOpen className="size-3 shrink-0" />
        <ContentText className="truncate">{lecture.title}</ContentText>
      </Link>
    );
  }
  if (subject) {
    return (
      <Link
        href={`/subjects/${subject.id}`}
        className={cn("flex min-w-0 items-center gap-1 text-xs hover:underline", className)}
        style={subject.color ? { color: subject.color } : undefined}
      >
        <GraduationCap className="size-3 shrink-0" />
        <ContentText className="truncate">{subject.name}</ContentText>
      </Link>
    );
  }
  return null;
}
