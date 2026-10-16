import test from 'node:test'
import assert from 'node:assert/strict'
import { paginateDeals } from './pagination.js'

const deals = Array.from({ length: 50000 }, (_, id) => ({ id }))

test('50,000 deals are split into bounded pages without gaps or overlaps', () => {
  const first = paginateDeals(deals, 0, 100)
  const second = paginateDeals(deals, 1, 100)
  const last = paginateDeals(deals, 499, 100)
  assert.equal(first.pageCount, 500)
  assert.equal(first.deals.length, 100)
  assert.deepEqual([first.start, first.end, first.offset], [1, 100, 0])
  assert.deepEqual([second.start, second.end, second.offset], [101, 200, 100])
  assert.deepEqual([last.start, last.end, last.offset], [49901, 50000, 49900])
  assert.equal(first.deals[0], deals[0])
  assert.equal(second.deals[0], deals[100])
  assert.equal(last.deals.at(-1), deals.at(-1))
  assert.equal(paginateDeals(deals, 0, 500).pageCount, 100)
})

test('shrinking results clamps the page and returns the partial final page', () => {
  const page = paginateDeals(deals.slice(0, 105), 499, 100)
  assert.equal(page.pageIndex, 1)
  assert.equal(page.deals.length, 5)
  assert.deepEqual([page.start, page.end], [101, 105])
  assert.equal(paginateDeals(deals, -10).pageIndex, 0)
})

test('empty results produce an empty first page and invalid sizes are rejected', () => {
  assert.deepEqual(paginateDeals([], 50), { deals: [], pageIndex: 0, pageCount: 1, offset: 0, start: 0, end: 0, total: 0 })
  assert.throws(() => paginateDeals(deals, 0, 0), /Invalid page size/)
  assert.throws(() => paginateDeals(deals, 0, 1.5), /Invalid page size/)
  assert.throws(() => paginateDeals(deals, 0.5, 100), /Invalid page index/)
})
