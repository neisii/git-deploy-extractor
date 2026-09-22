import { useMemo } from 'react'
import type { DependencyCandidate } from '../../../shared/types'
import { visibleMissingDependencies } from './visibleMissingDependencies'
import { matchesFileName } from './matchesFileName'
import type { FileListItem } from '../components/deployFiles/FileListColumn'

export interface MissingDependenciesView {
  items: FileListItem[]
  allChecked: boolean
  someChecked: boolean
  // REQ-020 — 우측은 REQ-019 제외 패턴이 적용 안 되므로 더 단순하다
  // (검색과 무관하게 실제로 추가된 개수).
  selectedCount: number
}

// RT-34(S1) — DeployFilesPanel.tsx에 있던 우측 "누락된 의존성" 파생 계산
// (Extract 목록 중복 제거 → 파일명 검색, 전체 선택 판정, 카운터)을 훅으로
// 뺐다. 동작은 그대로다.
export function useMissingDependenciesView(
  missingDependencies: DependencyCandidate[],
  searchTerm: string,
  // useIncludedFilesView가 계산한 값을 그대로 받는다 — RT-17(R4·R5)
  // "이미 Extract 목록에 있는 경로는 누락된 의존성에서 제외" 중복 제거용.
  includedSet: Set<string>
): MissingDependenciesView {
  const items = useMemo((): FileListItem[] => {
    return visibleMissingDependencies(missingDependencies, includedSet)
      .filter((d) => matchesFileName(d.localPath, searchTerm))
      .map((d) => ({
        localPath: d.localPath,
        checked: false,
        extraLabel: d.kind === 'interface' ? '(인터페이스)' : '(구현체)'
      }))
  }, [missingDependencies, searchTerm, includedSet])

  // 좌측 allChecked/someChecked와 동일한 방식 — 화면에 보이는(검색 적용된)
  // items 기준으로 판정한다(indeterminate 지원을 위해 절대값이 아님).
  const allChecked = items.length > 0 && items.every((f) => f.checked)
  const someChecked = items.some((f) => f.checked)

  const selectedCount = useMemo(
    () => missingDependencies.filter((d) => includedSet.has(d.localPath)).length,
    [missingDependencies, includedSet]
  )

  return { items, allChecked, someChecked, selectedCount }
}
