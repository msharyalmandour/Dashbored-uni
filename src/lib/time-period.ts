export type TimePeriod = "morning" | "day" | "evening" | "night";

/**
 * Single source of truth for "what time of day is it" — used by both the
 * greeting text and the ambient hero gradient so they never disagree about
 * which period the user is in.
 */
export function getTimePeriod(now: Date): TimePeriod {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}
