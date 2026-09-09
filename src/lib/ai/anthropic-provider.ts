import { captureAnalysisSchema, type AiProvider, type CaptureAnalysis, type CaptureAnalysisInput } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

/**
 * The output budget, and the single most consequential number in this file.
 *
 * It used to be 1024, which was chosen against the size of the JSON answer —
 * a few hundred tokens — and looked generous. It was not, because this model
 * reasons before it answers by default, and that reasoning is billed against
 * the same ceiling. A full timetable is precisely the case that reasons the
 * longest: twenty-odd rows, each needing a day, two times and a room read off
 * an image. The budget was spent thinking and the reply ended before a single
 * character of JSON was emitted, which reached the student as "the AI
 * returned an empty response" — a message that described the symptom and
 * pointed nowhere near the cause.
 *
 * Two independent artefacts of that ceiling are worth recording, because both
 * were mistaken for other bugs: a subject in the database called `CRTICAL car`
 * — a course name cut off mid-word at the limit — and a timetable that was
 * "analysed" every time and never once produced a calendar event.
 *
 * 16000 is not a guess at what a reply needs; it is deliberate headroom over
 * anything a reply could need, so that the answer is never the thing that gets
 * truncated. Unused budget is not billed.
 */
const MAX_OUTPUT_TOKENS = 16_000;

/**
 * How much of a document is sent. Long lecture PDFs are the normal case and
 * the first pages carry the identifying signal (title, course code, topic
 * headings); sending an entire 200-page deck would cost far more for no
 * better classification.
 */
const MAX_CONTENT_CHARS = 12_000;

/**
 * The instruction. Written as a classification task over the student's *own*
 * structure rather than an open-ended request, because the only useful answer
 * is one expressed in ids and names this app can act on.
 *
 * The refusal clause matters more than the rest: a model asked to categorise
 * will categorise, confidently, even when the content says nothing. Making
 * UNKNOWN plus a low confidence an explicitly correct answer is what keeps
 * the inbox honest instead of full of confident nonsense.
 */
function buildPrompt(input: CaptureAnalysisInput): string {
  const subjectList =
    input.subjects.length > 0
      ? input.subjects.map((s) => `- id: ${s.id} | name: ${s.name}${s.code ? ` (${s.code})` : ""}`).join("\n")
      : "(the student has no subjects yet)";

  const topicList = input.knownTopics.length > 0 ? input.knownTopics.join(", ") : "(none recorded yet)";

  return `You are the classification step of a university study app. A student has dropped one item into their inbox. Decide what it is so the app can propose where to file it.

THE STUDENT'S SUBJECTS (you may only use an id from this list, or null):
${subjectList}

TOPIC NAMES THE STUDENT ALREADY USES (prefer these over inventing new wording):
${topicList}

TODAY'S DATE: ${input.today}

THE ITEM
Source: ${input.source}${input.fileName ? `\nFile name: ${input.fileName}` : ""}
${
  input.image
    ? `The item is the image above. Read it — including any handwriting, slides, screenshots or timetables in it — and answer about what it actually shows.`
    : `Content:\n"""\n${input.content.slice(0, MAX_CONTENT_CHARS)}\n"""`
}

RULES
- Answer about what is actually in the content. Do not infer a subject from a filename alone unless the filename genuinely names one.
- subjectId must be an id copied exactly from the list above, or null. Never invent one.
- proposedSubjectName: when the content clearly belongs to a course the student does NOT have yet, put that course's name here exactly as the content writes it. Leave it null whenever subjectId is set — an existing course always wins. Also leave it null if the content names no course; a guessed course name would create a real course in someone's account.
- keyConcepts: the concepts genuinely taught or raised in the content, in its own words. An empty list is correct for a short thought — do not pad it.
- demandingConcepts: only concepts the content itself signals as difficult or foundational. Empty is usually correct. This is not a place to guess what a student might find hard.
- detectedEvent: fill this ONLY if the content states a real exam, assignment or deadline. Put the exact wording that says so in "evidence". If the content gives no date, or only a vague one, set date to null and still quote the evidence. If there is no such event at all, set detectedEvent to null. Never infer a date that is not written.
- If the content is too short, too vague, or unrelated to any subject, answer contentType "UNKNOWN", subjectId null, and a confidence below 0.4. That is a correct answer, not a failure.
- confidence is your honest probability that the classification is right.
- Write title, summary and concepts in the same language as the content.
- detectedTimetable: fill this ONLY when the item genuinely is a university timetable, schedule or calendar. Read every row you can: course name, which day, start and end time, room, and whether it is a lecture, a lab/tutorial or clinical. weekday is 0=Sunday through 6=Saturday. Times are 24-hour "HH:MM". Omit any row whose day or time you cannot actually read — a guessed lecture time becomes a real commitment in the student's week and corrupts every calculation about their free time. If the item is not a timetable, set detectedTimetable to null.
- If the item is a timetable, also put every course name you can read into keyConcepts, so nothing you could read is lost.

Reply with a single JSON object and nothing else, in this exact shape:
{"contentType":"LECTURE_MATERIAL|QUESTION|TASK|MISTAKE|REFERENCE|PERSONAL_NOTE|UNKNOWN","title":"string","summary":"string","subjectId":"string or null","proposedSubjectName":"string or null","topics":["string"],"keyConcepts":["string"],"demandingConcepts":["string"],"detectedEvent":null,"detectedTimetable":null,"suggestedDestinations":[{"destination":"LECTURE|KNOWLEDGE_GAP|FLASHCARD|TASK|MISTAKE|PROBLEM|NONE","reason":"string"}],"confidence":0.0}

When there IS an event, detectedEvent takes this shape instead of null:
{"kind":"EXAM|ASSIGNMENT|DEADLINE","title":"string","date":"YYYY-MM-DD or null","evidence":"string"}

When the item IS a timetable, detectedTimetable takes this shape instead of null:
{"entries":[{"courseName":"string","weekday":0,"startTime":"HH:MM","endTime":"HH:MM","location":"string or null","kind":"LECTURE|LAB|CLINICAL|OTHER"}]}`;
}

/**
 * Pulls the JSON object out of a model reply. Models sometimes wrap JSON in a
 * fenced block or a sentence of preamble; that is a formatting habit, not a
 * bad answer, so it is worth recovering from. Anything else is a real failure
 * and is left to the schema to reject.
 */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The AI provider did not return JSON.");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Turning a failed call into something the person reading it can act on.
 *
 * This string is written to a database row and shown in the inbox, so it used
 * to say only "AI provider returned HTTP 401." — safe, and useless. Diagnosing
 * a dead provider then meant opening the database and knowing that Anthropic
 * reports a bad key as 401 and an empty balance as a 400 with a particular
 * message. That is not knowledge a setup problem should require.
 *
 * The response body still never reaches the message. It can echo the request,
 * and the request contains the student's own uploaded content — so what is
 * surfaced is the *type* of failure, recognised from the body but never
 * quoted from it.
 */
async function describeFailure(response: Response): Promise<string> {
  let bodyText = "";
  try {
    bodyText = (await response.text()).toLowerCase();
  } catch {
    // A body that cannot be read changes nothing: the status still classifies.
  }

  switch (response.status) {
    case 401:
      return "The AI key was rejected as invalid. Check it was copied in full, then redeploy.";
    case 403:
      return "The AI key is valid but not permitted to use this model.";
    case 404:
      return "The configured AI model does not exist. Check the model name.";
    case 429:
      return "The AI provider is rate limiting requests. This usually clears on its own.";
    case 400:
      // Anthropic reports an empty balance as a 400, not as an auth failure —
      // which is exactly the distinction that makes "add credit" the right fix
      // here and the wrong fix for a 401.
      return bodyText.includes("credit balance")
        ? "The AI account has no credit left. Add credit to continue."
        : "The AI provider rejected the request as malformed.";
    default:
      return response.status >= 500
        ? "The AI provider is having problems. This is on their side; try again later."
        : `The AI provider refused the request (HTTP ${response.status}).`;
  }
}

/**
 * The shape of a successful Messages API reply, narrowed to what is read here.
 *
 * `content` is a list of blocks, and a text block is not guaranteed to be one
 * of them — a reply that spent its whole budget reasoning contains only a
 * thinking block, which is exactly the failure this file was built around.
 */
type MessagesResponse = {
  content?: { type: string; text?: string }[];
  stop_reason?: string | null;
};

/**
 * Why a reply carried no usable text.
 *
 * All three cases used to collapse into one sentence — "returned an empty
 * response" — which is true of all of them and useful for none. They are not
 * the same problem and do not have the same fix: one is this app's budget to
 * raise, one is a decision the model made about the content, and one is a
 * genuine anomaly. `stop_reason` already distinguishes them; nothing was
 * reading it.
 */
function describeMissingText(stopReason: string | null | undefined): string {
  switch (stopReason) {
    case "max_tokens":
      // Should now be unreachable — MAX_OUTPUT_TOKENS is far above what any
      // reply needs. If it ever fires again, the ceiling is the cause and the
      // message says so rather than sending the next reader back to square one.
      return "The AI ran out of room before it finished its answer.";
    case "refusal":
      return "The AI declined to answer about this item.";
    default:
      return "The AI provider returned an empty response.";
  }
}

/**
 * A real call to the Anthropic Messages API. Constructed only when
 * ANTHROPIC_API_KEY is present (see provider.ts) — this module never runs
 * with a missing key, and there is no offline branch that pretends to.
 */
export function createAnthropicProvider(apiKey: string, model = DEFAULT_MODEL): AiProvider {
  return {
    id: `anthropic:${model}`,

    async analyzeCapture(input: CaptureAnalysisInput): Promise<CaptureAnalysis> {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: "user",
              // The image goes first. A model reads its context in order, and
              // the instructions refer to "the image above" — put the picture
              // after the question and it is answering about something it has
              // not seen yet.
              content: input.image
                ? [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: input.image.mediaType,
                        data: input.image.base64,
                      },
                    },
                    { type: "text", text: buildPrompt(input) },
                  ]
                : buildPrompt(input),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await describeFailure(response));
      }

      const body = (await response.json()) as MessagesResponse;
      // Deliberately the *last* text block, not the first. A reply may open
      // with a text block before a tool or thinking block and close with the
      // real answer; taking the first would classify against a preamble.
      const text = body.content?.filter((block) => block.type === "text").at(-1)?.text;
      if (!text) throw new Error(describeMissingText(body.stop_reason));

      return captureAnalysisSchema.parse(extractJson(text));
    },
  };
}
