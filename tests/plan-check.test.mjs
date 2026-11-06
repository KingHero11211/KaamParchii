import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanReminder, validateClarification, validatePlanCheck, validateTerms } from "../src/lib/plan-check.ts";

const terms = { instructions: "Data delete mat karna.", spendingLimit: "600", approval: "Ask before any paid work" };
const plan = "Replace board for ₹950 and reset the phone.";
const raw = { concerns: [{ message: "Reset may affect customer data.", customerQuote: terms.instructions, planQuote: "reset the phone" }],
  estimate: "950", estimateEvidence: "₹950", question: "May we replace the board for ₹950?" };
test("price comparison is deterministic and revalidation does not duplicate the price concern", () => {
  const checked = validatePlanCheck(raw, terms, plan);
  assert.equal(checked.concerns.length, 2);
  assert.deepEqual(validatePlanCheck(checked, terms, plan), checked);
});
test("equal and lower estimates do not trigger an exceeded-limit finding", () => {
  for (const price of ["600", "599.99"]) {
    const checked = validatePlanCheck({ ...raw, concerns: [], estimate: price, estimateEvidence: price }, terms, "Total " + price);
    assert.equal(checked.concerns.length, 0);
  }
});
test("unsupported quotes fail the entire check", () => {
  assert.throws(() => validatePlanCheck({ ...raw, concerns: [{ ...raw.concerns[0], customerQuote: "invented" }] }, terms, plan));
  assert.throws(() => validatePlanCheck({ ...raw, estimateEvidence: "1200" }, terms, plan));
});
test("malformed terms and price ranges require clarification", () => {
  assert.throws(() => validateTerms({ ...terms, spendingLimit: "-1" }));
  assert.throws(() => validatePlanCheck({ ...raw, estimate: "500-900" }, terms, plan));
  const unknown = validatePlanCheck({ ...raw, concerns: [], estimate: "", estimateEvidence: "" }, terms, plan);
  assert.equal(unknown.estimate, "");
});
test("compatible plans receive a neutral spoken reminder and conflicts receive a stop reminder", () => {
  const compatible = { concerns: [], estimate: "", estimateEvidence: "", question: "Can we do a free visual inspection?" };
  assert.ok(!buildPlanReminder(compatible).startsWith("Rukiye"));
  assert.ok(buildPlanReminder({ ...compatible, concerns: raw.concerns }).startsWith("Rukiye"));
});
test("clarifications require the original question and stay bounded", () => {
  assert.deepEqual(validateClarification("", undefined), { answer: "", question: "" });
  assert.deepEqual(validateClarification("Board theek, reset mat karna.", "May we replace the board and reset?"), {
    answer: "Board theek, reset mat karna.", question: "May we replace the board and reset?",
  });
  assert.throws(() => validateClarification("Haan", ""));
  assert.throws(() => validateClarification("Haan", "q".repeat(501)));
});
test("spoken reminders remove expressive markup and reject excessive text", () => {
  assert.ok(!buildPlanReminder({ ...raw, question: "<laugh> Question?" }).includes("<"));
  assert.throws(() => buildPlanReminder({ ...raw, concerns: Array(12).fill({ ...raw.concerns[0], message: "x".repeat(700) }) }));
});
