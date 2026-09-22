import { useMemo } from 'react'
import type { DeployFileEntry, DeployFilesFilter } from '../store/appStore'
import type { ExcludePatternEntry } from './excludePatterns'
import { matchesAnyActiveExcludePattern } from './excludePatternMatch'
import { matchesFileName } from './matchesFileName'
import { includedPathsSet } from './includedPathsSet'
import type { FileListItem } from '../components/deployFiles/FileList'

export interface IncludedFilesView {
  items: FileListItem[]
  allChecked: boolean
  someChecked: boolean
  // REQ-020 — "선택"(Filter/검색 무관 절대값, 단 제외 패턴엔 영향받음 —
  // 매치되면 실제로 Export 안 되므로).
  selectedCount: number
  // "누락된 의존성" 중복 제거(RT-17)·수동 추가 팝업 후보 필터링에 재사용된다
  // — deployFiles 원본에서 바로 유도되는 값이라 이 훅이 함께 계산해 둔다.
  includedSet: Set<string>
}

// RT-34(S1) — DeployFilesPanel.tsx에 있던 좌측 "포함된 파일" 파생 계산
// (상태 Filter → 제외 패턴 → 파일명 검색, 전체 선택 판정, 카운터)을
// 훅으로 뺐다. 동작은 그대로다.
export function useIncludedFilesView(
  deployFiles: DeployFileEntry[],
  filter: DeployFilesFilter,
  excludePatterns: ExcludePatternEntry[],
  searchTerm: string
): IncludedFilesView {
  const items = useMemo((): FileListItem[] => {
    const statusFiltered =
      filter === 'all' ? deployFiles : deployFiles.filter((f) => f.status === filter)
    // 순서: 상태 Filter → 제외 패턴(REQ-019) → 파일명 검색. 전부 AND
    // 조건이라 순서 자체는 결과에 영향 없음(DETAILED_DESIGN.md §12.1).
    return statusFiltered
      .filter((f) => !matchesAnyActiveExcludePattern(f.localPath, excludePatterns))
      .filter((f) => matchesFileName(f.localPath, searchTerm))
      .map((f) => ({ localPath: f.localPath, checked: f.included }))
  }, [deployFiles, filter, excludePatterns, searchTerm])

  const allChecked = items.length > 0 && items.every((f) => f.checked)
  const someChecked = items.some((f) => f.checked)

  const selectedCount = useMemo(
    () =>
      deployFiles.filter(
        (f) => f.included && !matchesAnyActiveExcludePattern(f.localPath, excludePatterns)
      ).length,
    [deployFiles, excludePatterns]
  )

  // RT-42 — 이 값은 filter/검색어/제외패턴과 무관해서(원본 deployFiles만
  // 있으면 됨) 다른 컴포넌트(MissingDependenciesPane 등)도 이 훅 전체를
  // 호출하지 않고 lib/includedPathsSet.ts로 저렴하게 따로 구한다.
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  return { items, allChecked, someChecked, selectedCount, includedSet }
}
