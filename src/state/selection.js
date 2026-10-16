// Store explicit IDs: changing filters must never silently add/remove selections.
export function selectionReducer(selectedIds, action) {
  switch (action.type) {
    case 'toggle': {
      const next = new Set(selectedIds)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return next
    }
    case 'set-many': {
      const next = new Set(selectedIds)
      for (const id of action.ids) {
        if (action.checked) next.add(id)
        else next.delete(id)
      }
      return next
    }
    case 'clear':
      return new Set()
    default:
      return selectedIds
  }
}
