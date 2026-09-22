import { useCallback, useEffect, useRef } from 'react'

// RT-32(S3) — appStore.ts 시절 setSearchTerm/setAuthorFilter/
// setHashFilterText/setDateRange 네 액션이 전부 모듈 전역 타이머
// 하나(searchDebounceTimer)를 공유했다 — 한 필드를 편집하면 다른
// 필드의 대기 중이던 디바운스까지 우연히 취소되는 결합이었다. 이 훅을
// 호출부마다 하나씩 따로 쓰면 각자 독립된 타이머를 갖는다(BranchSearchBar.tsx
// 참고 — 검색어/작성자/해시/기간 네 필드가 각각 자기 훅 인스턴스를 씀).
//
// run()은 debounce 후 action을 부르고, cancel()은 대기 중인 호출을
// 취소한다 — "지금 바로 조회"(Search 버튼, Ctrl/Cmd+Enter) 같은 즉시
// 트리거가 이 필드의 대기 중이던 디바운스까지 정리하고 싶을 때 쓴다
// (기존 shared timer가 clearTimeout으로 해주던 것과 같은 효과).
export function useDebouncedAction<Args extends unknown[]>(
  action: (...args: Args) => void,
  delayMs: number
): { run: (...args: Args) => void; cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 매 렌더 최신 action을 참조하도록 ref로 감싼다 — run/cancel 자체는
  // useCallback으로 안정된 참조를 유지하면서도, 타이머가 실제로 발화할
  // 때는 항상 최신 클로저(state)를 쓴다. ref 쓰기는 렌더 도중이 아니라
  // 렌더 이후(effect)에 한다 — react-hooks/refs 규칙(렌더 중 ref 쓰기 금지).
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => cancel, [cancel])

  const run = useCallback(
    (...args: Args) => {
      cancel()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        actionRef.current(...args)
      }, delayMs)
    },
    [cancel, delayMs]
  )

  return { run, cancel }
}
