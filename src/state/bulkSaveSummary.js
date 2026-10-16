export function summarizeBulkSave(batch, states) {
  const result = { saving: 0, saved: 0, failed: 0, conflicts: 0, changed: 0, failedIds: [] }
  if (!batch) return result
  for (const id of batch.ids) {
    const state = states.get(id)
    if (!state || state.stageId !== batch.stageId) result.changed++
    else if (state.status === 'saving') result.saving++
    else if (state.status === 'saved') result.saved++
    else if (state.status === 'conflict') result.conflicts++
    else if (state.status === 'failed') {
      result.failed++
      result.failedIds.push(id)
    }
  }
  return result
}
