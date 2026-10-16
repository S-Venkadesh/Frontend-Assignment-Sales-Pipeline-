import { useDeferredValue, useMemo, useReducer, useRef, useState } from 'react'
import { OWNERS, STAGES, daysSince } from './data/deals.js'
import { useDeals } from './hooks/useDeals.js'
import { PipelineTable } from './components/PipelineTable.jsx'
import { BulkActions } from './components/BulkActions.jsx'
import { Pagination } from './components/Pagination.jsx'
import { NetworkSimulator } from './components/NetworkSimulator.jsx'
import { SavePanel } from './components/SavePanel.jsx'
import { TeammateSimulator } from './components/TeammateSimulator.jsx'
import { usePipelineView } from './hooks/usePipelineView.js'
import { paginateDeals } from './data/pagination.js'
import { selectionReducer } from './state/selection.js'
import './App.css'

const EMPTY_DEALS = []
const DEFAULT_FILTERS = { search: '', ownerId: '', stageId: '', inactivity: '', sort: 'recent' }
const number = new Intl.NumberFormat('en-US')
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

function App() {
  const { data: deals = EMPTY_DEALS, isPending, isError, refetch, changeStage, changeStages, saves, retryFailed, discardFailed, saveMyStages, keepCurrentStages } = useDeals()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [announcement, setAnnouncement] = useState('')
  const [selectedIds, dispatchSelection] = useReducer(selectionReducer, null, () => new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [bulkStage, setBulkStage] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [bulkError, setBulkError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const now = useRef(Date.now()).current
  const deferredSearch = useDeferredValue(filters.search)
  const { matching, hasUpdates } = usePipelineView(deals, { ...filters, search: deferredSearch }, now, saves.viewRevision, saves.teamRevision, refreshKey)
  const page = useMemo(() => paginateDeals(matching, pageIndex, pageSize), [matching, pageIndex, pageSize])
  const selectedStats = useMemo(() => {
    let matchingCount = 0
    let pageCount = 0
    for (const deal of matching) if (selectedIds.has(deal.id)) matchingCount++
    for (const deal of page.deals) if (selectedIds.has(deal.id)) pageCount++
    return { matchingCount, pageCount, hiddenCount: selectedIds.size - matchingCount }
  }, [matching, page.deals, selectedIds])
  const summary = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map((stage) => [stage.id, 0]))
    let openValue = 0
    let wonValue = 0
    let inactive = 0
    for (const deal of deals) {
      counts[deal.stageId]++
      if (deal.stageId === 'won') wonValue += deal.valueCents
      else if (deal.stageId !== 'lost') {
        openValue += deal.valueCents
        if (daysSince(deal.lastActivityAt, now) >= 14) inactive++
      }
    }
    return { counts, openValue, wonValue, inactive }
  }, [deals, now])
  const filteredValue = useMemo(() => matching.reduce((total, deal) => total + deal.valueCents, 0), [matching])
  const hasFilters = Boolean(filters.search || filters.ownerId || filters.stageId || filters.inactivity)
  const viewKey = `${deferredSearch}|${filters.ownerId}|${filters.stageId}|${filters.inactivity}|${filters.sort}`

  function setFilter(key, value) {
    setPageIndex(0)
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  function clearFilters() {
    setPageIndex(0)
    setFilters(DEFAULT_FILTERS)
  }

  function changePageSize(size) {
    setPageSize(size)
    setPageIndex(0)
  }

  function selectDeals(ids, checked) {
    dispatchSelection({ type: 'set-many', ids, checked })
    setBulkResult('')
    setBulkError('')
  }

  function toggleDeal(id) {
    dispatchSelection({ type: 'toggle', id })
    setBulkResult('')
    setBulkError('')
  }

  function clearSelection() {
    dispatchSelection({ type: 'clear' })
    setBulkStage('')
    setBulkError('')
  }

  function handleBulkMove() {
    if (!selectedIds.size || !bulkStage) return
    setBulkResult('')
    setBulkError('')
    try {
      const { requestedIds, unchangedIds } = changeStages(selectedIds, bulkStage)
      const stage = STAGES.find((item) => item.id === bulkStage)
      const moved = requestedIds.length ? `Requested ${number.format(requestedIds.length)} moves to ${stage.label}. See save activity for results.` : 'No changes needed.'
      const unchanged = unchangedIds.length ? ` ${number.format(unchangedIds.length)} already in ${stage.label}; unchanged.` : ''
      setBulkResult(moved + unchanged)
      clearSelection()
    } catch (error) {
      setBulkError(`${error.message}. Selection kept; try again.`)
    }
  }

  function handleStageChange(deal, stageId) {
    try {
      changeStage(deal.id, stageId)
      setAnnouncement(`${deal.id} moving to ${STAGES.find((stage) => stage.id === stageId).label}. Saving.`)
    } catch (error) {
      setBulkError(error.message)
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#pipeline-results">Skip to deals</a>
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">p<span>·</span></span>pipeline<span className="workspace-divider" /><span className="workspace-name">Sales workspace</span></div>
        <div className="workspace-meta"><span className="status-dot" /> Demo workspace <span className="team-count">20 teammates</span><span className="avatar avatar-purple" aria-label="Alex Morgan">AM</span></div>
      </header>
      <main>
        <div className="page-heading">
          <div><p className="eyebrow">WORKSPACE / OPPORTUNITIES</p><h1>Sales pipeline<span className="heading-dot">.</span></h1><p className="page-description">Every opportunity. One clear view.</p></div>
          <span className="dataset-label"><span className="status-dot" /> Sample dataset</span>
        </div>
        <section className="overview" aria-label="Pipeline overview">
          <div className="metric"><span className="metric-label">Total opportunities</span><strong>{isPending ? '—' : number.format(deals.length)}</strong><span className="metric-caption">Across all seven stages</span></div>
          <div className="metric"><span className="metric-label">Open pipeline</span><strong>{isPending ? '—' : compactMoney.format(summary.openValue / 100)}</strong><span className="metric-caption">New leads through negotiation</span></div>
          <div className="metric"><span className="metric-label">Closed won</span><strong className="positive">{isPending ? '—' : compactMoney.format(summary.wonValue / 100)}</strong><span className="metric-caption">{number.format(summary.counts.won)} opportunities won</span></div>
          <div className="metric"><span className="metric-label">Needs attention</span><strong>{isPending ? '—' : number.format(summary.inactive)}</strong><span className="metric-caption"><span className="attention-dot" /> Open deals inactive for 14+ days</span></div>
        </section>
        <NetworkSimulator />
        <TeammateSimulator activity={saves} disabled={isPending || isError} />
        <section className="pipeline-panel" aria-label="Opportunities">
          <div className="panel-heading"><div><h2>Opportunities <span className="count-badge">{number.format(deals.length)}</span></h2><p>Find the right deal and keep it moving.</p></div><span className="view-label"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 8h14M3 12h14M8 4v12" /></svg> Table view</span></div>
          <div className="stage-tabs" role="group" aria-label="Filter by stage">
            <button type="button" className={`stage-tab ${!filters.stageId ? 'active' : ''}`} aria-pressed={!filters.stageId} onClick={() => setFilter('stageId', '')}>All deals <span>{number.format(deals.length)}</span></button>
            {STAGES.map((stage) => <button type="button" key={stage.id} className={`stage-tab ${filters.stageId === stage.id ? 'active' : ''}`} aria-pressed={filters.stageId === stage.id} onClick={() => setFilter('stageId', stage.id)}><span className={`stage-dot dot-${stage.color}`} />{stage.label}<span>{number.format(summary.counts[stage.id])}</span></button>)}
          </div>
          <div className="filter-bar">
            <label className="search-box"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg><span className="sr-only">Search deals by name, company, or ID</span><input type="search" placeholder="Search deals, companies, or IDs…" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} /></label>
            <label className="filter-control"><span className="sr-only">Filter by owner</span><select value={filters.ownerId} onChange={(event) => setFilter('ownerId', event.target.value)}><option value="">All owners</option>{OWNERS.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
            <label className="filter-control"><span className="sr-only">Filter by inactivity</span><select value={filters.inactivity} onChange={(event) => setFilter('inactivity', event.target.value)}><option value="">Any activity</option><option value="7">Inactive 7+ days</option><option value="14">Inactive 14+ days</option><option value="30">Inactive 30+ days</option></select></label>
            <label className="filter-control sort-control"><span>Sort:</span><select aria-label="Sort deals" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="recent">Recent activity</option><option value="value-desc">Highest value</option><option value="value-asc">Lowest value</option><option value="company">Company A–Z</option></select></label>
          </div>
          <div className="results-bar"><p role="status" aria-live="polite">{isPending ? 'Preparing sample deals…' : `${number.format(matching.length)} ${hasFilters ? 'matching ' : ''}opportunities`}<span className="result-divider">·</span>{compactMoney.format(filteredValue / 100)} total value {filters.search !== deferredSearch && <span> · Searching…</span>}</p>{hasFilters && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
          <div className="teammate-view-status">
            <p role="status" aria-live="polite">{hasUpdates ? 'Teammate changes applied. Row order and filter membership stay fixed until you refresh the view.' : 'Live teammate updates preserve your current view.'}</p>
            <button type="button" className="text-button" disabled={!hasUpdates} onClick={() => setRefreshKey((previous) => previous + 1)}>Refresh view</button>
          </div>
          {!isPending && !isError && <SavePanel saves={saves} onRetry={retryFailed} onDiscard={discardFailed} onSaveMine={saveMyStages} onKeepCurrent={keepCurrentStages} />}
          {!isPending && !isError && <BulkActions
            selectedCount={selectedIds.size}
            pageSelectedCount={selectedStats.pageCount}
            hiddenCount={selectedStats.hiddenCount}
            matchingCount={matching.length}
            matchingSelectedCount={selectedStats.matchingCount}
            isSearching={filters.search !== deferredSearch}
            stageId={bulkStage}
            onStageChange={setBulkStage}
            onSelectMatching={() => selectDeals(matching.map((deal) => deal.id), true)}
            onClear={clearSelection}
            onMove={handleBulkMove}
            error={bulkError}
            result={bulkResult}
          />}
          {isPending ? <div className="empty-state" role="status"><span className="loading-spinner" /><h3>Preparing your pipeline</h3><p>Loading 50,000 sample opportunities.</p></div> : isError ? <div className="empty-state" role="alert"><h3>Couldn’t load opportunities</h3><p>Try loading the sample dataset again.</p><button type="button" className="primary-button" onClick={() => refetch()}>Try again</button></div> : <>
            <PipelineTable
              deals={page.deals}
              totalCount={matching.length}
              rowOffset={page.offset}
              now={now}
              viewKey={`${viewKey}|${page.pageIndex}|${pageSize}|${refreshKey}`}
              selectedIds={selectedIds}
              saveStates={saves.states}
              teammateUpdates={saves.updates}
              onSaveMine={(id) => saveMyStages([id])}
              onKeepCurrent={(id) => keepCurrentStages([id])}
              onRetrySave={(id) => retryFailed([id])}
              onDiscardSave={(id) => discardFailed([id])}
              pageSelectedCount={selectedStats.pageCount}
              onToggleDeal={toggleDeal}
              onTogglePage={(checked) => selectDeals(page.deals.map((deal) => deal.id), checked)}
              onStageChange={handleStageChange}
              onClearFilters={clearFilters}
            />
            <Pagination page={page} pageSize={pageSize} onPageChange={setPageIndex} onPageSizeChange={changePageSize} />
          </>}
          <div className="panel-footer"><span><span className="status-dot" /> Simulated saves · data resets on refresh</span><span>Amounts in USD</span></div>
        </section>
        <footer className="page-footer"><span>Built for a clearer pipeline.</span><span>50,000 deals. Just the rows you need.</span></footer>
      </main>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </div>
  )
}

export default App
