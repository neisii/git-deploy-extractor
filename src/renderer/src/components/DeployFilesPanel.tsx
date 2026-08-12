import { useMemo } from 'react'
import { useAppStore, selectIsAnalysisStale } from '../store/appStore'
import type { DeployFilesFilter } from '../store/appStore'
import { FileListColumn } from './deployFiles/FileListColumn'
import type { FileListItem } from './deployFiles/FileListColumn'
import { SplitPane } from './SplitPane'

// RISK_ISSUES.md §7.2 — 파일명(경로의 마지막 조각)에 대한 부분 일치.
// §7.3(파일명으로 커밋 검색)과 동일한 매칭 기준을 좌우 두 검색 필드에도
// 그대로 적용한다.
function matchesFileName(path: string, term: string): boolean {
  if (!term) return true
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  return fileName.toLowerCase().includes(term.toLowerCase())
}

const SPLIT_MIN_PX = 260

export function DeployFilesPanel(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filter = useAppStore((s) => s.deployFilesFilter)
  const setFilter = useAppStore((s) => s.setDeployFilesFilter)
  const deployFilesSearchTerm = useAppStore((s) => s.deployFilesSearchTerm)
  const setDeployFilesSearchTerm = useAppStore((s) => s.setDeployFilesSearchTerm)
  const warnings = useAppStore((s) => s.warnings)
  const toggleIncluded = useAppStore((s) => s.toggleDeployFileIncluded)
  const toggleAll = useAppStore((s) => s.toggleAllDeployFiles)

  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const dependencyApplicable = useAppStore((s) => s.dependencyApplicable)
  const dependencyReason = useAppStore((s) => s.dependencyReason)
  const missingDependencies = useAppStore((s) => s.missingDependencies)
  const dependencyParseWarnings = useAppStore((s) => s.dependencyParseWarnings)
  const dependencySearchTerm = useAppStore((s) => s.dependencySearchTerm)
  const setDependencySearchTerm = useAppStore((s) => s.setDependencySearchTerm)
  const toggleDependencyIncluded = useAppStore((s) => s.toggleDependencyIncluded)
  const addAllMissingDependencies = useAppStore((s) => s.addAllMissingDependencies)

  const isStale = useAppStore(selectIsAnalysisStale)

  const includedItems = useMemo((): FileListItem[] => {
    const statusFiltered =
      filter === 'all' ? deployFiles : deployFiles.filter((f) => f.status === filter)
    return statusFiltered
      .filter((f) => matchesFileName(f.localPath, deployFilesSearchTerm))
      .map((f) => ({ localPath: f.localPath, checked: f.included }))
  }, [deployFiles, filter, deployFilesSearchTerm])

  const allChecked = includedItems.length > 0 && includedItems.every((f) => f.checked)
  const someChecked = includedItems.some((f) => f.checked)

  const includedSet = useMemo(() => new Set(deployFiles.map((f) => f.localPath)), [deployFiles])

  const missingItems = useMemo((): FileListItem[] => {
    return missingDependencies
      .filter((d) => matchesFileName(d.localPath, dependencySearchTerm))
      .map((d) => ({
        localPath: d.localPath,
        checked: includedSet.has(d.localPath),
        extraLabel: d.kind === 'interface' ? '(인터페이스)' : '(구현체)'
      }))
  }, [missingDependencies, dependencySearchTerm, includedSet])

  const allMissingAdded =
    missingDependencies.length > 0 && missingDependencies.every((d) => includedSet.has(d.localPath))

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
        kind: 'checkbox',
        label: '전체 선택',
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
        kind: 'button',
        label: '전체 추가',
        // 정정(#33): 화면에 실제로 표시 중인 목록(검색어 반영됨)의 경로만
        // 넘긴다 — 이전엔 검색어를 완전히 무시하고 항상 전체를 대상으로 했다.
        onClick: () => addAllMissingDependencies(missingItems.map((item) => item.localPath)),
        disabled: missingDependencies.length === 0 || allMissingAdded
      }}
      columnWidthKey="missingPath"
      emptyMessage="누락된 의존성이 없습니다"
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
    </div>
  )
}
