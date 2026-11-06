# Telugu and service categories — verification

Implemented on 6 November 2026. New jobs support general repair/maintenance, electronics, appliances/AC, vehicles and home maintenance. Each job freezes its shop name, category and explicit Hindi/Hinglish, English or Telugu conversation language. Existing jobs retain legacy phone-shop defaults. Receipt and interface labels stay English; original text is not silently translated when changing settings.

## Observed checks

- 52 Node checks passed, TypeScript passed, Python compilation passed, production build passed.
- Focused checks cover validated language/category values, legacy-job loading, frozen context after save/reload/update, proposal context, Telugu instruction fallback, language mismatch rejection, category-specific speech hints, Telugu amounts/dates/contact digits and retained quote/approval checks.
- A fictional LiveKit Telugu appliance session received Gnani greeting audio, published a synthetic Telugu customer reply, and saved three Telugu assistant/user/assistant turns.
- Live Telugu extraction returned HTTP 200, customer name శ్యామ్, spending limit 600 and no discard warnings.
- A 900-rupee pump replacement against a 600-rupee limit and an ask-before-replacement instruction returned HTTP 200, two concerns and a Telugu question.
- Timbre warning returned HTTP 200, RIFF/WAV, 1,367,722 bytes.
- Browser walkthrough selected Appliances & AC and Telugu, entered a fictional shop, loaded the Telugu sample, reviewed the exact Telugu script and generated playable readback (HTTP 200). The confirmed job retained the shop/category/language and original instructions after reload.
- A code review found no material context-propagation, legacy-job or approval-integrity defects.

## Development server

The default Turbopack dev session repeatedly recompiled and refreshed the intake, resetting fields. No source rewrite loop or duplicate Next process was found. Restarting with the supported `--webpack` dev option stopped the refresh loop and the settings/save/reload walkthrough passed. `npm run dev` now uses that option; production builds still use Next.js defaults. The exact underlying Turbopack cause was not established.

## Remaining acceptance checks

A fluent Telugu speaker should check pronunciation and wording with natural microphone recordings. A complete multi-action approval, refusal and corrected-readback conversation remains to be rehearsed. Provider/model output remains fallible. No Bhojpuri/Haryanvi support, automatic translation of existing records, telephone calls, hosted storage migration or cloud worker deployment is included.

