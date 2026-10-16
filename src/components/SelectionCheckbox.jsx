import { useEffect, useRef } from 'react'

export function SelectionCheckbox({ checked, indeterminate = false, label, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="selection-checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
    />
  )
}
