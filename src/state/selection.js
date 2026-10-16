import { STAGES } from '../data/deals.js'

const EMPTY_SNAPSHOT = { states: new Map(), savingCount: 0, failedCount: 0, savedCount: 0 }

// Confirmed records never contain optimistic edits. The Query cache is a projection
// of these records plus the latest intent for each deal, rather than a list snapshot.
export class SaveController {
  constructor({ onDealsChange = () => {}, now = Date.now } = {}) {
    this.confirmed = new Map()
    this.states = new Map()
    this.listeners = new Set()
    this.sequence = 0
    this.onDealsChange = onDealsChange
    this.now = now
    this.snapshot = EMPTY_SNAPSHOT
    this.deals = []
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initialize(deals) {
    for (const deal of deals) {
      const current = this.confirmed.get(deal.id)
      if (!current || deal.version >= current.version) this.confirmed.set(deal.id, deal)
    }
    this.publish()
    return this.deals
  }

  begin(dealIds, stageId) {
    if (!STAGES.some((stage) => stage.id === stageId)) throw new Error('Unknown stage')
    const ids = [...new Set(dealIds)]
    for (const id of ids) if (!this.confirmed.has(id)) throw new Error('Deal not found')
    const operationId = ++this.sequence
    const startedAt = new Date(this.now()).toISOString()
    const items = []
    const unchangedIds = []
    for (const id of ids) {
      const confirmed = this.confirmed.get(id)
      const previous = this.states.get(id)
      if (confirmed.stageId === stageId && !['saving', 'failed'].includes(previous?.status)) {
        unchangedIds.push(id)
        continue
      }
      items.push({ id, stageId, expectedVersion: confirmed.version })
      this.states.set(id, { id, operationId, stageId, startedAt, status: 'saving', error: '' })
    }
    this.publish()
    return { operationId, items, unchangedIds }
  }

  settle(operation, results) {
    const byId = new Map(results.map((result) => [result.id, result]))
    for (const item of operation.items) {
      const result = byId.get(item.id) ?? { ok: false, error: 'No response received. Retry this move.', kind: 'network' }
      const confirmed = this.confirmed.get(item.id)
      if (result.deal && result.deal.version >= confirmed.version) this.confirmed.set(item.id, result.deal)
      const state = this.states.get(item.id)
      // A late response may advance confirmed data, but cannot replace newer intent.
      if (state?.operationId !== operation.operationId) continue
      this.states.set(item.id, {
        ...state, status: result.ok ? 'saved' : 'failed',
        error: result.ok ? '' : result.error || 'Save failed. Retry this move.',
        kind: result.kind,
      })
    }
    this.publish()
  }

  fail(operation, error) {
    this.settle(operation, operation.items.map((item) => ({ id: item.id, ok: false, kind: 'network', error: error.message || 'Save failed. Retry this move.' })))
  }

  retryItems(ids) {
    const requested = new Set(ids)
    return [...this.states.values()]
      .filter((state) => state.status === 'failed' && requested.has(state.id))
      .map((state) => ({ id: state.id, stageId: state.stageId }))
  }

  discard(ids) {
    for (const id of ids) if (this.states.get(id)?.status === 'failed') this.states.delete(id)
    this.publish()
  }

  publish() {
    const previous = this.deals
    this.deals = [...this.confirmed.values()].map((confirmed, index) => {
      const state = this.states.get(confirmed.id)
      if (!state || state.status === 'saved') return confirmed
      const old = previous[index]
      if (old?.id === confirmed.id && old.stageId === state.stageId && old.version === confirmed.version && old.updatedAt === state.startedAt) return old
      return { ...confirmed, stageId: state.stageId, updatedAt: state.startedAt, lastActivityAt: state.startedAt }
    })
    const states = new Map()
    let savingCount = 0
    let failedCount = 0
    let savedCount = 0
    for (const [id, state] of this.states) {
      const confirmed = this.confirmed.get(id)
      states.set(id, { ...state, confirmedStageId: confirmed.stageId, company: confirmed.company, name: confirmed.name })
      if (state.status === 'saving') savingCount++
      else if (state.status === 'failed') failedCount++
      else savedCount++
    }
    this.snapshot = { states, savingCount, failedCount, savedCount }
    this.onDealsChange(this.deals)
    for (const listener of this.listeners) listener()
  }
}
