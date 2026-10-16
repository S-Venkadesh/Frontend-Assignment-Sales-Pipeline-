import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeals } from './deals.js'
import { capturePipelineView, projectPipelineView } from './pipelineView.js'

test('live record updates preserve row membership/order until an explicit view refresh', () => {
  const deals = createDeals({ count: 3 }).map((deal, index) => ({ ...deal, stageId: 'new-lead', lastActivityAt: `2026-10-0${index + 1}T00:00:00Z` }))
  const filters = { stageId: 'new-lead', sort: 'recent' }
  const view = capturePipelineView(deals, filters, Date.now(), 0)
  assert.deepEqual(view.ids, ['D-00003', 'D-00002', 'D-00001'])
  const updated = { ...deals[0], stageId: 'won', lastActivityAt: '2026-10-16T00:00:00Z', version: 2 }
  const byId = new Map(deals.map((deal) => [deal.id, deal]))
  byId.set(updated.id, updated)
  const projected = projectPipelineView(view, byId)
  assert.deepEqual(projected.map((deal) => deal.id), view.ids)
  assert.equal(projected[2], updated)
  assert.equal(projected[0], deals[2])
  const refreshed = capturePipelineView([...byId.values()], filters, Date.now(), 1)
  assert.deepEqual(refreshed.ids, ['D-00003', 'D-00002'])
  assert.equal(refreshed.teamRevision, 1)
})

test('refreshing activity order reorders only on explicit capture', () => {
  const deals = createDeals({ count: 2 }).map((deal, index) => ({ ...deal, lastActivityAt: `2026-10-0${index + 1}T00:00:00Z` }))
  const view = capturePipelineView(deals, { sort: 'recent' }, Date.now(), 0)
  const updated = [{ ...deals[0], lastActivityAt: '2026-10-16T00:00:00Z' }, deals[1]]
  assert.deepEqual(projectPipelineView(view, new Map(updated.map((deal) => [deal.id, deal]))).map((deal) => deal.id), ['D-00002', 'D-00001'])
  assert.deepEqual(capturePipelineView(updated, { sort: 'recent' }, Date.now(), 1).ids, ['D-00001', 'D-00002'])
})
