"use client";

import { useEffect, useRef, useState } from "react";
import { approvalItems, getCallBrowserToken, validateProposal, type CustomerCall } from "@/lib/customer-calls";
import { serviceForJob, serviceCategories, conversationLanguages } from "@/lib/service-context";
import BrowserApproval from "@/components/browser-approval";
import { formatDate, type Job } from "@/lib/jobs";

export default function CustomerCallPanel({ job }: { job: Job }) {
  const service = serviceForJob(job);
  const [total, setTotal] = useState("");
  const [actions, setActions] = useState("");
  const [permission, setPermission] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [calls, setCalls] = useState<CustomerCall[]>([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extractConsent, setExtractConsent] = useState(false);
  const [reviewId, setReviewId] = useState("");
  const working = useRef(false);
  const mounted = useRef(true);

  async function send(body: object) {
    const response = await fetch("/api/customer-calls", {
      method: "POST", headers: { "Content-Type": "application/json", "x-kaamparchi-browser": getCallBrowserToken() },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The call action failed.");
    return data;
  }
  async function load() {
    try {
      const data = await send({ action: "list", jobId: job.id });
      if (mounted.current) setCalls(data.calls);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Could not load conversation history.");
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  // This panel is keyed by job ID, so every job receives fresh state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function proposal() {
    return validateProposal({
      jobId: job.id, reference: job.reference, customerName: job.intake.customerName,
      device: job.intake.device, phone: "", total, actions: actions.split("\n").filter(value => value.trim()),
      instructions: job.intake.instructions, originalLimit: job.intake.spendingLimit, service,
    }, false);
  }
  function edit(change: () => void) { change(); setReviewed(false); setPreview(false); setPermission(false); }
  async function perform(action: string, id?: string) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      const body = { action, id, consent: extractConsent, confirmed: reviewId === id };
      const data = action === "end-browser" ? await (async () => {
        const response = await fetch("/api/browser-voice", { method: "POST",
          headers: { "Content-Type": "application/json", "x-kaamparchi-browser": getCallBrowserToken() },
          body: JSON.stringify({ action: "end", id }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not end voice session.");
        return result;
      })() : await send(body);
      if (mounted.current) {
        setCalls(previous => [data.call, ...previous.filter(call => call.id !== data.call.id)]);
        setReviewId("");
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "The call action failed."); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="panel parchi-section call-panel" aria-labelledby="customer-call-heading">
    <div className="eyebrow">Customer approval</div>
    <h2 id="customer-call-heading">Ask before the repair</h2>
    <p className="hint">{service.shopName} · {conversationLanguages[service.language].label}</p>
    <p>Prepare the exact revised price and work. The customer can discuss each item with KaamParchi in a live browser conversation.</p>
    <div className="fields">
      <div className="field"><label htmlFor="call-total">Complete revised total · ₹</label><input id="call-total" inputMode="decimal" value={total} disabled={busy || voiceActive} onChange={e => edit(() => setTotal(e.target.value))} placeholder="e.g. 900" /></div>
      <div className="field full"><label htmlFor="call-actions">Proposed work · one action per line</label><textarea id="call-actions" value={actions} maxLength={1500} disabled={busy || voiceActive}
        placeholder={"Describe one specific action per line for " + serviceCategories[service.category].label.toLowerCase()} onChange={e => edit(() => setActions(e.target.value))} />
        <p className="hint">Include any data-loss consequences. Up to five specific actions. Confirm the total includes all proposed work.</p></div>
    </div>
    <button className="button secondary" disabled={busy || voiceActive} onClick={() => {
      try { proposal(); setPreview(true); setError(""); } catch (e) { setError((e as Error).message); }
    }}>Preview customer proposal</button>
    {preview && <div className="aside-card">
      <h3>Proposal to {job.intake.customerName}</h3>
      <p>{job.reference} · {job.intake.device}{proposal().phone ? " · +91 " + proposal().phone : ""}</p>
      <p>Originally recorded spending limit · {job.intake.spendingLimit ? "₹" + job.intake.spendingLimit : "Not recorded"}</p>
      <p>Original customer instructions</p><blockquote>{job.intake.instructions || "Not recorded"}</blockquote>
      <ul>{approvalItems(proposal()).map(item => <li key={item}>{item}</li>)}</ul>
      <p>The assistant will introduce itself, confirm who answered, explain the proposal, ask about each item, and read the decisions back for confirmation.</p>
    </div>}
    <div className="check"><input id="call-permission" type="checkbox" checked={permission} disabled={busy || voiceActive || !preview} onChange={e => setPermission(e.target.checked)} />
      <label htmlFor="call-permission">The customer agrees to this automated voice conversation, with audio processed through LiveKit and Gnani and responses generated by Gemini.</label></div>
    <div className="check"><input id="call-proposal-review" type="checkbox" checked={reviewed} disabled={busy || voiceActive || !preview} onChange={e => setReviewed(e.target.checked)} />
      <label htmlFor="call-proposal-review">I checked the complete price, individual actions and original instructions for this conversation.</label></div>
    {preview && <BrowserApproval proposal={proposal()} disabled={!permission || !reviewed || busy}
      onActiveChange={setVoiceActive} onHistoryChange={() => void load()} />}
    <button className="button secondary" disabled={busy || voiceActive} onClick={() => { setError(""); void load(); }}>Refresh conversation history</button>
    {error && <div className="error" role="alert">{error}</div>}
    <h3>Conversations for this job</h3>
    {!calls.length && <p className="hint">No conversations recorded for this job in this browser’s history.</p>}
    {calls.map(call => <article className="aside-card" key={call.id}>
      <h3>{call.status === "finished" ? "Conversation completed" : call.status === "failed" ? "Connection failed" : "Conversation awaiting outcome"}</h3>
      <p>{formatDate(call.createdAt)} · {call.transport === "livekit-browser" ? "Browser conversation" : "+91 " + call.proposal.phone}</p>
      <ul>{approvalItems(call.proposal).map(item => <li key={item}>{item}</li>)}</ul>
      <p role="status">{call.message}</p>
      {call.callStatus && <p>Connection outcome · {call.callStatus}</p>}
      {["queued", "unknown", "preparing"].includes(call.status) && <button className="button secondary" disabled={busy || voiceActive} onClick={() => void perform("refresh", call.id)}>Refresh conversation outcome</button>}
      {call.transport === "livekit-browser" && ["queued", "unknown", "preparing"].includes(call.status) && !voiceActive && <button className="button secondary" disabled={busy} onClick={() => void perform("end-browser", call.id)}>End saved voice session</button>}
      {!!call.transcript?.length && <details><summary>Read full conversation transcript</summary>{call.transcript.map((turn, index) => <p key={index}><strong>{turn.role === "user" ? "Customer" : "KaamParchi"}</strong><br />{turn.content}{turn.interrupted && <em> · interrupted</em>}</p>)}</details>}
      {call.status === "finished" && call.callStatus === "ANSWERED" && !!call.transcript?.length && !call.decisions && <>
        <label className="check"><input type="checkbox" checked={extractConsent} disabled={busy || voiceActive} onChange={e => setExtractConsent(e.target.checked)} />Send this proposal and call transcript to Gemini to suggest separate decisions.</label>
        <button className="button secondary" disabled={busy || !extractConsent} onClick={() => void perform("extract", call.id)}>Extract customer decisions</button>
      </>}
      {call.decisions && <>
        <h3>{call.reviewedAt ? "Shop-reviewed decisions" : "Suggested decisions · review required"}</h3>
        {call.decisions.map(decision => <div className="call-decision" key={decision.item}>
          <strong>{decision.item}</strong><p>{decision.decision === "unclear" ? "Pending clarification" : decision.decision === "approved" ? "Customer approval indicated" : "Customer declined"}</p>
          {decision.evidence && <><p>Customer response</p><blockquote>{decision.evidence}</blockquote><p>Assistant read-back</p><blockquote>{decision.readback}</blockquote><p>Customer confirmation</p><blockquote>{decision.confirmation}</blockquote></>}
        </div>)}
        {!call.reviewedAt && <>
          <label className="check"><input type="checkbox" checked={reviewId === call.id} disabled={busy || voiceActive} onChange={e => setReviewId(e.target.checked ? call.id : "")} />I checked each suggestion against the full conversation and this saved proposal. Unclear items require clarification.</label>
          <button className="button secondary" disabled={busy || reviewId !== call.id} onClick={() => void perform("review", call.id)}>Mark decisions reviewed</button>
        </>}
      </>}
    </article>)}
    <p className="hint">Conversation records are saved on this app’s server and linked to this browser. Every changed price or repair needs a fresh proposal. Review the actual conversation before acting on suggested decisions.</p>
  </section>;
}
