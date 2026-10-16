# Sales pipeline

A local React + JavaScript + Vite assignment app. The first three increments provide a virtualized pipeline table backed by TanStack Query, with 50,000 seeded deals, 20 owners, seven stages, pagination, bulk stage changes, and simulated network saves with recovery.

## Run

Requires Node.js 22.12+ or 24+.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite.

```sh
npm test       # Data, pagination, selection, network saves, and failure recovery
npm run build # Production build
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
- Filters, sorting, and page-size changes return to page one. If edits shrink the results, pagination clamps to the last available page. Empty results retain selection so hidden deals can still be moved or deselected.
- Controls have accessible labels, visible focus indicators, and native keyboard behavior. The table exposes total row counts and row positions.
- Overview metrics describe the whole dataset; the results count and value describe the filtered view. Needs attention counts open deals inactive for at least 14 full days. Inactivity filters can include won/lost deals.

All server state is simulated in memory and resets on refresh. Overview metrics and filtered results include optimistic/unsaved changes; save activity makes their status explicit. Teammate activity, dedicated conflict resolution, and complete virtualized keyboard navigation are later increments.

## Data and code

- `src/data/deals.js`: stage/owner definitions, seeded generator, filtering/sorting, immutable stage updates. Monetary values are integer USD cents. Deals include `id`, `name`, `company`, `valueCents`, `currency`, `ownerId`, `stageId`, `lastActivityAt`, `updatedAt`, and `version`.
- `src/data/dealRepository.js`: configurable fake API, authoritative records, per-deal outcomes, expected-version checks, and delayed-write protection.
- `src/state/saveController.js`: confirmed records plus latest optimistic intent per ID; failure-only retry/discard and response reconciliation. Failed saves never restore a whole-list snapshot.
- `src/hooks/useDeals.js`: TanStack Query queries/mutations and cache projection. Automatic mutation retries are disabled; recovery is explicit. Inactive mutation payloads have a short retention window.
- `src/components/NetworkSimulator.jsx` and `src/components/SavePanel.jsx`: simulator settings, save counts, and virtualized failure review.
- `src/components/PipelineTable.jsx`: TanStack Virtual rows in a semantic HTML table.
- `src/components/BulkActions.jsx`: selection scope, target stage, and bulk results.
- `src/components/Pagination.jsx` and `src/data/pagination.js`: page navigation and bounded slices.
- `src/state/selection.js`: immutable ID-based selection reducer.
- `src/App.jsx`: filters and pipeline overview.

The seed fixes names, values, owners, and stage distribution. Activity dates are relative to when the dataset is generated. A fixed reference date can be supplied in tests. New Lead contains exactly 10,000 deals. The optional Google font has a local system-font fallback.

## Verification

The production build and 29 Node tests pass. They cover dataset integrity, filters, pagination, selection, latency bounds, forced success/failure, request settings snapshots, optimistic updates, rejected requests, a deterministic 500-deal batch with 480 successes/20 failures, retrying only failures, targeted rollback, version checks, and older-response protection.

Local Chrome checks covered bounded row rendering, selection across views, bulk actions, immediate optimism, forced single failures/retry/discard, confirmed-state rollback, partial 500-deal results, filtered-out failure review, failure-only retry without rewriting successes, targeted bulk discard, and mobile layout. Teammate events and dedicated concurrent-edit recovery are not yet implemented or tested.

## Save ordering

Each local operation has a monotonically increasing ID. The fake API remembers the latest operation per deal and rejects superseded delayed writes. Requests include the expected confirmed version; mismatches return an explicit failure with the current authoritative record. The client merges confirmed records by version and changes visible save status only for the current operation. A late response cannot overwrite a newer desired stage. Retrying a version failure is an explicit new write based on the latest confirmed version; richer teammate conflict resolution comes next.

One bulk request returns per-deal outcomes after its simulated delay. This models partial success without creating thousands of timers/promises or per-deal copies of the full table. There is no real HTTP server, durable storage, or cross-tab synchronization.
