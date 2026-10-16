export function runWithFocusRecovery(action) {
  const focused = document.activeElement
  const row = focused?.closest('[data-deal-id]')
  const region = focused?.closest('.failed-list, .table-scroll')
  action()
  requestAnimationFrame(() => {
    if (!focused || focused.isConnected || ![document.body, document.documentElement].includes(document.activeElement)) return
    const rowControl = row?.isConnected ? row.querySelector('.stage-select') : null
    const target = rowControl || (region?.isConnected ? region : null) || document.querySelector('[aria-label="Save activity"]') || document.getElementById('pipeline-results')
    target?.focus({ preventScroll: true })
  })
}
