import * as React from "react";
import { cn } from "@/lib/utils";
import { bidiSegments, isMixed } from "@/lib/bidi";

/**
 * Text the student owns, rather than text the interface wrote.
 *
 * The interface is Arabic and the document is `dir="rtl"`. The student's
 * material very often is not: a Saudi nursing student's slides, drug names and
 * lecture titles are mostly English. Dropped into an RTL paragraph with no
 * direction of its own, a Latin run gets placed by the bidi algorithm, and the
 * algorithm puts the trailing punctuation at the *start* of the line. Rendered,
 * the flashcard on the most-used screen in the app read:
 *
 *     ?Loading dose formula
 *
 * and a lecture note read ".covered in class". Nothing is misspelled and no
 * string is wrong — the paragraph simply never said which way it runs.
 *
 * `dir="auto"` tells the browser to decide per string from its first strong
 * character, which is exactly the right rule here: Arabic content stays RTL,
 * English content goes LTR, and each keeps its own punctuation. `isolate`
 * stops a run from reordering the text around it.
 *
 * Use this for anything that came from the student or their files. Do not use
 * it for interface copy — that is always the UI language and already correct.
 *
 * `dir="auto"` settles a string that is all one script. It cannot settle one
 * that is BOTH, which in this product is most of them — an Arabic explanation
 * carrying an English definition. There the string starts with Arabic, the
 * paragraph resolves RTL, and the English sentence's full stop is drawn at the
 * far left:
 *
 *     .be done, how, when, where and by whom
 *
 * So a mixed string has its Latin runs wrapped in `<bdi>`, which isolates each
 * one and keeps its punctuation with it. The splitting is in src/lib/bidi.ts
 * and is held by scripts/verify-bidi.ts, whose first check is that the pieces
 * rejoin into exactly the input — this must never be able to drop a character
 * out of a student's note.
 *
 * All-Arabic and all-Latin strings are left exactly as they were: `isMixed`
 * is false for them, nothing is wrapped, and `dir="auto"` does the work on its
 * own as before.
 */
type ContentTag = "span" | "p" | "h1" | "h2" | "h3" | "div";

export function ContentText({
  as: Tag = "span",
  className,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "dir"> & { as?: ContentTag }) {
  return (
    <Tag dir="auto" className={cn("[unicode-bidi:isolate]", className)} {...props}>
      {isolate(children)}
    </Tag>
  );
}

/**
 * Wrap the Latin runs of a string child in `<bdi>`.
 *
 * Only a plain string is touched. Anything else — an element, a fragment, a
 * number — is returned untouched, because this knows nothing about what is
 * inside it and guessing would be worse than the full stop.
 */
function isolate(children: React.ReactNode): React.ReactNode {
  if (typeof children !== "string" || !isMixed(children)) return children;
  return bidiSegments(children).map((segment, i) =>
    segment.latin ? <bdi key={i}>{segment.text}</bdi> : segment.text
  );
}
