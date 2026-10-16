import { PAGE_SIZES } from '../data/pagination.js'

const number = new Intl.NumberFormat('en-US')

export function Pagination({ page, pageSize, onPageChange, onPageSizeChange }) {
  return (
    <nav className="pagination" aria-label="Deal pagination">
      <label className="page-size-control">Deals per page
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span className="page-range" role="status">{number.format(page.start)}–{number.format(page.end)} of {number.format(page.total)}</span>
      <div className="page-navigation">
        <button type="button" aria-label="First page" disabled={page.pageIndex === 0} onClick={() => onPageChange(0)}>«</button>
        <button type="button" aria-label="Previous page" disabled={page.pageIndex === 0} onClick={() => onPageChange(page.pageIndex - 1)}>‹</button>
        <span>Page {number.format(page.pageIndex + 1)} of {number.format(page.pageCount)}</span>
        <button type="button" aria-label="Next page" disabled={page.pageIndex === page.pageCount - 1} onClick={() => onPageChange(page.pageIndex + 1)}>›</button>
        <button type="button" aria-label="Last page" disabled={page.pageIndex === page.pageCount - 1} onClick={() => onPageChange(page.pageCount - 1)}>»</button>
      </div>
    </nav>
  )
}
