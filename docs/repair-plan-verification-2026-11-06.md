# Repair-plan verification, 6 November 2026

## Refinements

- Clarification answers carry the exact question the customer answered.
- The question remains paired with the answer when a recheck generates a follow-up question.
- Editing the technician plan clears the previous clarification pair, findings and audio.
- The clarification action says Recheck with customer answer and requires an answer.
- A compatible-plan reminder opens neutrally. A conflicting-plan reminder starts with Rukiye.
- Empty model questions are rejected. Speech markup is removed and oversized reminders are rejected.

## Live checks in this pass

All inputs used fictional repair details.

| Scenario | Observed result |
| --- | --- |
| ₹950 board replacement and reset against ₹600/data-preservation/permission instructions | HTTP 200. Three concerns with source quotes. Extracted final total ₹950. |
| Free visual inspection with no reset, no replacement and permission before paid work | HTTP 503 from Gemini, surfaced as HTTP 502 by the app. A single later retry also received 503. Current model behavior remains unverified for this case. |
| Initial ₹950 corrected to final ₹550 | Request timed out or stopped and returned HTTP 502. No usable result. |
| Plan without an explicit price | Gemini HTTP 503. No usable result. |
| Customer accepts ₹950 and board replacement but refuses reset, paired with the original question | Gemini HTTP 503. Live clarification behavior remains unverified. |
| Neutral spoken reminder using a validated compatible-result fixture | Gnani HTTP 200, audio/wav, 656,684 bytes. This verifies speech generation independently of Gemini. Pronunciation was not listened to in this pass. |
| Clarification answer without its original question | App HTTP 400 before model processing. |

Provider errors were reported explicitly. No automatic retry or alternate-provider fallback was added.

## Local regression checks

36 tests passed. They cover extraction completeness, source evidence, price comparison, neutral/conflicting reminder selection, clarification bounds and required question, markup and speech length handling, existing read-back behavior, origins, and guarded call integration.

## Demo preparation

Use docs/demo-60-seconds.md for the recording script, timing, spoken examples and rehearsal checklist. The video still needs to be recorded. Rehearse the affected live cases once Gemini is available again. Record actual app outputs and keep shortened waiting periods apparent in the edit.
