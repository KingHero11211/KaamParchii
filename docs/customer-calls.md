# Customer approval calls

## Current account status

The existing speech key was checked against the documented Agent Builder list-agents endpoint and received HTTP 401. No agent was created, changed or dialled during that check. Calling credits and Agent Builder access are unverified. Speech APIs continue to use GNANI_API_KEY.

Ask Gnani support for an Agent Builder Platform API key with agents and conversations permissions, a dedicated outbound development agent, and registration of your own consenting test number. Ask whether programme credits cover this calling service. Never post the key in chat or source control.

## Configure a dedicated agent

Create or obtain a separate agent used only by this prototype. Configure and test Gnani ASR/TTS, Hindi/English support, the LLM, call duration, and voicemail handling in Gnani Agent Builder. Confirm the agent and number are enabled for outbound development calls.

KaamParchi updates this dedicated agent's system prompt and greeting before each call. It turns off dynamic greetings, pre-call variables and post-call webhooks for this integration. Use a dedicated agent to keep other agent workflows separate. The local ledger allows only one active call at a time, so the next proposal cannot change the agent while an earlier call is awaiting its outcome.

Add these values locally to .env.local, then restart the app.

```dotenv
GNANI_AGENT_API_KEY=your-agent-builder-key
GNANI_AGENT_ID=your-dedicated-agent-id
GNANI_CALLS_ENABLED=true
GNANI_CALL_ALLOWED_NUMBERS=your-whitelisted-10-digit-mobile
```

The local number list and Gnani's registered-number list must both contain the destination. The app uses the documented development trigger endpoint. A speech key alone has not been verified to provide access.

## App workflow

1. Open a saved job and find Ask before the repair.
2. Check the customer's number, complete revised price and each proposed action. Use one action per line and state data-loss consequences.
3. Preview the proposal, confirm customer callback permission, review the exact scope, and select Call customer for approval.
4. The app saves an immutable proposal before contacting Gnani. Repeating the same request returns its existing attempt.
5. After the conversation, select Refresh call outcome. The integration searches logs for the exact clientReferenceId, verifies the agent and conversation ID, and reads completed statistics. It imports no decisions from a call connected flag.
6. Extract customer decisions sends the proposal and transcript to Gemini after explicit permission. Each proposed approval or refusal needs customer evidence, a later assistant read-back, and a later customer confirmation. The shop checks the full transcript and marks the suggestions reviewed. Unclear items remain pending.

The original intake and printed intake receipt retain the original handover. Call records show the revised proposal separately. Any changed price or scope requires a fresh proposal. An unanswered call provides no approval.

## Reliability and deployment

Call records are stored in data/customer-calls.sqlite, ignored by version control. Use Node 22.13 or newer with node:sqlite and a persistent writable disk. Browser-local intake jobs still use the existing localStorage store. A random browser token links this prototype's call history to that browser. Clearing browser storage loses that history link.

A failed configuration step can be explicitly retried. An uncertain dispatch stays locked until reconciled with Gnani. There are no automatic dial retries or stale-lock expiry because a timeout cannot establish whether a call was placed. Repeated finished or uncertain proposals return their original attempt. For an uncertain attempt with no matching log, use Gnani support and the saved call reference before making another call.

Exact clientReferenceId correlation is required in conversation logs. If the provider omits it, the app leaves the attempt pending and requires integration support. Live response correlation, phone audio and pronunciation still need verification with Agent Builder access.

This integration polls after an explicit refresh and requires no public webhook. Public multi-shop hosting needs shop authentication, shared job storage, encrypted operational backups and deployment-specific access controls before exposing customer data or call controls. Keep this prototype on a trusted local machine while those are pending.

## Verification

Focused tests cover input validation, mixed decisions, ordered confirmation evidence, persistent deduplication, one-active-call locking, failed retries, exact-reference outcome matching, allowlist enforcement and ambiguous network failures. Provider tests use mocked responses and place no calls.

Official references are [Trigger Test Call](https://docs.gnani.ai/Platform/Trigger_Call), [Update Agent](https://docs.gnani.ai/Platform/Update_Agent), [Conversation Logs](https://docs.gnani.ai/Platform/Get_Conversation_Logs), and [Conversation Statistics](https://docs.gnani.ai/Platform/Get_Conversation_Stats).
