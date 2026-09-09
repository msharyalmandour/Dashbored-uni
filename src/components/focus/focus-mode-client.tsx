"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Pause, Square, Lightbulb, PartyPopper, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startFocusSession, endFocusSession, noteConfusion } from "@/app/actions/focus";
import { createKnowledgeGap } from "@/app/actions/knowledge-gap";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";

interface Subject {
  id: string;
  name: string;
  color: string;
}
interface Lecture {
  id: string;
  title: string;
  subjectId: string;
}

const DURATIONS = [25, 45, 60, 90];

type Stage = "ready" | "setup" | "active" | "reflect" | "done";

/**
 * What the homepage hands over when the student presses Start on the one
 * recommended action, so they land on "here is what you are doing and why"
 * rather than a form asking which subject they had in mind.
 */
export interface SessionPreset {
  title: string;
  minutes: number;
  subjectId?: string;
  why?: string;
}

export function FocusModeClient({
  subjects,
  lectures,
  preset,
}: {
  subjects: Subject[];
  lectures: Lecture[];
  preset?: SessionPreset;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  // Arriving with a preset skips the form entirely — the recommendation
  // already knows the what, the why and the how long.
  const [stage, setStage] = React.useState<Stage>(preset ? "ready" : "setup");

  const [subjectId, setSubjectId] = React.useState(preset?.subjectId ?? "");
  const [lectureId, setLectureId] = React.useState("");
  const [taskLabel, setTaskLabel] = React.useState(preset?.title ?? "");
  const [plannedMinutes, setPlannedMinutes] = React.useState(preset?.minutes ?? 25);

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [sessionNote, setSessionNote] = React.useState("");
  const [gapTitle, setGapTitle] = React.useState("");
  const [gapSaving, setGapSaving] = React.useState(false);
  const [capturedGaps, setCapturedGaps] = React.useState<string[]>([]);

  const [accomplished, setAccomplished] = React.useState("");
  const [notUnderstood, setNotUnderstood] = React.useState("");
  const [toReview, setToReview] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [gapCreatedAtEnd, setGapCreatedAtEnd] = React.useState(false);

  const startedAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (stage !== "active" || paused) return;
    const interval = setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [stage, paused]);

  const filteredLectures = lectures.filter((l) => !subjectId || l.subjectId === subjectId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  async function handleStart() {
    const id = await startFocusSession({
      subjectId: subjectId || undefined,
      lectureId: lectureId || undefined,
      taskLabel: taskLabel || undefined,
      plannedMinutes,
    });
    setSessionId(id);
    setRemainingSeconds(plannedMinutes * 60);
    startedAtRef.current = Date.now();
    setStage("active");
  }

  async function handleQuickGap() {
    if (!gapTitle.trim()) return;
    setGapSaving(true);
    try {
      // Goes through the session, which already knows the subject and
      // lecture — so this works even when no subject was picked in a form,
      // where the old path showed a success toast and saved nothing at all.
      if (sessionId) {
        await noteConfusion({ sessionId, note: gapTitle });
      } else if (subjectId) {
        await createKnowledgeGap({
          subjectId,
          lectureId: lectureId || undefined,
          title: gapTitle,
          difficulty: "MEDIUM",
          source: "OTHER",
        });
      }
      setCapturedGaps((g) => [...g, gapTitle]);
      setGapTitle("");
      toast.success(dict.focus.comeBackToIt);
    } finally {
      setGapSaving(false);
    }
  }

  function handleEndSession() {
    setAccomplished(sessionNote);
    setStage("reflect");
  }

  async function handleSubmitReflection() {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const actualMinutes = Math.round((Date.now() - startedAtRef.current) / 60000) || plannedMinutes;
      const result = await endFocusSession({
        sessionId,
        actualMinutes,
        accomplished,
        notUnderstood,
        toReview,
      });
      setGapCreatedAtEnd(result.createdGap);
      setStage("done");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setStage("setup");
    setSessionId(null);
    setSessionNote("");
    setCapturedGaps([]);
    setAccomplished("");
    setNotUnderstood("");
    setToReview("");
    setGapCreatedAtEnd(false);
    setPaused(false);
  }

  // Arrived from the one recommended action: say what this is, why it is
  // worth doing, and how long — then one button. No form to fill in first,
  // because the student already decided by pressing Start.
  if (stage === "ready") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col gap-5 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {dict.focus.readyHeading}
          </p>
          <div className="space-y-2">
            {selectedSubject && (
              <span
                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${selectedSubject.color}22`, color: selectedSubject.color }}
              >
                {selectedSubject.name}
              </span>
            )}
            <p className="font-display text-2xl font-semibold">
              {taskLabel || dict.focus.focusedSession}
            </p>
            <p className="text-sm text-muted-foreground">
              {dict.focus.minutesLong.replace("{minutes}", String(plannedMinutes))}
            </p>
          </div>

          {/* The reason, in the student's own terms. Carried over from the
              recommendation rather than restated here, so the answer to
              "why this?" is the same one they were already given. */}
          {preset?.why && <p className="text-sm text-muted-foreground">{preset.why}</p>}

          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={handleStart}>
              <Play className="size-4" /> {dict.focus.begin}
            </Button>
            {/* Never trapped in a plan they no longer agree with. */}
            <Button variant="ghost" size="sm" onClick={() => setStage("setup")}>
              {dict.focus.somethingElse}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage === "setup") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="space-y-1.5">
            <Label>{dict.focus.subjectOptional}</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); }}>
              <SelectTrigger><SelectValue placeholder={dict.focus.noSpecificSubject} /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {subjectId && (
            <div className="space-y-1.5">
              <Label>{dict.focus.lectureOptional}</Label>
              <Select value={lectureId} onValueChange={setLectureId}>
                <SelectTrigger><SelectValue placeholder={dict.focus.noSpecificLecture} /></SelectTrigger>
                <SelectContent>
                  {filteredLectures.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{dict.focus.workingOn}</Label>
            <Input value={taskLabel} onChange={(e) => setTaskLabel(e.target.value)} placeholder={dict.focus.workingOnPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.focus.studyDuration}</Label>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setPlannedMinutes(d)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    plannedMinutes === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  )}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <Button size="lg" onClick={handleStart}>
            <Play className="size-4" /> {dict.focus.startSession}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "active") {
    const pct = ((plannedMinutes * 60 - remainingSeconds) / (plannedMinutes * 60)) * 100;
    const mm = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
    const ss = (remainingSeconds % 60).toString().padStart(2, "0");

    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <div>
            {selectedSubject && (
              <span
                className="mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${selectedSubject.color}22`, color: selectedSubject.color }}
              >
                {selectedSubject.name}
              </span>
            )}
            <p className="font-display text-lg font-semibold">{taskLabel || dict.focus.focusedSession}</p>
          </div>

          <p className="font-display text-6xl font-bold tabular-nums">{mm}:{ss}</p>
          <div className="w-full max-w-sm">
            <Progress value={pct} />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? dict.focus.resume : dict.focus.pause}
            </Button>
            <Button variant="destructive" onClick={handleEndSession}>
              <Square className="size-4" /> {dict.focus.endSession}
            </Button>
          </div>

          <div className="w-full space-y-1.5 text-left">
            <Label>{dict.focus.quickNote}</Label>
            <Textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder={dict.focus.quickNotePlaceholder}
            />
          </div>

          <div className="w-full space-y-1.5 text-left">
            <Label className="flex items-center gap-1.5">
              <Lightbulb className="size-3.5 text-primary" /> {dict.focus.quickGapCapture}
            </Label>
            <div className="flex gap-2">
              <Input
                value={gapTitle}
                onChange={(e) => setGapTitle(e.target.value)}
                placeholder={dict.focus.quickGapPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickGap();
                  }
                }}
              />
              <Button variant="secondary" onClick={handleQuickGap} disabled={gapSaving || !gapTitle.trim()}>
                {gapSaving ? <Loader2 className="size-4 animate-spin" /> : dict.common.add}
              </Button>
            </div>
            {capturedGaps.length > 0 && (
              <ul className="text-xs text-muted-foreground">
                {capturedGaps.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage === "reflect") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col gap-4 p-6">
          <p className="font-display text-lg font-semibold">{dict.focus.reflectionTitle}</p>
          <div className="space-y-1.5">
            <Label>{dict.focus.accomplished}</Label>
            <Textarea value={accomplished} onChange={(e) => setAccomplished(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.focus.notUnderstood}</Label>
            <Textarea
              value={notUnderstood}
              onChange={(e) => setNotUnderstood(e.target.value)}
              placeholder={selectedSubject ? dict.focus.notUnderstoodHintWithSubject : dict.focus.notUnderstoodHintNoSubject}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.focus.toReview}</Label>
            <Textarea value={toReview} onChange={(e) => setToReview(e.target.value)} />
          </div>
          <Button onClick={handleSubmitReflection} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {dict.focus.finishSession}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <PartyPopper className="size-10 text-primary" />
        <p className="font-display text-xl font-semibold">{dict.focus.niceWork}</p>
        <p className="text-sm text-muted-foreground">
          {dict.focus.sessionLogged}
          {gapCreatedAtEnd && ` ${dict.focus.gapCreatedNote}`}
        </p>
        <Button onClick={resetAll}>{dict.focus.startAnother}</Button>
      </CardContent>
    </Card>
  );
}
