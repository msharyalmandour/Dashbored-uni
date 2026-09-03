import { getCurrentUserId } from "@/lib/current-user";
import {
  getStudyTimeSeries,
  getConsistencyGrid,
  getSubjectCompletion,
  getStudyProgress,
  getGapTrends,
  getPracticeAccuracy,
  getRepeatedMistakes,
  getReviewCompletion,
  getFlashcardAccuracy,
} from "@/lib/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { StudyTimeChart } from "@/components/analytics/study-time-chart";
import { ConsistencyHeatmap } from "@/components/analytics/consistency-heatmap";
import { EntityBarChart } from "@/components/analytics/entity-bar-chart";
import { StudyProgressChart } from "@/components/analytics/study-progress-chart";
import { GapTrendsChart } from "@/components/analytics/gap-trends-chart";
import { RepeatedMistakesChart } from "@/components/analytics/repeated-mistakes-chart";
import { ReviewCompletionChart } from "@/components/analytics/review-completion-chart";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const userId = await getCurrentUserId();

  const [
    studyTime,
    consistency,
    subjectCompletion,
    studyProgress,
    gapTrends,
    practiceAccuracy,
    repeatedMistakes,
    reviewCompletion,
    flashcardAccuracy,
  ] = await Promise.all([
    getStudyTimeSeries(userId),
    getConsistencyGrid(userId),
    getSubjectCompletion(userId),
    getStudyProgress(userId),
    getGapTrends(userId),
    getPracticeAccuracy(userId),
    getRepeatedMistakes(userId),
    getReviewCompletion(userId),
    getFlashcardAccuracy(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Every chart here answers a question you can act on.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Study Time" description="Minutes studied per day, last 14 days.">
          <StudyTimeChart data={studyTime} />
        </ChartCard>

        <ChartCard title="Consistency" description="Study streak — are you showing up daily?">
          <ConsistencyHeatmap weeks={consistency} />
        </ChartCard>

        <ChartCard title="Subject Completion" description="Which subject is falling behind on lectures?">
          <EntityBarChart data={subjectCompletion.map((s) => ({ name: s.name, color: s.color, value: s.completion }))} />
        </ChartCard>

        <ChartCard title="Study Progress" description="Cumulative % of all lectures completed this semester.">
          <StudyProgressChart data={studyProgress} />
        </ChartCard>

        <ChartCard title="Knowledge Gap Trends" description="Are you resolving gaps faster than you're creating them?">
          <GapTrendsChart data={gapTrends} />
        </ChartCard>

        <ChartCard title="Practice Accuracy" description="Where are you weakest on practice problems?">
          <EntityBarChart data={practiceAccuracy.map((s) => ({ name: s.name, color: s.color, value: s.accuracy }))} />
        </ChartCard>

        <ChartCard title="Repeated Mistakes" description="Topics where the same mistake keeps happening.">
          <RepeatedMistakesChart data={repeatedMistakes.map((m) => ({ name: m.name, count: m.count }))} />
        </ChartCard>

        <ChartCard title="Review Completion" description="Are scheduled reviews being done, or piling up overdue?">
          <ReviewCompletionChart data={reviewCompletion} />
        </ChartCard>

        <ChartCard title="Flashcard Accuracy" description="Which subject's flashcards need more repetition?" className="lg:col-span-2">
          <EntityBarChart data={flashcardAccuracy.map((s) => ({ name: s.name, color: s.color, value: s.accuracy }))} />
        </ChartCard>
      </div>
    </div>
  );
}
