# Sales pipeline

A local React + JavaScript + Vite assignment app. The first increment provides a virtualized pipeline table backed by TanStack Query, with 50,000 seeded deals, 20 owners, and seven stages.

## Run

Requires Node.js 22.12+ or 24+.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite.

```sh
npm test       # Data integrity, filtering, sorting, and local stage changes
npm run build # Production build
```

## Current behavior

- Search by deal name, company, or ID; search terms combine and ignore case.
- Filter by stage, owner, and inactivity (7, 14, or 30 full days).
- Sort by recent activity, deal value, or company.
- Change a deal's stage with its native select control. The stage counts and totals update immediately.
- Only visible rows and a small overscan are rendered. All 50,000 records are held in memory; this increment does not paginate or fetch data incrementally.
- Controls have accessible labels, visible focus indicators, and native keyboard behavior. The table exposes total row counts and row positions.
- Overview metrics describe the whole dataset; the results count and value describe the filtered view. Needs attention counts open deals inactive for at least 14 full days. Inactivity filters can include won/lost deals.

Changes are session-only and reset on refresh. Stage changes are immediate local edits; network simulation, optimistic saves, retries, bulk actions, teammate updates, conflict handling, and complete virtualized keyboard navigation are later increments.

## Data and code

- `src/data/deals.js`: stage/owner definitions, seeded generator, filtering/sorting, immutable stage updates. Monetary values are integer USD cents. Deals include `id`, `name`, `company`, `valueCents`, `currency`, `ownerId`, `stageId`, `lastActivityAt`, `updatedAt`, and `version`.
- `src/data/dealRepository.js`: replaceable in-memory data source. Stage changes advance the deal version and update activity timestamps.
- `src/hooks/useDeals.js`: TanStack Query cache integration.
- `src/components/PipelineTable.jsx`: TanStack Virtual rows in a semantic HTML table.
- `src/App.jsx`: filters and pipeline overview.

The seed fixes names, values, owners, and stage distribution. Activity dates are relative to when the dataset is generated. A fixed reference date can be supplied in tests. New Lead contains exactly 10,000 deals. The optional Google font has a local system-font fallback.
