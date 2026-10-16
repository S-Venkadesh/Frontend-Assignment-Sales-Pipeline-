export const PAGE_SIZES = [100, 250, 500]

export function paginateDeals(deals, requestedPage = 0, pageSize = 100) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('Invalid page size')
  if (!Number.isInteger(requestedPage)) throw new Error('Invalid page index')
  const pageCount = Math.max(1, Math.ceil(deals.length / pageSize))
  const pageIndex = Math.max(0, Math.min(requestedPage, pageCount - 1))
  const offset = pageIndex * pageSize
  return {
    deals: deals.slice(offset, offset + pageSize),
    pageIndex, pageCount, offset,
    start: deals.length ? offset + 1 : 0,
    end: Math.min(offset + pageSize, deals.length),
    total: deals.length,
  }
}
