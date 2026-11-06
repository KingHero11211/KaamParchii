# Customer approval calls

Approved scope: review the exact revised price and individual proposed repairs, call the consenting customer through Gnani, retrieve the conversation, and review separate decisions.

Build one file at a time.

1. Shared types, input validation and dedicated-agent prompt. Preserve the original intake and freeze every proposal.
2. SQLite call ledger under ignored data/ plus Gnani Platform integration. One active call on a dedicated agent. Durable proposal fingerprint prevents duplicate dispatch. Ambiguous dial failures require reconciliation.
3. Same-origin routes for configuration, call creation, outcome refresh, decision extraction and reviewed decisions. Real calls require explicit configuration, allowlisted numbers and per-call customer permission.
4. Customer-call panel on each job with editable proposal items and price, preview, explicit call action, saved history, transcript, suggested decisions and operator review.
5. Environment example and setup guide for a dedicated Gnani development agent with agents/conversations permissions and whitelisted numbers.
6. Focused regression checks, disabled-configuration check and production build. Never place a real call during development.

Outcome retrieval accepts only exact clientReferenceId, bot and conversation matches. Unknown correlation stays pending. Connection and disposition codes never imply approval. Suggested decisions need supporting customer words and an assistant read-back with customer confirmation before shop review.

This is a single-server local prototype. The existing browser-local intake remains available. Call records are server-side and contain customer information. Live calling stays disabled until the credentials and registered test numbers are configured. Public hosting requires persistent server storage and shop authentication.
