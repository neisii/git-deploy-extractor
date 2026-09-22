import { useMemo } from 'react'
import type { DeployFileEntry, DeployFilesFilter } from '../store/appStore'
import type { FilePattern } from './filePattern'
import { hiddenByPatterns } from './filePattern'
import { matchesFileName } from './matchesFileName'
import { includedPathsSet } from './includedPathsSet'
import type { FileListItem } from '../components/deployFiles/FileList'

export interface IncludedFilesView {
  items: FileListItem[]
  allChecked: boolean
  someChecked: boolean
  // REQ-020 — "선택"(Filter/검색 무관 절대값, 단 파일 패턴엔 영향받음 —
  // 매치되면 실제로 Export 안 되므로).
  selectedCount: number
  // RT-46 — 상태 Filter까지만 반영한 목록 중 파일 패턴에 걸려 숨겨진
  // 개수(검색어는 반영하지 않음, FilterPatternBar의 "· N개 숨김" 배지용).
  patternHiddenCount: number
  // "누락된 의존성" 중복 제거(RT-17)·수동 추가 팝업 후보 필터링에 재사용된다
  // — deployFiles 원본에서 바로 유도되는 값이라 이 훅이 함께 계산해 둔다.
  includedSet: Set<string>
}

// RT-34(S1) — DeployFilesPanel.tsx에 있던 좌측 "포함된 파일" 파생 계산
// (상태 Filter → 제외 패턴 → 파일명 검색, 전체 선택 판정, 카운터)을
// 훅으로 뺐다. RT-46 — 제외 전용 matchesAnyActiveExcludePattern을
// 제외/포함 모두 다루는 hiddenByPatterns로 교체.
export function useIncludedFilesView(
  deployFiles: DeployFileEntry[],
  filter: DeployFilesFilter,
  filePatterns: FilePattern[],
  searchTerm: string
): IncludedFilesView {
  const statusFiltered = useMemo(
    () => (filter === 'all' ? deployFiles : deployFiles.filter((f) => f.status === filter)),
    [deployFiles, filter]
  )

  const afterPatterns = useMemo(
    () => statusFiltered.filter((f) => !hiddenByPatterns(f.localPath, filePatterns)),
    [statusFiltered, filePatterns]
  )

  const items = useMemo((): FileListItem[] => {
    // 순서: 상태 Filter → 파일 패턴(REQ-019/RT-46) → 파일명 검색. 전부 AND
    // 조건이라 순서 자체는 결과에 영향 없음(DETAILED_DESIGN.md §12.1).
    return afterPatterns
      .filter((f) => matchesFileName(f.localPath, searchTerm))
      .map((f) => ({ localPath: f.localPath, checked: f.included }))
  }, [afterPatterns, searchTerm])

  const patternHiddenCount = statusFiltered.length - afterPatterns.length

  const allChecked = items.length > 0 && items.every((f) => f.checked)
  const someChecked = items.some((f) => f.checked)

  const selectedCount = useMemo(
    () =>
      deployFiles.filter((f) => f.included && !hiddenByPatterns(f.localPath, filePatterns)).length,
    [deployFiles, filePatterns]
  )

  // RT-42 — 이 값은 filter/검색어/패턴과 무관해서(원본 deployFiles만
  // 있으면 됨) 다른 컴포넌트(MissingDependenciesPane 등)도 이 훅 전체를
  // 호출하지 않고 lib/includedPathsSet.ts로 저렴하게 따로 구한다.
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  return { items, allChecked, someChecked, selectedCount, patternHiddenCount, includedSet }
}
