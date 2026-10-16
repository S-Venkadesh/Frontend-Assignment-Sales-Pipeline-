import { filterDeals } from './deals.js'

// Row membership/order is a user-controlled snapshot, while each record stays live.
// A teammate stage/activity change must not move a focused row or clear selection.
export function capturePipelineView(deals, filters, now, teamRevision) {
  return { ids: filterDeals(deals, filters, now).map((deal) => deal.id), teamRevision }
}

export function projectPipelineView(view, byId) {
  return view.ids.map((id) => byId.get(id)).filter(Boolean)
}
