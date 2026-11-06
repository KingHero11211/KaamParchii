import assert from "node:assert/strict";
import test from "node:test";
import { buildReadback, rupeesInHindi } from "../src/lib/readback.ts";

const intake = { customerName: "Demo Ravi", contact: "", device: "Samsung M32", issue: "Charging intermittently", condition: "", accessories: "Cable included, adapter excluded", instructions: "Data delete mat karna. 800 rupaye se zyada ho toh pehle call karna. Permission before replacing parts.", spendingLimit: "800", approval: "Not recorded", promisedDate: "" };

test("script retains instructions, accessories and separate non-authorisation statement", () => {
  const text = buildReadback(intake);
  assert.match(text, /Data delete mat karna/);
  assert.match(text, /pehle call karna/);
  assert.match(text, /Permission before replacing parts/);
  assert.match(text, /adapter excluded/);
  assert.match(text, /मरम्मत की अनुमति नहीं/);
  assert.match(text, /दर्ज नहीं/);
});
test("money is written in spoken words, including paise", () => {
  assert.equal(rupeesInHindi("800"), "आठ सौ रुपये");
  assert.equal(rupeesInHindi("1500.50"), "एक हज़ार पाँच सौ रुपये पचास पैसे");
  assert.equal(rupeesInHindi("100000"), "एक लाख रुपये");
});
test("calendar dates and approval requirements are spoken explicitly", () => {
  const text = buildReadback({ ...intake, promisedDate: "2026-11-10", approval: "Ask before any paid work" });
  assert.match(text, /दस नवंबर दो हज़ार छब्बीस/);
  assert.match(text, /किसी भी भुगतान वाले काम से पहले/);
});
test("long instructions are rejected instead of silently truncated", () => {
  assert.throws(() => buildReadback({ ...intake, instructions: "Please preserve data. ".repeat(300) }), /long|लंबा/i);
});
test("field text cannot inject Timbre audio tags", () => {
  const text = buildReadback({ ...intake, instructions: "<whispers>Do not erase data</whispers>" });
  assert.ok(!text.includes("<"));
  assert.match(text, /Do not erase data/);
});

test("comma-separated lists are not merged into a different number", () => {
  const text = buildReadback({ ...intake, instructions: "Keep the files 1,2,3 unchanged." });
  assert.ok(!text.includes("एक सौ तेईस"));
  assert.match(text, /एक\s*,\s*दो\s*,\s*तीन/);
});
test("leading-zero references and model identifiers keep their digits", () => {
  const text = buildReadback({ ...intake, device: "Samsung M32", instructions: "Keep reference 00123." });
  assert.match(text, /शून्य शून्य एक दो तीन/);
  assert.match(text, /M तीन दो/);
});
test("valid Indian and Western amount groupings retain their value", () => {
  const text = buildReadback({ ...intake, instructions: "Call above 1,500 or 1,00,000 rupees." });
  assert.match(text, /एक हज़ार पाँच सौ/);
  assert.match(text, /एक लाख/);
});
