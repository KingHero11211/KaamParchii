import { DatabaseSync } from "node:sqlite";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CallProposal, CustomerCall } from "../customer-calls";

export class CallLedger {
  private database: DatabaseSync;
  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, fingerprint TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL, record TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_agent ON calls ((1))
      WHERE status IN ('preparing', 'queued', 'unknown');
    `);
  }
  get(id: string, owner: string): CustomerCall {
    const row = this.database.prepare("SELECT record FROM calls WHERE id=? AND owner=?").get(id, owner);
    if (!row) throw new Error("This call was not found in this browser’s call history.");
    return JSON.parse(row.record as string);
  }
  list(jobId: string, owner: string): CustomerCall[] {
    const rows = this.database.prepare("SELECT record FROM calls WHERE owner=? ORDER BY rowid DESC LIMIT 200").all(owner);
    return rows.map(row => JSON.parse(row.record as string) as CustomerCall).filter(call => call.proposal.jobId === jobId);
  }
  reserve(proposal: CallProposal, agentId: string, owner: string, retry = false, requestId?: string): { call: CustomerCall; created: boolean } {
    const fingerprint = createHash("sha256").update(JSON.stringify({ proposal, agentId, owner, requestId })).digest("hex");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.database.prepare("SELECT record FROM calls WHERE fingerprint=?").get(fingerprint);
      if (existing) {
        const previous: CustomerCall = JSON.parse(existing.record as string);
        if (retry && previous.status === "failed") {
          const next: CustomerCall = { ...previous, status: "preparing", message: "Retrying agent preparation." };
          this.database.prepare("UPDATE calls SET status=?,record=? WHERE id=?").run(next.status, JSON.stringify(next), next.id);
          this.database.exec("COMMIT");
          return { call: next, created: true };
        }
        this.database.exec("COMMIT");
        return { call: previous, created: false };
      }
      if (this.database.prepare("SELECT id FROM calls WHERE status IN ('preparing','queued','unknown')").get()) {
        throw new Error("Another call is still active or awaiting reconciliation. Refresh its outcome before preparing another proposal.");
      }
      const call: CustomerCall = { id: requestId || crypto.randomUUID(), agentId, proposal, createdAt: new Date().toISOString(),
        status: "preparing", message: "Preparing the dedicated calling agent." };
      this.database.prepare("INSERT INTO calls VALUES (?,?,?,?,?)").run(call.id, owner, fingerprint, call.status, JSON.stringify(call));
      this.database.exec("COMMIT");
      return { call, created: true };
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  patch(id: string, owner: string, changes: Partial<Omit<CustomerCall, "id" | "proposal" | "agentId" | "createdAt">>): CustomerCall {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.get(id, owner);
      const next = { ...current, ...changes };
      this.database.prepare("UPDATE calls SET status=?,record=? WHERE id=? AND owner=?").run(next.status, JSON.stringify(next), id, owner);
      this.database.exec("COMMIT");
      return next;
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  close() { this.database.close(); }
  report(id: string, token: string, turns: CustomerCall["transcript"]): CustomerCall {
    const row = this.database.prepare("SELECT owner,record FROM calls WHERE id=?").get(id);
    if (!row) throw new Error("Unknown voice session.");
    const call: CustomerCall = JSON.parse(row.record as string);
    const supplied = createHash("sha256").update(token).digest("hex");
    if (call.transport !== "livekit-browser" || !call.reportHash || call.reportHash.length !== supplied.length ||
        !timingSafeEqual(Buffer.from(call.reportHash), Buffer.from(supplied))) throw new Error("Invalid voice-session report.");
    if (call.transcript !== undefined || call.status === "failed") return call;
    return this.patch(id, row.owner as string, {
      status: "finished", transcript: turns, callStatus: turns?.some(turn => turn.role === "user") ? "ANSWERED" : "NO ANSWER",
      message: "Browser conversation ended. Review the transcript before extracting decisions.",
    });
  }
}

let ledger: CallLedger | undefined;
export function callLedger(): CallLedger {
  if (!ledger) {
    const directory = join(process.cwd(), "data");
    mkdirSync(directory, { recursive: true });
    ledger = new CallLedger(join(directory, "customer-calls.sqlite"));
  }
  return ledger;
}
