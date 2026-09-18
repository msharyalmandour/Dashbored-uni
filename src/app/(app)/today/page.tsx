import { redirect } from "next/navigation";

/**
 * The second home, retired.
 *
 * This page was the day view, reached from a sidebar entry called "Dashboard"
 * while a nearly empty page held the name "Home". Two homes is one too many:
 * a student opening the app had to know which of them had what they came for,
 * and the one called Home was the one that had almost nothing.
 *
 * The day now lives on `/`. This route stays as a redirect rather than being
 * deleted, because it has been the real home for a while — it is in bookmarks,
 * in history, and in links the student has already followed. Removing it would
 * turn all of those into a 404 to save one file.
 */
export default async function TodayPage() {
  redirect("/");
}
