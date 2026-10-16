import { STAGES } from '../data/deals.js'

const number = new Intl.NumberFormat('en-US')

export function BulkActions({ selectedCount, pageSelectedCount, hiddenCount, matchingCount, matchingSelectedCount, isSearching, stageId, onStageChange, onSelectMatching, onClear, onMove, error, result }) {
  return (
    <div className="bulk-section">
      <div className="bulk-toolbar" role="group" aria-label="Bulk deal actions">
        <div className="selection-summary" role="status" aria-live="polite">
          <strong>{number.format(selectedCount)} selected</strong>
          <span>{selectedCount ? `${number.format(pageSelectedCount)} on this page` : 'Select deals using the checkboxes below.'}</span>
          {hiddenCount > 0 && <span className="hidden-selection">{number.format(hiddenCount)} outside current filters</span>}
        </div>
        <div className="bulk-controls">
          <label className="filter-control">
            <span className="sr-only">Stage for selected deals</span>
            <select value={stageId} onChange={(event) => onStageChange(event.target.value)} disabled={!selectedCount}>
              <option value="">Move to stage…</option>
              {STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
          </label>
          <button type="button" className="primary-button bulk-move" disabled={!selectedCount || !stageId} onClick={onMove}>
            Move {number.format(selectedCount)} {selectedCount === 1 ? 'deal' : 'deals'}
          </button>
          <button type="button" className="text-button" disabled={!selectedCount} onClick={onClear}>Clear selection</button>
        </div>
      </div>
      <div className="selection-scope">
        <span>The header checkbox selects this page only.</span>
        <button type="button" className="text-button" disabled={!matchingCount || matchingSelectedCount === matchingCount || isSearching} onClick={onSelectMatching}>
          Select all {number.format(matchingCount)} matching deals
        </button>
        {hiddenCount > 0 && <span className="scope-warning">Moving applies to all selected deals, including those outside these filters.</span>}
      </div>
      {error && <p className="bulk-message bulk-error" role="alert">{error}</p>}
      {result && <p className="bulk-message" role="status">{result}</p>}
    </div>
  )
}
