import { validateServiceContext, type ServiceContext } from "./service-context.ts";

export const statuses = ["Received", "In progress", "Ready", "Collected"] as const;
export type JobStatus = (typeof statuses)[number];
export type Intake = {
  customerName: string;
  contact: string;
  device: string;
  issue: string;
  condition: string;
  accessories: string;
  instructions: string;
  spendingLimit: string;
  approval: "Ask before any paid work" | "Not recorded";
  promisedDate: string;
};
export type Job = {
  id: string;
  reference: string;
  createdAt: string;
  intake: Intake;
  status: JobStatus;
  technicianNotes: string;
  service?: ServiceContext;
};
export const emptyIntake: Intake = {
  customerName: "", contact: "", device: "", issue: "", condition: "",
  accessories: "", instructions: "", spendingLimit: "", approval: "Not recorded", promisedDate: "",
};
const storageKey = "repair-handover.jobs.v1";

export function validateIntake(intake: Intake): string[] {
  const errors: string[] = [];
  if (!intake.customerName.trim()) errors.push("Enter the customer’s name.");
  if (!intake.device.trim()) errors.push("Describe the item, asset or work location.");
  if (!intake.issue.trim()) errors.push("Describe the customer-reported problem.");
  if (intake.spendingLimit.trim() && (!/^\d+(\.\d{1,2})?$/.test(intake.spendingLimit) || Number(intake.spendingLimit) <= 0)) {
    errors.push("Enter a spending limit greater than zero, with up to two decimal places, or leave it blank.");
  }
  return errors;
}

function isJob(value: unknown): value is Job {
  if (!value || typeof value !== "object") return false;
  const j = value as Job;
  try { if (j.service !== undefined) validateServiceContext(j.service); } catch { return false; }
  return typeof j.id === "string" && typeof j.reference === "string" &&
    typeof j.createdAt === "string" && !Number.isNaN(Date.parse(j.createdAt)) &&
    statuses.includes(j.status) && typeof j.technicianNotes === "string" &&
    !!j.intake && Object.keys(emptyIntake).every(k => typeof j.intake[k as keyof Intake] === "string") &&
    ["Ask before any paid work", "Not recorded"].includes(j.intake.approval) && validateIntake(j.intake).length === 0;
}

export function readJobs(): Job[] {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Saved records could not be read. Existing data has not been changed."); }
  if (!Array.isArray(parsed) || !parsed.every(isJob)) throw new Error("Saved records have an unsupported format. Existing data has not been changed.");
  return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeJobs(jobs: Job[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(jobs)); }
  catch { throw new Error("Could not save in this browser. Storage may be full or unavailable. Keep this page open and try again."); }
}

export function createJob(intake: Intake, service?: ServiceContext): Job {
  const cleaned = Object.fromEntries(Object.entries(intake).map(([k, v]) => [k, v.trim()])) as Intake;
  const errors = validateIntake(cleaned);
  if (errors.length) throw new Error(errors.join(" "));
  const id = crypto.randomUUID();
  const job: Job = {
    id, reference: `RH-${id.slice(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(), intake: cleaned, status: "Received", technicianNotes: "",
    service: validateServiceContext(service),
  };
  const jobs = readJobs();
  writeJobs([job, ...jobs]);
  return job;
}

export function updateJob(id: string, changes: Pick<Job, "status" | "technicianNotes">): Job {
  if (!statuses.includes(changes.status)) throw new Error("Choose a valid job status.");
  const jobs = readJobs();
  const index = jobs.findIndex(job => job.id === id);
  if (index === -1) throw new Error("This job could not be found.");
  // Confirmed intake is preserved; technician observations stay separate.
  const updated = { ...jobs[index], status: changes.status, technicianNotes: changes.technicianNotes };
  jobs[index] = updated;
  writeJobs(jobs);
  return updated;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export const intakeLabels: Record<keyof Intake, string> = {
  customerName: "Customer", contact: "Contact", device: "Item / asset", issue: "Customer-reported problem",
  condition: "Condition recorded at intake", accessories: "Accessories received", instructions: "Customer instructions",
  spendingLimit: "Spending limit (not repair approval)", approval: "Approval requirement", promisedDate: "Agreed completion date",
};
