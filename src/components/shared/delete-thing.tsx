"use client";

import * as React from "react";
import { DeleteControl } from "@/components/shared/delete-control";
import type { DeletableKind } from "@/lib/deletion";
import {
  subjectConsequences,
  semesterConsequences,
  lectureConsequences,
  deleteSubject,
  deleteSemester,
  deleteLecture,
  deleteTopic,
  deleteTask,
  deleteFlashcard,
  deleteProblem,
  deleteMistake,
  deleteKnowledgeGap,
  deleteClinicalEntry,
  deleteVideo,
  deleteLectureResource,
} from "@/app/actions/delete";

/**
 * Delete, addressable from a server component.
 *
 * `DeleteControl` takes two functions, which is the right shape for a client
 * row that already holds the thing. Most of the lists in this app are server
 * components, and a function cannot cross that boundary — `onDelete={() =>
 * deleteVideo(v.id)}` in a server file is a runtime error, not a type error,
 * which is the kind that reaches a student.
 *
 * So the crossing happens here instead: a server page passes an id, a kind and
 * a name, all of which serialise, and this decides which action that means. The
 * switch is the whole component. It is also the only place in the app that
 * knows the mapping, which is why adding a new deletable thing is one case here
 * rather than an import in nine pages.
 *
 * `parentId` is for the two actions that need a path to revalidate — a topic
 * knows its course, a resource knows its lecture — because neither has a page
 * of its own to return to.
 */
export function DeleteThing({
  kind,
  id,
  name,
  parentId,
  keptNote,
  label,
  className,
  variant,
}: {
  kind: DeletableKind;
  id: string;
  name: string;
  /** Subject id for a topic; lecture id for a resource. Ignored otherwise. */
  parentId?: string;
  keptNote?: boolean;
  label?: string;
  className?: string;
  variant?: "icon" | "button";
}) {
  const remove = React.useCallback(async () => {
    switch (kind) {
      case "semester":
        return void (await deleteSemester(id));
      case "subject":
        return void (await deleteSubject(id));
      case "lecture":
        return void (await deleteLecture(id));
      case "topic":
        return void (await deleteTopic(id, parentId ?? ""));
      case "resource":
        return void (await deleteLectureResource(id, parentId ?? ""));
      case "task":
        return void (await deleteTask(id));
      case "flashcard":
        return void (await deleteFlashcard(id));
      case "problem":
        return void (await deleteProblem(id));
      case "mistake":
        return void (await deleteMistake(id));
      case "gap":
        return void (await deleteKnowledgeGap(id));
      case "clinical":
        return void (await deleteClinicalEntry(id));
      case "video":
        return void (await deleteVideo(id));
      /* A slide deck is deleted by its own button, which also has to clear the
         file and the annotations — see lectures/delete-slide-button.tsx. */
      case "slide":
        throw new Error("Use DeleteSlideButton for a slide deck.");
    }
  }, [kind, id, parentId]);

  /* Only the three things that carry other things have anything to count. The
     rest pass no loader at all, and the dialog says "nothing else is affected"
     rather than spinning to discover that. */
  const count = React.useMemo(() => {
    if (kind === "subject") return () => subjectConsequences(id);
    if (kind === "semester") return () => semesterConsequences(id);
    if (kind === "lecture") return () => lectureConsequences(id);
    return undefined;
  }, [kind, id]);

  return (
    <DeleteControl
      kind={kind}
      name={name}
      onDelete={remove}
      loadConsequences={count}
      keptNote={keptNote}
      label={label}
      className={className}
      variant={variant}
    />
  );
}
