import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeBulkSave } from './bulkSaveSummary.js'

test('500-deal batch isolates its 20 failures from earlier unrelated failures', () => {
  const ids = Array.from({ length: 500 }, (_, index) => `batch-${index}`)
  const states = new Map(ids.map((id, index) => [id, { stageId: 'won', status: index < 480 ? 'saved' : 'failed' }]))
  for (let index = 0; index < 10; index++) states.set(`previous-${index}`, { stageId: 'won', status: 'failed' })
  const result = summarizeBulkSave({ ids, stageId: 'won' }, states)
  assert.equal(result.saved, 480)
  assert.equal(result.failed, 20)
  assert.deepEqual(result.failedIds, ids.slice(480))
  assert.ok(result.failedIds.every((id) => !id.startsWith('previous-')))
  for (const id of result.failedIds) states.set(id, { stageId: 'won', status: 'saved' })
  const recovered = summarizeBulkSave({ ids, stageId: 'won' }, states)
  assert.equal(recovered.saved, 500)
  assert.equal(recovered.failed, 0)
  assert.equal(recovered.failedIds.length, 0)
})

test('pending/conflicting deals and later changes are not resubmitted as failed bulk saves', () => {
  const states = new Map([
    ['saving', { stageId: 'won', status: 'saving' }],
    ['conflict', { stageId: 'won', status: 'conflict' }],
    ['changed', { stageId: 'lost', status: 'failed' }],
    ['failed', { stageId: 'won', status: 'failed' }],
  ])
  const result = summarizeBulkSave({ ids: ['saving', 'conflict', 'changed', 'failed', 'discarded'], stageId: 'won' }, states)
  assert.deepEqual(result, { saving: 1, saved: 0, failed: 1, conflicts: 1, changed: 2, failedIds: ['failed'] })
})
