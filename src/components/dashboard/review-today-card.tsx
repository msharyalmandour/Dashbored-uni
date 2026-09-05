import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReviewItem, Subject, Lecture, Topic, Flashcard, KnowledgeGap, Mistake } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ReviewWithRelations = ReviewItem & {
  subject: Subject;
  lecture: Lecture | null;
  topic: Topic | null;
  flashcard: Flashcard | null;
  knowledgeGap: KnowledgeGap | null;
  mistake: Mistake | null;
};

export function ReviewTodayCard({
  dict,
  reviews,
}: {
  dict: Dictionary;
  reviews: ReviewWithRelations[];
}) {
  const counts = reviews.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  const TYPE_LABEL = dict.review.typeLabels;

  return (
    <Card variant="quiet">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="size-4 text-primary" />
            {dict.dashboard.reviewToday}
          </CardTitle>
          <CardDescription>{dict.dashboard.reviewTodaySubtitle}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {reviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {dict.dashboard.noReviewsDue}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {Object.entries(counts).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {TYPE_LABEL[type as keyof typeof TYPE_LABEL] ?? type}: {count}
                </Badge>
              ))}
            </div>
            <Button asChild size="sm">
              <Link href="/review">
                {dict.dashboard.startReviewing} ({reviews.length})
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
