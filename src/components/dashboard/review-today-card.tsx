import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReviewItem, Subject, Lecture, Topic, Flashcard, KnowledgeGap, Mistake } from "@prisma/client";

type ReviewWithRelations = ReviewItem & {
  subject: Subject;
  lecture: Lecture | null;
  topic: Topic | null;
  flashcard: Flashcard | null;
  knowledgeGap: KnowledgeGap | null;
  mistake: Mistake | null;
};

const TYPE_LABEL: Record<string, string> = {
  LECTURE: "Lectures",
  TOPIC: "Topics",
  FLASHCARD: "Flashcards",
  KNOWLEDGE_GAP: "Knowledge Gaps",
  MISTAKE: "Mistakes",
};

export function ReviewTodayCard({ reviews }: { reviews: ReviewWithRelations[] }) {
  const counts = reviews.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="size-4 text-primary" />
            Review Today
          </CardTitle>
          <CardDescription>Lectures, topics, flashcards &amp; gaps due now.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {reviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            No reviews due — spaced repetition is caught up.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {Object.entries(counts).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {TYPE_LABEL[type] ?? type}: {count}
                </Badge>
              ))}
            </div>
            <Button asChild size="sm">
              <Link href="/review">Start Reviewing ({reviews.length})</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
