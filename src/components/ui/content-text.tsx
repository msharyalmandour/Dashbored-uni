import * as React from "react";
import { cn } from "@/lib/utils";

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
      {children}
    </Tag>
  );
}
