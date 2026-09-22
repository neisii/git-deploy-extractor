import { useMemo } from 'react'
import { useAppStore, selectIsAnalysisStale } from '../../store/appStore'
import { FilePane } from '../FilePane'
import { FileList } from './FileList'
import { FilePaneCountTitle } from './FilePaneCountTitle'
import { PanelState } from '../PanelState'
import { useMissingDependenciesView } from '../../lib/useMissingDependenciesView'
import { includedPathsSet } from '../../lib/includedPathsSet'

const OVER_COUNT_THRESHOLD = 50

// RT-42 — DeployFilesPanel.tsx에 인라인으로 있던 우측("누락된 의존성")
// 조립을 뺐다. **RT-52 전까지는 이름·내용 그대로 유지한다** — §5.1은
// 우측을 최종적으로 "ExtractTargetsPane"(Extract 대상 목록)으로 바꾸고
// 이 "누락된 의존성" 기능 자체를 RT-52의 AddFilesPopup 안 HEAD 트리로
// 옮기라고 하지만, 그 상태 모델 변경(RT-51)과 팝업(RT-52)이 아직
// 없어서 지금 이걸 없애면 대체 기능 없이 회귀가 된다(2026-09-22 사용자
// 결정 — 이번엔 구조 정리만).
export function MissingDependenciesPane(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const dependencyApplicable = useAppStore((s) => s.dependencyApplicable)
  const dependencyReason = useAppStore((s) => s.dependencyReason)
  const missingDependencies = useAppStore((s) => s.missingDependencies)
  const searchTerm = useAppStore((s) => s.dependencySearchTerm)
  const setSearchTerm = useAppStore((s) => s.setDependencySearchTerm)
  const toggleDependencyIncluded = useAppStore((s) => s.toggleDependencyIncluded)
  const toggleAllMissingDependencies = useAppStore((s) => s.toggleAllMissingDependencies)
  const isStale = useAppStore(selectIsAnalysisStale)

  // RT-17(R4·R5)/RT-42 — 이미 Extract 목록(변경 파일·수동 추가)에 있는
  // 경로는 "누락된 의존성"에서 제외한다. includedSet은 IncludedFilesPane도
  // 독립적으로 구하는 값이라(둘 다 deployFiles 원본에서 저렴하게 유도)
  // useIncludedFilesView 전체를 또 호출하지 않고 이 값만 따로 구한다.
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  const { items, allChecked, someChecked, selectedCount } = useMissingDependenciesView(
    missingDependencies,
    searchTerm,
    includedSet
  )

  const title = (
    <FilePaneCountTitle
      label="누락된 의존성"
      selectedCount={selectedCount}
      total={items.length}
      totalBeforeFilter={missingDependencies.length}
      overCountThreshold={OVER_COUNT_THRESHOLD}
    />
  )

  const toolbar = (
    <label className="file-list-column__search">
      검색(파일명):
      <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    </label>
  )

  let body: React.JSX.Element
  if (isStale) {
    body = <PanelState kind="stale" />
  } else if (dependencyAnalyzing) {
    body = <div className="status-text">의존성 확인 중...</div>
  } else if (!dependencyApplicable) {
    body = <PanelState kind="na" detail={dependencyReason ?? undefined} />
  } else {
    body = (
      <FileList
        items={items}
        onToggleItem={toggleDependencyIncluded}
        emptyMessage="누락된 의존성이 없습니다"
        bulkAction={{
          checked: allChecked,
          indeterminate: someChecked && !allChecked,
          // "전체 추가"(add-only 버튼)에서 "전체 선택"(양방향 토글 체크박스)로
          // 교체 — 화면에 실제로 표시 중인 목록(검색어 반영됨)의 경로만 넘긴다.
          onClick: () => toggleAllMissingDependencies(items.map((item) => item.localPath))
        }}
      />
    )
  }

  return <FilePane title={title} toolbar={toolbar} body={body} />
}
