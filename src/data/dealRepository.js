import { createDeals, STAGES } from './deals.js'

export const DEFAULT_NETWORK = { minDelay: 300, maxDelay: 1500, failureRate: 0.1 }

export function createDealRepository({ initialDeals, random = Math.random, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now } = {}) {
  let records
  let settings = { ...DEFAULT_NETWORK }
  const latestOperations = new Map()

  function ensureData() {
    records ??= new Map((initialDeals ?? createDeals()).map((deal) => [deal.id, deal]))
  }

  function configureNetwork(next) {
    if (!Number.isInteger(next.minDelay) || !Number.isInteger(next.maxDelay) || next.minDelay < 0 || next.maxDelay > 10000 || next.minDelay > next.maxDelay) {
      throw new Error('Delay must be between 0 and 10,000 ms, with minimum no greater than maximum.')
    }
    if (!Number.isFinite(next.failureRate) || next.failureRate < 0 || next.failureRate > 1) throw new Error('Failure rate must be between 0% and 100%.')
    settings = { ...next }
    return { ...settings }
  }

  async function getDeals() {
    ensureData()
    return [...records.values()]
  }

  async function saveStages(operation) {
    ensureData()
    if (!Number.isSafeInteger(operation.operationId) || operation.operationId <= 0) throw new Error('Invalid save operation')
    for (const item of operation.items) {
      if (!records.has(item.id)) throw new Error('Deal not found')
      if (!STAGES.some((stage) => stage.id === item.stageId)) throw new Error('Unknown stage')
    }
    // Each request captures its settings. Changing controls affects later requests.
    const network = { ...settings }
    const delay = network.minDelay + Math.floor(random() * (network.maxDelay - network.minDelay + 1))
    for (const item of operation.items) {
      latestOperations.set(item.id, Math.max(operation.operationId, latestOperations.get(item.id) ?? 0))
    }
    await wait(delay)
    const results = operation.items.map((item) => {
      const current = records.get(item.id)
      // A newer request from this client fences an older delayed write, even if
      // the newer request fails. Version checks will also detect outside changes.
      if (operation.operationId < latestOperations.get(item.id)) {
        return { id: item.id, ok: false, kind: 'superseded', deal: current, error: 'A newer move replaced this request.' }
      }
      if (random() < network.failureRate) {
        return { id: item.id, ok: false, kind: 'network', deal: current, error: 'Simulated network failure. Retry or discard this move.' }
      }
      if (item.expectedVersion !== current.version) {
        return { id: item.id, ok: false, kind: 'conflict', deal: current, error: 'This deal changed while saving. Retry your move or discard it.' }
      }
      const timestamp = new Date(now()).toISOString()
      const saved = { ...current, stageId: item.stageId, version: current.version + 1, updatedAt: timestamp, lastActivityAt: timestamp }
      records.set(item.id, saved)
      return { id: item.id, ok: true, deal: saved }
    })
    return { results, delay }
  }

  return { getDeals, saveStages, configureNetwork }
}

export const dealRepository = createDealRepository()
