"use client";

import { useEffect, useRef, useState } from "react";
import VoiceIntake from "@/components/voice-intake";
import { legacyServiceContext, type ServiceContext } from "@/lib/service-context";
import type { Intake } from "@/lib/jobs";
import type { PlanCheck } from "@/lib/plan-check";
import AgentAudio from "@/components/ui/agent-audio";

export default function RepairPlan({ intake, service = legacyServiceContext }: { intake: Intake; service?: ServiceContext }) {
  const [plan, setPlan] = useState("");
  const [clarification, setClarification] = useState("");
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [mode, setMode] = useState<"plan" | "clarification">("plan");
  const [consent, setConsent] = useState(false);
  const [speechConsent, setSpeechConsent] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PlanCheck | null>(null);
  const [question, setQuestion] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!audio) { setAudioUrl(""); return; }
    const url = URL.createObjectURL(audio);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  function edit(value: string) {
    if (mode === "plan") { setPlan(value); setQuestion(""); setClarification(""); setClarificationQuestion(""); }
    else setClarification(value);
    setResult(null); setAudio(null); setError("");
  }
  async function run(action: "check" | "speak") {
    if (busy || voiceBusy || request.current || !consent || (action === "speak" && (!speechConsent || !result))) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    if (action === "check") { setResult(null); setAudio(null); }
    try {
      const response = await fetch("/api/plan-check", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          action, consent: true, plan, clarification, clarificationQuestion, service,
          terms: { instructions: intake.instructions, spendingLimit: intake.spendingLimit, approval: intake.approval },
          result,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "The plan check is unavailable.");
      }
      if (action === "speak") {
        const blob = await response.blob();
        if (request.current === controller) setAudio(blob);
      } else {
        const data: PlanCheck = await response.json();
        if (request.current === controller) { setResult(data); setQuestion(data.question); }
      }
    } catch (e) {
      if (request.current === controller) setError(e instanceof Error && e.name === "AbortError" ? "Request cancelled." : e instanceof Error ? e.message : "The request failed.");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  return <section className="panel parchi-section repair-plan" aria-labelledby="plan-title">
    <div className="eyebrow">Customer instructions at the workbench</div>
    <h2 id="plan-title">Check the proposed repair</h2>
    <p>Describe the work, total price and any changes to the item or property. Compare the plan with the confirmed customer terms before proceeding.</p>
    <div className="toolbar" style={{ marginBottom: 20 }}>
      <button className="button secondary" disabled={busy || voiceBusy} aria-pressed={mode === "plan"} onClick={() => setMode("plan")}>Technician plan</button>
      <button className="button secondary" disabled={busy || voiceBusy || !question} aria-pressed={mode === "clarification"} onClick={() => {
        if (!clarificationQuestion) setClarificationQuestion(question);
        setMode("clarification");
      }}>Customer clarification</button>
    </div>
    {mode === "clarification" && <div className="notice"><strong>{clarification.trim() ? "Question answered in this draft" : "Ask the customer"}</strong><p>{clarificationQuestion}</p><p>Record their answer as a draft. Confirm any repair approval separately with the customer.</p></div>}
    <VoiceIntake service={service} key={mode} purpose={mode} transcript={mode === "plan" ? plan : clarification}
      onTranscriptChange={edit} disabled={busy} onActivityChange={setVoiceBusy} />
    {mode === "clarification" && <p className="hint">Your plan remains available in the Technician plan tab. Clarifications stay in this session and leave the original intake intact.</p>}
    <div className="check">
      <input id="plan-consent" type="checkbox" checked={consent} disabled={busy || voiceBusy} onChange={e => setConsent(e.target.checked)} />
      <label htmlFor="plan-consent">I have permission to send the plan, customer instructions, spending limit and clarification draft to Gemini for comparison.</label>
    </div>
    <button className="button" disabled={busy || voiceBusy || !consent || plan.trim().length < 10 || plan.length > 4000 || clarification.length > 2000 || (mode === "clarification" && !clarification.trim())} onClick={() => void run("check")}>{busy ? "Processing…" : mode === "clarification" ? "Recheck with customer answer" : "Check plan against customer terms"}</button>
    {busy && <button className="button secondary" onClick={() => request.current?.abort()}>Cancel request</button>}
    {error && <div className="error" role="alert">{error}</div>}
    {result && <div className="plan-findings" aria-live="polite">
      <h3>{result.concerns.length ? "Review these concerns before proceeding" : "No conflict identified in this check"}</h3>
      <p>AI checks can miss or misinterpret instructions. Review the original terms and obtain separate approval for paid work.</p>
      <p>{result.estimate ? "Proposed total identified: ₹" + result.estimate : "Total price needs clarification."}</p>
      {result.estimate && <blockquote>{result.estimateEvidence}</blockquote>}
      {result.concerns.map((item, index) => <article className="aside-card" key={index}>
        <h3>{item.message}</h3><p>Customer record</p><blockquote>{item.customerQuote}</blockquote>
        <p>Technician plan</p><blockquote>{item.planQuote}</blockquote>
      </article>)}
      <h3>Question for the customer</h3><p>{result.question}</p>
      <div className="check"><input id="warning-consent" type="checkbox" checked={speechConsent} disabled={busy || voiceBusy} onChange={e => setSpeechConsent(e.target.checked)} />
        <label htmlFor="warning-consent">Send the findings and clarification question to Gnani Timbre for a spoken reminder.</label></div>
      <button className="button secondary" disabled={busy || voiceBusy || !speechConsent || !consent} onClick={() => void run("speak")}>Prepare spoken reminder</button>
      {audioUrl && <AgentAudio key={audioUrl} src={audioUrl} label="Spoken repair plan reminder" />}
    </div>}
    <p className="hint">Plan checks and clarification drafts are kept on this screen for the current session.</p>
  </section>;
}
