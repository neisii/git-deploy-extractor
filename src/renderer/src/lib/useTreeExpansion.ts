import { useCallback, useState } from 'react'

export interface TreeExpansion {
  isOpen: (path: string) => boolean
  toggle: (path: string) => void
}

// RT-53(§5.1 RT-53, M-20) — 폴더 펼침 상태. **로컬에만 유지(저장 안 함,
// M-20 결정 2026-09-23)** — 새로고침하면 항상 기본값(defaultOpen)으로
//돌아간다. 사용자가 직접 토글한 상태가 defaultOpen보다 우선하며, 목록
// (컴포넌트 인스턴스)마다 이 훅을 따로 호출해 독립적으로 관리한다 —
// AddFilesPopup의 탐색/결과 두 트리처럼 같은 컴포넌트 안에서도 펼침
// 상태를 분리해야 하면 이 훅을 두 번 호출한다(§5.1 "탐색/결과는 펼침
// id를 분리").
export function useTreeExpansion(defaultOpen: (path: string) => boolean): TreeExpansion {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map())

  const isOpen = useCallback(
    (path: string) => overrides.get(path) ?? defaultOpen(path),
    [overrides, defaultOpen]
  )

  const toggle = useCallback(
    (path: string) => {
      setOverrides((prev) => {
        const current = prev.get(path) ?? defaultOpen(path)
        const next = new Map(prev)
        next.set(path, !current)
        return next
      })
    },
    [defaultOpen]
  )

  return { isOpen, toggle }
}
