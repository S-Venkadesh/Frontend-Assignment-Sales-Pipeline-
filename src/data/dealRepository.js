import { createDeals, updateStage } from './deals.js'

// Session-only data source. Network latency, failures, and conflicts come next.
let deals

export async function getDeals() {
  deals ??= createDeals()
  return deals
}

export function changeDealStage(dealId, stageId) {
  if (!deals) throw new Error('Load deals before editing')
  deals = updateStage(deals, dealId, stageId)
  return deals
}
