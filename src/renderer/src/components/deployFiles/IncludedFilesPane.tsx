import { useAppStore, selectIsAnalysisStale } from '../../store/appStore'
import { FilePane } from '../FilePane'
import { FileList } from './FileList'
import { FilePaneCountTitle } from './FilePaneCountTitle'
import { PanelState } from '../PanelState'
import { FilterPatternBar } from './FilterPatternBar'
import { useIncludedFilesView } from '../../lib/useIncludedFilesView'

export interface IncludedFilesPaneProps {
  // 실제 팝업은 WorkArea가 소유한 PopupHost가 렌더링한다(RT-43) — 이
  // 컴포넌트는 트리거만 갖고 "열어달라"고 부모(DeployFilesPanel)에게
  // 알린다(기존 FileListColumn의 onOpenManualAdd와 같은 이유).
  onOpenManualAdd: () => void
}

// RT-42 — DeployFilesPanel.tsx에 인라인으로 있던 좌측("포함된 파일") 조립을
// 뺐다. CommitListPanel 등 다른 *Panel과 같은 방식으로 스토어를 직접
// 구독하는 독립 컴포넌트다 — "좌측 전용 prop 없음"은 FilePane(순수 슬롯
// primitive) 얘기고, 이 컴포넌트 자체는 이름 그대로 좌측 전용이라 store
// 접근을 가져도 된다.
//
// RT-45(U-3·U-5) — 상태 Filter(all/added/modified) UI와 파일명 검색
// (REQ-025)을 삭제했다. 검색 대체 안전장치(M-1)는 FilterPatternBar의
// screenOnly 옵션. `+ 파일 추가`를 toolbar 줄에서 제목 줄 우측으로 옮겼다.
//
// RT-46 — 제외 패턴 입력·칩 UI를 FilterPatternBar로 뺐다(모드 선택
// (제외/포함)·쉼표 다중 입력·해석 오버레이·"활성 K개" 요약이 새로 생겨
// 이 파일에 인라인으로 두기엔 너무 커졌다).
export function IncludedFilesPane({ onOpenManualAdd }: IncludedFilesPaneProps): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filePatterns = useAppStore((s) => s.filePatterns)
  const toggleIncluded = useAppStore((s) => s.toggleDeployFileIncluded)
  const toggleAll = useAppStore((s) => s.toggleAllDeployFiles)
  const isStale = useAppStore(selectIsAnalysisStale)

  const { items, allChecked, someChecked, selectedCount, patternHiddenCount } =
    useIncludedFilesView(deployFiles, filePatterns)

  const title = (
    <>
      <FilePaneCountTitle
        label="포함된 파일"
        selectedCount={selectedCount}
        total={items.length}
        totalBeforeFilter={deployFiles.length}
      />
      <button
        type="button"
        className="add-file-button"
        onClick={onOpenManualAdd}
        title="HEAD 트리의 임의 파일을 배포 대상에 직접 추가합니다"
      >
        + 파일 추가
      </button>
    </>
  )

  const toolbar = <FilterPatternBar hiddenCount={patternHiddenCount} />

  const body = isStale ? (
    <PanelState kind="stale" />
  ) : (
    <FileList
      items={items}
      onToggleItem={toggleIncluded}
      emptyMessage="파일이 없습니다"
      bulkAction={{
        checked: allChecked,
        indeterminate: someChecked && !allChecked,
        // 정정(#33): 화면에 실제로 표시 중인 목록(RT-45 이후: 파일 패턴만
        // 반영됨)의 경로만 넘긴다 — 이전엔 store가 필터를 다시 계산했다.
        onClick: () => toggleAll(items.map((item) => item.localPath))
      }}
    />
  )

  return <FilePane title={title} toolbar={toolbar} body={body} />
}
