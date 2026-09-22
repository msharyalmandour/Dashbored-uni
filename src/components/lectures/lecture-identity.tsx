import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { cn } from "@/lib/utils";

/**
 * The one thing that stays put while you go deeper into a lecture.
 *
 * The chain a student actually walks is lecture → slides → pen → notes → AI →
 * flashcards → questions → mistakes → review, and before this every step of it
 * announced itself differently. The lecture page led with the lecture's name;
 * the slide list led with the word "Slides" and a generic subtitle, with the
 * lecture demoted to a back-link that said "Back to lecture"; the slide
 * workspace led with the slide's file name and mentioned neither the lecture
 * nor the course. Three steps into one piece of work and nothing on screen
 * still said which lecture you were in.
 *
 * So this is the same element, at the same size, in the same position, on
 * every step: the course above, the lecture's name, and then where in the
 * lecture you currently are. Depth stops reading as navigation between
 * unrelated pages and starts reading as movement inside one thing — which is
 * the difference between a product with deep pages and a product with a lot of
 * pages.
 *
 * The rank is deliberately `t-title` and not `t-display`, including on the
 * lecture's own page, where it replaces a heading rather than sitting under
 * one. On these routes the subject of the screen is the deck, the page, the
 * handwriting — the content is what should be largest, and the chrome that
 * says which lecture it belongs to should be legible and no more.
 */
export function LectureIdentity({
  subject,
  lecture,
  step,
  backHref,
  backLabel,
  actions,
  className,
}: {
  subject: { id: string; name: string };
  lecture: { id: string; title: string };
  /** Where in the lecture you are — the deck, one slide. Absent on the lecture itself. */
  step?: string;
  /** One level up, for the arrow. Absent on the lecture itself. */
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel}
              // The arrow flips with the writing direction. In Arabic "back"
              // points the other way, and a left-pointing chevron in an RTL
              // line means forward.
              className="-ms-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-[oklch(100%_0_0_/_8%)] hover:text-foreground rtl:rotate-180"
            >
              <ChevronLeft className="size-4" />
            </Link>
          )}
          <Link
            href={`/subjects/${subject.id}`}
            className="t-label min-w-0 truncate text-muted-foreground transition-colors hover:text-foreground"
          >
            <ContentText>{subject.name}</ContentText>
          </Link>
        </div>

        <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
          {/* On a deeper step the lecture's name becomes the way back to it —
              the student is inside this lecture, so the lecture is a place, not
              a label. On the lecture itself there is nowhere to go, so it is
              plain text. */}
          {step ? (
            <Link href={`/lectures/${lecture.id}`} className="min-w-0 transition-colors hover:text-primary">
              <ContentText className="t-title on-env">{lecture.title}</ContentText>
            </Link>
          ) : (
            <ContentText as="h1" className="t-title on-env">
              {lecture.title}
            </ContentText>
          )}
          {step && (
            <span className="t-meta on-env-quiet flex items-baseline gap-2">
              <span aria-hidden>·</span>
              <ContentText>{step}</ContentText>
            </span>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
