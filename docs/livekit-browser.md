# Live browser repair approvals

KaamParchi uses LiveKit for the browser audio connection, Gnani Prisma v3 for speech recognition, Gnani Timbre v3 for speech, and Gemini for the dialogue. No phone number is required for browser voice. This feature does not dial telephone numbers.

## Run locally on Windows

Keep two terminals open from the project directory:

```powershell
npm.cmd run dev
```

```powershell
npm.cmd run voice
```

The worker uses `.venv`. To rebuild that environment on another machine, install Python 3.11, create `.venv`, then install `voice-agent/requirements.txt`. Run `npm.cmd install` for the website dependencies.

Keep `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GNANI_API_KEY`, and `GEMINI_API_KEY` in `.env.local`. The worker posts transcripts to `KAAMPARCHI_APP_URL`, defaulting to http://127.0.0.1:3000. Restart the worker after changing credentials or its Python files.

## Try it

New jobs save their shop, category and conversation language. Telugu and English sessions configure worker recognition, speech, greeting and dialogue accordingly; old jobs retain Hindi/Hinglish defaults. `tests/voice_smoke.py --telugu` runs a fictional Telugu appliance session.

Open a saved job. In Ask before the repair, enter the complete revised price and each proposed action on a separate line. Preview, review the exact scope, and confirm permission. Click Start browser conversation and allow microphone access. End the session, refresh conversation history, then inspect the transcript before extracting and reviewing suggested decisions.

Example proposal: total 900, replace motherboard, reset phone which may erase stored data. Example customer reply: Haan, main Ravi bol raha hoon. Nau sau rupaye aur motherboard ke liye haan, lekin phone reset mat karna. Wait for the assistant to read each decision back, and correct it if needed.

## Prototype boundaries

- Five-minute sessions; speak in turns shorter than 30 seconds.
- Custom adapters use the same verified REST endpoints as the app. The installed Gnani LiveKit plugin lacked the required v3 settings. Responses arrive after each utterance and API processing, rather than continuous Gnani streaming.
- One active approval session at a time. The proposal is frozen while connected. End a saved session from history if a reload interrupted the controls.
- Browser tokens grant a short-lived room connection and microphone publication only. Report credentials are sent to the worker, never the browser.
- Calls and final transcripts are stored in `data/customer-calls.sqlite`, scoped to a token kept in this browser. Worker report delivery retries and retains undelivered reports under `data/voice-reports`; they retry when a later session starts. These files contain conversation data and must stay local.
- Model output is advisory. Exact customer evidence, a non-interrupted assistant readback, a later customer confirmation, and shop review are required for suggested decisions. Original intake instructions remain unchanged.
- Gemini can return 503 during high demand. The worker now attempts a spoken service-unavailable message and closes an incomplete conversation; incomplete discussion must not be treated as approval.
- Actual phone calls require a separate telephony provider; enterprise-only Gnani Agent Builder is disabled.

## Verification on 6 November 2026

39 Node checks passed; TypeScript checking and production build passed. A real fictional LiveKit session received Gnani greeting audio, published a synthetic customer reply, transcribed that reply, and saved assistant/customer turns back to the local ledger. Gemini returned 503 during an earlier check. A later live check successfully saved the greeting, customer transcription and Gemini response as three turns. That response grouped approval questions, so the prompt was tightened afterward to ask one item per turn. A complete approval/readback/confirmation dialogue still needs user verification. Browser preview and consent gating were checked visually without enabling a physical microphone. The later spoken error handler still requires a live failure-path check.

Optional paid-service smoke check: `.venv/Scripts/python.exe tests/voice_smoke.py`. It uses a fictional proposal and synthetic customer audio; it consumes API allowance, creates a LiveKit room, and closes it. It prints no credentials. It does not dial a phone.
