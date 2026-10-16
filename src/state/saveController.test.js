import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeals } from '../data/deals.js'
import { createDealRepository, DEFAULT_NETWORK } from '../data/dealRepository.js'
import { SaveController } from './saveController.js'

const now = Date.parse('2026-10-16T12:00:00Z')
const initial = (count = 2) => createDeals({ count, now: now - 86400000 }).map((deal) => ({ ...deal, stageId: 'new-lead' }))
const noWait = async () => {}

async function setup({ count = 2, random = () => 0.5, wait = noWait } = {}) {
  const repository = createDealRepository({ initialDeals: initial(count), random, wait, now: () => now })
  const controller = new SaveController({ now: () => now })
  controller.initialize(await repository.getDeals())
  return { repository, controller }
}

async function save(repository, controller, operation) {
  const response = await repository.saveStages(operation)
  controller.settle(operation, response.results)
  return response
}

test('optimism is immediate; the authoritative record changes only after successful save', async () => {
  let release
  const { repository, controller } = await setup({ wait: () => new Promise((resolve) => { release = resolve }) })
  const operation = controller.begin(['D-00001'], 'won')
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.deals[0].version, 1)
  assert.equal(controller.getSnapshot().savingCount, 1)
  assert.equal((await repository.getDeals())[0].stageId, 'new-lead')
  const pending = save(repository, controller, operation)
  release()
  await pending
  assert.equal(controller.deals[0].version, 2)
  assert.equal(controller.getSnapshot().savedCount, 1)
  assert.equal(controller.getSnapshot().savingCount, 0)
  assert.equal((await repository.getDeals())[0].stageId, 'won')
})

test('500-deal bulk save reports 480 successes and 20 failures; retry sends only the 20 failures', async () => {
  const draws = [0.5, ...Array(20).fill(0.01), ...Array(480).fill(0.9)]
  const { repository, controller } = await setup({ count: 500, random: () => draws.shift() ?? 0.9 })
  const ids = controller.deals.map((deal) => deal.id)
  await save(repository, controller, controller.begin(ids, 'won'))
  assert.equal(controller.getSnapshot().savedCount, 480)
  assert.equal(controller.getSnapshot().failedCount, 20)
  assert.equal(controller.getSnapshot().savingCount, 0)
  assert.ok(controller.deals.every((deal) => deal.stageId === 'won'))
  assert.equal((await repository.getDeals()).filter((deal) => deal.stageId === 'won').length, 480)
  const retryItems = controller.retryItems(ids)
  assert.equal(retryItems.length, 20)
  assert.ok(retryItems.every((item) => item.stageId === 'won'))
  repository.configureNetwork({ ...DEFAULT_NETWORK, failureRate: 0 })
  const retry = controller.begin(retryItems.map((item) => item.id), 'won')
  assert.equal(retry.items.length, 20)
  await save(repository, controller, retry)
  assert.equal(controller.getSnapshot().failedCount, 0)
  assert.equal(controller.getSnapshot().savedCount, 500)
  // Successful deals were not resubmitted or version-bumped a second time.
  assert.ok((await repository.getDeals()).every((deal) => deal.stageId === 'won' && deal.version === 2))
})

test('discard rolls back only failed deals, preserving unrelated successful and saving deals', async () => {
  const draws = [0.5, 0, 0.9]
  const { repository, controller } = await setup({ count: 3, random: () => draws.shift() ?? 0.9 })
  await save(repository, controller, controller.begin(['D-00001', 'D-00002'], 'won'))
  controller.begin(['D-00003'], 'contacted')
  controller.discard(['D-00001', 'D-00002', 'D-00003'])
  assert.equal(controller.deals[0].stageId, 'new-lead')
  assert.equal(controller.deals[0].version, 1)
  assert.equal(controller.deals[0].lastActivityAt, initial(3)[0].lastActivityAt)
  assert.equal(controller.deals[1].stageId, 'won')
  assert.equal(controller.deals[1].version, 2)
  assert.equal(controller.deals[2].stageId, 'contacted')
  assert.equal(controller.getSnapshot().savingCount, 1)
  assert.equal(controller.getSnapshot().failedCount, 0)
})

test('discard after a later failure restores the most recently confirmed move', async () => {
  const { repository, controller } = await setup()
  await save(repository, controller, controller.begin(['D-00001'], 'contacted'))
  repository.configureNetwork({ ...DEFAULT_NETWORK, failureRate: 1 })
  await save(repository, controller, controller.begin(['D-00001'], 'won'))
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.getSnapshot().failedCount, 1)
  controller.discard(['D-00001'])
  assert.equal(controller.deals[0].stageId, 'contacted')
  assert.equal(controller.deals[0].version, 2)
})

test('rejected requests retain optimistic edits and expose each failed ID for retry', async () => {
  const { controller } = await setup()
  const operation = controller.begin(['D-00001', 'D-00002'], 'demo-done')
  controller.fail(operation, new Error('Connection lost'))
  assert.equal(controller.getSnapshot().failedCount, 2)
  assert.ok(controller.deals.every((deal) => deal.stageId === 'demo-done'))
  assert.equal(controller.retryItems(['D-00001']).length, 1)
  assert.equal(controller.getSnapshot().states.get('D-00001').error, 'Connection lost')
})

test('older responses cannot overwrite a newer successful move', async () => {
  const releases = []
  const { repository, controller } = await setup({ wait: () => new Promise((resolve) => releases.push(resolve)) })
  const older = controller.begin(['D-00001'], 'contacted')
  const olderSave = save(repository, controller, older)
  const newer = controller.begin(['D-00001'], 'won')
  const newerSave = save(repository, controller, newer)
  releases[1]()
  await newerSave
  releases[0]()
  const response = await olderSave
  assert.equal(response.results[0].kind, 'superseded')
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.getSnapshot().states.get('D-00001').operationId, newer.operationId)
  assert.equal(controller.getSnapshot().states.get('D-00001').status, 'saved')
  assert.equal((await repository.getDeals())[0].stageId, 'won')
})

test('a late older write cannot reappear after discarding a newer failed move', async () => {
  const releases = []
  const { repository, controller } = await setup({ wait: () => new Promise((resolve) => releases.push(resolve)) })
  const older = save(repository, controller, controller.begin(['D-00001'], 'contacted'))
  repository.configureNetwork({ ...DEFAULT_NETWORK, failureRate: 1 })
  const newer = save(repository, controller, controller.begin(['D-00001'], 'won'))
  releases[1]()
  await newer
  assert.equal(controller.getSnapshot().failedCount, 1)
  controller.discard(['D-00001'])
  releases[0]()
  await older
  assert.equal(controller.deals[0].stageId, 'new-lead')
  assert.equal((await repository.getDeals())[0].stageId, 'new-lead')
  assert.equal(controller.getSnapshot().failedCount, 0)
})

test('moving back to the confirmed stage while an older move is pending fences that older move', async () => {
  const releases = []
  const { repository, controller } = await setup({ wait: () => new Promise((resolve) => releases.push(resolve)) })
  const older = save(repository, controller, controller.begin(['D-00001'], 'won'))
  const back = controller.begin(['D-00001'], 'new-lead')
  assert.equal(back.items.length, 1)
  const newer = save(repository, controller, back)
  releases[1]()
  await newer
  releases[0]()
  await older
  assert.equal(controller.deals[0].stageId, 'new-lead')
  assert.equal((await repository.getDeals())[0].stageId, 'new-lead')
})

test('stale version responses are explicit failures and keep newer confirmed records', async () => {
  const { repository, controller } = await setup()
  const oldBase = controller.begin(['D-00001'], 'won')
  await repository.saveStages({ operationId: oldBase.operationId, items: [{ id: 'D-00001', stageId: 'contacted', expectedVersion: 1 }] })
  const response = await repository.saveStages({ ...oldBase, operationId: oldBase.operationId + 1 })
  controller.settle(oldBase, response.results)
  assert.equal(response.results[0].kind, 'conflict')
  assert.equal(controller.deals[0].stageId, 'won')
  assert.equal(controller.getSnapshot().states.get('D-00001').confirmedStageId, 'contacted')
  controller.discard(['D-00001'])
  assert.equal(controller.deals[0].stageId, 'contacted')
})

test('already-confirmed targets are skipped and invalid starts leave state unchanged', async () => {
  const { controller } = await setup()
  const skipped = controller.begin(['D-00001', 'D-00001'], 'new-lead')
  assert.deepEqual(skipped.items, [])
  assert.deepEqual(skipped.unchangedIds, ['D-00001'])
  assert.throws(() => controller.begin(['D-00001', 'missing'], 'won'), /Deal not found/)
  assert.throws(() => controller.begin(['D-00001'], 'invalid'), /Unknown stage/)
  assert.equal(controller.getSnapshot().states.size, 0)
})
