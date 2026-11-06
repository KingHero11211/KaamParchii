# Telugu and repair categories implementation plan

Goal: Save a shop/category/language snapshot on each job and use it consistently through intake, plan checks, receipts and live browser approvals. Existing jobs retain their original phone-shop/Hinglish defaults. The interface stays English; Telugu is a conversation language.

Implementation choices: one shared workflow with category presets rather than separate applications. Categories: general repair, electronics, appliances/AC, vehicle service, home maintenance. Explicit languages: Hindi/Hinglish, English, Telugu. New jobs default to general repair and Nukkad Repair Care. User-approved scope is the requested Telugu and category expansion; implementation details are chosen to preserve existing data and review safeguards.

- [x] Add validated shared service context and category presets; focused tests first.
- [x] Persist optional context on new jobs, preserve legacy jobs.
- [x] Add intake settings UI and propagate frozen context to all child requests.
- [x] Add Telugu/English deterministic readback and speech number formatting; retain original customer wording.
- [x] Update REST transcription/extraction/readback/plan-check validation and prompts, preserving quote and approval checks.
- [x] Propagate context into saved proposals and LiveKit worker speech configuration/greeting.
- [x] Generalize receipt labels/examples and preserve the selected shop snapshot.
- [x] Check regressions, production build, Telugu API fixtures and browser settings/save/reload flow; review changes.

Work one product file at a time and typecheck after each. Do not migrate hosting/storage, translate the whole interface, add phone dialing, or claim Bhojpuri/Haryanvi support. Do not auto-publish changes to GitHub as part of implementation.
