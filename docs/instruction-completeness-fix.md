# Instruction completeness fix — 2026-11-05

## Cause
The prior schema permitted a concise instructions summary. Exact evidence checks established provenance of that summary but did not establish that all customer requests were represented. Live output had omitted the call-above-800 condition from instructions.

## Change
- Schema asks for a separate instructionClauses array of verbatim source quotes. fields.instructions is reconstructed by validation, not trusted as a summary.
- A high-recall English/Roman Hindi/Devanagari directive scan adds complete source sentences for recognised directives, preserving their conditions and amounts.
- Quotes must occur in the transcript. Contained fragments are replaced by full sentences, duplicate spans are removed, and distinct repeated source occurrences are preserved in order.
- Contiguous supporting evidence spans the first through last retained instruction. Applying suggestions and customer confirmation remain explicit.
- Long instruction lists fail with a specific 422 response, not silent truncation. Recognisable device credentials also block applicable instructions.

## Verification
- Observed four initial regression failures, then all five original instruction tests passed after the change.
- Independent source review reproduced three further issues: repeated corrections collapsed, credential-bearing fallback copied a PIN, and a 101-clause result failed client revalidation. Added reproductions, observed all three fail, fixed them, then ran the full available suite: 11/11 passed.
- TypeScript passed after each product-file change.
- A live synthetic Gemini 3.1 Flash-Lite extraction returned HTTP 200 and all three complete instructions: data preservation, call above 800 rupees, and permission before replacing parts. No secret values were printed.
- Final production build passed.

## Limits and rulings
The directive fallback is a completeness aid for common wording, not universal semantic coverage. It preserves source wording, including unresolved corrections; the customer must resolve intent during review. Speech-recognition errors and unusual phrasing remain possible. No claims of perfect instruction extraction or legal authorisation are made. Keep direct workspace/file-by-file execution as requested; do not add broader features or change shop flow in this fix.
