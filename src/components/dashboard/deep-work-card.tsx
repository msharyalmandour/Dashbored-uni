import { ImageFeatureCard } from "@/components/ui/image-feature-card";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Time actually spent in a focus session today.
 *
 * The reference art pairs its photograph card with a second one reading
 * "Deep Work Time — 1h 25m", and that is a figure this app really has:
 * FocusSession records minutes, and getDashboardData already sums today's.
 * So this is the reference's own composition fed by a measured number.
 *
 * The reference's OTHER card is "Attention Quality — 88%", and it is not
 * built. Nothing in this product measures attention quality; the score would
 * have to be invented, and an invented number in the largest type on the
 * screen is the most convincing lie an interface can tell. ProgressCard's
 * comment settled this rule for the app already and it holds here.
 *
 * Zero minutes is shown, not hidden. A student who has not started today is
 * exactly who the card is for, and an empty state that disappears when the
 * number is zero only ever appears to confirm what you already knew.
 */
export function DeepWorkCard({
  dict,
  focusMinutesToday,
}: {
  dict: Dictionary;
  focusMinutesToday: number;
}) {
  const t = dict.dashboard.deepWork;
  const hours = Math.floor(focusMinutesToday / 60);
  const minutes = focusMinutesToday % 60;

  /* The unit labels come from dict.time, which already had them — I had added
     a second pair under dashboard.deepWork before noticing, which is how a
     dictionary ends up with two strings that must agree and no reason they
     will.
  
     Built as elements rather than interpolated into one string: "1س 25د" is a
     mixed-direction run and renders reordered. The unit is dimmed and smaller
     because it is the quieter half of the reading — the figure is what the
     eye is going for. */
  const unit = (u: string) => (
    <span className="text-[1.25rem] font-medium text-foreground/60">{u}</span>
  );
  const value = (
    <>
      {hours > 0 && (
        <>
          <span>{hours}</span>
          {unit(dict.time.hours)}
        </>
      )}
      <span className={hours > 0 ? "ms-1" : undefined}>{minutes}</span>
      {unit(dict.time.minutes)}
    </>
  );

  return (
    <ImageFeatureCard
      /* evening, not day. Measured average luma across the six ambient
         photographs: day 96 and neutral (R-B = 0), evening 52 and warm
         (R-B = +8). A bright neutral-green photograph in a dark warm identity
         is the one card on the page that belongs to a different product. */
      image="/ambient/evening.jpg"
      label={t.label}
      value={value}
      caption={focusMinutesToday === 0 ? t.noneYet : t.today}
      href="/focus"
    />
  );
}
