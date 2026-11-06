# Spoken repair plan

Approved direction: compare a technician's spoken plan with the confirmed intake, show grounded concerns, speak a warning, and support a customer clarification draft.

Build sequentially, verifying each file.

1. Add shared input validation and grounded result validation. Compute price comparisons in application code. Reject unsupported evidence.
2. Add a server route using the existing Gemini configuration and Gnani Timbre configuration, with consent, same-origin checks, timeouts and bounded inputs.
3. Reuse Prisma recording with contextual wording for a repair plan or clarification.
4. Add the technician panel with editable plan, source quotes, explicit speech playback, cancellation, and stale-result invalidation.
5. Integrate on job details with job-keyed state. Clarification stays a draft and never changes confirmed intake or grants approval.
6. Verify a conflicting plan, a compatible plan, price boundaries, malformed responses, and production build.

The prototype flags possible conflicts. Every result requires human review. No result grants permission for work. No voice recording verifies identity. Checks and clarification drafts stay in memory for this milestone.
