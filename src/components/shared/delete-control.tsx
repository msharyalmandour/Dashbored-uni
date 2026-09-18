"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContentText } from "@/components/ui/content-text";
import { useI18n } from "@/components/shared/i18n-provider";
import { needsTypedConfirmation, type Consequence, type DeletableKind } from "@/lib/deletion";
import { cn } from "@/lib/utils";

/**
 * One delete control, for everything.
 *
 * Seventeen kinds of thing could be created in this app and five could be
 * deleted, so anything the agent filed wrongly from a drop was permanent. The
 * server side of that is fixed; this is the part a student touches.
 *
 * WHAT MAKES IT TRUSTWORTHY is not the dialog, it is the counting. "Are you
 * sure?" asks a question nobody can answer, because the fact they need — that
 * this course is carrying five lectures and thirty flashcards from a whole term
 * — is exactly what such a dialog omits. So `loadConsequences` runs when the
 * dialog opens and the numbers come out of the database, not out of a guess.
 *
 * Things with nothing underneath them pass no loader at all and the dialog says
 * so plainly rather than inventing reassurance.
 */
export function DeleteControl({
  kind,
  name,
  onDelete,
  loadConsequences,
  keptNote = false,
  label,
  className,
  variant = "icon",
}: {
  kind: DeletableKind;
  /** What the student calls it. Used in the title and in the typed confirmation. */
  name: string;
  onDelete: () => Promise<void>;
  /** Omitted when the thing owns nothing — then there is nothing to count. */
  loadConsequences?: () => Promise<Consequence[]>;
  /** True where things attached to this survive it, and the student should know. */
  keptNote?: boolean;
  label?: string;
  className?: string;
  variant?: "icon" | "button";
}) {
  const { dict, format } = useI18n();
  const t = dict.del;
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [consequences, setConsequences] = React.useState<Consequence[] | null>(null);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Counted when the dialog opens.
   *
   * In the opening itself rather than in an effect watching `open`, because
   * opening a dialog is something a student did — not state that needs
   * synchronising — and an effect here would be a cascading render for no
   * reason. It also means the counting never runs for rows nobody opened: a
   * list of forty courses must not be forty count queries nobody asked for.
   */
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    setTyped("");
    setError(null);
    if (!loadConsequences) {
      setConsequences([]);
      return;
    }
    setConsequences(null);
    loadConsequences()
      .then(setConsequences)
      // A failed count must not become a dialog that cannot be dismissed. The
      // deletion itself is still guarded on the server.
      .catch(() => setConsequences([]));
  }

  const needsTyping = consequences ? needsTypedConfirmation(kind, consequences) : false;
  const mayConfirm = consequences !== null && !busy && (!needsTyping || typed.trim() === name.trim());

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
      // The list this row was in is a server component; without this the row
      // stays on screen after the thing behind it has gone.
      router.refresh();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label={label ?? t.action}
            title={label ?? t.action}
            className={cn("text-muted-foreground hover:text-destructive", className)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className={cn("text-muted-foreground hover:text-destructive", className)}>
            <Trash2 className="size-4" />
            {label ?? t.action}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <ContentText>{format(t.title, { name })}</ContentText>
          </DialogTitle>
          <DialogDescription>{t.permanent}</DialogDescription>
        </DialogHeader>

        {/* The counts. Nothing is shown until they have arrived — a dialog that
            says "nothing else is affected" and then corrects itself is worse
            than one that waits half a second. */}
        {consequences === null ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : consequences.length === 0 ? (
          <p className="t-body text-muted-foreground">{t.nothingElse}</p>
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="t-label mb-2 text-muted-foreground">{t.alsoGoes}</p>
            <ul className="flex flex-col gap-1">
              {consequences.map((c) => (
                <li key={c.key} className="t-body flex items-baseline gap-2">
                  <span className="font-semibold tabular-nums" dir="ltr">
                    {c.count}
                  </span>
                  <span className="text-muted-foreground">{t.counts[c.key]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Said only where it is true. Telling a student their flashcards are
            safe when deleting a course — where they are not — would be the
            worst sentence in the app. */}
        {keptNote && consequences !== null && <p className="t-meta text-muted-foreground">{t.kept}</p>}

        {needsTyping && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-name" className="t-meta text-muted-foreground">
              <ContentText>{format(t.typeToConfirm, { name })}</ContentText>
            </label>
            <Input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              dir="auto"
            />
          </div>
        )}

        {error && <p className="t-meta text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.cancel}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!mayConfirm}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? t.deleting : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
