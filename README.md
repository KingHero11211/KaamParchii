# KaamParchi

A voice-assisted repair intake and technician handover prototype for repair and maintenance businesses, built for the Gnani AI internship challenge.

Gnani Prisma captures Hindi/Hinglish, English and Telugu speech using an explicit conversation-language setting. The shop reviews the extracted details, hears a Gnani Timbre readback and confirms the intake. At the workbench, a technician speaks the proposed repair; the app checks it against the customer's instructions and budget, shows supporting quotes and speaks a warning. A LiveKit browser conversation lets the customer discuss revised prices and individual repair actions.

## Features

- Per-job shop name, service category and conversation language. Categories cover general repairs, electronics, appliances/AC, vehicles and home maintenance.

- Recording or audio upload, editable transcription, and removal of incorrect recordings.
- Gemini draft extraction with transcript evidence and preserved customer instructions.
- Reviewed intake, browser-local job dashboard, technician notes/status, and printable receipts.
- Voice repair plans, conflict explanations, spoken reminders, and customer clarification.
- Browser approval conversations with separate price/action decisions, saved transcripts and shop review.
- Animated recording feedback and a voice-responsive speaking orb.

Telephone dialing is not part of this prototype.

## Local setup

Requires Node.js 22.13+ and npm. The optional live voice worker requires Python 3.11.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
```

Fill in your credentials in `.env.local`, then start the website:

```powershell
npm.cmd run dev
```

Open http://localhost:3000. Use fictional customer information. API credentials stay server-side and must never use a `NEXT_PUBLIC_` prefix.

### Live browser voice

In a second terminal, create the Python environment once:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r voice-agent/requirements.txt
```

Then start the worker:

```powershell
npm.cmd run voice
```

The npm voice command targets Windows. On Linux/macOS, use `.venv/bin/python voice-agent/agent.py start`. Keep both the website and worker running. See [browser voice setup](docs/livekit-browser.md) for details and verification limits.

## Shop categories and Telugu

New intake begins with shop name, service category and conversation language. The selected settings are saved with the job and its approval proposals; later settings do not rewrite older jobs. Legacy jobs keep their original Nukkad Mobile Care / Hindi-Hinglish context.

Choose Telugu to use Telugu transcription, field suggestions, clarification questions, spoken summaries/warnings and browser voice. The UI and receipt labels remain English. Free-form text is read as entered; switching language does not automatically translate existing entries. Each category has a Telugu sample. Bhojpuri and Haryanvi are not offered.

Local development uses Webpack because the default Turbopack development session repeatedly refreshed the form in this workspace. Production builds retain the default Next.js compiler. See [verification](docs/telugu-service-verification.md).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GNANI_API_KEY` | Prisma transcription and Timbre speech |
| `GEMINI_API_KEY` | Draft extraction, plan comparison and conversation |
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.1-flash-lite` |
| `LIVEKIT_URL` | LiveKit Cloud `wss://` project URL |
| `LIVEKIT_API_KEY` | Server-side LiveKit project key |
| `LIVEKIT_API_SECRET` | Server-side LiveKit project secret |
| `KAAMPARCHI_APP_URL` | Worker transcript callback origin; defaults to `http://127.0.0.1:3000` |

Only the example file is committed. Real keys, recordings, local databases, dependencies and Python environments are excluded from Git.

## Checks

```powershell
npm.cmd run typecheck
node --experimental-strip-types --test tests/*.test.mjs
npm.cmd run build
```

The optional `tests/voice_smoke.py` creates a fictional live session and consumes API allowance. It never dials a phone. Automated checks do not establish model accuracy or a complete customer approval conversation.

## Deploying the website on Vercel

Import this repository, select Next.js, and add the required environment variables in Vercel. Use Node.js 22.x or another compatible supported version. The normal build command is `npm run build`; keep Next.js output settings at their defaults.

**The full browser-approval feature needs additional hosting work before a Vercel deployment can support it:**

1. Conversation history currently uses a local SQLite file under `data/`. Vercel Functions do not provide shared persistent local storage. Move this ledger to a hosted database; do not use `/tmp` as a permanent database.
2. Run the Python LiveKit worker as a separately deployed agent service, for example on LiveKit Cloud. A website import does not deploy that worker. Set its callback origin to the deployed website and supply its secrets separately.
3. Test browser microphone permissions, transcript callbacks and provider timeouts on the deployed origin. Protect public API access before exposing paid credentials to unrestricted traffic.

The intake, transcription, extraction, readback, plan-check and print workflows are separate from browser conversation history. Jobs remain local to each browser and deployed origin; localhost records do not automatically move to the deployed site.

References: [Vercel and SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [LiveKit agent deployment](https://docs.livekit.io/deploy/agents/quickstart/).

## Prototype boundaries

- Use fictional data. No authentication or independent customer identity verification is implemented.
- AI suggestions require human review; source quotes establish text matches, not semantic correctness.
- Original customer instructions remain unchanged by plan checks or suggested conversation decisions.
- A spending limit does not authorise repairs. Price approval never automatically approves reset/data loss.
- Browser jobs can be lost when browser storage is cleared. Conversation records are server-local and browser-scoped.
- Gemini may return temporary errors. No cross-provider fallback is configured.
- Speech is processed after utterances using Gnani REST APIs; this is not continuous Gnani streaming.
- Default shop names and sample records are fictional. Technician notes are excluded from customer receipts.

See [demo script](docs/demo-60-seconds.md) and [repair-plan verification](docs/repair-plan-verification-2026-11-06.md).
