"use client";

import { useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant, useTranscriptions, useVoiceAssistant } from "@livekit/components-react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { getCallBrowserToken, type CallProposal } from "@/lib/customer-calls";

type Connection = { token: string; serverUrl: string };
type Props = { proposal: CallProposal; disabled: boolean; onActiveChange: (active: boolean) => void; onHistoryChange: () => void };

function Conversation({ onEnd }: { onEnd: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const transcripts = useTranscriptions();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [micError, setMicError] = useState("");
  const track = audioTrack?.publication.track?.mediaStreamTrack;
  useEffect(() => {
    if (!track || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const meter = context.createAnalyser();
    meter.fftSize = 256;
    const source = context.createMediaStreamSource(new MediaStream([track]));
    source.connect(meter);
    setAnalyser(meter);
    void context.resume().catch(() => {});
    return () => { source.disconnect(); meter.disconnect(); setAnalyser(null); void context.close().catch(() => {}); };
  }, [track]);
  const labels: Record<string, string> = {
    disconnected: "Connecting to the voice agent…", connecting: "Waiting for the voice agent…",
    initializing: "Preparing the conversation…", listening: "Listening to you", thinking: "Considering your answer…",
    speaking: "KaamParchi is speaking", failed: "The voice worker has not joined. Check that it is running.",
  };
  return <div className="browser-conversation">
    <VoicePoweredOrb playing={state === "speaking"} analyser={analyser} />
    <p role="status">{labels[state] || "Voice session connected"}</p>
    <RoomAudioRenderer />
    <StartAudio className="button secondary" label="Enable agent audio" />
    <div className="toolbar">
      <button className="button secondary" onClick={() => {
        setMicError("");
        void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => setMicError("Check microphone permission and try again."));
      }}>{isMicrophoneEnabled ? "Mute microphone" : "Enable microphone"}</button>
      <button className="button" onClick={onEnd}>End voice session</button>
    </div>
    {micError && <p role="alert">{micError}</p>}
    <details open><summary>Live conversation</summary>{transcripts.length ? transcripts.map(turn => <p key={turn.streamInfo.id}>
      <strong>{turn.participantInfo.identity.startsWith("customer-") ? "Customer" : "KaamParchi"}</strong><br />{turn.text}
    </p>) : <p className="hint">Spoken turns appear here after transcription.</p>}</details>
    <p className="hint">Five-minute prototype limit. End the session, refresh history, and review the saved transcript before acting on a decision.</p>
  </div>;
}

export default function BrowserApproval({ proposal, disabled, onActiveChange, onHistoryChange }: Props) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState("");
  const requestId = useRef("");
  const working = useRef(false);
  const mounted = useRef(true);
  const historyChanged = useRef(onHistoryChange);
  historyChanged.current = onHistoryChange;
  async function send(action: string, id: string) {
    const response = await fetch("/api/browser-voice", {
      method: "POST", keepalive: action === "end",
      headers: { "Content-Type": "application/json", "x-kaamparchi-browser": getCallBrowserToken() },
      body: JSON.stringify({ action, id, proposal, consent: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Voice connection unavailable.");
    return data;
  }
  useEffect(() => {
    mounted.current = true;
    void fetch("/api/browser-voice", { cache: "no-store" }).then(response => response.json()).then(data => {
      if (mounted.current) setReady(data.ready === true);
    }).catch(() => { if (mounted.current) setError("Could not check the voice connection."); });
    return () => {
      mounted.current = false;
      if (requestId.current) void send("end", requestId.current).catch(() => {});
      onActiveChange(false);
    };
  // The parent freezes the proposal during a session and keys this panel by job.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function start() {
    if (working.current || disabled || !ready) return;
    working.current = true; setBusy(true); setError(""); onActiveChange(true);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setAttempt(requestId.current);
    try {
      const data = await send("start", requestId.current);
      if (mounted.current) setConnection({ token: data.token, serverUrl: data.serverUrl });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Could not start voice.");
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  async function end() {
    if (working.current || !requestId.current) return;
    working.current = true; setBusy(true); setError("");
    setConnection(null);
    try {
      await send("end", requestId.current);
      requestId.current = "";
      if (mounted.current) { setAttempt(""); onActiveChange(false); historyChanged.current(); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Could not close voice session. Try again."); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="browser-approval">
    <h3>Talk with KaamParchi</h3>
    <p>The customer can discuss this proposal here using Gnani Prisma and Timbre. Microphone audio passes through LiveKit and Gnani; Gemini handles the conversation.</p>
    {!ready && <p className="hint">Add the LiveKit settings and run the local voice worker to connect.</p>}
    {!connection && !attempt && <button className="button" disabled={disabled || busy || !ready} onClick={() => void start()}>Start browser conversation</button>}
    {busy && <p role="status">Updating voice session…</p>}
    {error && <div className="error" role="alert">{error}</div>}
    {attempt && !connection && <button className="button secondary" disabled={busy} onClick={() => void end()}>End attempted voice session</button>}
    {connection && <LiveKitRoom token={connection.token} serverUrl={connection.serverUrl} audio video={false}
      onError={() => { setError("The audio connection failed. Check microphone access and end this attempt before retrying."); }}
      onDisconnected={() => { if (mounted.current && !working.current) void end(); }}>
      <Conversation onEnd={() => void end()} />
    </LiveKitRoom>}
  </div>;
}
