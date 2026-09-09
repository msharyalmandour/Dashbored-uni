import { captureAnalysisSchema, type AiProvider, type CaptureAnalysis, type CaptureAnalysisInput } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

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
- If the item is a university timetable, schedule or calendar, say so in contentType terms and put every course name you can read into keyConcepts, so nothing you could read is lost.

Reply with a single JSON object and nothing else, in this exact shape:
{"contentType":"LECTURE_MATERIAL|QUESTION|TASK|MISTAKE|REFERENCE|PERSONAL_NOTE|UNKNOWN","title":"string","summary":"string","subjectId":"string or null","proposedSubjectName":"string or null","topics":["string"],"keyConcepts":["string"],"demandingConcepts":["string"],"detectedEvent":null,"suggestedDestinations":[{"destination":"LECTURE|KNOWLEDGE_GAP|FLASHCARD|TASK|MISTAKE|PROBLEM|NONE","reason":"string"}],"confidence":0.0}

When there IS an event, detectedEvent takes this shape instead of null:
{"kind":"EXAM|ASSIGNMENT|DEADLINE","title":"string","date":"YYYY-MM-DD or null","evidence":"string"}`;
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
          max_tokens: 1024,
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
        // The body can echo request content, so only the status is surfaced —
        // this string is written to a database row the student can see.
        throw new Error(`AI provider returned HTTP ${response.status}.`);
      }

      const body = (await response.json()) as { content?: { type: string; text?: string }[] };
      const text = body.content?.find((block) => block.type === "text")?.text;
      if (!text) throw new Error("The AI provider returned an empty response.");

      return captureAnalysisSchema.parse(extractJson(text));
    },
  };
}
