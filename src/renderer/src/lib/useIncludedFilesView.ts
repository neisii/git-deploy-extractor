import { useMemo } from 'react'
import type { DeployFileEntry } from '../store/appStore'
import type { FilePattern } from './filePattern'
import { hiddenByPatterns } from './filePattern'
import { includedPathsSet } from './includedPathsSet'
import type { FileListItem } from '../components/deployFiles/FileList'

export interface IncludedFilesView {
  items: FileListItem[]
  allChecked: boolean
  someChecked: boolean
  // REQ-020 — "선택"(파일 패턴엔 영향받음 — 매치되면 실제로 Export
  // 안 되므로). RT-45(M-1) — screenOnly 패턴은 화면만 걸러낼 뿐 Export
  // 대상은 그대로라 여기서는 제외하고 계산한다(exportPlan.buildExportFiles와
  // 같은 기준).
  selectedCount: number
  // RT-45/46 — 파일 패턴(screenOnly 포함 전부)에 걸려 화면에서 숨겨진
  // 개수(FilterPatternBar의 "· N개 숨김" 배지용).
  patternHiddenCount: number
  // "누락된 의존성" 중복 제거(RT-17)·수동 추가 팝업 후보 필터링에 재사용된다
  // — deployFiles 원본에서 바로 유도되는 값이라 이 훅이 함께 계산해 둔다.
  includedSet: Set<string>
}

// RT-34(S1) — DeployFilesPanel.tsx에 있던 좌측 "포함된 파일" 파생 계산을
// 훅으로 뺐다. RT-45 — 상태 Filter·파일명 검색(REQ-025)을 삭제했다(파일
// 패턴이 그 역할을 대신함, M-1). RT-46 — 제외 전용
// matchesAnyActiveExcludePattern을 제외/포함 모두 다루는 hiddenByPatterns로
// 교체.
export function useIncludedFilesView(
  deployFiles: DeployFileEntry[],
  filePatterns: FilePattern[]
): IncludedFilesView {
  const items = useMemo((): FileListItem[] => {
    return deployFiles
      .filter((f) => !hiddenByPatterns(f.localPath, filePatterns))
      .map((f) => ({ localPath: f.localPath, checked: f.included, status: f.status }))
  }, [deployFiles, filePatterns])

  const patternHiddenCount = deployFiles.length - items.length

  const allChecked = items.length > 0 && items.every((f) => f.checked)
  const someChecked = items.some((f) => f.checked)

  // Export는 screenOnly 패턴을 적용하지 않는다(services/exportPlan.ts와
  // 동일한 필터) — "선택" 카운터가 실제 Export될 개수를 반영해야 하므로
  // 여기서도 화면 필터링(items)과 다른 패턴 집합을 쓴다.
  const exportRelevantPatterns = useMemo(
    () => filePatterns.filter((p) => !p.screenOnly),
    [filePatterns]
  )
  const selectedCount = useMemo(
    () =>
      deployFiles.filter(
        (f) => f.included && !hiddenByPatterns(f.localPath, exportRelevantPatterns)
      ).length,
    [deployFiles, exportRelevantPatterns]
  )

  // RT-42 — 이 값은 패턴과 무관해서(원본 deployFiles만 있으면 됨) 다른
  // 컴포넌트(MissingDependenciesPane 등)도 이 훅 전체를 호출하지 않고
  // lib/includedPathsSet.ts로 저렴하게 따로 구한다.
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  return { items, allChecked, someChecked, selectedCount, patternHiddenCount, includedSet }
}
