# Sales pipeline

A React + JavaScript + Vite sales pipeline for 50,000 seeded deals and 20 owners, with virtualized rows, bulk actions, simulated network saves, and teammate conflict resolution.

Submission artifacts: [two-page design rationale](docs/DESIGN_RATIONALE.pdf), [rationale source](docs/DESIGN_RATIONALE.md), [2m45s captioned walkthrough](artifacts/demo.webm), [demo script](docs/DEMO_SCRIPT.md), and [verification notes](docs/VERIFICATION.md).

## Run

Requires Node.js 22.12+ or 24+.

```sh
npm start
```

The startup script installs the locked dependencies on first use or after package/lockfile changes, then starts Vite. Open its printed Local URL. Node.js 24 LTS is recommended. Once dependencies are installed, `npm run dev` also works.

```sh
npm test       # Data, pagination, selection, network saves, and failure recovery
npm run build # Production build
npm run check # Tests and production build together
```

## Current behavior

- Search by deal name, company, or ID; search terms combine and ignore case.
- Filter by stage, owner, and inactivity (7, 14, or 30 full days).
- Sort by recent activity, deal value, or company.
- Change a deal's stage with its native select control. The stage counts and totals update immediately.
- Browse pages of 100, 250, or 500 deals using first/previous/next/last controls. Each page renders only visible rows and a small overscan. Pagination is client-side: all 50,000 records remain in memory, with filtering and sorting performed locally.
- Select individual deals with checkboxes. The header checkbox selects/deselects the whole current page, including rows outside the scroll viewport; it never changes selections on other pages. Its mixed state indicates a partly selected page.
- “Select all matching deals” adds a snapshot of every currently matching ID, across all pages. Later filter/data changes do not automatically select new matches. Individual checkboxes can exclude deals from the selection.
- Selection survives scrolling, paging, sorting, page-size changes, and filters. The toolbar reports the overall count, the count on this page, and the count outside current filters. Bulk moves apply to all selected IDs, including hidden selections.
- Choose a target stage and click “Move N deals.” Changes appear immediately, with row-level Saving/Saved/Unsaved status. Confirmed deals already in the target stage are skipped and reported separately. Selection clears on submission; local validation errors preserve it. New selections made during saving are kept.
- The fake API delays each single/bulk request by a random 300–1,500 ms and independently fails about 10% of eligible deal writes by default. Open “Network simulator” to adjust minimum/maximum delay or failure rate; 0% and 100% support repeatable success/failure demos. Settings changes apply to future requests.
- Failed changes stay visible as unsaved. Retry resends only failed deals to their intended stages; Discard restores each deal's latest confirmed record. Successful and unrelated pending changes stay intact. Versions advance only when a write is confirmed.
- Save activity reports the latest outcome per deal across the session. “Review failed deals” opens a virtualized list with deal IDs, company/name, intended stage, confirmed stage, error, and individual Retry/Discard controls. This list works independently of table filters. Global Retry/Discard actions affect only the current failures, never successful deals.
- Latest bulk results also show batch-specific saved/failed/saving/conflict counts. “Review N bulk failures” and “Retry N bulk failures” isolate that batch from older unrelated failures. A 480-success/20-failure batch can retry only those 20; later discarded or differently edited deals are reported separately.
- Open “Teammate simulator” below “Network simulator” to enable random updates every 1, 3, or 5 seconds. Automatic activity starts off. Manual controls let you choose a deal ID, teammate, and stage to reproduce an edit immediately. The latest five events appear in the simulator; turning activity off clears its timer.
- Teammate events patch known records by ID only when their version is newer. Duplicate/older events are ignored, and untouched records keep their references. Updates do not refetch the dataset, remount the table, reset pagination, or clear selected IDs.
- Current row membership/order stays stable as teammate changes arrive; visible cells and overview counts update live. “Refresh view” reapplies filters/sorting when you choose. Explicit filter/sort changes and local edits also capture a new view. A selected deal that leaves the filtered view remains selected and is counted outside the filters.
- If a teammate edits a deal with a pending or failed local move, your intended stage stays visible with a separate Conflict status. “Review conflicts” compares your stage with the latest confirmed stage. “Keep current stage” accepts that confirmed record; “Save my stage” submits a new version-checked write. Another teammate change can produce another conflict. Conflicts are excluded from ordinary failure retries, with individual and bulk resolution controls.
- Filters, sorting, and page-size changes return to page one. If edits shrink the results, pagination clamps to the last available page. Empty results retain selection so hidden deals can still be moved or deselected.
- Controls have accessible labels, visible focus indicators, and native keyboard behavior. The table exposes total row counts and row positions.
- Tab/Shift+Tab cross virtual row boundaries in both the deal table and recovery lists. On a deal checkbox, Up/Down moves between rows and Home/End reaches the first/last row on that page. Space selects, while stage dropdown arrows remain native. Retry/discard actions recover focus when their original control disappears.
- Overview metrics describe the whole dataset; the results count and value describe the filtered view. Needs attention counts open deals inactive for at least 14 full days. Inactivity filters can include won/lost deals.

All server state is simulated in memory and resets on refresh. Overview metrics and displayed records include optimistic/unsaved changes; save activity makes their status explicit. Current view membership/order can differ from freshly evaluated filters until refreshed. Broader screen-reader/user testing remains future work.

## Data and code

- `src/data/deals.js`: stage/owner definitions, seeded generator, filtering/sorting, immutable stage updates. Monetary values are integer USD cents. Deals include `id`, `name`, `company`, `valueCents`, `currency`, `ownerId`, `stageId`, `lastActivityAt`, `updatedAt`, and `version`.
- `src/data/dealRepository.js`: configurable fake API, authoritative records, per-deal outcomes, expected-version checks, and delayed-write protection.
- `src/state/saveController.js`: confirmed records plus latest optimistic intent per ID; failure-only retry/discard and response reconciliation. Failed saves never restore a whole-list snapshot.
- `src/hooks/useDeals.js`: TanStack Query queries/mutations and cache projection. Automatic mutation retries are disabled; recovery is explicit. Inactive mutation payloads have a short retention window.
- `src/components/NetworkSimulator.jsx` and `src/components/SavePanel.jsx`: simulator settings, save counts, and virtualized failure review.
- `src/components/TeammateSimulator.jsx`: manual and automatic teammate activity, timer cleanup, and recent events.
- `src/hooks/usePipelineView.js` and `src/data/pipelineView.js`: stable view IDs/order with live record projection.
- `src/components/PipelineTable.jsx`: TanStack Virtual rows in a semantic HTML table.
- `src/components/BulkActions.jsx`: selection scope, target stage, and bulk results.
- `src/components/Pagination.jsx` and `src/data/pagination.js`: page navigation and bounded slices.
- `src/state/selection.js`: immutable ID-based selection reducer.
- `src/state/bulkSaveSummary.js`: batch-scoped outcomes and failure IDs.
- `src/hooks/useVirtualKeyboard.js` and `src/utils/focus.js`: virtual-row keyboard access and recovery focus.
- `scripts/start.mjs`: one-command startup and dependency fingerprinting.
- `src/App.jsx`: filters and pipeline overview.

The seed fixes names, values, owners, and stage distribution. Activity dates are relative to when the dataset is generated. A fixed reference date can be supplied in tests. New Lead contains exactly 10,000 deals. The optional Google font has a local system-font fallback.

## Verification

The production build and 44 Node tests pass. They cover dataset integrity, filters, pagination, selection, latency bounds, forced success/failure, request settings snapshots, optimistic updates, rejected requests, a deterministic 500-deal batch with 480 successes/20 failures, retrying only failures, targeted rollback, version checks, and older-response protection. Teammate tests cover ID-based patches across 50,000 records, duplicate/out-of-order events, pending/failed edit conflicts, late save responses, both resolution choices, repeated conflicts, subscription cleanup, and stable filter/sort snapshots.

Local Chrome checks covered bounded row rendering, selection across views, bulk actions, immediate optimism, forced single failures/retry/discard, confirmed-state rollback, partial 500-deal results, filtered-out failure review, failure-only retry without rewriting successes, targeted bulk discard, and mobile layout. Teammate checks verified the same table/row/focused control remain mounted, exact scroll and row positions remain stable, selection/page state persist, explicit view refresh preserves hidden selection, automatic activity starts/stops, both conflict choices work, and resolving one conflict in a 100-deal batch does not rewrite its 99 successes.

## Save ordering

Each local operation has a monotonically increasing ID. The fake API remembers the latest operation per deal and rejects superseded delayed writes. Requests include the expected confirmed version; mismatches return an explicit conflict with the current authoritative record. The client merges confirmed records by version and changes visible save status only for the current operation. A late response cannot overwrite a newer desired stage or clear a teammate conflict. “Save my stage” explicitly writes against the latest confirmed version; “Keep current stage” drops only the conflicting local intent.

One bulk request returns per-deal outcomes after its simulated delay. This models partial success without creating thousands of timers/promises or per-deal copies of the full table. There is no real HTTP server, durable storage, or cross-tab synchronization.

## Reproduce a teammate conflict

1. Refresh, open Network simulator, set both delays to 5,000 ms and failures to 0%, then apply.
2. Open Teammate simulator. Leave Deal ID as `D-00001`, choose Priya Sharma and Contacted.
3. Search the main table for `D-00001` and move it to Won. While it is saving, click “Send teammate update.”
4. The table retains your Won intent and shows Conflict. “Review conflicts” shows Your stage: Won and Current stage: Contacted.
5. Choose “Keep current stage” to accept Contacted, or “Save my stage” to submit Won against the newer version. Neither choice changes the selection.

To check context preservation, select a deal, scroll within a page, and enable automatic activity. Incoming changes leave selection, row positions, page, and scroll intact; use Refresh view to apply new ordering/membership.
