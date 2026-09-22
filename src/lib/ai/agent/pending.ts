import { z } from "zod";
import { timetableEntriesSchema } from "./tools";

/**
 * A week the agent read and is waiting to be told is right.
 *
 * Kept out of the Server Action file because that file is `"use server"`, where
 * every export must be an async action — a plain parser there is a build error,
 * and more to the point it belongs with the agent rather than with the actions
 * that happen to call it.
 *
 * The entries are the classes themselves rather than a count, because the only
 * question worth asking here is whether these are the student's actual classes,
 * and that cannot be answered from "19 classes across 6 courses".
 */
export type TimetableEntry = z.infer<typeof timetableEntriesSchema>[number];

export interface PendingTimetable {
  kind: "TIMETABLE";
  entries: TimetableEntry[];
}

/**
 * The held proposal on a capture, if there is one.
 *
 * Re-validated through the same schema the model's own call went through. This
 * has been sitting in a database between two requests, and a shape checked once
 * on the way in is not a shape you know on the way out.
 */
export function parsePendingWrites(raw: unknown): PendingTimetable | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { kind?: unknown; entries?: unknown };
  if (candidate.kind !== "TIMETABLE") return null;

  const entries = timetableEntriesSchema.safeParse(candidate.entries);
  if (!entries.success || entries.data.length === 0) return null;
  return { kind: "TIMETABLE", entries: entries.data };
}
