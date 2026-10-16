import { createDeals, updateStage, updateStages } from './deals.js'

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

export function changeDealStages(dealIds, stageId) {
  if (!deals) throw new Error('Load deals before editing')
  const result = updateStages(deals, dealIds, stageId)
  deals = result.deals
  return result
}
