# Manual Repair Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish a locally runnable manual intake-to-confirmed-job-card prototype before integrating speech.

**Architecture:** Next.js client screens use the existing typed job model and browser-local persistence. Confirmed intake remains unchanged when technician notes and status change. Server storage and Gnani speech are later milestones, not claims of this prototype.

**Tech Stack:** Next.js, React, TypeScript, CSS, browser storage.

**Spec:** WORKFLOW.md (workflow previously presented in chat; user instructed continuation).

## Global Constraints
- Implement one file, verify it, then proceed to the next; do not batch product-file writes.
- Start with an editable manual workflow, then connect Hindi/Hinglish speech.
- Reported issue is not a diagnosis.
- A spending limit is not repair authorisation.
- Never collect device unlock codes or account passwords.
- Use fictional data until server storage and access control are implemented.
- Preserve existing files; no Git repository has been initialized, so no commit/worktree steps apply yet.

## Review Focus
- Storage unavailable: report failure without pretending the job was saved.
- Duplicate confirmation: prevent a second save while submitting.
- Missing optional fields: display Not recorded, without inferring absence.
- Unsupported saved records: preserve existing data and report an error.
- Technician changes: preserve the confirmed intake snapshot.

## Execution checklist
- [x] Inspect existing workflow and files; preserve the chosen architecture.
- [ ] Restore framework dependency installation with approved network access; add TypeScript/type dependencies; run typecheck on existing files before continuing.
- [ ] Create src/app/intake/page.tsx. Consume Intake, emptyIntake, intakeLabels, validateIntake and createJob from src/lib/jobs.ts. Provide entry and review steps; block invalid required fields; require explicit acknowledgement; guard double submission; show storage errors without navigation. On successful save, navigate to /jobs/{id}. Run npm run typecheck before the next file.
- [ ] Create src/app/jobs/[id]/page.tsx. Resolve the route id; readJobs(): Job[]; show loading, storage failure and missing-job states separately. Display the confirmed intake and a clear non-authorisation statement. Consume updateJob(id, {status, technicianNotes}): Job to save technician fields separately. Offer browser printing. Run npm run typecheck before the next file.
- [ ] Verify record behavior with Node's built-in assertions and a temporary in-memory localStorage: required fields; invalid amount; create/read/update; intake unchanged after technician edit; corrupt saved data not overwritten; failed storage write reports failure.
- [ ] Create README.md with local run instructions and accurate implementation limits; verify documented routes and commands against files.
- [ ] Run npm run build. Browser QA only after reading the Sites local preview reference. Report any unverified behavior without claiming completion.

## Next milestone, outside this plan
Current Gnani API docs and locally supplied API secret; Prisma recording/upload; extraction model selection; transcript evidence and clarification; Timbre read-back; server storage/access controls before deployment.

## Self-review
The plan covers the remaining manual workflow, preserves existing jobs.ts interfaces, and includes failure handling. Broader user trials remain deferred per user instruction. Framework verification is blocked until dependency download is approved.
