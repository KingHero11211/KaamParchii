# Transcript Extraction Implementation Plan

> Execute in this session, one file at a time; preserve the established manual confirmation workflow.

**Goal:** Use server-side Gemini structured output to suggest intake fields from a transcript, with exact supporting excerpts and clarification prompts.

**Design:** Send only the explicitly selected transcript to Gemini. Treat it as untrusted source data. Return all existing Intake fields as value/evidence pairs, empty when unsupported. Validate schema, lengths, evidence presence, amount/date formats and approval enum before showing suggestions. A field without a matching excerpt is discarded. Evidence demonstrates where a suggestion came from, not its semantic correctness. User reviews suggestions and explicitly applies selected fields; no asynchronous overwrites or automatic job confirmation. New transcript invalidates suggestions. Keep prior manual values unless selected for replacement. Do not send existing customer form fields to the model.

## File sequence
- [x] src/lib/extraction.ts: schema, types and runtime evidence validation; typecheck and focused assertions passed.
- [x] src/app/api/extract/route.ts: request size/origin/consent guards, key/model config, Gemini REST generation, errors and timeout; typecheck passed.
- [x] src/components/extraction-panel.tsx: explicit Gemini consent, request, evidence review, selected-field application and stale-result protection; typecheck passed.
- [x] src/components/voice-intake.tsx: optional disabled prop and activity callback; typecheck passed.
- [x] src/app/intake/page.tsx: panel connected; mutual voice/extraction busy guards and confirmation reset; typecheck passed.
- [x] .env.example: blank GEMINI_API_KEY and configurable GEMINI_MODEL; inspected without reading real secret values.
- [x] README.md: workflow/setup/verification limits updated; final production build passed.

## Verification
Use synthetic transcripts only. Verify validation and failure cases without secrets in output. Exercise one live extraction if configured, displaying only response status and synthetic output. Verify UI draft review and preservation of manual fields. Production build and focused regression checks; broad user trials remain deferred.

## Defaults
Current documented default: gemini-3.8-flash, configurable via GEMINI_MODEL. No retry or model fallback that spends credits automatically. Unspecified dates stay empty; no inference from relative dates. Keep transcript/evidence in the current draft, not saved to receipts in this milestone. Timbre remains next.

## Verification ledger
- Gemini key existence checked without printing it. Model metadata returned HTTP 200 for gemini-3.8-flash and advertised generateContent support.
- Synthetic live generation checks: first timed out; later requests returned upstream HTTP 503. A lighter gemini-3.5-flash-lite diagnostic call also returned 503. No successful generation has been observed. User confirmed preference for available 3.8 Flash; restored/retained it as default.
- Used the current documented REST responseFormat.text schema with low thinking effort for Gemini 3.x. No automatic retries/fallbacks are implemented.
- Independent review found a voice/extraction overlap race. Added voice activity reporting to parent and disabled extraction while speech work is active. TypeScript passed after each file. A broad async regression suite remains deferred under user instructions.
- Browser verified the new panel and initial disabled states render. Actual suggestion display, application and customer-confirmation after live extraction remain unverified because the provider returned no successful generation.
- Final production build passed, including /api/extract and /api/transcribe.
- Ruling: keep current non-Git workspace and focused checks, preserving user-selected execution method. No claim of successful end-to-end extraction until a live generation succeeds.

## Follow-up: model service failure resolved
- Investigated actual provider error bodies using synthetic minimal requests, with key redaction. 3.8 Flash returned HTTP 503 UNAVAILABLE with high-demand message. 2.5 Flash returned HTTP 404 explicitly stating it is unavailable to new users of this project. Model-list presence alone did not establish generation eligibility.
- Gemini 3.1 Flash-Lite returned HTTP 200 for a minimal generation and then HTTP 200 through /api/extract with the full structured schema and a fictional Hinglish transcript.
- Verified response included Demo Ravi, Samsung M32, the excluded adapter, data-preservation instructions and spending limit 800 with exact transcript excerpts. One unsupported approval suggestion was discarded by runtime validation rather than applied.
- Changed the default and .env.example to gemini-3.1-flash-lite. Existing GEMINI_MODEL overrides remain supported. No hidden fallback or automatic retry was added, and no Groq credential is needed for the successful path.
- Final production build passed after this model change.
- Browser follow-up succeeded: typed fictional Hinglish transcript, requested live extraction, observed six supported suggestions, and applied them to the draft. Customer, device, issue, accessories, instructions and amount fields populated; no automatic confirmation occurred.
- Semantic limitation observed: one browser response shortened instructions to data preservation and did not repeat the call-above-threshold instruction in that field, although it extracted the spending amount. Human transcript review remains required; exact-evidence validation does not ensure completeness. Do not claim perfect extraction accuracy.
