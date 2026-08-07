import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { useAppStore, selectIsAnalysisStale } from '../store/appStore'
import type { DeployFileEntry, DeployFilesFilter } from '../store/appStore'
import { loadColumnWidths, saveColumnWidths } from '../lib/columnWidths'
import type { ColumnWidths } from '../lib/columnWidths'

// 300개 기준은 UI_UX_SPEC.md §2.6의 대략치 — 행 하나(체크박스+경로 1열)
// 기준이며 실사용 데이터로 재조정 가능하다.
const VIRTUALIZE_THRESHOLD = 300
const ROW_HEIGHT = 28
const MIN_COLUMN_WIDTH = 100

const CSS_VAR_MIN = '--local-col-min'
const CSS_VAR_NATURAL = '--local-col-natural'

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
      <span
        className="deploy-files-row__local deploy-files-row__local--clickable"
        onClick={() => onToggle(file.localPath)}
      >
        {file.localPath}
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
  const isStale = useAppStore(selectIsAnalysisStale)

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
  // (최소 폭, 내용 폭) 중 큰 값으로 결정된다. 내용 폭은 CSS의 max-content에
  // 맡기지 않는다 — 헤더/각 행이 서로 별도의 grid 컨테이너라 max-content가
  // 행마다 독립적으로 계산되어 헤더와 목록의 폭이 어긋나는 문제가 있었다.
  // 대신 전체 필터링된 행 + 헤더 라벨 중 가장 넓은 실측 폭을 JS로 계산해
  // 모든 행(가상 스크롤 포함)에 동일하게 주입한다.
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => loadColumnWidths())
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  const [naturalWidth, setNaturalWidth] = useState<number>(MIN_COLUMN_WIDTH)
  const probeHeaderRef = useRef<HTMLSpanElement>(null)
  const probeRowRef = useRef<HTMLSpanElement>(null)
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useLayoutEffect(() => {
    const headerEl = probeHeaderRef.current
    const rowEl = probeRowRef.current
    if (!headerEl || !rowEl) return

    if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement('canvas')
    const ctx = measureCanvasRef.current.getContext('2d')
    if (!ctx) return

    const measure = (el: HTMLElement, text: string): number => {
      const computed = getComputedStyle(el)
      ctx.font = computed.font
      const padding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight)
      return Math.ceil(ctx.measureText(text).width + padding)
    }

    let max = measure(headerEl, 'Local Path')
    for (const file of filtered) {
      max = Math.max(max, measure(rowEl, file.localPath))
    }
    setNaturalWidth(Math.max(max, MIN_COLUMN_WIDTH))
  }, [filtered])

  const scrollStyle = useMemo(() => {
    const style: Record<string, string> = {}
    const min = columnWidths.localPath ?? MIN_COLUMN_WIDTH
    if (columnWidths.localPath) style[CSS_VAR_MIN] = `${columnWidths.localPath}px`
    style[CSS_VAR_NATURAL] = `${Math.max(naturalWidth, min)}px`
    return style as CSSProperties
  }, [columnWidths, naturalWidth])

  const handleResizeStart = useCallback((event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    const headerCell = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-col]')
    const startWidth = headerCell?.getBoundingClientRect().width ?? 200
    dragState.current = { startX: event.clientX, startWidth }

    const computeWidth = (clientX: number): number => {
      const drag = dragState.current
      if (!drag) return MIN_COLUMN_WIDTH
      return Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + (clientX - drag.startX)))
    }

    const onMouseMove = (moveEvent: MouseEvent): void => {
      if (!dragState.current || !scrollRef.current) return
      scrollRef.current.style.setProperty(CSS_VAR_MIN, `${computeWidth(moveEvent.clientX)}px`)
    }
    const onMouseUp = (upEvent: MouseEvent): void => {
      if (dragState.current) {
        const finalWidth = computeWidth(upEvent.clientX)
        setColumnWidths((prev) => {
          const next = { ...prev, localPath: finalWidth }
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
  }, [])

  if (isStale) {
    return (
      <div className="panel deploy-files-panel">
        선택이 변경되었습니다 — Preview를 눌러 계산하세요
      </div>
    )
  }

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
              onMouseDown={handleResizeStart}
              title="드래그해서 최소 폭 조절"
            />
          </span>
          {/* 컬럼 실측 폭 계산용 — 화면에 보이지 않고 레이아웃에도 관여하지 않는다 */}
          <span
            ref={probeHeaderRef}
            data-col="localPath"
            className="deploy-files-panel__col-header deploy-files-measure-probe"
            aria-hidden
          />
        </div>
        <span
          ref={probeRowRef}
          className="deploy-files-row__local deploy-files-measure-probe"
          aria-hidden
        />
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
