import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { STAGES } from '../data/deals.js'
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard.js'
import { summarizeBulkSave } from '../state/bulkSaveSummary.js'

const number = new Intl.NumberFormat('en-US')
const stageNames = Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label]))

function FailedDeals({ failures, onRetry, onDiscard, conflicts = false }) {
  const scrollRef = useRef(null)
  const virtualizer = useVirtualizer({ count: failures.length, getScrollElement: () => scrollRef.current, estimateSize: () => 110, getItemKey: (index) => failures[index].id, overscan: 3 })
  const onKeyDown = useVirtualKeyboard(scrollRef, virtualizer, failures.length)
  return (
    <div className={`failed-list ${conflicts ? 'conflict-list' : ''}`} ref={scrollRef} tabIndex={0} role="region" aria-label={conflicts ? 'Conflicting edits, scroll to review all deals' : 'Failed saves, scroll to review all deals'} onKeyDown={onKeyDown}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const failure = failures[row.index]
          return <div className="failed-deal" key={failure.id} data-virtual-index={row.index} style={{ height: row.size, transform: `translateY(${row.start}px)` }}>
            <div className="failed-deal-description">
              <strong>{failure.id} · {failure.company}</strong>
              <span>{conflicts ? `Your stage: ${stageNames[failure.stageId]} · Current stage: ${stageNames[failure.confirmedStageId]}` : `${failure.name} · Unsaved move to ${stageNames[failure.stageId]}`}</span>
              <span className="failed-reason" title={failure.error}>{conflicts ? failure.error : `Confirmed: ${stageNames[failure.confirmedStageId]}. ${failure.error}`}</span>
            </div>
            <div className="failed-deal-actions">
              <button type="button" className="text-button" onClick={() => onRetry([failure.id])} aria-label={conflicts ? `Save my stage for ${failure.id}` : `Retry save for ${failure.id}`}>{conflicts ? 'Save my stage' : 'Retry'}</button>
              <button type="button" className="text-button" onClick={() => onDiscard([failure.id])} aria-label={conflicts ? `Keep current stage for ${failure.id}` : `Discard unsaved move for ${failure.id}`}>{conflicts ? 'Keep current stage' : 'Discard'}</button>
            </div>
          </div>
        })}
      </div>
    </div>
  )
}

export function SavePanel({ saves, bulkMove, onRetry, onDiscard, onSaveMine, onKeepCurrent }) {
  const [expanded, setExpanded] = useState(false)
  const [reviewScope, setReviewScope] = useState('all')
  const [conflictsExpanded, setConflictsExpanded] = useState(false)
  const failures = useMemo(() => [...saves.states.values()].filter((state) => state.status === 'failed'), [saves.states])
  const conflicts = useMemo(() => [...saves.states.values()].filter((state) => state.status === 'conflict'), [saves.states])
  const bulkSummary = useMemo(() => summarizeBulkSave(bulkMove, saves.states), [bulkMove, saves.states])
  const visibleFailures = useMemo(() => {
    if (reviewScope !== 'bulk' || !bulkMove) return failures
    const ids = new Set(bulkMove.ids)
    return failures.filter((failure) => ids.has(failure.id) && failure.stageId === bulkMove.stageId)
  }, [failures, reviewScope, bulkMove])
  if (!saves.states.size) return null
  const failedIds = failures.map((failure) => failure.id)
  const conflictIds = conflicts.map((conflict) => conflict.id)
  return (
    <section className="save-panel" aria-label="Save activity" tabIndex={-1}>
      <div className="save-panel-heading">
        <p className="save-totals" role="status" aria-live="polite">
          <strong>{saves.savingCount ? `${number.format(saves.savingCount)} saving…` : saves.failedCount || saves.conflictCount ? 'Needs attention' : 'Saves complete'}</strong>
          <span>{number.format(saves.savedCount)} saved</span>
          <span className={saves.failedCount ? 'save-failed-count' : ''}>{number.format(saves.failedCount)} failed</span>
          <span className={saves.conflictCount ? 'save-conflict-count' : ''}>{number.format(saves.conflictCount)} conflicts</span>
        </p>
        {saves.failedCount > 0 && <div className="save-panel-actions">
          <button type="button" className="text-button" aria-expanded={expanded && reviewScope === 'all'} aria-controls="failed-save-details" onClick={() => { setExpanded(!expanded || reviewScope !== 'all'); setReviewScope('all') }}>{expanded && reviewScope === 'all' ? 'Hide failed deals' : `Review ${number.format(saves.failedCount)} failed deals`}</button>
          <button type="button" className="text-button" onClick={() => onRetry(failedIds)}>Retry {number.format(saves.failedCount)} failed</button>
          <button type="button" className="text-button" onClick={() => onDiscard(failedIds)}>Discard {number.format(saves.failedCount)} failed</button>
        </div>}
      </div>
      <p className="save-panel-caption">Latest save status per deal this session. Failed moves remain visible as unsaved; discard restores confirmed stages.</p>
      {bulkMove && <div className="bulk-save-summary" aria-label="Latest bulk save results">
        <p><strong>Latest bulk: {number.format(bulkMove.ids.length)} deals → {stageNames[bulkMove.stageId]}</strong>{bulkMove.unchangedCount > 0 && <span> · {number.format(bulkMove.unchangedCount)} already in this stage; skipped</span>}</p>
        <p className="bulk-save-counts" role="status">{number.format(bulkSummary.saved)} saved · {number.format(bulkSummary.failed)} failed · {number.format(bulkSummary.saving)} saving · {number.format(bulkSummary.conflicts)} conflicts{bulkSummary.changed > 0 && ` · ${number.format(bulkSummary.changed)} discarded or changed since`}</p>
        {bulkSummary.failed > 0 && <div className="save-panel-actions">
          <button type="button" className="text-button" aria-expanded={expanded && reviewScope === 'bulk'} aria-controls="failed-save-details" onClick={() => { setExpanded(true); setReviewScope('bulk') }}>Review {number.format(bulkSummary.failed)} bulk failures</button>
          <button type="button" className="text-button" onClick={() => onRetry(bulkSummary.failedIds)}>Retry {number.format(bulkSummary.failed)} bulk failures</button>
        </div>}
      </div>}
      {expanded && visibleFailures.length > 0 && <div id="failed-save-details"><p className="save-panel-caption">{reviewScope === 'bulk' ? 'Failures from the latest bulk move only.' : 'All current failures in this session.'}</p><FailedDeals failures={visibleFailures} onRetry={onRetry} onDiscard={onDiscard} /></div>}
      {conflicts.length > 0 && <div className="conflict-actions">
        <p>Concurrent edits need your choice. Saving your stage can conflict again if a teammate makes another change.</p>
        <div className="save-panel-actions">
          <button type="button" className="text-button" aria-expanded={conflictsExpanded} aria-controls="conflict-details" onClick={() => setConflictsExpanded((previous) => !previous)}>{conflictsExpanded ? 'Hide conflicts' : `Review ${number.format(conflicts.length)} conflicts`}</button>
          <button type="button" className="text-button" onClick={() => onSaveMine(conflictIds)}>Save my stages for {number.format(conflicts.length)} conflicts</button>
          <button type="button" className="text-button" onClick={() => onKeepCurrent(conflictIds)}>Keep current stages for {number.format(conflicts.length)} conflicts</button>
        </div>
        {conflictsExpanded && <div id="conflict-details"><FailedDeals failures={conflicts} onRetry={onSaveMine} onDiscard={onKeepCurrent} conflicts /></div>}
      </div>}
    </section>
  )
}
