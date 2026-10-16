import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeals, OWNERS } from '../data/deals.js'
import { createDealRepository, DEFAULT_NETWORK } from '../data/dealRepository.js'
import { SaveController } from './saveController.js'

const now = Date.parse('2026-10-16T12:00:00Z')

async function setup({ count = 3, wait = async () => {} } = {}) {
  const initialDeals = createDeals({ count, now: now - 86400000 }).map((deal) => ({ ...deal, stageId: 'new-lead' }))
  const repository = createDealRepository({ initialDeals, random: () => 0.5, wait, now: () => now })
  const controller = new SaveController({ now: () => now })
  controller.initialize(await repository.getDeals())
  repository.subscribeTeammateUpdates((event) => controller.receiveUpdates([event]))
  return { controller, repository }
}

function event(deal, version, stageId = 'contacted') {
  return { eventId: version, deal: { ...deal, version, stageId, updatedBy: 'owner-2', updatedAt: new Date(now).toISOString() }, actor: OWNERS[1] }
}

test('teammate events patch only their ID and preserve untouched record identities and view ordering revision', async () => {
  const { controller, repository } = await setup({ count: 50000 })
  const before = controller.deals
  const revision = controller.getSnapshot().viewRevision
  repository.simulateTeammateUpdate({ dealId: 'D-20000', stageId: 'won', ownerId: 'owner-2' })
  assert.equal(controller.deals[19999].stageId, 'won')
  assert.equal(controller.deals[19999].version, 2)
  for (let index = 0; index < before.length; index++) if (index !== 19999) assert.equal(controller.deals[index], before[index])
  assert.equal(controller.getSnapshot().viewRevision, revision)
  assert.equal(controller.getSnapshot().teamRevision, 1)
  assert.equal(controller.getSnapshot().teamCount, 1)
})

test('duplicate, older, unknown-ID and malformed events do not roll back data or publish new state', async () => {
  const { controller } = await setup()
  const deal = controller.deals[0]
  controller.receiveUpdates([event(deal, 4, 'won')])
  const snapshot = controller.getSnapshot()
  const projection = controller.deals
  controller.receiveUpdates([event(deal, 3, 'lost'), event(deal, 4, 'lost'), event({ ...deal, id: 'missing' }, 5), event(deal, 1.5), event(deal, 5, 'invalid')])
  assert.equal(controller.deals, projection)
  assert.equal(controller.getSnapshot(), snapshot)
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.deals[0].version, 4)
})

test('a teammate change during saving becomes an explicit conflict; the old save cannot overwrite it', async () => {
  let release
  const { controller, repository } = await setup({ wait: () => new Promise((resolve) => { release = resolve }) })
  const operation = controller.begin(['D-00001'], 'won')
  const pending = repository.saveStages(operation)
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted', ownerId: 'owner-2' })
  assert.equal(controller.getSnapshot().conflictCount, 1)
  assert.equal(controller.getSnapshot().savingCount, 0)
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.getSnapshot().states.get('D-00001').confirmedStageId, 'contacted')
  release()
  const response = await pending
  assert.equal(response.results[0].kind, 'conflict')
  controller.settle(operation, response.results)
  assert.equal(controller.getSnapshot().conflictCount, 1)
  assert.equal((await repository.getDeals())[0].stageId, 'contacted')
  assert.equal(controller.retryItems(['D-00001']).length, 0)
})

test('keeping the current stage resolves a conflict immediately and late failures cannot resurrect it', async () => {
  let release
  const { controller, repository } = await setup({ wait: () => new Promise((resolve) => { release = resolve }) })
  const operation = controller.begin(['D-00001'], 'won')
  const pending = repository.saveStages(operation)
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted' })
  controller.discard(['D-00001'])
  assert.equal(controller.deals[0].stageId, 'contacted')
  release()
  controller.settle(operation, (await pending).results)
  assert.equal(controller.deals[0].stageId, 'contacted')
  assert.equal(controller.getSnapshot().states.size, 0)
})

test('saving my stage after a conflict uses the newest version and preserves the original intended stage', async () => {
  const { controller, repository } = await setup()
  controller.begin(['D-00001'], 'won')
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted' })
  const [intent] = controller.retryItems(['D-00001'], 'conflict')
  assert.equal(intent.stageId, 'won')
  const resolution = controller.begin([intent.id], intent.stageId)
  assert.equal(resolution.items[0].expectedVersion, 2)
  const response = await repository.saveStages(resolution)
  controller.settle(resolution, response.results)
  assert.equal(controller.getSnapshot().conflictCount, 0)
  assert.equal(controller.getSnapshot().savedCount, 1)
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.deals[0].version, 3)
})

test('another teammate edit during resolution produces a new conflict instead of overwriting it', async () => {
  let release
  const { controller, repository } = await setup({ wait: () => new Promise((resolve) => { release = resolve }) })
  controller.begin(['D-00001'], 'won')
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted' })
  const resolution = controller.begin(['D-00001'], 'won')
  const pending = repository.saveStages(resolution)
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'negotiation', ownerId: 'owner-3' })
  release()
  controller.settle(resolution, (await pending).results)
  assert.equal(controller.getSnapshot().conflictCount, 1)
  assert.equal(controller.getSnapshot().states.get('D-00001').confirmedStageId, 'negotiation')
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal((await repository.getDeals())[0].stageId, 'negotiation')
})

test('a teammate event after server commit but before local response remains a conflict', async () => {
  const { controller, repository } = await setup()
  const operation = controller.begin(['D-00001'], 'won')
  const response = await repository.saveStages(operation)
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'lost' })
  controller.settle(operation, response.results)
  assert.equal(controller.getSnapshot().conflictCount, 1)
  assert.equal(controller.getSnapshot().states.get('D-00001').confirmedStageId, 'lost')
  assert.equal(controller.deals[0].version, 3)
  controller.discard(['D-00001'])
  assert.equal(controller.deals[0].stageId, 'lost')
})

test('bulk conflict resolution does not include unrelated network failures or successes', async () => {
  const { controller, repository } = await setup()
  const operation = controller.begin(['D-00001', 'D-00002', 'D-00003'], 'won')
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted' })
  const response = await repository.saveStages(operation)
  response.results[1] = { id: 'D-00002', ok: false, error: 'Connection lost' }
  controller.settle(operation, response.results)
  assert.equal(controller.getSnapshot().conflictCount, 1)
  assert.equal(controller.getSnapshot().failedCount, 1)
  assert.equal(controller.getSnapshot().savedCount, 1)
  assert.deepEqual(controller.retryItems(controller.deals.map((deal) => deal.id), 'conflict').map((item) => item.id), ['D-00001'])
  assert.deepEqual(controller.retryItems(controller.deals.map((deal) => deal.id)).map((item) => item.id), ['D-00002'])
  controller.discard(['D-00001'])
  assert.equal(controller.getSnapshot().failedCount, 1)
  assert.equal(controller.getSnapshot().savedCount, 1)
})

test('teammate changes to a failed move require conflict resolution, rather than ordinary retry', async () => {
  const { controller, repository } = await setup()
  repository.configureNetwork({ ...DEFAULT_NETWORK, failureRate: 1 })
  const operation = controller.begin(['D-00001'], 'won')
  controller.settle(operation, (await repository.saveStages(operation)).results)
  assert.equal(controller.getSnapshot().failedCount, 1)
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted' })
  assert.equal(controller.getSnapshot().failedCount, 0)
  assert.equal(controller.getSnapshot().conflictCount, 1)
})

test('completed local saves accept later teammate edits without retaining a misleading saved label', async () => {
  const { controller, repository } = await setup()
  const operation = controller.begin(['D-00001'], 'won')
  controller.settle(operation, (await repository.saveStages(operation)).results)
  repository.simulateTeammateUpdate({ dealId: 'D-00001', stageId: 'contacted', ownerId: 'owner-2' })
  assert.equal(controller.deals[0].stageId, 'contacted')
  assert.equal(controller.deals[0].version, 3)
  assert.equal(controller.getSnapshot().states.size, 0)
  assert.equal(controller.getSnapshot().updates.get('D-00001').actor.name, 'Priya Sharma')
})

test('teammate subscriptions can be removed and random updates always choose a different stage', async () => {
  const { repository } = await setup()
  const events = []
  const unsubscribe = repository.subscribeTeammateUpdates((update) => events.push(update))
  const before = await repository.getDeals()
  const update = repository.simulateTeammateUpdate()
  assert.notEqual(update.deal.stageId, before.find((deal) => deal.id === update.deal.id).stageId)
  assert.equal(events.length, 1)
  unsubscribe()
  repository.simulateTeammateUpdate()
  assert.equal(events.length, 1)
})
