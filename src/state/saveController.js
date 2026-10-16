import { OWNERS, STAGES } from '../data/deals.js'

const EMPTY_SNAPSHOT = { states: new Map(), savingCount: 0, failedCount: 0, savedCount: 0, conflictCount: 0, viewRevision: 0, teamRevision: 0, teamCount: 0, activities: [], updates: new Map() }

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
    this.indices = new Map()
    this.viewRevision = 0
    this.teamRevision = 0
    this.teamCount = 0
    this.activities = []
    this.updates = new Map()
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initialize(deals) {
    for (const deal of deals) {
      const current = this.confirmed.get(deal.id)
      if (!current || deal.version > current.version) this.confirmed.set(deal.id, deal)
    }
    this.indices = new Map([...this.confirmed.keys()].map((id, index) => [id, index]))
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
      if (confirmed.stageId === stageId && !['saving', 'failed', 'conflict'].includes(previous?.status)) {
        unchangedIds.push(id)
        continue
      }
      items.push({ id, stageId, expectedVersion: confirmed.version })
      this.states.set(id, { id, operationId, stageId, startedAt, status: 'saving', error: '', baseVersion: confirmed.version })
    }
    this.publish(ids)
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
      // An event can arrive before the response to an already committed local
      // write. Preserve its conflict and the newer teammate version.
      if (state.status === 'conflict') continue
      if (result.kind === 'conflict' || (result.ok && result.deal.version < this.confirmed.get(item.id).version)) {
        this.states.set(item.id, { ...state, status: 'conflict', kind: 'conflict', error: 'This deal changed while saving. Choose which stage to keep.' })
        continue
      }
      this.states.set(item.id, {
        ...state, status: result.ok ? 'saved' : 'failed',
        error: result.ok ? '' : result.error || 'Save failed. Retry this move.',
        kind: result.kind,
      })
    }
    this.publish(operation.items.map((item) => item.id), false)
  }

  fail(operation, error) {
    this.settle(operation, operation.items.map((item) => ({ id: item.id, ok: false, kind: 'network', error: error.message || 'Save failed. Retry this move.' })))
  }

  retryItems(ids, status = 'failed') {
    const requested = new Set(ids)
    return [...this.states.values()]
      .filter((state) => state.status === status && requested.has(state.id))
      .map((state) => ({ id: state.id, stageId: state.stageId }))
  }

  discard(ids) {
    const requested = [...ids]
    for (const id of requested) if (['failed', 'conflict'].includes(this.states.get(id)?.status)) this.states.delete(id)
    this.publish(requested)
  }

  receiveUpdates(events) {
    const changed = new Set()
    for (const event of events) {
      const incoming = event.deal
      const current = this.confirmed.get(incoming?.id)
      if (!current || !Number.isSafeInteger(incoming.version) || incoming.version <= current.version || !STAGES.some((stage) => stage.id === incoming.stageId)) continue
      this.confirmed.set(incoming.id, incoming)
      const actor = event.actor ?? OWNERS.find((owner) => owner.id === incoming.updatedBy)
      const update = { ...event, actor, deal: incoming }
      this.updates.set(incoming.id, update)
      this.activities = [update, ...this.activities].slice(0, 5)
      this.teamCount++
      const state = this.states.get(incoming.id)
      if (state && state.status !== 'saved') {
        this.states.set(incoming.id, { ...state, status: 'conflict', kind: 'conflict', error: `${actor?.name || 'A teammate'} changed this deal. Choose which stage to keep.` })
      } else if (state) this.states.delete(incoming.id)
      changed.add(incoming.id)
    }
    if (!changed.size) return
    this.teamRevision++
    this.publish(changed, false)
  }

  publish(changedIds, refreshView = true) {
    if (refreshView) this.viewRevision++
    const previous = this.deals
    const project = (confirmed, index) => {
      const state = this.states.get(confirmed.id)
      if (!state || state.status === 'saved') return confirmed
      const old = previous[index]
      if (old?.id === confirmed.id && old.stageId === state.stageId && old.version === confirmed.version && old.updatedAt === state.startedAt) return old
      return { ...confirmed, stageId: state.stageId, updatedAt: state.startedAt, lastActivityAt: state.startedAt }
    }
    if (!changedIds || !previous.length) {
      this.deals = [...this.confirmed.values()].map(project)
    } else {
      this.deals = previous.slice()
      for (const id of changedIds) {
        const index = this.indices.get(id)
        if (index !== undefined) this.deals[index] = project(this.confirmed.get(id), index)
      }
    }
    const states = new Map()
    let savingCount = 0
    let failedCount = 0
    let savedCount = 0
    let conflictCount = 0
    for (const [id, state] of this.states) {
      const confirmed = this.confirmed.get(id)
      const actor = OWNERS.find((owner) => owner.id === confirmed.updatedBy)
      states.set(id, { ...state, confirmedStageId: confirmed.stageId, confirmedVersion: confirmed.version, actorName: actor?.name || 'A teammate', company: confirmed.company, name: confirmed.name })
      if (state.status === 'saving') savingCount++
      else if (state.status === 'failed') failedCount++
      else if (state.status === 'conflict') conflictCount++
      else savedCount++
    }
    const updates = new Map([...this.updates].filter(([id, event]) => this.confirmed.get(id).updatedBy === event.actor?.id))
    this.snapshot = { states, savingCount, failedCount, savedCount, conflictCount, viewRevision: this.viewRevision, teamRevision: this.teamRevision, teamCount: this.teamCount, activities: this.activities, updates }
    this.onDealsChange(this.deals)
    for (const listener of this.listeners) listener()
  }
}
