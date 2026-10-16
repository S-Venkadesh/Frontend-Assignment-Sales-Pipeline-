import test from 'node:test'
import assert from 'node:assert/strict'
import { selectionReducer } from './selection.js'

test('selecting and clearing one page preserves selections from other pages', () => {
  const initial = new Set(['other-page'])
  const selected = selectionReducer(initial, { type: 'set-many', ids: ['page-1', 'page-2'], checked: true })
  assert.deepEqual([...selected], ['other-page', 'page-1', 'page-2'])
  const cleared = selectionReducer(selected, { type: 'set-many', ids: ['page-1', 'page-2'], checked: false })
  assert.deepEqual([...cleared], ['other-page'])
  assert.deepEqual([...initial], ['other-page'])
  assert.equal(selected.size, 3)
})

test('selecting all matches captures IDs and toggling one deal excludes only that ID', () => {
  const matchingIds = Array.from({ length: 50000 }, (_, index) => `D-${index}`)
  const selected = selectionReducer(new Set(['outside-filter']), { type: 'set-many', ids: matchingIds, checked: true })
  assert.equal(selected.size, 50001)
  const excluded = selectionReducer(selected, { type: 'toggle', id: 'D-25000' })
  assert.equal(excluded.size, 50000)
  assert.ok(!excluded.has('D-25000'))
  assert.ok(excluded.has('outside-filter'))
  matchingIds.push('new-match')
  assert.ok(!excluded.has('new-match'))
  assert.equal(selectionReducer(excluded, { type: 'clear' }).size, 0)
  assert.equal(selected.size, 50001)
})

test('duplicate selections do not inflate counts and toggles reselect a deal', () => {
  const selected = selectionReducer(new Set(['deal']), { type: 'set-many', ids: ['deal', 'deal'], checked: true })
  assert.equal(selected.size, 1)
  const removed = selectionReducer(selected, { type: 'toggle', id: 'deal' })
  assert.equal(removed.size, 0)
  assert.deepEqual([...selectionReducer(removed, { type: 'toggle', id: 'deal' })], ['deal'])
})
