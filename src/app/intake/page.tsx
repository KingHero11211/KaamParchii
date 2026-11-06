"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { createJob, emptyIntake, intakeLabels, validateIntake, type Intake } from "@/lib/jobs";
import ServiceSettings from "@/components/service-settings";
import { defaultServiceContext, validateServiceContext, serviceCategories, sampleDetails, conversationLanguages, type ServiceContext } from "@/lib/service-context";
import VoiceIntake from "@/components/voice-intake";
import ExtractionPanel from "@/components/extraction-panel";
import ReadbackPanel from "@/components/readback-panel";

export default function IntakePage() {
  const router = useRouter();
  const [service, setService] = useState<ServiceContext>({...defaultServiceContext});
  const contextKey = JSON.stringify(service);
  const [intake, setIntake] = useState<Intake>({ ...emptyIntake });
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const savingRef = useRef(false);
  function change(key: keyof Intake, value: string) {
    setIntake(previous => ({ ...previous, [key]: value }));
    setConfirmed(false);
  }
  function next(event: FormEvent) {
    event.preventDefault();
    if (extracting) return;
    let problems = validateIntake(intake);
    try { validateServiceContext(service); } catch (e) { problems = [...problems, (e as Error).message]; }
    setErrors(problems);
    if (!problems.length) { setReview(true); window.scrollTo(0, 0); }
  }
  function save() {
    if (!confirmed || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const job = createJob(intake, service);
      router.replace(`/jobs/${job.id}`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Could not save this intake."]);
      savingRef.current = false;
      setSaving(false);
    }
  }
  function field(key: keyof Intake, placeholder: string, full = false, multiline = false, type = "text", required = false) {
    const props = { id: key, name: key, value: intake[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, e.target.value), placeholder, required, maxLength: multiline ? 2000 : 160 };
    return <div className={`field ${full ? "full" : ""}`}><label htmlFor={key}>{intakeLabels[key]}{required ? " *" : ""}</label>{multiline ? <textarea {...props} /> : <input {...props} type={type} inputMode={key === "spendingLimit" ? "decimal" : undefined} />}</div>;
  }
  return <>
    <Link className="back" href="/">← Back to job desk</Link>
    <div className="heading-row"><div><div className="eyebrow">A GOOD REPAIR STARTS HERE</div><h1>{review ? "Check the details together." : "Let’s get the details right."}</h1><p>{review ? "Review this record with the customer before confirming the handover." : "Capture what arrived, what’s wrong, and what the customer wants you to know."}</p></div><span className="badge">Voice-assisted prototype</span></div>
    <div className="steps" aria-label="Intake progress"><span className={`step ${!review ? "active" : ""}`} aria-current={!review ? "step" : undefined}>1 · Capture details</span><span className={`step ${review ? "active" : ""}`} aria-current={review ? "step" : undefined}>2 · Review & confirm</span><span className="step">3 · Job card</span></div>
    {errors.length > 0 && <div className="error" role="alert"><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <div className="workspace"><div>
      {!review && <ServiceSettings value={service} disabled={extracting || voiceActive} onChange={value=>{setService(value);setConfirmed(false);}} />}
      {!review && <VoiceIntake key={"voice-" + contextKey} service={service} transcript={transcript} onTranscriptChange={setTranscript} disabled={extracting} onActivityChange={setVoiceActive} />}
      {!review && <ExtractionPanel key={"extract-" + contextKey} service={service} transcript={transcript} intake={intake} disabled={voiceActive} onBusyChange={setExtracting} onApply={values => { setIntake(previous => ({ ...previous, ...values })); setConfirmed(false); setErrors([]); }} />}
      {!review ? <form className="panel" onSubmit={next}>
        <div className="form-body">
          <div style={{ marginBottom: 24 }}><button className="button secondary small" type="button" disabled={Object.entries(intake).some(([key, value]) => value !== emptyIntake[key as keyof Intake])} onClick={() => setIntake({ ...emptyIntake, ...sampleDetails(service), spendingLimit: "800", approval: "Ask before any paid work" })}>Use sample intake details</button><p className="hint">Fictional example for the hackathon. Available only when the form is empty.</p></div>
          <div className="section-title"><span>01</span><h2>Customer & item / asset</h2></div>
          <div className="fields">{field("customerName", "Customer name", false, false, "text", true)}{field("contact", "Phone or another contact (optional)", false, false, "tel")}{field("device", serviceCategories[service.category].example, true, false, "text", true)}</div>
          <div className="section-title"><span>02</span><h2>The handover details</h2></div>
          <div className="fields">{field("issue", "Describe the problem in the customer’s words", true, true, "text", true)}{field("condition", "Describe visible condition, or explicitly record not inspected", true, true)}{field("accessories", "Items or accessories received, if any", true)}{field("instructions", "e.g. inspect first; ask before replacing parts", true, true)}</div>
          <div className="section-title"><span>03</span><h2>Expectations & approval</h2></div>
          <div className="fields">{field("spendingLimit", "Amount in ₹, if stated")}{field("promisedDate", "", false, false, "date")}<div className="field full"><label htmlFor="approval">Approval requirement</label><select id="approval" value={intake.approval} onChange={e => change("approval", e.target.value)}><option>Not recorded</option><option>Ask before any paid work</option></select><p className="hint">A spending limit does not authorise repair work. Leave unagreed details blank.</p></div></div>
          <p className="hint">* Required fields. Do not enter device passwords or unlock codes. Use fictional customer details in this local prototype.</p>
        </div>
        <div className="actions"><Link className="button secondary" href="/">Cancel</Link><button className="button" type="submit" disabled={extracting}>Review intake →</button></div>
      </form> : <section className="panel" aria-label="Review intake">
        <div className="panel-head"><h2>Customer intake · Draft</h2><button className="button secondary small" disabled={saving} onClick={() => { setReview(false); setConfirmed(false); setErrors([]); }}>Edit details</button></div>
        <p style={{paddingInline:24}}>{service.shopName} · {serviceCategories[service.category].label} · {conversationLanguages[service.language].label}</p>
        <dl className="review-list">{(Object.keys(intakeLabels) as (keyof Intake)[]).map(key => <div key={key} className={`review-item ${["issue", "instructions"].includes(key) ? "wide" : ""}`}><dt>{intakeLabels[key]}</dt><dd>{intake[key] ? `${key === "spendingLimit" ? "₹" : ""}${intake[key]}` : <span className="unrecorded">Not recorded</span>}</dd></div>)}</dl>
        <ReadbackPanel service={service} intake={intake} disabled={saving} />
        <div className="check"><input id="confirm" type="checkbox" checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} /><label htmlFor="confirm">I have reviewed these details with the customer and confirmed that this record reflects the handover. This does not authorise unspecified repairs.</label></div>
        <div className="actions"><span className="hint">Saved in this browser only.</span><button className="button" disabled={!confirmed || saving} onClick={save}>{saving ? "Saving…" : "Confirm & create job card →"}</button></div>
      </section>}
    </div><aside><div className="aside-card dark"><span className="badge">SPEAK → REVIEW → LISTEN</span><h3>Speak it. Check it.</h3><p>Prisma transcribes the conversation. Gemini suggests fields with supporting excerpts. Review the draft, let the customer hear it with Timbre, then confirm separately.</p></div><div className="aside-card"><h3>Small details. Big difference.</h3><ul><li>Record symptoms as reported, not as a diagnosis.</li><li>Check accessories and visible damage together.</li><li>Ask about restrictions, replacement permissions and spending expectations.</li><li>Blank means not recorded, not “none”.</li></ul></div></aside></div>
  </>;
}
