import type { Intake } from "./jobs";

export const extractionKeys = ["customerName", "contact", "device", "issue", "condition", "accessories", "instructions", "spendingLimit", "approval", "promisedDate"] as const satisfies readonly (keyof Intake)[];
export type SuggestedField = { value: string; evidence: string };
export type Extraction = { fields: Record<keyof Intake, SuggestedField>; instructionClauses: string[]; clarifications: string[]; warnings: string[] };

const fieldDescription: Record<keyof Intake, string> = {
  customerName: "Customer name only when stated. Preserve the transcript's script and spelling, e.g. श्याम stays श्याम. Copy evidence directly in the original script; never translate or transliterate the quote. Do not confuse the technician name with the customer.",
  contact: "Customer contact exactly as supplied, never invent digits.",
  device: "Device brand/model only as stated.",
  issue: "Customer-reported symptoms, not diagnosis or a proposed fix.",
  condition: "Condition explicitly observed/stated. Do not infer damage from a symptom.",
  accessories: "Included and explicitly excluded accessories. Preserve negation.",
  instructions: "Leave value and evidence empty. The server builds this field from instructionClauses, without summarisation.",
  spendingLimit: "Explicit unambiguous spending threshold as a positive rupee amount string with optional 2 decimal places. No currency symbol or commas. Not repair authorisation.",
  approval: "Ask before any paid work ONLY if explicit approval before ALL paid work was requested. A call only above a threshold does not qualify. Otherwise Not recorded.",
  promisedDate: "An explicitly agreed complete calendar date as YYYY-MM-DD. Relative dates, uncertain dates, and dates with no year stay empty.",
};

export const extractionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    fields: {
      type: "object", additionalProperties: false,
      properties: Object.fromEntries(extractionKeys.map(key => [key, {
        type: "object", additionalProperties: false, description: fieldDescription[key],
        properties: { value: { type: "string", description: "Empty string when not stated, except approval defaults to Not recorded." }, evidence: { type: "string", description: "Exact contiguous excerpt copied from transcript supporting this value. Empty for missing information." } },
        required: ["value", "evidence"],
      }])),
      required: [...extractionKeys],
    },
    instructionClauses: { type: "array", items: { type: "string" }, description: "Copy EVERY customer instruction as a verbatim transcript clause, including data preservation, exclusions, spending conditions, call-before-work requests, replacement permissions, timing requests and corrections. Keep each condition with its action and amount. Do not summarise or translate. A spendingLimit field does not replace the call-above-threshold instruction. Preserve original order. Empty array when none are stated." },
    clarifications: { type: "array", items: { type: "string" }, description: "Up to five brief questions about missing required information or ambiguities. Do not invent answers." },
  },
  required: ["fields", "instructionClauses", "clarifications"],
};

const normalise = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim();

export class InstructionCompletenessError extends Error {}

function explicitHindiCustomerName(transcript: string): SuggestedField | null {
  const source = normalise(transcript);
  // Recover only a single, initial, explicit self-introduction. Keep its script;
  // never accept a translated model quote as evidence or guess a transliteration.
  if ((source.match(/मेरा\s+नाम/gu) || []).length !== 1 ||
      /technician|टेक्नीशियन|तकनीशियन|ग्राहक\s*(?:का\s*)?नाम|customer\s*(?:['’]s\s*)?name/iu.test(source)) return null;
  const match = /^(मेरा\s+नाम\s+([\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+){0,3})\s+है[।.!?])(?=\s|$)/u.exec(source);
  if (!match || match[2].split(/\s+/u).some(word => /^(?:नहीं|नही|न|मत|not|nahi)$/iu.test(word)) || match[2].length > 160) return null;
  return { value: match[2], evidence: match[1] };
}

function preserveInstructions(transcript: string, clauses: unknown, warnings: string[]) {
  if (!Array.isArray(clauses) || clauses.length > 1000 || clauses.some(quote => typeof quote !== "string")) throw new Error("Invalid instruction clauses.");
  const secret = /\b(?:password|passcode|pin|unlock\s+code)\b\s*(?:(?:is|hai|:|=)\s*\S+|["']?(?=[\p{L}\p{N}]*\p{N})[\p{L}\p{N}]{3,})|(?:पासवर्ड|पिन|अनलॉक\s*कोड)\s*(?:है|:|=)?\s*\p{N}{3,}/iu;
  if (secret.test(transcript)) throw new InstructionCompletenessError("Remove device passwords, PINs or unlock codes from the transcript before generating a draft. No instructions were applied.");
  const source = normalise(transcript);
  // High-recall fallback for common English, Roman Hindi and Devanagari directives.
  // This is not a semantic completeness guarantee; the full transcript remains reviewable.
  const directive = /\b(?:don't|do not|never|please|must|before|permission|approval|call|notify|inform|preserve|without|keep|mat|pehle|pahle|ijazat|ijaazat|bina|batana|pooch|puch|rakhna|bachana|chahiye)\b|मत\s|पहले|अनुमति|इजाज़त|बिना|कॉल\s*कर|फोन\s*कर/u;
  const segments = transcript.split(/(?<=[.!?;])(?=\s|$)|(?<=।)|\n+/u).map(normalise).filter(Boolean);
  const fallback = segments.filter(segment => directive.test(segment.toLowerCase()));
  const spans = new Map<string, { start: number; end: number; quote: string }>();
  for (const raw of [...clauses, ...fallback]) {
    const quote = normalise(raw);
    if (!quote) continue;
    let start = source.indexOf(quote);
    if (start < 0) { warnings.push("An instruction quote not found in the transcript was discarded."); continue; }
    // Distinct source occurrences matter: a repeated instruction can reverse a correction.
    while (start >= 0) {
      const end = start + quote.length;
      spans.set(`${start}:${end}`, { start, end, quote: source.slice(start, end) });
      start = source.indexOf(quote, end);
    }
  }
  const all = [...spans.values()].sort((a, b) => a.start - b.start || b.end - a.end);
  // Keep the complete sentence when the model supplied only a smaller fragment.
  let widestEnd = -1;
  const ordered = all.filter(span => { if (span.end <= widestEnd) return false; widestEnd = span.end; return true; });
  const instructionClauses = ordered.map(span => span.quote);
  const text = instructionClauses.join("\n");
  if (text.length > 2000) throw new InstructionCompletenessError("Customer instructions are too long for one job card. Split the intake or enter and review the instructions manually; no instructions were truncated.");
  const evidence = ordered.length ? source.slice(ordered[0].start, ordered[ordered.length - 1].end) : "";
  return { instructionClauses, field: { value: text, evidence } };
}

export function validateExtraction(value: unknown, transcript: string): Extraction {
  if (!value || typeof value !== "object") throw new Error("Invalid extraction response.");
  const root = value as Record<string, unknown>;
  if (!root.fields || typeof root.fields !== "object" || !Array.isArray(root.clarifications)) throw new Error("Invalid extraction structure.");
  const fields = {} as Extraction["fields"];
  const warnings: string[] = [];
  for (const key of extractionKeys) {
    const raw = (root.fields as Record<string, unknown>)[key];
    if (!raw || typeof raw !== "object" || !("value" in raw) || !("evidence" in raw) || typeof raw.value !== "string" || typeof raw.evidence !== "string") throw new Error("Extraction returned an invalid field.");
    if (key === "instructions") { fields[key] = { value: "", evidence: "" }; continue; }
    let suggestion = raw.value.trim();
    let evidence = raw.evidence.trim();
    const limit = ["issue", "condition", "instructions"].includes(key) ? 2000 : 160;
    let invalid = suggestion.length > limit || evidence.length > 3000;
    if (suggestion && !(key === "approval" && suggestion === "Not recorded")) invalid ||= !evidence || !normalise(transcript).includes(normalise(evidence));
    if (key === "spendingLimit" && suggestion) invalid ||= !/^\d+(\.\d{1,2})?$/.test(suggestion) || !Number.isFinite(Number(suggestion)) || Number(suggestion) <= 0;
    if (key === "approval") invalid ||= !["Ask before any paid work", "Not recorded", ""].includes(suggestion);
    if (key === "promisedDate" && suggestion) invalid ||= !/^\d{4}-\d{2}-\d{2}$/.test(suggestion) || Number.isNaN(Date.parse(suggestion)) || new Date(suggestion).toISOString().slice(0, 10) !== suggestion;
    if (invalid && key === "customerName" && suggestion && suggestion.length <= limit && evidence.length <= 3000) {
      const recovered = explicitHindiCustomerName(transcript);
      if (recovered) {
        suggestion = recovered.value; evidence = recovered.evidence; invalid = false;
        warnings.push("Customer name recovered from the exact Hindi self-introduction. Review its spelling before applying.");
      }
    }
    if (invalid) { warnings.push(`${key}: suggestion discarded because its format or supporting excerpt could not be verified.`); suggestion = ""; evidence = ""; }
    if (!suggestion || (key === "approval" && suggestion === "Not recorded")) evidence = "";
    fields[key] = { value: suggestion || (key === "approval" ? "Not recorded" : ""), evidence };
  }
  if (root.clarifications.some(question => typeof question !== "string" || question.length > 500)) throw new Error("Invalid clarification questions.");
  const clarifications = (root.clarifications as string[]).map(question => question.trim()).filter(Boolean).slice(0, 5);
  const preserved = preserveInstructions(transcript, root.instructionClauses, warnings);
  fields.instructions = preserved.field;
  return { fields, instructionClauses: preserved.instructionClauses, clarifications, warnings };
}
