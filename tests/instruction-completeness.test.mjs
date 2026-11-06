import assert from "node:assert/strict";
import test from "node:test";
import { extractionKeys, validateExtraction } from "../src/lib/extraction.ts";

function output(quotes = []) {
  const fields = Object.fromEntries(extractionKeys.map(key => [key, { value: "", evidence: "" }]));
  fields.instructions = { value: "Do not delete data", evidence: "Data delete mat karna." };
  return { fields, instructionClauses: quotes, clarifications: [] };
}

test("retains threshold and permission clauses omitted from the model summary", () => {
  const transcript = "Data delete mat karna. 800 rupaye se zyada kharcha ho toh pehle call karna. Koi part badalne se pehle meri permission lena.";
  const result = validateExtraction(output(["Data delete mat karna."]), transcript);
  assert.match(result.fields.instructions.value, /800 rupaye se zyada kharcha ho toh pehle call karna/);
  assert.match(result.fields.instructions.value, /Koi part badalne se pehle meri permission lena/);
  assert.match(result.fields.instructions.value, /Data delete mat karna/);
});

test("keeps original order, drops duplicate or invented quotes", () => {
  const transcript = "Do not erase data. Call before spending more than 800 rupees.";
  const result = validateExtraction(output(["Call before spending more than 800 rupees.", "Do not erase data.", "Do not erase data.", "Replace the battery."]), transcript);
  assert.equal(result.fields.instructions.value, transcript.replace(". Call", ".\nCall"));
  assert.equal(result.fields.instructions.evidence, transcript);
  assert.ok(!result.fields.instructions.value.includes("Replace the battery"));
});

test("preserves Devanagari conditions", () => {
  const transcript = "डेटा डिलीट मत करना। आठ सौ से ज़्यादा खर्च हो तो पहले कॉल करना।";
  const result = validateExtraction(output([]), transcript);
  assert.ok(result.fields.instructions.value.includes("पहले कॉल करना"));
});

test("a symptom or excluded accessory is not automatically a customer instruction", () => {
  const transcript = "Charging kabhi hoti hai kabhi nahi. Adapter nahi hai.";
  const result = validateExtraction(output([]), transcript);
  assert.equal(result.fields.instructions.value, "");
});

test("does not silently truncate a long list of instructions", () => {
  const transcript = Array.from({ length: 60 }, (_, i) => `Please call me before doing repair number ${i}.`).join(" ");
  assert.throws(() => validateExtraction(output([]), transcript), /instructions.*long/i);
});

test("preserves a repeated instruction after a correction", () => {
  const transcript = "Please replace the battery. Actually do not replace the battery. Please replace the battery.";
  const result = validateExtraction(output([]), transcript);
  assert.equal(result.instructionClauses.length, 3);
  assert.equal(result.fields.instructions.evidence, transcript);
  assert.equal(result.fields.instructions.value.split("\n").at(-1), "Please replace the battery.");
});

test("does not copy an unlock PIN into the job card", () => {
  assert.throws(() => validateExtraction(output([]), "Please unlock with PIN 1234 before testing."), /password|PIN|unlock/i);
});

test("a long but valid instruction list survives server/client revalidation", () => {
  const transcript = Array.from({ length: 101 }, (_, i) => `Call ${i}.`).join(" ");
  const first = validateExtraction(output([]), transcript);
  const second = validateExtraction(first, transcript);
  assert.equal(first.instructionClauses.length, 101);
  assert.deepEqual(second.fields.instructions, first.fields.instructions);
});
