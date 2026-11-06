# Timbre review read-back

Build in the current workspace, one file at a time, preserving the existing review/confirmation boundary.

## Workflow
Review the structured draft → inspect the exact Hindi/Hinglish script → explicitly request audio → play/pause with native controls → correct the draft if necessary → confirm separately. Playback never changes confirmation or repair permission.

## Design
Use deterministic Hindi labels and the entered field wording; do not add an LLM translation step that could alter instructions. Convert numeric amounts to Hindi spoken words; preserve all instructions and missing-field notices. Do not silently truncate long scripts. Native audio playback is manual, cached only in memory for the current review; edit/unmount discards it. Show the exact script before sending it to Gnani.

## Contract verified from official docs
POST https://api.vachana.ai/api/v1/tts/inference; X-API-Key-ID; model=timbre-v3.0; voice=Shivani; language=hi-en; speed=1.0; audio_config WAV/linear_pcm/mono/16-bit/24000 Hz. Response is binary audio, not JSON. API key remains server-side. No retries or cloned voices.

## Sequential files
- [x] tests/readback.test.mjs — initial missing-module failure observed; checks added and passed.
- [x] src/lib/readback.ts — pure script generation/number formatting; focused checks and typecheck passed.
- [x] src/app/api/readback/route.ts — intake/consent/origin validation, upstream request, audio/error handling; typecheck passed.
- [x] src/components/readback-panel.tsx — explicit send, script preview, loading/cancel/error, manual playback/cleanup; typecheck passed.
- [x] src/app/intake/page.tsx — mounted only in review; confirmation controls preserved; typecheck passed.
- [x] README.md — setup/limitations updated; final production build passed.

## Verification
Use a fictional short script for one live Timbre request, check returned WAV header and audio size without logging keys. Check browser controls and separate confirmation. No real customer recordings or secrets used for checks. Shared speech account may rate-limit concurrent STT/TTS; show failure without an automatic retry. Final independent source review follows the existing execution method.

## Results and review ledger
- Live fictional POST /api/readback returned HTTP 200, audio/wav, 2,311,724 bytes, RIFF/WAVE header. This verifies TTS account access and binary output, not subjective pronunciation quality.
- Browser: loaded sample intake, opened review, expanded exact spoken script, explicitly enabled speech transmission and generated audio. Native Play/time controls appeared; intake confirmation remained unchecked and save remained disabled.
- Independent source review found comma-separated lists and leading-zero IDs could be changed by generic numeric formatting. Added reproductions, observed both fail, then fixed valid-group recognition, digit preservation and alphanumeric model-number spacing. All 8 readback checks passed afterward.
- Final full available suite: 19/19 passed (8 readback + 8 instruction + 3 origin checks). Final production build passed with /api/readback included.
- Limits: audible pronunciation was not listened to during verification; mixed-language field text is not translated. Complex punctuation, names and other language pronunciations still require user review. Audio is not saved to job records. Existing extraction limitations remain documented separately.
- Ruling: keep the existing workspace and user-selected one-file-at-a-time execution. Native playback stays manual and never writes confirmation. No unrelated features or automatic paid retries added.
