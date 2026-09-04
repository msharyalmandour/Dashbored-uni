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
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());

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
        <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.analytics.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.analytics.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={dict.analytics.studyTime} description={dict.analytics.studyTimeDesc}>
          <StudyTimeChart data={studyTime} dict={dict} />
        </ChartCard>

        <ChartCard title={dict.analytics.consistency} description={dict.analytics.consistencyDesc}>
          <ConsistencyHeatmap weeks={consistency} dict={dict} />
        </ChartCard>

        <ChartCard title={dict.analytics.subjectCompletion} description={dict.analytics.subjectCompletionDesc}>
          <EntityBarChart data={subjectCompletion.map((s) => ({ name: s.name, color: s.color, value: s.completion }))} />
        </ChartCard>

        <ChartCard title={dict.analytics.studyProgress} description={dict.analytics.studyProgressDesc}>
          <StudyProgressChart data={studyProgress} dict={dict} />
        </ChartCard>

        <ChartCard title={dict.analytics.gapTrends} description={dict.analytics.gapTrendsDesc}>
          <GapTrendsChart data={gapTrends} dict={dict} />
        </ChartCard>

        <ChartCard title={dict.analytics.practiceAccuracy} description={dict.analytics.practiceAccuracyDesc}>
          <EntityBarChart data={practiceAccuracy.map((s) => ({ name: s.name, color: s.color, value: s.accuracy }))} />
        </ChartCard>

        <ChartCard title={dict.analytics.repeatedMistakes} description={dict.analytics.repeatedMistakesDesc}>
          <RepeatedMistakesChart data={repeatedMistakes.map((m) => ({ name: m.name, count: m.count }))} dict={dict} />
        </ChartCard>

        <ChartCard title={dict.analytics.reviewCompletion} description={dict.analytics.reviewCompletionDesc}>
          <ReviewCompletionChart data={reviewCompletion} dict={dict} />
        </ChartCard>

        <ChartCard title={dict.analytics.flashcardAccuracy} description={dict.analytics.flashcardAccuracyDesc} className="lg:col-span-2">
          <EntityBarChart data={flashcardAccuracy.map((s) => ({ name: s.name, color: s.color, value: s.accuracy }))} />
        </ChartCard>
      </div>
    </div>
  );
}
