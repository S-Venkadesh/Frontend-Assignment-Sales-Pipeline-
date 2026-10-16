import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeals } from './deals.js'
import { createDealRepository, DEFAULT_NETWORK } from './dealRepository.js'

const deals = createDeals({ count: 2, now: Date.parse('2026-10-16T00:00:00Z') })

test('default latency samples include the 300 ms and 1,500 ms bounds', async () => {
  for (const [random, expected] of [[0, 300], [0.999999, 1500]]) {
    const waits = []
    const repository = createDealRepository({ initialDeals: deals, random: () => random, wait: async (ms) => waits.push(ms) })
    await repository.saveStages({ operationId: 1, items: [{ id: deals[0].id, stageId: 'won', expectedVersion: 1 }] })
    assert.deepEqual(waits, [expected])
  }
  assert.deepEqual(DEFAULT_NETWORK, { minDelay: 300, maxDelay: 1500, failureRate: 0.1 })
})

test('0% failures saves every deal, 100% failures writes no deal', async () => {
  for (const failureRate of [0, 1]) {
    const repository = createDealRepository({ initialDeals: deals, random: () => 0.5, wait: async () => {} })
    repository.configureNetwork({ minDelay: 0, maxDelay: 0, failureRate })
    const response = await repository.saveStages({ operationId: 1, items: deals.map((deal) => ({ id: deal.id, stageId: 'won', expectedVersion: 1 })) })
    assert.ok(response.results.every((result) => result.ok === !failureRate))
    assert.ok((await repository.getDeals()).every((deal) => deal.version === (failureRate ? 1 : 2)))
  }
})

test('changing network settings does not alter an in-flight request', async () => {
  let release
  let actualDelay
  const repository = createDealRepository({ initialDeals: deals, random: () => 0.5, wait: (ms) => { actualDelay = ms; return new Promise((resolve) => { release = resolve }) } })
  repository.configureNetwork({ minDelay: 600, maxDelay: 600, failureRate: 1 })
  const pending = repository.saveStages({ operationId: 1, items: [{ id: deals[0].id, stageId: 'won', expectedVersion: 1 }] })
  repository.configureNetwork({ minDelay: 0, maxDelay: 0, failureRate: 0 })
  release()
  const response = await pending
  assert.equal(actualDelay, 600)
  assert.equal(response.results[0].ok, false)
})

test('invalid settings and invalid batches are rejected before any write', async () => {
  const repository = createDealRepository({ initialDeals: deals, wait: async () => {} })
  assert.throws(() => repository.configureNetwork({ minDelay: 500, maxDelay: 300, failureRate: 0.1 }), /minimum/)
  assert.throws(() => repository.configureNetwork({ minDelay: 0, maxDelay: 10001, failureRate: 0.1 }), /10,000/)
  assert.throws(() => repository.configureNetwork({ minDelay: 0, maxDelay: 0, failureRate: 1.1 }), /Failure rate/)
  await assert.rejects(repository.saveStages({ operationId: 1, items: [{ id: deals[0].id, stageId: 'won', expectedVersion: 1 }, { id: 'missing', stageId: 'won', expectedVersion: 1 }] }), /Deal not found/)
  assert.deepEqual(await repository.getDeals(), deals)
})
