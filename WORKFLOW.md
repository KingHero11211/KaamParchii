# Repair Handover — build specification

## First release
A mobile-friendly, single-shop application for phone repair intake. Start with an editable manual workflow, then connect Hindi/Hinglish speech. The working title is temporary.

## Workflow
1. Jobs: search saved jobs or start an intake.
2. Intake: enter customer/device information and reported concerns. Later, record with consent or upload audio.
3. Review: inspect extracted fields and supporting transcript passages. Missing information stays missing; ambiguity requires clarification.
4. Confirm: review customer instructions, accessories, condition, spending limit and approval requirements. Confirmation acknowledges the intake record, not approval for unspecified repairs.
5. Job: save an immutable confirmed intake snapshot; show technician findings separately. Print the customer receipt and track received / in progress / ready / collected.

## Information boundaries
- Reported issue is not a diagnosis.
- A spending limit is not repair authorisation.
- Unspecified accessories or damage are not assumed absent.
- Unagreed completion dates remain empty.
- Never collect device unlock codes or account passwords.
- Audio recording will require explicit consent. Audio retention defaults will be decided before integration.
- A receipt is an intake record, not a claim of legal enforceability.

## Architecture
Next.js App Router + TypeScript. Accessible responsive CSS without an extra UI framework. Server-side API credentials. Start with a browser-local manual prototype containing no real customer records; move storage to a server database before real shop use. No misleading AI or persistence claims in the UI.

## Screens
- / : jobs, search, status filters, empty state.
- /intake : entry and review/confirmation steps.
- /jobs/[id] : confirmed intake, separate technician notes, status, printable receipt.

## File-by-file order
Each file is created and checked before the next. Later dependency changes may require revisiting a completed file.
1. WORKFLOW.md — scope and decisions (this file).
2. package.json — dependencies and verification commands.
3. tsconfig.json — compiler configuration.
4. .gitignore — protect local state and secrets.
5. next-env.d.ts — framework type references.
6. src/lib/jobs.ts — data model, validation, browser-local storage and reference numbers.
7. src/app/layout.tsx — application shell and metadata.
8. src/app/globals.css — responsive visual system and print styles.
9. src/app/page.tsx — job list and local-prototype disclosure.
10. src/app/intake/page.tsx — manual intake, review, confirmation and save.
11. src/app/jobs/[id]/page.tsx — job view, status, technician notes, print.
12. README.md — run instructions, implemented scope, limitations and next steps.

## Verification
Check each configuration/file when created. Use TypeScript and production build as the assembled app becomes complete. Check critical confirmation and record consistency. Browser visual verification follows when a preview is available. User trials remain a later phase.

## Next milestones
Server database and shop access; current Gnani API documentation and credentials; Prisma recording/upload; model-backed extraction with transcript evidence; clarification and Timbre read-back; deployment and demo.

## Inputs needed later
Gnani API documentation/access configuration (secret entered locally, never in chat); choice of extraction-model provider; shop identity for receipts; hosting and customer-data retention before real deployment.
