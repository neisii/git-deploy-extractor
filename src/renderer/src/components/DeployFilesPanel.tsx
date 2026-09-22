import { useMemo, useState } from 'react'
import { useAppStore, selectIsAnalysisStale } from '../store/appStore'
import type { DeployFilesFilter } from '../store/appStore'
import { FilePane } from './FilePane'
import { FileList } from './deployFiles/FileList'
import { PanelState } from './PanelState'
import { ManualAddPopup } from './deployFiles/ManualAddPopup'
import { SplitPane } from './SplitPane'
import { useIncludedFilesView } from '../lib/useIncludedFilesView'
import { useMissingDependenciesView } from '../lib/useMissingDependenciesView'

const SPLIT_MIN_PX = 260
const MISSING_DEPENDENCY_OVER_COUNT_THRESHOLD = 50

// RT-41 — FileListColumn이 내부에서 조립하던 제목 문구(선택/전체/필터 전
// 전체 세 숫자, REQ-020)를 FilePane의 title 슬롯에 넘길 값으로 여기서
// 직접 만든다. overCountThreshold는 "누락된 의존성"에만 넘어온다(50 초과
// 경고, "포함된 파일"은 항상 undefined라 경고 없음 — 원래 동작 그대로).
function buildCountTitle(
  label: string,
  selectedCount: number,
  total: number,
  totalBeforeFilter: number,
  overCountThreshold?: number
): React.JSX.Element {
  const isOverThreshold = overCountThreshold !== undefined && total > overCountThreshold
  return (
    <span className="file-pane__title-text">
      {label} (선택 {selectedCount}개/
      <span
        className={isOverThreshold ? 'status-text--error' : undefined}
        title={isOverThreshold ? `${overCountThreshold}개를 초과했습니다` : undefined}
      >
        전체 {total}개
      </span>
      (필터 전 전체 {totalBeforeFilter}개))
    </span>
  )
}

export function DeployFilesPanel(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filter = useAppStore((s) => s.deployFilesFilter)
  const setFilter = useAppStore((s) => s.setDeployFilesFilter)
  const deployFilesSearchTerm = useAppStore((s) => s.deployFilesSearchTerm)
  const setDeployFilesSearchTerm = useAppStore((s) => s.setDeployFilesSearchTerm)
  const excludePatterns = useAppStore((s) => s.excludePatterns)
  const addExcludePattern = useAppStore((s) => s.addExcludePattern)
  const toggleExcludePattern = useAppStore((s) => s.toggleExcludePattern)
  const removeExcludePattern = useAppStore((s) => s.removeExcludePattern)
  const warnings = useAppStore((s) => s.warnings)
  const toggleIncluded = useAppStore((s) => s.toggleDeployFileIncluded)
  const toggleAll = useAppStore((s) => s.toggleAllDeployFiles)

  // REQ-021/DR-019 — 배포 대상 파일 수동 추가
  const headTreeFiles = useAppStore((s) => s.headTreeFiles)
  const manuallyAddedPaths = useAppStore((s) => s.manuallyAddedPaths)
  const addManualFile = useAppStore((s) => s.addManualFile)
  const removeManualFile = useAppStore((s) => s.removeManualFile)
  // 팝업 열림 상태는 store에 둘 이유가 없는 순수 UI 상태다 — 부모
  // (.deploy-files-panel) 중앙에 띄우려면 좌우 두 컬럼과 같은 레벨(여기)에서
  // 소유해야 한다(2026-08-22 정정 — 원래는 FileListColumn 로컬 상태였음).
  const [manualAddOpen, setManualAddOpen] = useState(false)
  // RT-41 — 제외 패턴 입력값(옛 FileListColumn 로컬 state)도 toolbar 조립을
  // DeployFilesPanel이 직접 맡게 되며 여기로 옮겨왔다.
  const [newPattern, setNewPattern] = useState('')

  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const dependencyApplicable = useAppStore((s) => s.dependencyApplicable)
  const dependencyReason = useAppStore((s) => s.dependencyReason)
  const missingDependencies = useAppStore((s) => s.missingDependencies)
  const dependencyParseWarnings = useAppStore((s) => s.dependencyParseWarnings)
  const dependencySearchTerm = useAppStore((s) => s.dependencySearchTerm)
  const setDependencySearchTerm = useAppStore((s) => s.setDependencySearchTerm)
  const toggleDependencyIncluded = useAppStore((s) => s.toggleDependencyIncluded)
  const toggleAllMissingDependencies = useAppStore((s) => s.toggleAllMissingDependencies)

  const isStale = useAppStore(selectIsAnalysisStale)

  // RT-34(S1) — 좌측 "포함된 파일"/우측 "누락된 의존성" 파생 계산을
  // 훅으로 뺐다(useIncludedFilesView/useMissingDependenciesView). 동작은
  // 그대로다 — includedSet은 두 훅이 공유(누락된 의존성 중복 제거,
  // RT-17 R4·R5).
  const {
    items: includedItems,
    allChecked,
    someChecked,
    selectedCount: includedSelectedCount,
    includedSet
  } = useIncludedFilesView(deployFiles, filter, excludePatterns, deployFilesSearchTerm)

  const {
    items: missingItems,
    allChecked: missingAllChecked,
    someChecked: missingSomeChecked,
    selectedCount: missingSelectedCount
  } = useMissingDependenciesView(missingDependencies, dependencySearchTerm, includedSet)

  // REQ-021/DR-019 — 이미 deployFiles에 있는 경로는 후보에서 미리 제외한다
  // (선택해도 무의미한 no-op이 되는 걸 방지 — 팝업 쪽은 순수 문자열 필터만
  // 하면 되도록 여기서 미리 정리해서 내려준다).
  const manualAddCandidates = useMemo(
    () => headTreeFiles.filter((path) => !includedSet.has(path)),
    [headTreeFiles, includedSet]
  )

  // RT-41(S4·U1) — FileListColumn 해체: 목록 렌더링(FileList)과 툴바
  // 조립(검색·제외 패턴·+ 파일 추가 버튼)을 분리했다. FilePane은
  // "좌측 전용 prop 없음"이라 이 조립은 DeployFilesPanel이 직접 맡는다
  // (RT-42에서 IncludedFilesPane으로 옮겨갈 예정). stale이어도 title·
  // toolbar는 항상 렌더링되고 body만 PanelState로 바뀐다(U1 — 입력
  // 중이던 검색어·제외 패턴 초안이 stale 전환에도 사라지지 않는다).
  const leftTitle = buildCountTitle(
    '포함된 파일',
    includedSelectedCount,
    includedItems.length,
    deployFiles.length
  )

  const leftToolbar = (
    <>
      <label>
        Filter:
        <select value={filter} onChange={(e) => setFilter(e.target.value as DeployFilesFilter)}>
          <option value="all">All</option>
          <option value="added">Added</option>
          <option value="modified">Modified</option>
        </select>
      </label>
      <label className="file-list-column__search">
        검색(파일명):
        <input
          type="text"
          value={deployFilesSearchTerm}
          placeholder="*.html, *List.html"
          onChange={(e) => setDeployFilesSearchTerm(e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => setManualAddOpen(true)}
        title="HEAD 트리의 임의 파일을 배포 대상에 직접 추가합니다"
      >
        + 파일 추가
      </button>
      <div className="file-list-column__exclude-patterns">
        <label>
          제외 패턴:
          <input
            type="text"
            value={newPattern}
            placeholder="*.png"
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              addExcludePattern(newPattern)
              setNewPattern('')
            }}
          />
        </label>
        <button
          onClick={() => {
            addExcludePattern(newPattern)
            setNewPattern('')
          }}
        >
          +추가
        </button>
        {excludePatterns.length > 0 && (
          <div className="file-list-column__exclude-pattern-chips">
            {excludePatterns.map((p) => (
              <span
                key={p.pattern}
                className={
                  p.enabled
                    ? 'exclude-pattern-chip exclude-pattern-chip--active'
                    : 'exclude-pattern-chip'
                }
              >
                <button
                  type="button"
                  className="exclude-pattern-chip__label"
                  onClick={() => toggleExcludePattern(p.pattern)}
                  title={p.enabled ? '클릭하면 이 패턴을 끕니다' : '클릭하면 이 패턴을 켭니다'}
                >
                  {p.pattern}
                </button>
                <button
                  type="button"
                  className="exclude-pattern-chip__remove"
                  onClick={() => removeExcludePattern(p.pattern)}
                  title="이 패턴을 이력에서 삭제합니다"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )

  const leftBody = isStale ? (
    <PanelState kind="stale" />
  ) : (
    <FileList
      items={includedItems}
      onToggleItem={toggleIncluded}
      emptyMessage="파일이 없습니다"
      bulkAction={{
        checked: allChecked,
        indeterminate: someChecked && !allChecked,
        // 정정(#33): 화면에 실제로 표시 중인 목록(상태 Filter+검색어 반영됨)의
        // 경로만 넘긴다 — 이전엔 store가 Filter만 다시 계산하고 검색어를
        // 무시했다.
        onClick: () => toggleAll(includedItems.map((item) => item.localPath))
      }}
    />
  )

  const rightTitle = buildCountTitle(
    '누락된 의존성',
    missingSelectedCount,
    missingItems.length,
    missingDependencies.length,
    MISSING_DEPENDENCY_OVER_COUNT_THRESHOLD
  )

  const rightToolbar = (
    <label className="file-list-column__search">
      검색(파일명):
      <input
        type="text"
        value={dependencySearchTerm}
        onChange={(e) => setDependencySearchTerm(e.target.value)}
      />
    </label>
  )

  let rightBody: React.JSX.Element
  if (isStale) {
    rightBody = <PanelState kind="stale" />
  } else if (dependencyAnalyzing) {
    rightBody = <div className="status-text">의존성 확인 중...</div>
  } else if (!dependencyApplicable) {
    rightBody = <PanelState kind="na" detail={dependencyReason ?? undefined} />
  } else {
    rightBody = (
      <FileList
        items={missingItems}
        onToggleItem={toggleDependencyIncluded}
        emptyMessage="누락된 의존성이 없습니다"
        bulkAction={{
          checked: missingAllChecked,
          indeterminate: missingSomeChecked && !missingAllChecked,
          // "전체 추가"(add-only 버튼)에서 "전체 선택"(양방향 토글 체크박스)로
          // 교체 — 화면에 실제로 표시 중인 목록(검색어 반영됨)의 경로만 넘긴다.
          onClick: () => toggleAllMissingDependencies(missingItems.map((item) => item.localPath))
        }}
      />
    )
  }

  return (
    <div className="deploy-files-panel">
      <div className="deploy-files-panel__title">Deploy Files (HEAD Latest Version)</div>
      {warnings.length > 0 && (
        <div className="warning-banner">{warnings.length}개 파일이 HEAD에 없어 제외되었습니다</div>
      )}
      {dependencyParseWarnings.length > 0 && (
        <div className="warning-banner">
          {dependencyParseWarnings.length}개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다
        </div>
      )}
      <SplitPane
        className="deploy-files-panel__split"
        storageKey="gde:splitRatio:deployFiles"
        defaultRatio={0.5}
        minStartPx={SPLIT_MIN_PX}
        minEndPx={SPLIT_MIN_PX}
        start={<FilePane title={leftTitle} toolbar={leftToolbar} body={leftBody} />}
        end={<FilePane title={rightTitle} toolbar={rightToolbar} body={rightBody} />}
      />
      {manualAddOpen && (
        <ManualAddPopup
          candidates={manualAddCandidates}
          addedPaths={manuallyAddedPaths}
          onAdd={addManualFile}
          onRemove={removeManualFile}
          onClose={() => setManualAddOpen(false)}
        />
      )}
    </div>
  )
}
