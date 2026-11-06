"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate, intakeLabels, readJobs, statuses, updateJob, type Intake, type Job, type JobStatus } from "@/lib/jobs";
import { shop } from "@/lib/shop";
import RepairPlan from "@/components/repair-plan";
import CustomerCallPanel from "@/components/customer-call-panel";

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState<JobStatus>("Received");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setLoadError("");
    try {
      const found = readJobs().find(item => item.id === id) ?? null;
      setJob(found);
      if (found) { setStatus(found.status); setNotes(found.technicianNotes); }
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not load this job."); }
    setLoaded(true);
  }, [id]);
  function saveChanges() {
    if (!job) return;
    setSaveError(""); setSaved(false);
    try { setJob(updateJob(job.id, { status, technicianNotes: notes })); setSaved(true); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save changes."); }
  }
  if (!loaded) return <div className="empty" role="status">Loading job card…</div>;
  if (loadError) return <><div role="alert" className="error">{loadError}</div><Link className="button secondary" href="/">Back to job desk</Link></>;
  if (!job) return <div className="empty"><h1>Job not found.</h1><p>This record may be in another browser, or browser storage may have been cleared.</p><Link className="button" href="/">Back to job desk</Link></div>;
  const dirty = status !== job.status || notes !== job.technicianNotes;
  const intake = job.intake;
  function fields(keys: (keyof Intake)[]) {
    return <dl className="parchi-fields">{keys.map(key => (
      <div key={key} className={key === "instructions" || key === "issue" ? "full-row" : undefined}>
        <dt>{key === "spendingLimit" ? "Customer’s spending limit" : intakeLabels[key]}</dt>
        <dd>{intake[key]?.trim() ? (key === "spendingLimit" ? "₹" + intake[key] : intake[key]) : "Not recorded"}</dd>
      </div>
    ))}</dl>;
  }
  return <>
    <div className="no-print">
      <Link className="back" href="/">← Job desk</Link>
      <div className="heading-row bench-title">
        <div><div className="eyebrow">Technician handover · {job.reference}</div>
          <h1>{intake.device}</h1><p>{intake.customerName} · Received {formatDate(job.createdAt)}</p></div>
        <button className="button secondary" onClick={() => window.print()}>Print customer receipt</button>
      </div>
      <div className="workspace bench">
        <div className="bench-sections">
          <section className="panel parchi-section priority"><h2>Before starting work</h2>
            {fields(["instructions", "spendingLimit", "approval"])}
            <p className="hint">Confirm paid work separately with the customer.</p>
          </section>
          <section className="panel parchi-section"><h2>Confirmed at intake</h2>
            {fields(["issue", "condition", "accessories", "contact", "promisedDate"])}
          </section>
          <RepairPlan key={job.id} intake={intake} />
          <CustomerCallPanel key={"calls-" + job.id} job={job} />
        </div>
        <section className="panel parchi-section bench-editor">
          <h2>Technician updates</h2>
          <label htmlFor="job-status">Job status</label>
          <select id="job-status" value={status} onChange={e => { setStatus(e.target.value as JobStatus); setSaved(false); }}>
            {statuses.map(value => <option key={value}>{value}</option>)}
          </select>
          <label htmlFor="notes">Internal notes</label>
          <textarea id="notes" value={notes} maxLength={5000} aria-describedby="notes-help"
            onChange={e => { setNotes(e.target.value); setSaved(false); }} />
          <p className="hint" id="notes-help">Visible only on the technician handover.</p>
          {saveError && <div className="error" role="alert">{saveError}</div>}
          <button className="button" disabled={!dirty} onClick={saveChanges}>Save changes</button>
          <div aria-live="polite">{saved && <p className="success-text">Changes saved in this browser.</p>}
            {dirty && <p className="hint">You have unsaved changes.</p>}</div>
        </section>
      </div>
    </div>
    <article className="print-only customer-slip">
      <header><div>{shop.name} · {shop.address}</div><h1>Repair intake receipt</h1>
        <strong>{job.reference}</strong> · Received {formatDate(job.createdAt)}</header>
      <section><h2>Device received</h2>{fields(["customerName", "contact", "device", "promisedDate", "issue", "condition", "accessories"])}</section>
      <section><h2>Customer instructions and terms</h2>{fields(["instructions", "spendingLimit", "approval"])}
        <p>The shop will seek separate approval for paid repairs.</p></section>
      <footer>Keep this reference for collection. · KaamParchi<br />{shop.receiptNote}</footer>
    </article>
  </>;
}
