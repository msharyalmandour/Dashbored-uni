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
import { startFocusSession, endFocusSession } from "@/app/actions/focus";
import { createKnowledgeGap } from "@/app/actions/knowledge-gap";
import { cn } from "@/lib/utils";

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

type Stage = "setup" | "active" | "reflect" | "done";

export function FocusModeClient({ subjects, lectures }: { subjects: Subject[]; lectures: Lecture[] }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("setup");

  const [subjectId, setSubjectId] = React.useState("");
  const [lectureId, setLectureId] = React.useState("");
  const [taskLabel, setTaskLabel] = React.useState("");
  const [plannedMinutes, setPlannedMinutes] = React.useState(25);

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
      if (subjectId) {
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
      toast.success("Knowledge gap captured");
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

  if (stage === "setup") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="space-y-1.5">
            <Label>Subject (optional)</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); }}>
              <SelectTrigger><SelectValue placeholder="No specific subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {subjectId && (
            <div className="space-y-1.5">
              <Label>Lecture (optional)</Label>
              <Select value={lectureId} onValueChange={setLectureId}>
                <SelectTrigger><SelectValue placeholder="No specific lecture" /></SelectTrigger>
                <SelectContent>
                  {filteredLectures.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>What are you working on?</Label>
            <Input value={taskLabel} onChange={(e) => setTaskLabel(e.target.value)} placeholder="e.g. Pharmacology problem set" />
          </div>
          <div className="space-y-1.5">
            <Label>Study duration</Label>
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
            <Play className="size-4" /> Start Focus Session
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
            <p className="font-display text-lg font-semibold">{taskLabel || "Focused study session"}</p>
          </div>

          <p className="font-display text-6xl font-bold tabular-nums">{mm}:{ss}</p>
          <div className="w-full max-w-sm">
            <Progress value={pct} />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="destructive" onClick={handleEndSession}>
              <Square className="size-4" /> End Session
            </Button>
          </div>

          <div className="w-full space-y-1.5 text-left">
            <Label>Quick note</Label>
            <Textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="Anything worth remembering while you work…"
            />
          </div>

          <div className="w-full space-y-1.5 text-left">
            <Label className="flex items-center gap-1.5">
              <Lightbulb className="size-3.5 text-primary" /> Quick knowledge gap capture
            </Label>
            <div className="flex gap-2">
              <Input
                value={gapTitle}
                onChange={(e) => setGapTitle(e.target.value)}
                placeholder="Didn't understand something? Capture it now."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickGap();
                  }
                }}
              />
              <Button variant="secondary" onClick={handleQuickGap} disabled={gapSaving || !gapTitle.trim()}>
                {gapSaving ? <Loader2 className="size-4 animate-spin" /> : "Add"}
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
          <p className="font-display text-lg font-semibold">Session Reflection</p>
          <div className="space-y-1.5">
            <Label>What did you accomplish?</Label>
            <Textarea value={accomplished} onChange={(e) => setAccomplished(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>What didn&apos;t you understand?</Label>
            <Textarea
              value={notUnderstood}
              onChange={(e) => setNotUnderstood(e.target.value)}
              placeholder={selectedSubject ? "This will become a Knowledge Gap automatically." : "Pick a subject next time to auto-create a gap."}
            />
          </div>
          <div className="space-y-1.5">
            <Label>What should you review later?</Label>
            <Textarea value={toReview} onChange={(e) => setToReview(e.target.value)} />
          </div>
          <Button onClick={handleSubmitReflection} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Finish Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <PartyPopper className="size-10 text-primary" />
        <p className="font-display text-xl font-semibold">Nice work</p>
        <p className="text-sm text-muted-foreground">
          Session logged.
          {gapCreatedAtEnd && " A new knowledge gap was created from your reflection."}
        </p>
        <Button onClick={resetAll}>Start Another Session</Button>
      </CardContent>
    </Card>
  );
}
