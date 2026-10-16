import { createDeals, OWNERS, STAGES } from './deals.js'

export const DEFAULT_NETWORK = { minDelay: 300, maxDelay: 1500, failureRate: 0.1 }

export function createDealRepository({ initialDeals, random = Math.random, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now } = {}) {
  let records
  let settings = { ...DEFAULT_NETWORK }
  const latestOperations = new Map()
  const teammateListeners = new Set()
  let recordIds
  let teammateSequence = 0

  function ensureData() {
    records ??= new Map((initialDeals ?? createDeals()).map((deal) => [deal.id, deal]))
    recordIds ??= [...records.keys()]
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
      if (item.expectedVersion !== current.version) {
        return { id: item.id, ok: false, kind: 'conflict', deal: current, error: 'This deal changed while saving. Compare the stages before resolving it.' }
      }
      if (random() < network.failureRate) {
        return { id: item.id, ok: false, kind: 'network', deal: current, error: 'Simulated network failure. Retry or discard this move.' }
      }
      const timestamp = new Date(now()).toISOString()
      const saved = { ...current, stageId: item.stageId, version: current.version + 1, updatedAt: timestamp, lastActivityAt: timestamp, updatedBy: 'you' }
      records.set(item.id, saved)
      return { id: item.id, ok: true, deal: saved }
    })
    return { results, delay }
  }

  function subscribeTeammateUpdates(listener) {
    teammateListeners.add(listener)
    return () => teammateListeners.delete(listener)
  }

  function simulateTeammateUpdate({ dealId, stageId, ownerId } = {}) {
    ensureData()
    const id = dealId || recordIds[Math.floor(random() * recordIds.length)]
    const current = records.get(id)
    if (!current) throw new Error('Deal not found. Enter a deal ID such as D-00001.')
    const actor = ownerId ? OWNERS.find((owner) => owner.id === ownerId) : OWNERS[1 + Math.floor(random() * (OWNERS.length - 1))]
    if (!actor) throw new Error('Unknown teammate')
    const alternatives = STAGES.filter((stage) => stage.id !== current.stageId)
    const nextStage = stageId || alternatives[Math.floor(random() * alternatives.length)].id
    if (!STAGES.some((stage) => stage.id === nextStage)) throw new Error('Unknown stage')
    const timestamp = new Date(now()).toISOString()
    const deal = { ...current, stageId: nextStage, version: current.version + 1, updatedAt: timestamp, lastActivityAt: timestamp, updatedBy: actor.id }
    records.set(id, deal)
    const event = { eventId: ++teammateSequence, deal, actor, receivedAt: timestamp }
    for (const listener of teammateListeners) listener(event)
    return event
  }

  return { getDeals, saveStages, configureNetwork, subscribeTeammateUpdates, simulateTeammateUpdate }
}

export const dealRepository = createDealRepository()
