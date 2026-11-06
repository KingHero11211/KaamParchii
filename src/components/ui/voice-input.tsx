"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoaderCircle, Mic, Square } from "lucide-react";

type VoiceInputProps = {
  recording: boolean;
  busy: boolean;
  seconds: number;
  stream: MediaStream | null;
  disabled: boolean;
  label: string;
  busyLabel?: string;
  onStart: () => void;
  onStop: () => void;
};

const BAR_COUNT = 24;
const formatTime = (seconds: number) => "00:" + Math.min(28, Math.max(0, seconds)).toString().padStart(2, "0");

export function VoiceInput({ recording, busy, seconds, stream, disabled, label, busyLabel = "Preparing audio…", onStart, onStop }: VoiceInputProps) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!stream || !recording || reduced || typeof AudioContext === "undefined") return;
    let context: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let frame = 0;
    let disposed = false;
    const heights = Array<number>(BAR_COUNT).fill(.08);
    try {
      context = new AudioContext();
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const meter = analyser;
      function draw() {
        if (disposed) return;
        meter.getByteTimeDomainData(samples);
        for (let bar = 0; bar < BAR_COUNT; bar++) {
          const start = Math.floor(bar * samples.length / BAR_COUNT);
          const end = Math.floor((bar + 1) * samples.length / BAR_COUNT);
          let sum = 0;
          for (let sample = start; sample < end; sample++) sum += Math.pow((samples[sample] - 128) / 128, 2);
          const target = .08 + Math.min(1, Math.sqrt(sum / (end - start)) * 5) * .92;
          heights[bar] += (target - heights[bar]) * .35;
          bars.current[bar]?.style.setProperty("--voice-bar", String(heights[bar]));
        }
        frame = requestAnimationFrame(draw);
      }
      void context.resume().then(() => { if (!disposed) draw(); }).catch(() => {});
    } catch {
      // The existing recorder continues when the local visual meter is unavailable.
    }
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      source?.disconnect(); analyser?.disconnect();
      if (context) void context.close().catch(() => {});
      bars.current.forEach(bar => bar?.style.removeProperty("--voice-bar"));
    };
  }, [stream, recording, reduced]);

  const status = recording ? "Listening to you" : busy ? busyLabel : "Speak naturally";
  return <div className="voice-input" data-recording={recording}>
    <div className="voice-input-caption" role="status">{status}</div>
    <motion.div className="voice-input-pill"
      animate={{ boxShadow: recording ? "0 0 0 6px rgba(35,78,64,.07)" : "0 0 0 0px rgba(35,78,64,0)" }}
      transition={{ duration: reduced ? 0 : .25 }}>
      <button type="button" className="voice-input-trigger" aria-label={recording ? "Stop recording" : label}
        aria-pressed={recording} disabled={!recording && (disabled || busy)} onClick={recording ? onStop : onStart}>
        {recording ? <Square size={20} fill="currentColor" aria-hidden="true" /> :
          busy ? <LoaderCircle size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}
      </button>
      <AnimatePresence initial={false}>
        {recording && <motion.div className="voice-input-live"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : .15 }}>
          <div className="voice-input-wave" aria-hidden="true">
            {Array.from({ length: BAR_COUNT }, (_, index) => <span key={index}
              ref={element => { bars.current[index] = element; }} />)}
          </div>
          <span className="voice-input-time" aria-label={seconds + " seconds recorded, 28 seconds maximum"}>{formatTime(seconds)}<small> / 00:28</small></span>
        </motion.div>}
      </AnimatePresence>
      {!recording && <span className="voice-input-idle">{busy ? "Please wait" : label}</span>}
    </motion.div>
    <p className="voice-input-help">{recording ? "Tap the square to finish · stops at 28 seconds" : "Use the selected conversation language · up to 28 seconds"}</p>
    <div className="voice-input-progress" aria-hidden="true"><span style={{ width: recording ? Math.min(100, seconds / 28 * 100) + "%" : "0%" }} /></div>
  </div>;
}
