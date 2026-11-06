# LiveKit browser approval

Connect the approved customer conversation through LiveKit using Gnani Prisma, Gnani Timbre and the configured Gemini model. Work one file at a time.

1. Install official LiveKit client/server SDKs and an isolated Python worker environment with Gnani, Google and Silero plugins. Inspect installed APIs before implementation.
2. Extend shared proposal validation for browser conversations without a phone number. Preserve strict phone validation for telephone calls.
3. Add a server-side voice-session ledger with frozen proposals, browser ownership, a bounded room lifetime, and authenticated worker reports. Reuse existing evidence validation for reviewed decisions.
4. Add same-origin token/session endpoints. Mint short-lived microphone-only room tokens and dispatch the dedicated worker. Secrets remain server-side.
5. Add the Python worker with the existing approval prompt, interruptible speech, local VAD, bounded sessions, and transcript reporting.
6. Add browser controls, the speaking orb, connection feedback, transcript and reviewed decision extraction. Reuse the proposal form. Keep unsupported Agent Builder phone controls collapsed.
7. Verify credentials with read-only access, worker registration and fixture sessions. Run focused regression checks and the production build. The user performs microphone/approval testing if browser permissions require their action.

Phone dialing remains pending a separate telephony provider. No test will dial a phone. Every proposal is fixed before a session begins. AI suggestions remain subject to shop review and unclear actions stay pending.


Implementation complete: steps 1–7, with custom REST adapters replacing the installed Gnani plugin because its v3 options lagged the API. Browser preview/consent gating, LiveKit registration, real speech round trip, saved transcript, failed-attempt recovery, 39 checks and production build verified. Full customer approval dialogue remains a manual acceptance check. No telephone calls made.
