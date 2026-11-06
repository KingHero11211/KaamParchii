import assert from "node:assert/strict";
import test from "node:test";
import { extractionKeys, validateExtraction } from "../src/lib/extraction.ts";

function draft(value = "Shyam", evidence = "Mera naam Shyam hai") {
  const fields = Object.fromEntries(extractionKeys.map(key => [key, { value: "", evidence: "" }]));
  fields.customerName = { value, evidence };
  return { fields, instructionClauses: [], clarifications: [] };
}

test("recovers the exact Hindi self-introduction when model evidence is transliterated", () => {
  const result = validateExtraction(draft(), "मेरा नाम श्याम है। मेरा फोन चार्ज नहीं हो रहा।");
  assert.deepEqual(result.fields.customerName, { value: "श्याम", evidence: "मेरा नाम श्याम है।" });
  assert.ok(result.warnings.some(warning => warning.includes("self-introduction")));
});

test("keeps a verified name suggestion unchanged", () => {
  const result = validateExtraction(draft("Shyam", "मेरा नाम श्याम है"), "मेरा नाम श्याम है।");
  assert.equal(result.fields.customerName.value, "Shyam");
});

test("does not infer a name from mentions, negation, technician identity or conflicting introductions", () => {
  for (const transcript of [
    "श्याम का फोन है।", "मेरा नाम श्याम नहीं है।", "मेरा नाम श्याम है। मैं technician हूँ।",
    "मेरा नाम श्याम है। नहीं, मेरा नाम राम है।", "मेरा नाम श्याम है। ग्राहक का नाम राम है।",
  ]) assert.equal(validateExtraction(draft(), transcript).fields.customerName.value, "", transcript);
});

test("other fields still reject translated or fabricated supporting quotes", () => {
  const raw = draft(); raw.fields.device = { value: "Oppo A13", evidence: "My Oppo A13" };
  const result = validateExtraction(raw, "मेरा नाम श्याम है। मैं Oppo A13 देने आया हूँ।");
  assert.equal(result.fields.device.value, "");
});
