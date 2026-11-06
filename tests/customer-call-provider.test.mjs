import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { CallLedger } from "../src/lib/server/call-ledger.ts";

const ledgerModule = "data:text/javascript," + encodeURIComponent("export function callLedger() { return globalThis.__testCallLedger; }");
const source = readFileSync(new URL("../src/lib/server/gnani-calls.ts", import.meta.url), "utf8")
  .replace('"../customer-calls"', JSON.stringify(new URL("../src/lib/customer-calls.ts", import.meta.url).href))
  .replace('"./call-ledger"', JSON.stringify(ledgerModule));
const provider = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64"));
const proposal = {
  jobId: "11111111-1111-4111-8111-111111111111", reference: "RH-DEMO", customerName: "Demo",
  phone: "9876543210", device: "Demo phone", instructions: "Preserve data.", originalLimit: "600",
  total: "900", actions: ["Replace motherboard", "Reset phone, which may erase data"],
};
const success = response => Response.json({ status: "success", response });

async function fixture(run) {
  const keys = ["GNANI_AGENT_API_KEY", "GNANI_AGENT_ID", "GNANI_CALLS_ENABLED", "GNANI_CALL_ALLOWED_NUMBERS"];
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  const ledger = new CallLedger(":memory:");
  globalThis.__testCallLedger = ledger;
  Object.assign(process.env, { GNANI_AGENT_API_KEY: "test-only-key", GNANI_AGENT_ID: "test-agent-id",
    GNANI_CALLS_ENABLED: "true", GNANI_CALL_ALLOWED_NUMBERS: "9876543210" });
  try { await run(ledger); }
  finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => previous[index] === undefined ? delete process.env[key] : process.env[key] = previous[index]);
    delete globalThis.__testCallLedger;
    ledger.close();
  }
}

test("mocked call dispatch freezes context, deduplicates requests and imports only an exact reference", async () => {
  await fixture(async ledger => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return success({});
    };
    const call = await provider.startCustomerCall(proposal, "owner");
    assert.equal(call.status, "queued");
    assert.equal(requests.length, 2);
    assert.ok(requests[0].body.systemPrompt.includes("900"));
    assert.equal(requests[1].body.clientReferenceId, call.id);
    await provider.startCustomerCall(proposal, "owner");
    assert.equal(requests.length, 2);

    let statsRequested = false;
    globalThis.fetch = async url => {
      if (url.includes("/stats")) statsRequested = true;
      return success({ data: [{ conversationId: "unrelated", botId: call.agentId, clientReferenceId: "wrong-reference" }] });
    };
    await provider.refreshCustomerCall(call.id, "owner");
    assert.equal(statsRequested, false);
    assert.equal(ledger.get(call.id, "owner").status, "queued");

    globalThis.fetch = async url => url.includes("/stats") ? success([{
      conversationId: "conversation-1", botId: call.agentId, endTime: 123, callProcessed: true, callStatus: "ANSWERED",
      utteranceAnalytics: [{ role: "user", content: "Reset mat karna." }],
    }]) : success({ data: [{ conversationId: "conversation-1", botId: call.agentId, clientReferenceId: call.id }] });
    const completed = await provider.refreshCustomerCall(call.id, "owner");
    assert.equal(completed.status, "finished");
    assert.equal(completed.decisions, undefined);
    assert.equal(completed.transcript[0].content, "Reset mat karna.");
  });
});

test("an ambiguous network failure after dispatch cannot be retried into a duplicate call", async () => {
  await fixture(async () => {
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      if (requests === 1) return success({});
      throw new Error("Simulated connection loss");
    };
    const call = await provider.startCustomerCall(proposal, "owner");
    assert.equal(call.status, "unknown");
    await provider.startCustomerCall(proposal, "owner", true);
    assert.equal(requests, 2);
  });
});

test("an unregistered local number cannot reach the platform", async () => {
  await fixture(async () => {
    globalThis.fetch = async () => assert.fail("No network request is expected");
    await assert.rejects(() => provider.startCustomerCall({ ...proposal, phone: "9123456789" }, "owner"));
  });
});
