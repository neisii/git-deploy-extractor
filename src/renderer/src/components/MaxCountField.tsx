import { useEffect, useRef, useState } from 'react'
import { parseMaxCountInput } from '../lib/maxCount'

interface MaxCountFieldProps {
  value: number
  onCommit: (value: number) => void
}

// RT-13(U3) — 예전엔 값을 바꿀 때마다 `Number(value) || 1`로 즉시 커밋해
// 지우는 순간 1로 스냅되고 그때마다 재조회가 나갔다. 이제 입력 중에는
// 로컬 문자열만 바꾸고, blur/Enter에서만 커밋한다(그때만 재조회). 비우거나
// 1 미만이면 이전 값으로 되돌린다.
export function MaxCountField({ value, onCommit }: MaxCountFieldProps): React.JSX.Element {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  // 포커스 중이 아닐 때만 외부 값(Reload 등)을 반영한다 — 입력 중인 문자열을
  // 부모 리렌더가 덮어쓰지 않게 한다.
  useEffect(() => {
    if (!focused.current) {
      setText(String(value))
    }
  }, [value])

  const commit = (): void => {
    const parsed = parseMaxCountInput(text)
    if (parsed === null) {
      setText(String(value))
      return
    }
    setText(String(parsed))
    if (parsed !== value) {
      onCommit(parsed)
    }
  }

  return (
    <input
      type="number"
      min={1}
      value={text}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
