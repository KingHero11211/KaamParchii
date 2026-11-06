import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateProposal, validateDecisions, approvalItems } from "../src/lib/customer-calls.ts";
import { CallLedger } from "../src/lib/server/call-ledger.ts";
const proposal = {jobId:"11111111-1111-4111-8111-111111111111",reference:"KP-TEST",customerName:"Demo",phone:"",device:"Phone",instructions:"Preserve data",originalLimit:"600",total:"900",actions:["Replace board"]};
test("browser proposals allow no phone while phone proposals require one", () => {
  assert.equal(validateProposal(proposal,false).phone, "");
  assert.throws(() => validateProposal(proposal));
});
test("browser requests deduplicate, isolate owners, and accept authenticated late reports once", () => {
  const ledger = new CallLedger(":memory:");
  try {
    const id="22222222-2222-4222-8222-222222222222";
    const first=ledger.reserve(proposal,"livekit:agent","owner",false,id);
    assert.equal(ledger.reserve(proposal,"livekit:agent","owner",false,id).created,false);
    assert.throws(()=>ledger.get(id,"other"));
    ledger.patch(id,"owner",{transport:"livekit-browser",status:"finished",reportHash:createHash("sha256").update("secret").digest("hex")});
    assert.throws(()=>ledger.report(id,"wrong",[]));
    assert.equal(ledger.report(id,"secret",[{role:"user",content:"No reset"}]).callStatus,"ANSWERED");
    assert.equal(ledger.report(id,"secret",[]).transcript.length,1);
    assert.equal(ledger.reserve(proposal,"livekit:agent","owner",false,"33333333-3333-4333-8333-333333333333").created,true);
  } finally { ledger.close(); }
});
test("interrupted readbacks cannot support confirmed decisions",()=>{
  const turns=[{role:"user",content:"Yes"},{role:"assistant",content:"You approve 900",interrupted:true},{role:"user",content:"Correct"}];
  const decisions=approvalItems(proposal).map(item=>({item,decision:"approved",evidence:"Yes",readback:"You approve 900",confirmation:"Correct"}));
  assert.throws(()=>validateDecisions({decisions},proposal,turns));
});
