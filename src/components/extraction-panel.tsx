"use client";

import { useEffect, useRef, useState } from "react";
import { extractionKeys, validateExtraction, type Extraction } from "@/lib/extraction";
import { intakeLabels, type Intake } from "@/lib/jobs";

type Props = { transcript: string; intake: Intake; onApply: (values: Partial<Intake>) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean };

export default function ExtractionPanel({ transcript, intake, onApply, onBusyChange, disabled = false }: Props) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ extraction: Extraction; transcript: string } | null>(null);
  const [selected, setSelected] = useState<(keyof Intake)[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const latestTranscript = useRef(transcript);
  latestTranscript.current = transcript;
  const latestIntake = useRef(intake);
  useEffect(() => {
    const previous = latestIntake.current;
    latestIntake.current = intake;
    setSelected(keys => keys.filter(key => previous[key] === intake[key]));
  }, [intake]);
  const mounted = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); onBusyChange(false); };
  }, [onBusyChange]);
  useEffect(() => {
    controller.current?.abort(); setResult(null); setSelected([]); setError(""); setMessage("");
  }, [transcript]);

  async function extract() {
    if (disabled || !consent || working.current || transcript.trim().length < 10) return;
    const snapshot = transcript;
    const abort = new AbortController(); controller.current = abort;
    working.current = true; setBusy(true); onBusyChange(true); setError(""); setResult(null); setSelected([]); setMessage("");
    try {
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: snapshot, consent: true }), signal: abort.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not extract intake details.");
      if (!mounted.current || snapshot !== latestTranscript.current) return;
      const extraction = validateExtraction(body, snapshot);
      // Keep the server's warnings as well as any client-side validation warnings.
      if (Array.isArray(body.warnings)) extraction.warnings = [...new Set([...extraction.warnings, ...body.warnings.filter((v: unknown) => typeof v === "string")])].slice(0, 20);
      setResult({ extraction, transcript: snapshot });
      setSelected(extractionKeys.filter(key => extraction.fields[key].evidence && (!latestIntake.current[key] || (key === "approval" && latestIntake.current[key] === "Not recorded"))));
    } catch (e) {
      if (mounted.current && snapshot === latestTranscript.current) setError(e instanceof Error && e.name === "AbortError" ? "Extraction cancelled. Your form is unchanged." : e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      working.current = false; controller.current = null;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  }

  function apply() {
    if (!result || result.transcript !== transcript || !selected.length) return;
    const values = Object.fromEntries(selected.filter(key => result.extraction.fields[key].evidence).map(key => [key, result.extraction.fields[key].value])) as Partial<Intake>;
    onApply(values); setSelected([]); setMessage("Selected suggestions applied to the draft. Check every field before customer confirmation.");
  }

  return <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="extract-heading">
    <div className="panel-head"><div><h2 id="extract-heading">Turn words into a draft</h2><p className="hint">Gemini suggests details from the transcript. You choose what enters the job card.</p></div><span className="badge">Review required</span></div>
    <div className="form-body">
      <div className="check" style={{ borderRadius: 10, marginBottom: 20 }}><input id="gemini-consent" type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><label htmlFor="gemini-consent">Send this transcript to Google Gemini to suggest intake details. Use fictional customer information for this prototype.</label></div>
      <div className="toolbar"><button className="button" type="button" disabled={disabled || !consent || busy || transcript.trim().length < 10 || transcript.length > 10000} onClick={extract}>{busy ? "Reading transcript…" : "Suggest job-card details"}</button>{busy && <button type="button" className="button secondary" onClick={() => controller.current?.abort()}>Cancel extraction</button>}</div>
      <p className="hint">{transcript.trim().length < 10 ? "Record, transcribe, or type at least 10 characters above to begin." : "Only the transcript is sent. Your existing form values stay unchanged unless you select replacements."}</p>
      {error && <div className="error" role="alert">{error}</div>}
      <div role="status" aria-live="polite">{busy ? <p className="hint">Asking Gemini for suggestions. Nothing has been saved or confirmed.</p> : message && <p className="success-text">{message}</p>}</div>
      {result && result.transcript === transcript && <>
        <p className="hint">A matching excerpt shows the source, but does not guarantee the suggestion is correct. Existing values are not selected for replacement by default.</p>
        {extractionKeys.map(key => {
          const field = result.extraction.fields[key];
          const available = Boolean(field.evidence && field.value);
          return <div key={key} style={{ borderBottom: "1px solid var(--border)", padding: "18px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><input id={`suggest-${key}`} type="checkbox" disabled={!available} checked={selected.includes(key)} style={{ width: 22, minHeight: 22, height: 22, flexShrink: 0, marginTop: 3 }} onChange={e => setSelected(previous => e.target.checked ? [...previous, key] : previous.filter(value => value !== key))} /><div style={{ minWidth: 0, overflowWrap: "anywhere" }}><label htmlFor={`suggest-${key}`}>{intakeLabels[key]}</label><p style={{ marginBottom: 6, whiteSpace: "pre-wrap" }}>{available ? `${key === "spendingLimit" ? "₹" : ""}${field.value}` : "Not stated clearly — ask or enter manually"}</p>{available && <><p className="hint">Transcript excerpt:</p><blockquote style={{ margin: "8px 0", paddingLeft: 12, borderLeft: "3px solid var(--border)", whiteSpace: "pre-wrap" }}>{field.evidence}</blockquote></>}{intake[key] && !(key === "approval" && intake[key] === "Not recorded") && <p className="hint">Current form value: {intake[key]}</p>}</div></div>
          </div>;
        })}
        {result.extraction.clarifications.length > 0 && <div className="notice" style={{ marginTop: 20 }}><strong>Clarify with the customer</strong><ul>{result.extraction.clarifications.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}
        {result.extraction.warnings.length > 0 && <div className="notice" role="status"><strong>Suggestion review notes</strong><ul>{result.extraction.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
        <button className="button" style={{ marginTop: 20 }} type="button" disabled={!selected.length} onClick={apply}>Apply {selected.length} selected suggestion{selected.length === 1 ? "" : "s"}</button>
      </>}
    </div>
  </section>;
}
