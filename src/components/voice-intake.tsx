"use client";

import { useEffect, useRef, useState } from "react";
import { legacyServiceContext, conversationLanguages, speechCode, type ServiceContext } from "@/lib/service-context";
import { prepareAudio } from "@/lib/audio";
import { VoiceInput } from "@/components/ui/voice-input";

type Props = { service?: ServiceContext; transcript: string; onTranscriptChange: (value: string) => void; disabled?: boolean; purpose?: "intake" | "plan" | "clarification"; onActivityChange?: (active: boolean) => void };

export default function VoiceIntake({ transcript, onTranscriptChange, disabled = false, purpose = "intake", onActivityChange, service = legacyServiceContext }: Props) {
  const [consent, setConsent] = useState(false);

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<{ file: File; duration: number } | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const mounted = useRef(true);
  const working = useRef(false);
  useEffect(() => { onActivityChange?.(busy || recording); }, [busy, recording, onActivityChange]);
  useEffect(() => () => onActivityChange?.(false), [onActivityChange]);

  function clearTimers() {
    if (timer.current) clearInterval(timer.current);
    if (deadline.current) clearTimeout(deadline.current);
    timer.current = null; deadline.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers(); request.current?.abort();
      if (recorder.current) { recorder.current.onstop = null; if (recorder.current.state !== "inactive") recorder.current.stop(); }
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!audio) { setAudioUrl(""); return; }
    const url = URL.createObjectURL(audio.file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  async function selectAudio(blob: Blob) {
    try {
      const prepared = await prepareAudio(blob);
      if (mounted.current) { setAudio(prepared); setMessage("Audio ready. Listen before sending it for transcription."); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Could not prepare this audio."); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }

  function stopRecording() {
    clearTimers();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }

  function removeRecording() {
    if (disabled || recording || (working.current && !request.current)) return;
    request.current?.abort();
    request.current = null;
    working.current = false;
    preview.current?.pause();
    setAudio(null); setAudioUrl(""); setSeconds(0); setBusy(false); setError("");
    onTranscriptChange("");
    setMessage("Recording and working transcript removed. You can record again. Review any details already copied into the draft.");
  }

  async function startRecording() {
    if (disabled || !consent || working.current || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Microphone recording is unavailable here. Use an audio upload, or open the app on localhost/HTTPS in a supported browser."); return;
    }
    working.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const media = new MediaRecorder(input);
      recorder.current = media;
      const chunks: Blob[] = [];
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => {
        media.onstop = null; clearTimers(); input.getTracks().forEach(track => track.stop());
        working.current = false;
        if (mounted.current) { setRecording(false); setBusy(false); setError("Recording failed. Try again or upload a short audio file."); }
      };
      media.onstop = () => {
        clearTimers(); input.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        setRecording(false); setBusy(true); working.current = true;
        void selectAudio(new Blob(chunks, { type: media.mimeType }));
      };
      media.start(); setAudio(null); setSeconds(0); setRecording(true); setBusy(false);
      working.current = false;
      timer.current = setInterval(() => setSeconds(value => value + 1), 1000);
      deadline.current = setTimeout(stopRecording, 28000);
    } catch (e) {
      stream.current?.getTracks().forEach(track => track.stop()); working.current = false;
      if (mounted.current) { setBusy(false); setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Microphone permission was denied. You can upload an audio file instead." : "Could not start the microphone. Try uploading audio instead."); }
    }
  }

  async function transcribe() {
    if (disabled || !audio || !consent || working.current || recording) return;
    working.current = true; setBusy(true); setError(""); setMessage("Sending audio to Gnani Prisma…");
    const controller = new AbortController(); request.current = controller;
    try {
      const form = new FormData();
      form.set("audio_file", audio.file); form.set("consent", "true"); form.set("language_code", speechCode(service.language)); form.set("service", JSON.stringify(service));
      const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Transcription failed.");
      if (typeof result.transcript !== "string") throw new Error("The server returned an unexpected transcript.");
      if (mounted.current && request.current === controller && !controller.signal.aborted) {
        if (result.transcript.trim()) {
          onTranscriptChange(result.transcript);
          setMessage(result.truncated ? "Warning: Gnani marked this transcript as incomplete. Use a shorter clip before relying on it." : "Transcript received from Prisma v3.0. Review the wording before using it.");
        } else setMessage("No speech was detected. Your existing transcript and form are unchanged.");
      }
    } catch (e) {
      if (mounted.current && request.current === controller) { setMessage(""); setError(e instanceof Error && e.name === "AbortError" ? "Request cancelled. Gnani may already have received the audio; cancellation does not guarantee a credit refund." : e instanceof Error ? e.message : "Could not transcribe audio."); }
    } finally {
      if (request.current === controller) {
        working.current = false; request.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }

  return <section className="panel voice-panel" aria-labelledby="voice-heading" style={{ marginBottom: 24 }}>
    <div className="panel-head"><div><h2 id="voice-heading">{purpose === "plan" ? "Speak your repair plan" : purpose === "clarification" ? "Record a customer clarification" : "Start with the conversation"}</h2><p className="hint">Record a short clip or upload audio. Prisma transcribes it; you review the details.</p></div><span className="badge">Gnani Prisma v3.0</span></div>
    <div className="form-body">
      <p className="hint">Conversation language · {conversationLanguages[service.language].label}</p>
      <div className="check" style={{ margin: "20px 0", borderRadius: 10 }}><input id="audio-consent" type="checkbox" checked={consent} disabled={disabled || busy || recording} onChange={e => setConsent(e.target.checked)} /><label htmlFor="audio-consent">I have permission from everyone speaking to record and send this audio to Gnani for transcription. This app does not save the audio after the page is closed.</label></div>
      <VoiceInput recording={recording} busy={busy} seconds={seconds} stream={recording ? stream.current : null}
        disabled={disabled || !consent}
        busyLabel={request.current ? "Transcribing with Prisma…" : "Preparing audio…"}
        label={purpose === "plan" ? "Record repair plan" : purpose === "clarification" ? "Record clarification" : "Record intake"}
        onStart={() => void startRecording()} onStop={stopRecording} />
      <div className="voice-upload"><label htmlFor="audio-upload">Or upload audio · 30 seconds maximum</label><input id="audio-upload" type="file" accept=".wav,.mp3,.ogg,.flac,.aac,.m4a,audio/*" disabled={disabled || busy || recording} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file && !working.current) { working.current = true; setAudio(null); setBusy(true); setError(""); setMessage(""); void selectAudio(file); } }} /></div>
      {audio && <div style={{ marginTop: 20 }}>
        <p className="hint">Prepared clip · {audio.duration.toFixed(1)} seconds · WAV · {(audio.file.size / 1024).toFixed(0)} KB</p>
        {audioUrl && <audio ref={preview} controls src={audioUrl} style={{ width: "100%", margin: "12px 0" }} aria-label="Preview intake recording" />}
        <div className="toolbar">
          <button type="button" className="button" disabled={disabled || !consent || busy || recording} onClick={transcribe}>Transcribe with Gnani</button>
          <button type="button" className="button secondary" disabled={disabled || recording || (busy && !request.current)} onClick={removeRecording}>Remove recording{transcript ? " & transcript" : ""}</button>
        </div>
        <p className="hint">Removal clears this clip and the working transcript. Review any details already copied into the draft.</p>
      </div>}
      {busy && request.current && <button type="button" className="button secondary" style={{ marginTop: 12 }} onClick={() => request.current?.abort()}>Cancel request</button>}
      <p className="hint" role="status" aria-live="polite">{recording ? "Microphone is recording. It stops automatically at 28 seconds." : message}</p>
      {error && <div className="error" role="alert">{error}</div>}
      <label htmlFor="intake-transcript" style={{ marginTop: 20 }}>Working transcript · editable, not saved to the receipt</label><textarea id="intake-transcript" value={transcript} disabled={disabled || busy || recording} maxLength={10000} onChange={e => onTranscriptChange(e.target.value)} placeholder="Your transcript appears here after transcription. You can also paste or type one." />
      <p className="hint">{purpose === "intake" ? "Check this transcript first, then use the Gemini suggestion panel below. Suggestions require your review before they change the form." : "Check names, amounts, corrections and negations. This transcript is a working draft."}</p>
    </div>
  </section>;
}
