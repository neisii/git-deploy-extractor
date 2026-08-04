import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { useAppStore } from '../store/appStore'
import type { DeployFileEntry, DeployFilesFilter } from '../store/appStore'

// 300개 기준은 UI_UX_SPEC.md §2.6의 대략치 — 행 하나(체크박스+경로 2열)
// 기준이며 실사용 데이터로 재조정 가능하다.
const VIRTUALIZE_THRESHOLD = 300
const ROW_HEIGHT = 28

function DeployFileRow({
  file,
  onToggle,
  style
}: {
  file: DeployFileEntry
  onToggle: (localPath: string) => void
  style?: CSSProperties
}): React.JSX.Element {
  return (
    <div style={style} className="deploy-files-grid-row deploy-files-row">
      <input type="checkbox" checked={file.included} onChange={() => onToggle(file.localPath)} />
      <span className="deploy-files-row__local">{file.localPath}</span>
      <span className="deploy-files-row__server">
        {file.localPath === file.serverPath ? '(경로 그대로 유지)' : file.serverPath}
      </span>
    </div>
  )
}

interface VirtualRowProps {
  files: DeployFileEntry[]
  onToggle: (localPath: string) => void
}

function VirtualRow({
  index,
  style,
  files,
  onToggle
}: RowComponentProps<VirtualRowProps>): React.JSX.Element {
  return <DeployFileRow file={files[index]} onToggle={onToggle} style={style} />
}

export function DeployFilesPanel(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filter = useAppStore((s) => s.deployFilesFilter)
  const setFilter = useAppStore((s) => s.setDeployFilesFilter)
  const warnings = useAppStore((s) => s.warnings)
  const toggleIncluded = useAppStore((s) => s.toggleDeployFileIncluded)
  const toggleAll = useAppStore((s) => s.toggleAllDeployFiles)

  const filtered = useMemo(
    () => (filter === 'all' ? deployFiles : deployFiles.filter((f) => f.status === filter)),
    [deployFiles, filter]
  )

  // 전체 선택 체크 상태는 저장하지 않고 매번 파생 계산한다 (UI_UX_SPEC.md §2.6)
  const allChecked = filtered.length > 0 && filtered.every((f) => f.included)
  const someChecked = filtered.some((f) => f.included)
  const indeterminate = someChecked && !allChecked

  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <div className="panel deploy-files-panel">
      <div className="deploy-files-panel__header">
        <label>
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => toggleAll()}
          />
          전체 선택
        </label>
        <span>Deploy Files (HEAD Latest Version)</span>
        <label>
          Filter:
          <select value={filter} onChange={(e) => setFilter(e.target.value as DeployFilesFilter)}>
            <option value="all">All</option>
            <option value="added">Added</option>
            <option value="modified">Modified</option>
          </select>
        </label>
      </div>
      {warnings.length > 0 && (
        <div className="warning-banner">{warnings.length}개 파일이 HEAD에 없어 제외되었습니다</div>
      )}
      <div className="deploy-files-grid-row deploy-files-panel__columns">
        <span></span>
        <span>Local Path</span>
        <span>Server Path</span>
      </div>
      <div className="deploy-files-panel__body">
        {filtered.length === 0 ? (
          <div className="status-text">파일이 없습니다</div>
        ) : filtered.length > VIRTUALIZE_THRESHOLD ? (
          <List
            rowComponent={VirtualRow}
            rowCount={filtered.length}
            rowHeight={ROW_HEIGHT}
            rowProps={{ files: filtered, onToggle: toggleIncluded }}
            style={{ height: '100%', width: '100%' }}
          />
        ) : (
          filtered.map((file) => (
            <DeployFileRow
              key={file.localPath}
              file={file}
              onToggle={toggleIncluded}
              style={{ height: ROW_HEIGHT }}
            />
          ))
        )}
      </div>
    </div>
  )
}
