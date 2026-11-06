"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, readJobs, statuses, type Job } from "@/lib/jobs";

export default function JobDesk() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  useEffect(() => {
    try { setJobs(readJobs()); } catch (e) { setError(e instanceof Error ? e.message : "Could not load saved jobs."); }
    setReady(true);
  }, []);
  const visible = jobs.filter(j => (filter === "All statuses" || j.status === filter) &&
    [j.reference, j.intake.customerName, j.intake.device, j.intake.contact].some(s => s.toLowerCase().includes(query.trim().toLowerCase())));
  const stats = [
    { label: "Open jobs", value: jobs.filter(j => j.status !== "Collected").length, note: "Currently with your shop" },
    { label: "Received", value: jobs.filter(j => j.status === "Received").length, note: "Waiting to be started" },
    { label: "In progress", value: jobs.filter(j => j.status === "In progress").length, note: "On the workbench" },
    { label: "Ready for pickup", value: jobs.filter(j => j.status === "Ready").length, note: "Waiting for the customer" },
  ];
  return <>
    <div className="heading-row"><div><div className="eyebrow">YOUR SHOP, IN SYNC</div><h1>A clear handover.<br />A better repair.</h1><p>Keep customer instructions and repair details together, from the first conversation to collection.</p></div><Link className="button" href="/intake">+ Start a new intake</Link></div>
    <div className="notice">Hackathon prototype · Records stay in this browser and can be lost if browser data is cleared. Use fictional details. Voice transcription requires a locally configured Gnani key.</div>
    {error && <div role="alert" className="error">{error}</div>}
    <section className="stats" aria-label="Job overview">{stats.map(s => <div className="stat" key={s.label}><div className="label">{s.label}</div><strong>{ready && !error ? s.value : "—"}</strong><small>{s.note}</small></div>)}</section>
    <section className="panel" aria-labelledby="jobs-title"><div className="panel-head"><h2 id="jobs-title">Your job desk <span className="badge">{ready && !error ? jobs.length : "—"} records</span></h2><div className="toolbar"><input aria-label="Search jobs" placeholder="Search name, device or job ID…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter by job status" value={filter} onChange={e => setFilter(e.target.value)}><option>All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div></div>
      {!ready ? <div className="empty" role="status">Loading your job desk…</div> : error ? <div className="empty"><h3>Records couldn’t be loaded</h3><p>Your existing data has not been overwritten. Resolve the storage issue before creating new jobs.</p></div> : jobs.length === 0 ? <div className="empty"><div className="empty-icon" aria-hidden="true">▤</div><h2>Every repair starts with the details.</h2><p>Create your first intake. Capture the issue, the customer’s instructions, and what arrived with the device.</p><Link className="button" href="/intake">Create first job card ↗</Link></div> : visible.length === 0 ? <div className="empty"><h3>No matching jobs</h3><p>Try a different search or status.</p><button className="button secondary" onClick={() => { setQuery(""); setFilter("All statuses"); }}>Clear filters</button></div> : <div className="table-wrap"><table><thead><tr><th>Job / received</th><th>Customer</th><th>Device</th><th>Status</th><th><span className="hint">Details</span></th></tr></thead><tbody>{visible.map(job => <tr key={job.id}><td><Link className="job-link" href={`/jobs/${job.id}`}>{job.reference}</Link><small>{formatDate(job.createdAt)}</small></td><td>{job.intake.customerName}<small>{job.intake.contact || "Contact not recorded"}</small></td><td>{job.intake.device}</td><td><span className={`badge ${job.status.toLowerCase().replaceAll(" ", "-")}`}>{job.status}</span></td><td><Link className="job-link" href={`/jobs/${job.id}`} aria-label={`Open ${job.reference}`}>Open ↗</Link></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
