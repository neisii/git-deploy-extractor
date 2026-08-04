import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { useAppStore } from '../store/appStore'
import type { DeployFileEntry, DeployFilesFilter } from '../store/appStore'
import { loadColumnWidths, saveColumnWidths } from '../lib/columnWidths'
import type { ColumnWidths } from '../lib/columnWidths'

// 300개 기준은 UI_UX_SPEC.md §2.6의 대략치 — 행 하나(체크박스+경로 2열)
// 기준이며 실사용 데이터로 재조정 가능하다.
const VIRTUALIZE_THRESHOLD = 300
const ROW_HEIGHT = 28
const MIN_COLUMN_WIDTH = 100

type ColumnKey = 'localPath' | 'serverPath'

const CSS_VAR: Record<ColumnKey, string> = {
  localPath: '--local-col-min',
  serverPath: '--server-col-min'
}

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
    <div
      style={{ ...style, width: 'max-content' }}
      className="deploy-files-grid-row deploy-files-row"
    >
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

  // 컬럼 폭: 리사이즈는 "최소 폭"을 지정하는 것일 뿐이다. 실제 폭은
  // (최소 폭, 내용 길이) 중 큰 값으로 CSS가 결정하므로(minmax(.., max-content))
  // 아무리 좁게 줄여도 텍스트가 잘리거나 옆 칸을 침범하지 않는다 — 넘치는
  // 만큼은 항상 가로 스크롤로 해결된다.
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => loadColumnWidths())
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ column: ColumnKey; startX: number; startWidth: number } | null>(null)

  const scrollStyle = useMemo(() => {
    const style: Record<string, string> = {}
    if (columnWidths.localPath) style[CSS_VAR.localPath] = `${columnWidths.localPath}px`
    if (columnWidths.serverPath) style[CSS_VAR.serverPath] = `${columnWidths.serverPath}px`
    return style as CSSProperties
  }, [columnWidths])

  const handleResizeStart = useCallback(
    (column: ColumnKey) => (event: ReactMouseEvent<HTMLSpanElement>) => {
      event.preventDefault()
      const headerCell = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-col]')
      const startWidth = headerCell?.getBoundingClientRect().width ?? 200
      dragState.current = { column, startX: event.clientX, startWidth }

      const computeWidth = (clientX: number): number => {
        const drag = dragState.current
        if (!drag) return MIN_COLUMN_WIDTH
        return Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + (clientX - drag.startX)))
      }

      const onMouseMove = (moveEvent: MouseEvent): void => {
        if (!dragState.current || !scrollRef.current) return
        scrollRef.current.style.setProperty(
          CSS_VAR[dragState.current.column],
          `${computeWidth(moveEvent.clientX)}px`
        )
      }
      const onMouseUp = (upEvent: MouseEvent): void => {
        if (dragState.current) {
          const finalWidth = computeWidth(upEvent.clientX)
          const column = dragState.current.column
          setColumnWidths((prev) => {
            const next = { ...prev, [column]: finalWidth }
            saveColumnWidths(next)
            return next
          })
        }
        dragState.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    []
  )

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
      <div className="deploy-files-panel__scroll" ref={scrollRef} style={scrollStyle}>
        <div className="deploy-files-grid-row deploy-files-panel__columns">
          <span></span>
          <span data-col="localPath" className="deploy-files-panel__col-header">
            Local Path
            <span
              className="deploy-files-resize-handle"
              onMouseDown={handleResizeStart('localPath')}
              title="드래그해서 최소 폭 조절"
            />
          </span>
          <span data-col="serverPath" className="deploy-files-panel__col-header">
            Server Path
            <span
              className="deploy-files-resize-handle"
              onMouseDown={handleResizeStart('serverPath')}
              title="드래그해서 최소 폭 조절"
            />
          </span>
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
              style={{ height: '100%' }}
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
    </div>
  )
}
