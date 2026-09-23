import { useMemo } from 'react'
import type { DeployFileEntry } from '../store/appStore'
import type { DeployFileStatus } from '../../../shared/types'
import type { FilePattern } from './filePattern'
import { hiddenByPatterns } from './filePattern'
import { includedPathsSet } from './includedPathsSet'

export interface IncludedFileItem {
  localPath: string
  status: DeployFileStatus
}

export interface IncludedFilesView {
  items: IncludedFileItem[]
  // REQ-020 — "선택". RT-51 이후로는 "이미 Extract로 이동한 변경 파일
  // 개수"를 뜻한다(화면에 보이는 이 목록 자체는 정의상 전부 미체크라 —
  // 아래 items 참고 — 필터와 무관한 절대값이라는 REQ-020 원칙은 그대로
  // 유지된다). RT-45(M-1) — screenOnly 패턴은 화면만 걸러낼 뿐 Export
  // 대상은 그대로라 여기서는 제외하고 계산한다(exportPlan.buildExportFiles와
  // 같은 기준).
  selectedCount: number
  // RT-45/46 — 파일 패턴(screenOnly 포함 전부)에 걸려 화면에서 숨겨진
  // 개수(FilterPatternBar의 "· N개 숨김" 배지용).
  patternHiddenCount: number
  // "누락된 의존성" 중복 제거(RT-17)·AddFilesPopup 후보 필터링에 재사용된다
  // — deployFiles 원본에서 바로 유도되는 값이라 이 훅이 함께 계산해 둔다.
  includedSet: Set<string>
  // RT-51(§5.1) — 패턴 적용 전, "미선택 변경 파일" 전체 개수(FilePaneCountTitle의
  // "필터 전 전체"). 컴포넌트가 빈 상태 문구를 "전부 Extract로 이동"(0) vs
  // "패턴에 걸려 숨겨짐"(0보다 큰데 items가 0)으로 고르는 데도 쓴다.
  totalBeforeFilter: number
  // RT-53(M-20) — 폴더 체크박스 indeterminate 판정(일부만 Extract로
  // 이동된 폴더)에 필요하다 — items(패턴까지 반영된 화면 표시분)만으로는
  // "이 폴더에서 이미 이동한 게 있는지"를 알 수 없어, 패턴과 무관한
  // source==='changed' 전체를 함께 내려준다.
  changedFiles: DeployFileEntry[]
}

// RT-34(S1) — DeployFilesPanel.tsx에 있던 좌측 "포함된 파일" 파생 계산을
// 훅으로 뺐다. RT-45 — 상태 Filter·파일명 검색(REQ-025)을 삭제했다(파일
// 패턴이 그 역할을 대신함, M-1). RT-46 — 제외 전용
// matchesAnyActiveExcludePattern을 제외/포함 모두 다루는 hiddenByPatterns로
// 교체.
//
// RT-51(§3.2·§5.1) — "포함된 파일"은 이제 "미선택 변경 파일" 목록이다.
// deployFiles가 더 이상 변경 파일만 담지 않으므로(의존성·수동 추가도
// 섞여 들어옴) source==='changed'로 먼저 좁히고, 그중 !included(아직
// Extract로 이동 안 한 것)만 화면에 보여준다 — 체크(=included:true)하면
// 다음 렌더에서 이 목록 자체에서 사라지는 방식으로 "Extract 이동"을
// 표현한다(§5.1 "체크하면 Extract 대상 목록으로 이동"). 그래서 items의
// checked는 항상 false다(TriStateCheckbox는 여전히 유용 — "화면에 보이는
// 항목이 있는지"로 disabled를 판정).
export function useIncludedFilesView(
  deployFiles: DeployFileEntry[],
  filePatterns: FilePattern[]
): IncludedFilesView {
  const changedFiles = useMemo(
    () => deployFiles.filter((f) => f.source === 'changed'),
    [deployFiles]
  )
  const unmoved = useMemo(() => changedFiles.filter((f) => !f.included), [changedFiles])

  const items = useMemo((): IncludedFileItem[] => {
    return unmoved
      .filter((f) => !hiddenByPatterns(f.localPath, filePatterns))
      .map((f) => ({ localPath: f.localPath, status: f.status }))
  }, [unmoved, filePatterns])

  const patternHiddenCount = unmoved.length - items.length

  // Export는 screenOnly 패턴을 적용하지 않는다(services/exportPlan.ts와
  // 동일한 필터) — "선택"(이미 Extract로 이동한 개수 중 실제 Export될
  // 개수)이 이 기준을 따른다.
  const exportRelevantPatterns = useMemo(
    () => filePatterns.filter((p) => !p.screenOnly),
    [filePatterns]
  )
  const selectedCount = useMemo(
    () =>
      changedFiles.filter(
        (f) => f.included && !hiddenByPatterns(f.localPath, exportRelevantPatterns)
      ).length,
    [changedFiles, exportRelevantPatterns]
  )

  // RT-42 — 이 값은 패턴과 무관해서(원본 deployFiles만 있으면 됨) 다른
  // 컴포넌트(ExtractTargetsPane 등)도 이 훅 전체를 호출하지 않고
  // lib/includedPathsSet.ts로 저렴하게 따로 구한다.
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  return {
    items,
    selectedCount,
    patternHiddenCount,
    includedSet,
    totalBeforeFilter: unmoved.length,
    changedFiles
  }
}
