"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";

type Props = { src: string; label: string; playerRef?: RefObject<HTMLAudioElement | null> };
type AudioGraph = { context: AudioContext; source: MediaElementAudioSourceNode | null; analyser: AnalyserNode | null };

export default function AgentAudio({ src, label, playerRef }: Props) {
  const player = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<AudioGraph | null>(null);
  const alive = useRef(true);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [status, setStatus] = useState("Ready to play");

  useEffect(() => {
    alive.current = true;
    const element = player.current;
    return () => {
      alive.current = false;
      element?.pause();
      const current = graph.current;
      current?.source?.disconnect();
      current?.analyser?.disconnect();
      if (current) void current.context.close().catch(() => {});
      graph.current = null;
    };
  }, []);

  async function connectAudio() {
    const element = player.current;
    if (!element || typeof AudioContext === "undefined") return;
    if (graph.current) {
      void graph.current.context.resume().catch(() => {});
      return;
    }
    let current: AudioGraph | null = null;
    try {
      const context = new AudioContext();
      current = { context, source: null, analyser: null };
      graph.current = current;
      await context.resume();
      if (!alive.current || graph.current !== current || context.state !== "running") return;
      const meter = context.createAnalyser();
      meter.fftSize = 256;
      meter.smoothingTimeConstant = .75;
      meter.connect(context.destination);
      const source = context.createMediaElementSource(element);
      source.connect(meter);
      current.source = source; current.analyser = meter;
      setAnalyser(meter);
    } catch {
      // Native playback remains available when visual analysis cannot be started.
      if (current && !current.source) {
        void current.context.close().catch(() => {});
        if (graph.current === current) graph.current = null;
      }
    }
  }

  return <div className="agent-audio">
    <VoicePoweredOrb playing={status === "Speaking"} analyser={analyser} />
    <div className="agent-audio-content">
      <div className="eyebrow">KaamParchi voice</div>
      <p className="agent-audio-status" role="status">{status}</p>
      <audio ref={element => { player.current = element; if (playerRef) playerRef.current = element; }}
        controls preload="metadata" src={src} aria-label={label}
        onPlay={() => void connectAudio()}
        onPlaying={() => setStatus("Speaking")}
        onPause={event => setStatus(event.currentTarget.ended ? "Finished · replay anytime" : "Paused")}
        onEnded={() => setStatus("Finished · replay anytime")}
        onWaiting={() => setStatus("Buffering…")}
        onError={() => setStatus("Audio unavailable")} />
    </div>
  </div>;
}
