import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { OWNERS, STAGES, daysSince } from '../data/deals.js'
import { SelectionCheckbox } from './SelectionCheckbox.jsx'

const ownerById = Object.fromEntries(OWNERS.map((owner) => [owner.id, owner]))
const stageById = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]))
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
const ROW_HEIGHT = 76
const HEADER_HEIGHT = 44

export function PipelineTable({ deals, totalCount, rowOffset, now, viewKey, selectedIds, saveStates, onRetrySave, onDiscardSave, pageSelectedCount, onToggleDeal, onTogglePage, onStageChange, onClearFilters }) {
  const scrollRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: deals.length, getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT, getItemKey: (index) => deals[index].id,
    scrollMargin: HEADER_HEIGHT, overscan: 8,
  })
  // Reset only for explicit view changes. Editing a deal preserves scroll.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [viewKey])

  const rows = virtualizer.getVirtualItems()
  const topPadding = rows.length ? Math.max(0, rows[0].start - HEADER_HEIGHT) : 0
  const bottomPadding = rows.length ? Math.max(0, virtualizer.getTotalSize() - (rows.at(-1).end - HEADER_HEIGHT)) : 0

  if (!deals.length) return <div className="empty-state" id="pipeline-results" tabIndex={-1}><span className="empty-icon" aria-hidden="true">⌕</span><h3>No opportunities found</h3><p>Try a different search or broaden your filters.</p><button type="button" className="primary-button" onClick={onClearFilters}>Clear filters</button></div>

  return (
    <div className="table-scroll" ref={scrollRef} id="pipeline-results" tabIndex={0} role="region" aria-label="Deal table, scroll to see more opportunities">
      <table className="deals-table" aria-label="Sales opportunities" aria-rowcount={totalCount + 1}>
        <colgroup><col className="selection-col" /><col className="deal-col" /><col className="value-col" /><col className="stage-col" /><col className="owner-col" /><col className="activity-col" /></colgroup>
        <thead><tr aria-rowindex={1}>
          <th scope="col" className="selection-cell"><SelectionCheckbox
            label={`Select all ${deals.length} deals on this page`}
            checked={pageSelectedCount === deals.length}
            indeterminate={pageSelectedCount > 0 && pageSelectedCount < deals.length}
            onChange={(event) => onTogglePage(event.target.checked)}
          /></th>
          <th scope="col">Deal / company</th><th scope="col">Deal value</th><th scope="col">Stage</th><th scope="col">Owner</th><th scope="col">Last activity</th>
        </tr></thead>
        <tbody>
          {topPadding > 0 && <tr aria-hidden="true"><td colSpan={6} style={{ height: topPadding, padding: 0, border: 0 }} /></tr>}
          {rows.map((row) => {
            const deal = deals[row.index]
            const owner = ownerById[deal.ownerId]
            const stage = stageById[deal.stageId]
            const save = saveStates.get(deal.id)
            const days = daysSince(deal.lastActivityAt, now)
            return (
              <tr key={deal.id} aria-rowindex={rowOffset + row.index + 2} className={selectedIds.has(deal.id) ? 'selected-row' : ''}>
                <td className="selection-cell"><SelectionCheckbox label={`Select ${deal.id}, ${deal.company}, ${deal.name}`} checked={selectedIds.has(deal.id)} onChange={() => onToggleDeal(deal.id)} /></td>
                <td><div className="deal-identity"><span className={`company-avatar avatar-${owner.color}`} aria-hidden="true">{deal.company.slice(0, 2).toUpperCase()}</span><div className="deal-text"><span className="deal-name" title={deal.name}>{deal.name}</span><span className="deal-company" title={`${deal.company} · ${deal.id}`}>{deal.company}<span> · {deal.id}</span></span></div></div></td>
                <td><span className="deal-value">{money.format(deal.valueCents / 100)}</span></td>
                <td><div className="stage-cell">
                  <select className={`stage-select stage-${stage.color}`} value={deal.stageId} aria-label={`Stage for ${deal.id}, ${deal.company}, ${deal.name}`} onChange={(event) => onStageChange(deal, event.target.value)}>{STAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                  {save && <span className={`row-save-status save-${save.status}`} title={save.error || undefined}>
                    {save.status === 'saving' ? 'Saving…' : save.status === 'saved' ? 'Saved' : 'Unsaved'}
                    {save.status === 'failed' && <>
                      <button type="button" onClick={() => onRetrySave(deal.id)} aria-label={`Retry save for ${deal.id}`}>Retry</button>
                      <button type="button" onClick={() => onDiscardSave(deal.id)} aria-label={`Discard unsaved move for ${deal.id}`}>Discard</button>
                    </>}
                  </span>}
                </div></td>
                <td><span className="owner-cell"><span className={`avatar avatar-${owner.color}`} aria-hidden="true">{owner.initials}</span><span>{owner.name}</span></span></td>
                <td><time className={`activity ${days >= 14 && !['won', 'lost'].includes(deal.stageId) ? 'inactive' : ''}`} dateTime={deal.lastActivityAt} title={date.format(new Date(deal.lastActivityAt))}><span className="activity-dot" />{days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`}</time></td>
              </tr>
            )
          })}
          {bottomPadding > 0 && <tr aria-hidden="true"><td colSpan={6} style={{ height: bottomPadding, padding: 0, border: 0 }} /></tr>}
        </tbody>
      </table>
    </div>
  )
}
