# Sales pipeline

A local React + JavaScript + Vite assignment app. The first two increments provide a virtualized pipeline table backed by TanStack Query, with 50,000 seeded deals, 20 owners, seven stages, pagination, and bulk stage changes.

## Run

Requires Node.js 22.12+ or 24+.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite.

```sh
npm test       # Data, filters, pagination, selection, and single/bulk changes
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
- Choose a target stage and click “Move N deals.” A single dataset pass updates all selected deals and the Query cache once. Deals already in the target stage are reported separately and keep their versions/timestamps. Successful completion clears selection; local validation errors preserve it.
- Filters, sorting, and page-size changes return to page one. If edits shrink the results, pagination clamps to the last available page. Empty results retain selection so hidden deals can still be moved or deselected.
- Controls have accessible labels, visible focus indicators, and native keyboard behavior. The table exposes total row counts and row positions.
- Overview metrics describe the whole dataset; the results count and value describe the filtered view. Needs attention counts open deals inactive for at least 14 full days. Inactivity filters can include won/lost deals.

Changes are session-only and reset on refresh. Stage changes are immediate local edits; network simulation, per-deal partial failures, optimistic saves, retries, teammate updates, conflict handling, and complete virtualized keyboard navigation are later increments.

## Data and code

- `src/data/deals.js`: stage/owner definitions, seeded generator, filtering/sorting, immutable stage updates. Monetary values are integer USD cents. Deals include `id`, `name`, `company`, `valueCents`, `currency`, `ownerId`, `stageId`, `lastActivityAt`, `updatedAt`, and `version`.
- `src/data/dealRepository.js`: replaceable in-memory data source. Stage changes advance the deal version and update activity timestamps.
- `src/hooks/useDeals.js`: TanStack Query cache integration.
- `src/components/PipelineTable.jsx`: TanStack Virtual rows in a semantic HTML table.
- `src/components/BulkActions.jsx`: selection scope, target stage, and bulk results.
- `src/components/Pagination.jsx` and `src/data/pagination.js`: page navigation and bounded slices.
- `src/state/selection.js`: immutable ID-based selection reducer.
- `src/App.jsx`: filters and pipeline overview.

The seed fixes names, values, owners, and stage distribution. Activity dates are relative to when the dataset is generated. A fixed reference date can be supplied in tests. New Lead contains exactly 10,000 deals. The optional Google font has a local system-font fallback.

## Verification

The production build and 15 Node tests pass, covering dataset integrity, filtering/sorting, selection snapshots and exclusions, page boundaries, bulk updates, no-op outcomes, and invalid requests. Local Chrome checks also covered bounded rendered row counts, selection across pages/filters/scrolling, keyboard checkbox selection, mixed header state, hidden selections, 10,000-match moves, a 50,000-deal move, last-page recovery, empty results, and mobile overflow. Network failures and concurrency are not implemented or tested yet.
