export type PlanTerms = { instructions: string; spendingLimit: string; approval: string };
export type Concern = { message: string; customerQuote: string; planQuote: string };
export type PlanCheck = { concerns: Concern[]; question: string; estimate: string; estimateEvidence: string };

export function validateClarification(answer: unknown, question: unknown): { answer: string; question: string } {
  if (typeof answer !== "string" || answer.length > 2000 ||
      (question !== undefined && (typeof question !== "string" || question.length > 500))) {
    throw new Error("Use a clarification answer up to 2,000 characters and its original question up to 500 characters.");
  }
  if (!answer.trim()) return { answer: "", question: "" };
  if (typeof question !== "string" || !question.trim()) throw new Error("Select the customer clarification question before checking the answer.");
  return { answer: answer.trim(), question: question.trim() };
}

export function buildPlanReminder(check: PlanCheck): string {
  const opening = check.concerns.length
    ? "Rukiye. Repair shuru karne se pehle customer ki instructions aur permission check karein. "
    : "Is check mein customer ki instructions ke saath koi conflict nahi mila. Paid work se pehle customer ki permission confirm karein. ";
  const text = (opening + check.concerns.map(item => item.message).join(" ") + " Customer se poochhein. " + check.question).replace(/[<>]/g, " ");
  if (text.length > 6000) throw new Error("These findings are too long for one spoken reminder. Review them on screen.");
  return text;
}

export const planSchema = {
  type: "object",
  properties: {
    estimate: { type: "string", description: "Explicit final total price in rupees, decimal digits only. Empty if missing, conditional, a range, or unresolved." },
    estimateEvidence: { type: "string", description: "Exact plan quote supporting the final total." },
    concerns: { type: "array", items: { type: "object", properties: {
      message: { type: "string" }, customerQuote: { type: "string" }, planQuote: { type: "string" },
    }, required: ["message", "customerQuote", "planQuote"], additionalProperties: false } },
    question: { type: "string", description: "One concise clarification question for the customer. Never assume approval." },
  },
  required: ["estimate", "estimateEvidence", "concerns", "question"],
  additionalProperties: false,
};

export function validateTerms(value: unknown): PlanTerms {
  if (!value || typeof value !== "object") throw new Error("Customer terms are required.");
  const terms = value as PlanTerms;
  if (typeof terms.instructions !== "string" || terms.instructions.length > 2000 ||
      typeof terms.spendingLimit !== "string" || terms.spendingLimit.length > 20 ||
      (terms.spendingLimit !== "" && (!/^\d+(\.\d{1,2})?$/.test(terms.spendingLimit) || Number(terms.spendingLimit) <= 0)) ||
      !["Ask before any paid work", "Not recorded"].includes(terms.approval)) throw new Error("Customer terms are invalid.");
  return { instructions: terms.instructions, spendingLimit: terms.spendingLimit, approval: terms.approval };
}

export function validatePlanCheck(value: unknown, terms: PlanTerms, plan: string): PlanCheck {
  if (!value || typeof value !== "object") throw new Error("Incomplete plan check.");
  const result = value as PlanCheck;
  if (!Array.isArray(result.concerns) || result.concerns.length > 12 ||
      typeof result.question !== "string" || !result.question.trim() || result.question.length > 500 ||
      typeof result.estimate !== "string" || typeof result.estimateEvidence !== "string") throw new Error("Incomplete plan check.");
  const source = terms.instructions + "\n" + terms.approval;
  const priceConcern = result.estimate && terms.spendingLimit && Number(result.estimate) > Number(terms.spendingLimit) ? {
    message: "The proposed ₹" + result.estimate + " total exceeds the recorded ₹" + terms.spendingLimit + " limit.",
    customerQuote: "Recorded spending limit: ₹" + terms.spendingLimit,
    planQuote: result.estimateEvidence,
  } : null;
  const concerns = result.concerns.filter(item => !priceConcern || item?.message !== priceConcern.message ||
    item.customerQuote !== priceConcern.customerQuote || item.planQuote !== priceConcern.planQuote).map(item => {
    if (!item || typeof item.message !== "string" || !item.message.trim() || item.message.length > 700 ||
        typeof item.customerQuote !== "string" || !item.customerQuote.trim() || !source.includes(item.customerQuote) ||
        typeof item.planQuote !== "string" || !item.planQuote.trim() || !plan.includes(item.planQuote)) {
      throw new Error("A finding could not be linked to the recorded words. Please check again.");
    }
    return { message: item.message, customerQuote: item.customerQuote, planQuote: item.planQuote };
  });
  if (result.estimate && (!/^\d{1,9}(\.\d{1,2})?$/.test(result.estimate) ||
      !result.estimateEvidence.trim() || !plan.includes(result.estimateEvidence))) throw new Error("The estimate needs review. Please clarify the total price.");
  if (priceConcern) concerns.unshift(priceConcern);
  return { concerns, question: result.question, estimate: result.estimate, estimateEvidence: result.estimateEvidence };
}
