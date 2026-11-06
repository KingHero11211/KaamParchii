"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Intake } from "@/lib/jobs";
import { legacyServiceContext, conversationLanguages, type ServiceContext } from "@/lib/service-context";
import { buildReadback } from "@/lib/readback";
import AgentAudio from "@/components/ui/agent-audio";

export default function ReadbackPanel({ intake, disabled = false, service = legacyServiceContext }: { intake: Intake; disabled?: boolean; service?: ServiceContext }) {
  const script = useMemo(() => {
    try { return { text: buildReadback(intake, service.language), error: "" }; }
    catch (e) { return { text: "", error: e instanceof Error ? e.message : "Check this draft before spoken review." }; }
  }, [intake, service.language]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const audioUrl = useRef("");
  const player = useRef<HTMLAudioElement | null>(null);
  const latest = useRef(script.text);
  latest.current = script.text;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; controller.current?.abort(); player.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);
  useEffect(() => {
    controller.current?.abort(); player.current?.pause();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = ""; setUrl(""); setError(""); setConsent(false);
  }, [script.text]);

  async function generate() {
    if (working.current || disabled || !consent || !script.text || url) return;
    const snapshot = script.text;
    const abort = new AbortController(); controller.current = abort;
    working.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/readback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake, consent: true, service }), signal: abort.signal });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(typeof body.error === "string" ? body.error : "Could not prepare spoken review.");
      }
      const audio = await response.blob();
      if (!audio.size || !audio.type.startsWith("audio/")) throw new Error("The server returned no playable audio.");
      if (!mounted.current || snapshot !== latest.current || abort.signal.aborted) return;
      const next = URL.createObjectURL(audio);
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = next; setUrl(next);
    } catch (e) {
      if (mounted.current && snapshot === latest.current) setError(e instanceof Error && e.name === "AbortError" ? "Read-back cancelled. Gnani may already have processed the request; cancellation does not guarantee a credit refund." : e instanceof Error ? e.message : "Could not prepare read-back.");
    } finally {
      controller.current = null; working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <section className="form-body" aria-labelledby="readback-heading" style={{ borderTop: "1px solid var(--border)" }}>
    <div className="section-title"><h2 id="readback-heading">Let the customer hear the details</h2><span className="badge">Gnani Timbre</span></div>
    <p className="hint">{conversationLanguages[service.language].label} read-back. Field wording is read as entered, not automatically translated. Listening never confirms the job or authorises a repair.</p>
    {script.error ? <div className="error" role="alert">{script.error}</div> : <details style={{ margin: "16px 0" }}><summary style={{ cursor: "pointer", minHeight: 44, paddingBlock: 10 }}>View exact spoken text</summary><p lang={conversationLanguages[service.language].html} style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{script.text}</p></details>}
    <div className="check" style={{ padding: 16, marginBottom: 16, borderRadius: 10 }}><input id="readback-consent" type="checkbox" checked={consent} disabled={busy || disabled || Boolean(url) || Boolean(script.error)} onChange={e => setConsent(e.target.checked)} /><label htmlFor="readback-consent">Send the displayed review summary to Gnani to generate speech. This may use programme credits.</label></div>
    <div className="toolbar"><button type="button" className="button secondary" disabled={disabled || !consent || busy || Boolean(url) || Boolean(script.error)} onClick={generate}>{busy ? "Preparing spoken summary…" : url ? "Audio ready below" : "Prepare " + conversationLanguages[service.language].name + " read-back"}</button>{busy && <button type="button" className="button secondary" onClick={() => controller.current?.abort()}>Cancel generation</button>}</div>
    <div role="status" aria-live="polite">{busy && <p className="hint">Timbre is generating the recording. Your confirmation has not changed.</p>}{url && <p className="success-text">Audio ready. Press Play to listen; replaying this recording does not make another API request.</p>}</div>
    {url && <AgentAudio key={url} src={url} playerRef={player} label="Play customer intake read-back" />}
    {error && <div className="error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
    <p className="hint">If anything sounds wrong, select Edit details above and correct the draft. Editing discards this recording. Confirm the intake separately below.</p>
  </section>;
}
