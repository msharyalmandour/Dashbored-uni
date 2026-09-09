"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Moon, GraduationCap, Stethoscope, Car, Utensils, Briefcase, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/components/shared/i18n-provider";
import { createTimeCommitment, deleteTimeCommitment, type CommitmentInput } from "@/app/actions/time";
import { formatMinuteOfDay } from "@/lib/time-intelligence";
import type { CommitmentKind } from "@prisma/client";

const KIND_ICON: Record<CommitmentKind, typeof Moon> = {
  SLEEP: Moon,
  UNIVERSITY: GraduationCap,
  CLINICAL: Stethoscope,
  COMMUTE: Car,
  MEALS: Utensils,
  WORK: Briefcase,
  PERSONAL: User,
};

const KINDS: CommitmentKind[] = [
  "SLEEP",
  "UNIVERSITY",
  "CLINICAL",
  "COMMUTE",
  "MEALS",
  "WORK",
  "PERSONAL",
];

export interface CommitmentView {
  id: string;
  kind: CommitmentKind;
  label: string | null;
  weekday: number | null;
  startMinute: number;
  endMinute: number;
}

/** "07:30" → 450. Returns null for anything the browser didn't fill in. */
function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Where the student tells the system what their week actually looks like.
 *
 * This form is the reason every hour figure elsewhere in the product is
 * allowed to exist. It is deliberately plain — a list and a small form, not
 * a calendar grid — because the goal is that someone can describe a normal
 * week in about a minute, not that the editor itself be impressive.
 */
export function WeekEditor({ commitments }: { commitments: CommitmentView[] }) {
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.time;

  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<CommitmentKind>("UNIVERSITY");
  const [weekday, setWeekday] = React.useState<string>("all");
  const [label, setLabel] = React.useState("");
  const [from, setFrom] = React.useState("09:00");
  const [to, setTo] = React.useState("11:00");

  const startMinute = parseTime(from);
  const endMinute = parseTime(to);
  // Shown as information rather than an error: an overnight block is a normal
  // thing to enter, and the student should be able to see it was understood.
  const crossesMidnight =
    startMinute !== null && endMinute !== null && endMinute <= startMinute && endMinute !== startMinute;
  const valid = startMinute !== null && endMinute !== null && startMinute !== endMinute;

  function resetForm() {
    setAdding(false);
    setKind("UNIVERSITY");
    setWeekday("all");
    setLabel("");
    setFrom("09:00");
    setTo("11:00");
  }

  async function save() {
    if (startMinute === null || endMinute === null || !valid) return;
    setSaving(true);
    try {
      const input: CommitmentInput = {
        kind,
        label: label.trim() || undefined,
        weekday: weekday === "all" ? null : Number(weekday),
        startMinute,
        endMinute,
      };
      await createTimeCommitment(input);
      toast.success(t.saved);
      resetForm();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setRemovingId(id);
    try {
      await deleteTimeCommitment(id);
      toast.success(t.removed);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setRemovingId(null);
    }
  }

  // Grouped so a week reads as a week: everyday blocks first, then each day.
  const everyDay = commitments.filter((c) => c.weekday === null);
  const byDay = t.weekdays.map((_, day) => commitments.filter((c) => c.weekday === day));

  function row(c: CommitmentView) {
    const Icon = KIND_ICON[c.kind];
    return (
      <div
        key={c.id}
        className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-secondary px-3 py-2"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{c.label || t.kinds[c.kind]}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {formatMinuteOfDay(c.startMinute)}–{formatMinuteOfDay(c.endMinute)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => remove(c.id)}
          disabled={removingId === c.id}
          aria-label={t.remove}
          title={t.remove}
        >
          {removingId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {commitments.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t.noCommitments}</p>
      )}

      {everyDay.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.everyDay}
          </h3>
          {everyDay.map(row)}
        </section>
      )}

      {byDay.map((dayCommitments, day) =>
        dayCommitments.length === 0 ? null : (
          <section key={day} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.weekdays[day]}
            </h3>
            {dayCommitments.map(row)}
          </section>
        )
      )}

      {adding ? (
        <Card variant="quiet" className="flex flex-col gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.kind}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CommitmentKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t.kinds[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.day}</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.everyDay}</SelectItem>
                  {t.weekdays.map((name, day) => (
                    <SelectItem key={name} value={String(day)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commitment-from">{t.from}</Label>
              <Input
                id="commitment-from"
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commitment-to">{t.to}</Label>
              <Input id="commitment-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-label">{t.label}</Label>
            <Input
              id="commitment-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t.labelPlaceholder}
            />
          </div>

          {crossesMidnight && <p className="text-xs text-muted-foreground">{t.crossesMidnight}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving || !valid}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t.save}
            </Button>
            <Button variant="ghost" onClick={resetForm} disabled={saving}>
              {t.cancel}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="ghost" className="w-fit" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {t.addCommitment}
        </Button>
      )}
    </div>
  );
}
