"use client";

import * as React from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "denied" | "unsupported";

/**
 * Records a voice note in the browser and hands back a File.
 *
 * MediaRecorder is genuinely available in every browser this app targets, so
 * the recording itself is real — what happens afterwards is the honest part:
 * the audio is stored as a capture, and nothing in this app can transcribe it,
 * because no speech-to-text provider is wired in. The UI says so rather than
 * leaving a student to discover it when the notes never appear.
 *
 * The container is negotiated rather than assumed. Chrome and Firefox produce
 * webm/opus; Safari produces mp4/aac and rejects a webm request outright, so
 * hardcoding one silently breaks recording on iOS.
 */
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useVoiceRecorder(onComplete: (file: File) => void) {
  const [state, setState] = React.useState<RecorderState>("idle");
  const [seconds, setSeconds] = React.useState(0);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);

  // Held in a ref so the recorder's stop handler always calls the current
  // callback without the recorder having to be torn down and rebuilt.
  const completeRef = React.useRef(onComplete);
  React.useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const cleanup = React.useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    // Every track has to be stopped explicitly, or the browser keeps showing
    // the recording indicator long after the student thinks they stopped.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  const start = React.useCallback(async () => {
    const mimeType = pickMimeType();
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) {
      setState("unsupported");
      return;
    }

    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Covers a refusal and a browser that has blocked the permission
      // permanently; both mean the same thing to the student.
      setState("denied");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: blob.type });
      cleanup();
      setState("idle");
      setSeconds(0);
      if (blob.size > 0) completeRef.current(file);
    };

    recorder.start();
    setState("recording");
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [cleanup]);

  const stop = React.useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const cancel = React.useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      // Dropped so onstop cannot fire and hand back a note the student
      // explicitly discarded.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    cleanup();
    setState("idle");
    setSeconds(0);
  }, [cleanup]);

  return { state, seconds, start, stop, cancel };
}
