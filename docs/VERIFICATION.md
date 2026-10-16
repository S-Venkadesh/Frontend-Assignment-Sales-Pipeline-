# Submission verification

Run `npm run check` for the deterministic data/save/concurrency suite and production build.

Final checks passed: 44 Node tests, production build, fresh-checkout startup, virtual-row keyboard traversal and recovery focus. Automated WCAG 2 A/AA and 2.1 AA scans reported zero violations in the main view and forced-failure recovery view; this does not replace manual assistive-technology testing.

The key partial-failure test is in `src/state/saveController.test.js`: a 500-deal batch is forced to return 480 successes and 20 failures. Retrying yields 500 confirmed deals, all at version 2, proving that the 480 successful deals were not submitted a second time. Discard tests preserve unrelated successful and pending records.

`src/state/bulkSaveSummary.test.js` verifies the latest batch's 20 failures remain isolated even when ten earlier unrelated failures exist. Batch retry excludes successes, conflicts, later differently edited records, and discarded intents.

Browser verification covers:

- Fresh-checkout `npm start`, including dependency installation.
- Bounded mounted deal/recovery rows, pagination, and multi-selection.
- Keyboard access across virtual row boundaries, reverse traversal, Home/End, and recovery focus.
- Single-save success/failure/retry/discard and partial bulk results.
- Teammate conflict comparison, both resolution choices, and resolving one conflicted ID without resubmitting successes.
- Table/row/control identity, exact scroll, page, and selection during teammate events.
- Automatic activity start/stop, responsive overflow, and browser console errors.

The two-page design rationale is in this directory. `artifacts/demo.webm` is a visually reviewed 164.92-second captioned walkthrough with no microphone audio. Its real 10% failure run produced 441 successes and 59 failures; retry reached 500 saved, with every batch record at version 2 and no browser errors. `artifacts/demo-verification.json` records these checks. The app simulates its server in memory; DevTools network throttling is not the simulator. Teammate activity starts off, and all application state resets on browser refresh.
