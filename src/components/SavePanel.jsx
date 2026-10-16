import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { STAGES } from '../data/deals.js'

const number = new Intl.NumberFormat('en-US')
const stageNames = Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label]))

function FailedDeals({ failures, onRetry, onDiscard }) {
  const scrollRef = useRef(null)
  const virtualizer = useVirtualizer({ count: failures.length, getScrollElement: () => scrollRef.current, estimateSize: () => 110, getItemKey: (index) => failures[index].id, overscan: 3 })
  return (
    <div className="failed-list" ref={scrollRef} tabIndex={0} role="region" aria-label="Failed saves, scroll to review all deals">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const failure = failures[row.index]
          return <div className="failed-deal" key={failure.id} style={{ height: row.size, transform: `translateY(${row.start}px)` }}>
            <div className="failed-deal-description">
              <strong>{failure.id} · {failure.company}</strong>
              <span>{failure.name} · Unsaved move to {stageNames[failure.stageId]}</span>
              <span className="failed-reason" title={failure.error}>Confirmed: {stageNames[failure.confirmedStageId]}. {failure.error}</span>
            </div>
            <div className="failed-deal-actions">
              <button type="button" className="text-button" onClick={() => onRetry([failure.id])} aria-label={`Retry save for ${failure.id}`}>Retry</button>
              <button type="button" className="text-button" onClick={() => onDiscard([failure.id])} aria-label={`Discard unsaved move for ${failure.id}`}>Discard</button>
            </div>
          </div>
        })}
      </div>
    </div>
  )
}

export function SavePanel({ saves, onRetry, onDiscard }) {
  const [expanded, setExpanded] = useState(false)
  const failures = useMemo(() => [...saves.states.values()].filter((state) => state.status === 'failed'), [saves.states])
  if (!saves.states.size) return null
  const failedIds = failures.map((failure) => failure.id)
  return (
    <section className="save-panel" aria-label="Save activity">
      <div className="save-panel-heading">
        <p className="save-totals" role="status" aria-live="polite">
          <strong>{saves.savingCount ? `${number.format(saves.savingCount)} saving…` : 'Saves complete'}</strong>
          <span>{number.format(saves.savedCount)} saved</span>
          <span className={saves.failedCount ? 'save-failed-count' : ''}>{number.format(saves.failedCount)} failed</span>
        </p>
        {saves.failedCount > 0 && <div className="save-panel-actions">
          <button type="button" className="text-button" aria-expanded={expanded} aria-controls="failed-save-details" onClick={() => setExpanded((previous) => !previous)}>{expanded ? 'Hide failed deals' : `Review ${number.format(saves.failedCount)} failed deals`}</button>
          <button type="button" className="text-button" onClick={() => onRetry(failedIds)}>Retry {number.format(saves.failedCount)} failed</button>
          <button type="button" className="text-button" onClick={() => onDiscard(failedIds)}>Discard {number.format(saves.failedCount)} failed</button>
        </div>}
      </div>
      <p className="save-panel-caption">Latest save status per deal this session. Failed moves remain visible as unsaved; discard restores confirmed stages.</p>
      {expanded && failures.length > 0 && <div id="failed-save-details"><FailedDeals failures={failures} onRetry={onRetry} onDiscard={onDiscard} /></div>}
    </section>
  )
}
