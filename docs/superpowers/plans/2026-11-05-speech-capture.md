# Speech Capture Implementation Plan

> **For agentic workers:** Use executing-plans in this session, one file at a time as requested by the user.

**Goal:** Connect genuine Prisma transcription to the existing manual intake without requiring a key in chat or pretending transcript extraction is available.

**Architecture:** Browser records short clips, converts them to WAV, or validates an uploaded audio file. A same-origin server route holds GNANI_API_KEY and calls the documented REST API. Transcript stays editable in the intake draft; confirmed intake is unchanged. No audio persistence. Fake shop identity is visibly marked as demo.

**Contract:** POST https://api.vachana.ai/stt/v3, multipart audio_file, model=prisma-v3.0, language_code=hi-IN,en-IN, format=transcribe, X-API-Key-ID header. 30-second provider limit; use 28-second recording guard. WAV/MP3/OGG/FLAC/AAC/M4A uploads, prototype 8MB ceiling. Unsupported browser decode fails with conversion guidance. No automatic credit-spending retries.

## Sequential files and verification
- [x] .env.example: blank server-only key placeholder, no real secret; inspected.
- [x] src/lib/shop.ts: Nukkad Mobile Care demo identity; typecheck passed.
- [x] src/app/api/transcribe/route.ts: validation, consent, same-origin guard, missing-key response, upstream timeout and safe error mapping; typecheck passed.
- [x] src/lib/audio.ts: duration/size checks, browser decode, WAV encoding; typecheck and WAV header/PCM assertions passed.
- [x] src/components/voice-intake.tsx: consent, record/stop, auto-stop, upload, editable transcript, cancellation/unmount cleanup and error handling; typecheck passed.
- [x] src/app/intake/page.tsx: voice capture integrated without overwriting form values; typecheck passed.
- [x] src/app/jobs/[id]/page.tsx: visibly fictional shop identity on receipt; typecheck passed.
- [x] README.md: local key setup, audio handling and limitations documented; final production build passed with approved filesystem access.

## Verification and limits
User deferred broad tests; use focused checks. Verify missing-key and consent failures without a provider call. Real STT quality and account authentication remain unverified until the user supplies a key locally. Keep auto-extraction and Timbre out of claims for this milestone. Review only source, never secret env contents.

## Verification record
- Each product file was typechecked before moving to the next.
- Direct route assertions passed: consent rejection, missing-key 503, mocked Prisma request contract, truncated-response handling and authentication-error mapping. No real provider calls or credits used.
- Independent source review verified the request contract against the supplied documentation. One important lost-edit risk was identified: transcript edits during a pending request could be replaced by its response. Fixed by disabling transcript editing while busy/recording; typecheck passed afterward. Busy-state behavior has not been tested in a browser against a real provider.
- Browser: new recording/transcript controls loaded; sample intake populated, reviewed, confirmed and saved. The resulting receipt displayed Nukkad Mobile Care and fictional-customer labelling.
- First production build compiled but failed writing an output directory with EPERM. Rerunning with approved normal filesystem access succeeded; no application workaround was introduced.
- Outstanding: real microphone/codec behavior, live STT calls, printed output, automatic extraction, Timbre, shared server records. Existing manual prototype minor findings remain deferred.
- Ruling: stay in the existing non-Git workspace and defer broad test-suite authoring per prior user instructions. Focused compilation and contract assertions do not establish production readiness.
- Final minor (deferred): clearer warning when retranscription replaces an existing working transcript.

## Next input
An extraction-model provider/key or approved local model is required for free-form transcript-to-field generation. Gnani speech credits do not establish access to a hosted LLM endpoint.
