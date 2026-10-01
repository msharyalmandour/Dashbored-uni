import { redirect } from "next/navigation";

/**
 * The month grid, retired.
 *
 * Two reasons, and the second is the one that settles it.
 *
 * It duplicated. The day is on Home, the week is on `/time`, and this was a
 * third surface over the same rows — a month and week and day grid reached
 * from three tiles elsewhere in the app.
 *
 * And it was empty. It read `ScheduleEvent`, which on the real account holds
 * eleven rows between 10 and 16 September and nothing since: the importer
 * wrote one week of dated occurrences and the recurring shape of the term
 * lives in `TimeCommitment`. So the month grid drew an empty September and an
 * empty October over a timetable that was correct the whole time. The day
 * panel had the identical bug and is fixed (src/lib/today-classes.ts); this
 * page would need the same expansion done again, per month, to show anything
 * at all.
 *
 * A month view is worth building when there is a question only a month can
 * answer — where the exams fall against the clinical weeks, most likely. It
 * is not worth keeping a blank one in the meantime, and the next one should be
 * built on the recurring source rather than on the table that emptied itself.
 *
 * A redirect rather than a deletion: this route is in history and in links the
 * student has already followed, and `/time` is where the week now lives.
 */
export default async function CalendarPage() {
  redirect("/time");
}
