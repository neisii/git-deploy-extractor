import { useEffect, useRef } from 'react'

export interface TriStateCheckboxProps {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  disabled?: boolean
  'aria-label'?: string
}

// RT-40(S5) — CommitListPanel과 FileListColumn이 각자 들고 있던
// "checked + indeterminate ref/effect" 코드가 거의 동일했다(S5). 실제
// DOM에만 있고 React prop으로는 못 다루는 `.indeterminate`를 여기 한
// 곳에서만 설정한다. `checked`를 함께 넘겨 checked=false여도 indeterminate
// 표시가 우선하도록 브라우저 기본 동작에 맡긴다.
export function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ...rest
}: TriStateCheckboxProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      {...rest}
    />
  )
}
