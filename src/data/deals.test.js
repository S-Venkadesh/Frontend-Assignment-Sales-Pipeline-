import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeals, daysSince, filterDeals, OWNERS, STAGES, updateStage, updateStages } from './deals.js'

const now = Date.parse('2026-10-16T12:00:00Z')
const deals = createDeals({ now })

test('50,000 unique deals have valid owners, stages, monetary values, and dates', () => {
  assert.equal(deals.length, 50000)
  assert.equal(new Set(deals.map((deal) => deal.id)).size, 50000)
  assert.equal(new Set(deals.map((deal) => deal.ownerId)).size, 20)
  for (const deal of deals) {
    assert.ok(OWNERS.some((owner) => owner.id === deal.ownerId))
    assert.ok(STAGES.some((stage) => stage.id === deal.stageId))
    assert.ok(Number.isSafeInteger(deal.valueCents) && deal.valueCents > 0)
    assert.ok(Number.isFinite(Date.parse(deal.lastActivityAt)))
    assert.equal(deal.version, 1)
  }
  for (const stage of STAGES) {
    assert.equal(deals.filter((deal) => deal.stageId === stage.id).length, stage.count)
  }
})

test('the same seed and reference date produce the same data', () => {
  assert.deepEqual(createDeals({ count: 10, now }), deals.slice(0, 10))
})

test('search combines terms across name, company, and ID and composes with filters', () => {
  const target = deals.find((deal) => daysSince(deal.lastActivityAt, now) >= 30)
  const search = `  ${target.company.toUpperCase()}   ${target.id}  `
  assert.deepEqual(filterDeals(deals, { search, ownerId: target.ownerId, stageId: target.stageId, inactivity: '30' }, now), [target])
  assert.deepEqual(filterDeals(deals, { search, ownerId: 'missing-owner' }, now), [])
  assert.deepEqual(filterDeals(deals, { search: 'no-such-company' }, now), [])
})

test('sorts value in both directions without mutating the source dataset', () => {
  const before = deals.map((deal) => deal.id)
  for (const sort of ['value-desc', 'value-asc']) {
    const sorted = filterDeals(deals, { sort }, now)
    for (let index = 1; index < sorted.length; index++) {
      assert.ok(sort === 'value-desc' ? sorted[index - 1].valueCents >= sorted[index].valueCents : sorted[index - 1].valueCents <= sorted[index].valueCents)
    }
  }
  assert.deepEqual(deals.map((deal) => deal.id), before)
})

test('a move updates only its deal and advances version and activity', () => {
  const target = deals[0]
  const updated = updateStage(deals, target.id, 'won', now)
  assert.equal(target.stageId, 'new-lead')
  assert.equal(updated[0].stageId, 'won')
  assert.equal(updated[0].version, 2)
  assert.equal(updated[0].updatedAt, new Date(now).toISOString())
  assert.equal(updated[0].lastActivityAt, updated[0].updatedAt)
  for (let index = 1; index < deals.length; index++) assert.equal(updated[index], deals[index])
  assert.equal(updateStage(updated, target.id, 'won', now), updated)
  assert.throws(() => updateStage(deals, target.id, 'unknown'), /Unknown stage/)
  assert.throws(() => updateStage(deals, 'missing', 'won'), /Deal not found/)
})

test('inactivity includes the threshold day and excludes newer activity', () => {
  const timestamp = (days) => new Date(now - days * 86400000).toISOString()
  const fixtures = [13, 14, 15].map((days, index) => ({ ...deals[index], lastActivityAt: timestamp(days) }))
  assert.deepEqual(filterDeals(fixtures, { inactivity: '14' }, now).map((deal) => deal.id), [fixtures[1].id, fixtures[2].id])
})

test('bulk moving 10,000 IDs updates every requested deal once and preserves all others', () => {
  const selected = deals.filter((deal) => deal.stageId === 'new-lead')
  const selectedIds = new Set(selected.map((deal) => deal.id))
  const result = updateStages(deals, selectedIds, 'won', now)
  assert.equal(result.changedIds.length, 10000)
  assert.equal(result.unchangedIds.length, 0)
  assert.equal(selectedIds.size, 10000)
  for (let index = 0; index < deals.length; index++) {
    if (selectedIds.has(deals[index].id)) {
      assert.equal(result.deals[index].stageId, 'won')
      assert.equal(result.deals[index].version, 2)
      assert.equal(result.deals[index].lastActivityAt, new Date(now).toISOString())
      assert.equal(deals[index].stageId, 'new-lead')
    } else assert.equal(result.deals[index], deals[index])
  }
})

test('bulk outcomes distinguish already-in-stage IDs and deduplicate requests', () => {
  const won = deals.find((deal) => deal.stageId === 'won')
  const lead = deals[0]
  const result = updateStages(deals, [won.id, lead.id, lead.id], 'won', now)
  assert.deepEqual(result.changedIds, [lead.id])
  assert.deepEqual(result.unchangedIds, [won.id])
  const wonIndex = deals.indexOf(won)
  assert.equal(result.deals[wonIndex], won)
  assert.equal(result.deals[wonIndex].version, 1)
  assert.equal(updateStages(deals, [won.id], 'won', now).deals, deals)
  assert.equal(updateStages(deals, [], 'won', now).deals, deals)
})

test('invalid bulk requests leave the original dataset unchanged', () => {
  const target = deals[0]
  assert.throws(() => updateStages(deals, [target.id, 'missing'], 'won', now), /Deal not found/)
  assert.throws(() => updateStages(deals, [target.id], 'invalid-stage', now), /Unknown stage/)
  assert.equal(target.stageId, 'new-lead')
  assert.equal(target.version, 1)
})
