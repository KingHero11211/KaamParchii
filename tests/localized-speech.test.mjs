import test from "node:test";
import assert from "node:assert/strict";
import { localizedReadback, spokenText, moneyWords } from "../src/lib/localized-speech.ts";
const intake={customerName:"శ్యామ్",contact:"09870",device:"వాషింగ్ మెషిన్",issue:"నీరు బయటకు రావడం లేదు",condition:"",accessories:"",instructions:"అనుమతి లేకుండా పంప్ మార్చవద్దు.",spendingLimit:"600.50",approval:"Ask before any paid work",promisedDate:"2026-11-10"};
test("Telugu readback preserves instructions, formats money and reads leading-zero contact digits",()=>{
  const text=localizedReadback(intake,"te-IN");
  assert.ok(text.includes(intake.instructions));
  assert.match(text,/ఆరు వందలు రూపాయలు యాభై పైసలు/);
  assert.match(text,/సున్నా తొమ్మిది ఎనిమిది ఏడు సున్నా/);
  assert.ok(!text.includes("600.50"));
  assert.ok(!text.includes("फ़ोन"));
});
test("English and Telugu preserve IDs, comma lists, negations and strip expressive tags",()=>{
  assert.match(spokenText("A013, 1,2,3 <laugh>","te-IN"),/A సున్నా ఒకటి మూడు/);
  assert.ok(!spokenText("<laugh> 600", "en-IN").includes("<"));
  assert.equal(moneyWords("900","en-IN"),"nine hundred rupees");
  assert.throws(()=>moneyWords("900 or 600","te-IN"));
});
