import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { saveAnswer } from "@/lib/sheet-store";

/**
 * The sheet's autosave.
 *
 * A ROUTE AND NOT A SERVER ACTION, for one reason: this fires every two
 * seconds while a student is typing, and it has to be cancellable and
 * ignorable. A Server Action is tied to a render and revalidates the page on
 * the way back, which on a textarea the student is still inside means the
 * field being re-rendered under the cursor. The client here throws the
 * response away unless it carries a timestamp.
 *
 * OWNERSHIP IS CHECKED IN THE QUERY, not before it. `saveAnswer` matches the
 * question by id AND by its sheet's userId in one `findFirst`, so there is no
 * window between "is this yours" and "write it", and a guessed id reads as
 * not-found rather than as someone else's sheet.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const { questionId, answer } = (body ?? {}) as { questionId?: unknown; answer?: unknown };
  if (typeof questionId !== "string" || typeof answer !== "string") {
    return NextResponse.json({ error: "bad-shape" }, { status: 400 });
  }

  /* A cap, because this is a text column with no limit and the body comes
     from a browser. Long enough for an essay answer: a 20,000-character
     reply is 3,000 words, which is more than any sheet question asks for and
     still refuses a paste of a whole PDF. */
  if (answer.length > 20000) {
    return NextResponse.json({ error: "too-long" }, { status: 413 });
  }

  const result = await saveAnswer(userId, questionId, answer);
  if (!result.saved) return NextResponse.json({ error: "not-found" }, { status: 404 });

  return NextResponse.json({ answeredAt: result.answeredAt?.toISOString() ?? null });
}
