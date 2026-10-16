import { useLayoutEffect, useState } from 'react'

const controlsIn = (row) => [...row.querySelectorAll('input:not(:disabled), select:not(:disabled), button:not(:disabled)')]

// Keep native controls and tab order, mounting a target row before focusing it.
export function useVirtualKeyboard(ref, virtualizer, count) {
  const [target, setTarget] = useState(null)
  const rows = virtualizer.getVirtualItems()
  useLayoutEffect(() => {
    if (!target) return
    const row = ref.current?.querySelector(`[data-virtual-index="${target.index}"]`)
    if (!row) return
    const controls = controlsIn(row)
    const control = target.last ? controls.at(-1) : controls[0]
    if (control) {
      control.focus({ preventScroll: true })
      setTarget(null)
    }
  }, [rows, target, ref])

  return (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return
    const row = event.target.closest('[data-virtual-index]')
    if (!row) return
    const index = Number(row.dataset.virtualIndex)
    const controls = controlsIn(row)
    let next
    let last = false
    if (event.key === 'Tab') {
      if (event.target !== (event.shiftKey ? controls[0] : controls.at(-1))) return
      next = index + (event.shiftKey ? -1 : 1)
      last = event.shiftKey
    } else if (event.target.type === 'checkbox' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)
    } else return
    if (next < 0 || next >= count) return
    event.preventDefault()
    virtualizer.scrollToIndex(next, { align: 'auto' })
    setTarget({ index: next, last })
  }
}
