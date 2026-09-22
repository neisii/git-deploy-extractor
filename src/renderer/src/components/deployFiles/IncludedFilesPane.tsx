import { useState } from 'react'
import { useAppStore, selectIsAnalysisStale } from '../../store/appStore'
import type { DeployFilesFilter } from '../../store/appStore'
import { FilePane } from '../FilePane'
import { FileList } from './FileList'
import { FilePaneCountTitle } from './FilePaneCountTitle'
import { PanelState } from '../PanelState'
import { useIncludedFilesView } from '../../lib/useIncludedFilesView'

export interface IncludedFilesPaneProps {
  // ManualAddPopup 자체는 DeployFilesPanel이 좌우 두 Pane을 감싸는 부모
  // (.deploy-files-panel) 중앙에 띄운다 — 이 컴포넌트는 트리거만 갖고
  // "열어달라"고 부모에게 알린다(기존 FileListColumn의 onOpenManualAdd와
  // 같은 이유).
  onOpenManualAdd: () => void
}

// RT-42 — DeployFilesPanel.tsx에 인라인으로 있던 좌측("포함된 파일") 조립을
// 뺐다. CommitListPanel 등 다른 *Panel과 같은 방식으로 스토어를 직접
// 구독하는 독립 컴포넌트다 — "좌측 전용 prop 없음"은 FilePane(순수 슬롯
// primitive) 얘기고, 이 컴포넌트 자체는 이름 그대로 좌측 전용이라 store
// 접근을 가져도 된다.
export function IncludedFilesPane({ onOpenManualAdd }: IncludedFilesPaneProps): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filter = useAppStore((s) => s.deployFilesFilter)
  const setFilter = useAppStore((s) => s.setDeployFilesFilter)
  const searchTerm = useAppStore((s) => s.deployFilesSearchTerm)
  const setSearchTerm = useAppStore((s) => s.setDeployFilesSearchTerm)
  const excludePatterns = useAppStore((s) => s.excludePatterns)
  const addExcludePattern = useAppStore((s) => s.addExcludePattern)
  const toggleExcludePattern = useAppStore((s) => s.toggleExcludePattern)
  const removeExcludePattern = useAppStore((s) => s.removeExcludePattern)
  const toggleIncluded = useAppStore((s) => s.toggleDeployFileIncluded)
  const toggleAll = useAppStore((s) => s.toggleAllDeployFiles)
  const isStale = useAppStore(selectIsAnalysisStale)

  // RT-41 — 제외 패턴 입력값(옛 FileListColumn 로컬 state).
  const [newPattern, setNewPattern] = useState('')

  const { items, allChecked, someChecked, selectedCount } = useIncludedFilesView(
    deployFiles,
    filter,
    excludePatterns,
    searchTerm
  )

  const title = (
    <FilePaneCountTitle
      label="포함된 파일"
      selectedCount={selectedCount}
      total={items.length}
      totalBeforeFilter={deployFiles.length}
    />
  )

  const toolbar = (
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
          value={searchTerm}
          placeholder="*.html, *List.html"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={onOpenManualAdd}
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
        // 정정(#33): 화면에 실제로 표시 중인 목록(상태 Filter+검색어 반영됨)의
        // 경로만 넘긴다 — 이전엔 store가 Filter만 다시 계산하고 검색어를
        // 무시했다.
        onClick: () => toggleAll(items.map((item) => item.localPath))
      }}
    />
  )

  return <FilePane title={title} toolbar={toolbar} body={body} />
}
