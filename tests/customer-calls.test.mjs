import test from "node:test";
import assert from "node:assert/strict";
import { approvalItems, indianPhone, validateDecisions, validateProposal } from "../src/lib/customer-calls.ts";
import { CallLedger } from "../src/lib/server/call-ledger.ts";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const proposal = validateProposal({
  jobId: "11111111-1111-4111-8111-111111111111", reference: "RH-DEMO", customerName: "Demo Customer",
  phone: "+91 98765 43210", device: "Demo phone", instructions: "Preserve data.", originalLimit: "600",
  total: "900", actions: ["Replace motherboard", "Reset phone, which may erase data"],
});

test("phone normalization and proposal validation reject ambiguous inputs", () => {
  assert.equal(indianPhone("+91 98765 43210"), "9876543210");
  assert.throws(() => indianPhone("987654321"));
  assert.throws(() => validateProposal({ ...proposal, total: "900 or 1000" }));
  assert.throws(() => validateProposal({ ...proposal, actions: ["Reset", "reset"] }));
  assert.throws(() => validateProposal({ ...proposal, instructions: "{{ private_variable }}" }));
});

test("duplicate attempts survive ledger reopen and return the original frozen proposal", () => {
  const directory = mkdtempSync(join(tmpdir(), "kaamparchi-calls-"));
  const path = join(directory, "test.sqlite");
  let ledger = new CallLedger(path);
  try {
    const first = ledger.reserve(proposal, "dedicated-agent", "owner");
    ledger.close();
    ledger = new CallLedger(path);
    const duplicate = ledger.reserve(proposal, "dedicated-agent", "owner");
    assert.equal(first.created, true);
    assert.equal(duplicate.created, false);
    assert.equal(first.call.id, duplicate.call.id);
    assert.equal(duplicate.call.proposal.total, "900");
    assert.throws(() => ledger.get(first.call.id, "someone-else"));
  } finally { ledger.close(); unlinkSync(path); rmdirSync(directory); }
});

test("an active or uncertain call blocks changed proposals and retry never redials an uncertain attempt", () => {
  const ledger = new CallLedger(":memory:");
  try {
    const first = ledger.reserve(proposal, "agent", "owner");
    ledger.patch(first.call.id, "owner", { status: "unknown" });
    assert.equal(ledger.reserve(proposal, "agent", "owner", true).created, false);
    assert.throws(() => ledger.reserve({ ...proposal, total: "1000" }, "agent", "owner"));
    ledger.patch(first.call.id, "owner", { status: "finished" });
    assert.equal(ledger.reserve({ ...proposal, total: "1000" }, "agent", "owner").created, true);
  } finally { ledger.close(); }
});

test("failed pre-dial attempts can be explicitly retried only once", () => {
  const ledger = new CallLedger(":memory:");
  try {
    const first = ledger.reserve(proposal, "agent", "owner").call;
    ledger.patch(first.id, "owner", { status: "failed" });
    assert.equal(ledger.reserve(proposal, "agent", "owner").created, false);
    assert.equal(ledger.reserve(proposal, "agent", "owner", true).created, true);
    assert.equal(ledger.reserve(proposal, "agent", "owner", true).created, false);
  } finally { ledger.close(); }
});

const turns = [
  { role: "user", content: "900 aur motherboard theek hai, reset mat karna." },
  { role: "assistant", content: "Total 900 aur motherboard approved, reset declined. Sahi hai?" },
  { role: "user", content: "Haan ye sahi hai." },
];
const decisions = approvalItems(proposal).map((item, index) => ({
  item, decision: index === 2 ? "declined" : "approved",
  evidence: turns[0].content, readback: turns[1].content, confirmation: turns[2].content,
}));
test("price and replacement approval remain separate from reset refusal", () => {
  const result = validateDecisions({ decisions }, proposal, turns);
  assert.deepEqual(result.map(value => value.decision), ["approved", "approved", "declined"]);
});
test("missing, invented or out-of-order confirmations cannot become approval", () => {
  assert.throws(() => validateDecisions({ decisions }, proposal, turns.slice(0, 2)));
  assert.throws(() => validateDecisions({ decisions: decisions.map(value => ({ ...value, evidence: "invented yes" })) }, proposal, turns));
  assert.throws(() => validateDecisions({ decisions }, proposal, [turns[2], turns[0], turns[1]]));
  assert.throws(() => validateDecisions({ decisions: [decisions[0], decisions[0], decisions[2]] }, proposal, turns));
});
test("unclear decisions discard unsupported evidence", () => {
  const result = validateDecisions({ decisions: decisions.map(value => ({ ...value, decision: "unclear" })) }, proposal, []);
  assert.ok(result.every(value => value.evidence === "" && value.confirmation === ""));
});
