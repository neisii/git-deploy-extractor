import { useMemo, useState } from 'react'
import { useAppStore, selectIsAnalysisStale } from '../store/appStore'
import type { DeployFilesFilter } from '../store/appStore'
import { FileListColumn } from './deployFiles/FileListColumn'
import type { FileListItem } from './deployFiles/FileListColumn'
import { ManualAddPopup } from './deployFiles/ManualAddPopup'
import { SplitPane } from './SplitPane'
import { matchesAnyActiveExcludePattern } from '../lib/excludePatternMatch'

// RISK_ISSUES.md §7.2 — 파일명(경로의 마지막 조각)에 대한 부분 일치.
// §7.3(파일명으로 커밋 검색)과 동일한 매칭 기준을 좌우 두 검색 필드에도
// 그대로 적용한다.
function matchesFileName(path: string, term: string): boolean {
  if (!term) return true
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  return fileName.toLowerCase().includes(term.toLowerCase())
}

const SPLIT_MIN_PX = 260
const MISSING_DEPENDENCY_OVER_COUNT_THRESHOLD = 50

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

  const includedItems = useMemo((): FileListItem[] => {
    const statusFiltered =
      filter === 'all' ? deployFiles : deployFiles.filter((f) => f.status === filter)
    // 순서: 상태 Filter → 제외 패턴(REQ-019) → 파일명 검색. 전부 AND
    // 조건이라 순서 자체는 결과에 영향 없음(DETAILED_DESIGN.md §12.1).
    return statusFiltered
      .filter((f) => !matchesAnyActiveExcludePattern(f.localPath, excludePatterns))
      .filter((f) => matchesFileName(f.localPath, deployFilesSearchTerm))
      .map((f) => ({ localPath: f.localPath, checked: f.included }))
  }, [deployFiles, filter, excludePatterns, deployFilesSearchTerm])

  const allChecked = includedItems.length > 0 && includedItems.every((f) => f.checked)
  const someChecked = includedItems.some((f) => f.checked)

  // REQ-020 — "선택"(Filter/검색 무관 절대값, 단 제외 패턴엔 영향받음 —
  // 매치되면 실제로 Export 안 되므로)과 "(필터 전 전체)"(모든 필터 무시한
  // 순수 전체)는 원본 deployFiles에서 직접 계산한다(§12.3).
  const includedSelectedCount = useMemo(
    () =>
      deployFiles.filter(
        (f) => f.included && !matchesAnyActiveExcludePattern(f.localPath, excludePatterns)
      ).length,
    [deployFiles, excludePatterns]
  )

  const includedSet = useMemo(() => new Set(deployFiles.map((f) => f.localPath)), [deployFiles])

  // REQ-021/DR-019 — 이미 deployFiles에 있는 경로는 후보에서 미리 제외한다
  // (선택해도 무의미한 no-op이 되는 걸 방지 — 팝업 쪽은 순수 문자열 필터만
  // 하면 되도록 여기서 미리 정리해서 내려준다).
  const manualAddCandidates = useMemo(
    () => headTreeFiles.filter((path) => !includedSet.has(path)),
    [headTreeFiles, includedSet]
  )

  const missingItems = useMemo((): FileListItem[] => {
    return missingDependencies
      .filter((d) => matchesFileName(d.localPath, dependencySearchTerm))
      .map((d) => ({
        localPath: d.localPath,
        checked: includedSet.has(d.localPath),
        extraLabel: d.kind === 'interface' ? '(인터페이스)' : '(구현체)'
      }))
  }, [missingDependencies, dependencySearchTerm, includedSet])

  // 좌측 allChecked/someChecked와 동일한 방식 — 화면에 보이는(검색 적용된)
  // missingItems 기준으로 판정한다(indeterminate 지원을 위해 절대값이 아님).
  const missingAllChecked = missingItems.length > 0 && missingItems.every((f) => f.checked)
  const missingSomeChecked = missingItems.some((f) => f.checked)

  // REQ-020 — 우측은 REQ-019 제외 패턴이 적용 안 되므로 더 단순하다
  // (검색과 무관하게 실제로 추가된 개수).
  const missingSelectedCount = useMemo(
    () => missingDependencies.filter((d) => includedSet.has(d.localPath)).length,
    [missingDependencies, includedSet]
  )

  // 각 박스(좌/우)가 자기 상태(빈/로딩/비적용/stale)를 독립적으로 보여준다
  // — MainGrid의 CommitListPanel/DeploymentPreviewPanel과 같은 패턴(둘 다
  // 각자 `.panel`이고, 부모인 SplitPane 자체는 제목·상태를 갖지 않는다).
  const leftContent = isStale ? (
    <div className="panel file-list-column">
      <div className="deploy-files-panel__header">
        <span className="file-list-column__title">포함된 파일</span>
      </div>
      <div className="status-text">선택이 변경되었습니다 — Preview를 눌러 계산하세요</div>
    </div>
  ) : (
    <FileListColumn
      headerTitle="포함된 파일"
      items={includedItems}
      onToggleItem={toggleIncluded}
      searchTerm={deployFilesSearchTerm}
      onSearchTermChange={setDeployFilesSearchTerm}
      bulkAction={{
        checked: allChecked,
        indeterminate: someChecked && !allChecked,
        // 정정(#33): 화면에 실제로 표시 중인 목록(상태 Filter+검색어 반영됨)의
        // 경로만 넘긴다 — 이전엔 store가 Filter만 다시 계산하고 검색어를
        // 무시했다.
        onClick: () => toggleAll(includedItems.map((item) => item.localPath))
      }}
      extraHeaderControl={
        <label>
          Filter:
          <select value={filter} onChange={(e) => setFilter(e.target.value as DeployFilesFilter)}>
            <option value="all">All</option>
            <option value="added">Added</option>
            <option value="modified">Modified</option>
          </select>
        </label>
      }
      columnWidthKey="includedPath"
      emptyMessage="파일이 없습니다"
      selectedCount={includedSelectedCount}
      totalBeforeFilter={deployFiles.length}
      excludePatterns={excludePatterns}
      onAddExcludePattern={addExcludePattern}
      onToggleExcludePattern={toggleExcludePattern}
      onRemoveExcludePattern={removeExcludePattern}
      onOpenManualAdd={() => setManualAddOpen(true)}
    />
  )

  const rightContent = isStale ? (
    <div className="panel file-list-column">
      <div className="deploy-files-panel__header">
        <span className="file-list-column__title">누락된 의존성</span>
      </div>
      <div className="status-text">선택이 변경되었습니다 — Preview를 눌러 계산하세요</div>
    </div>
  ) : dependencyAnalyzing ? (
    <div className="panel file-list-column">
      <div className="deploy-files-panel__header">
        <span className="file-list-column__title">누락된 의존성</span>
      </div>
      <div className="status-text">의존성 확인 중...</div>
    </div>
  ) : !dependencyApplicable ? (
    <div className="panel file-list-column">
      <div className="deploy-files-panel__header">
        <span className="file-list-column__title">누락된 의존성</span>
      </div>
      <div className="status-text">{dependencyReason ?? '이 저장소에는 적용할 수 없습니다'}</div>
    </div>
  ) : (
    <FileListColumn
      headerTitle="누락된 의존성"
      items={missingItems}
      onToggleItem={toggleDependencyIncluded}
      searchTerm={dependencySearchTerm}
      onSearchTermChange={setDependencySearchTerm}
      bulkAction={{
        checked: missingAllChecked,
        indeterminate: missingSomeChecked && !missingAllChecked,
        // "전체 추가"(add-only 버튼)에서 "전체 선택"(양방향 토글 체크박스)로
        // 교체 — 화면에 실제로 표시 중인 목록(검색어 반영됨)의 경로만 넘긴다.
        onClick: () => toggleAllMissingDependencies(missingItems.map((item) => item.localPath))
      }}
      columnWidthKey="missingPath"
      emptyMessage="누락된 의존성이 없습니다"
      selectedCount={missingSelectedCount}
      totalBeforeFilter={missingDependencies.length}
      overCountThreshold={MISSING_DEPENDENCY_OVER_COUNT_THRESHOLD}
    />
  )

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
        start={leftContent}
        end={rightContent}
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
