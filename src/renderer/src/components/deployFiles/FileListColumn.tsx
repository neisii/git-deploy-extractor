import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { loadColumnWidths, saveColumnWidths } from '../../lib/columnWidths'
import type { ColumnWidths } from '../../lib/columnWidths'

// RISK_ISSUES.md §7.2 point 8 — DeployFilesPanel의 좌(포함된 파일)/우(누락된
// 의존성) 두 목록이 공유하는 단일 컬럼 체크리스트. §7.1에서 Server Path
// 열을 지우고 남은 단일 컬럼 실측 폭 계산/리사이즈/가상 스크롤 로직을
// 그대로 재사용한다(RISK #21 메커니즘 노트가 예고한 정리) — 컬럼 폭
// 저장 키(columnWidthKey)만 좌/우가 다르게 넘겨받아 독립적으로 유지된다.

const VIRTUALIZE_THRESHOLD = 300
const ROW_HEIGHT = 28
const MIN_COLUMN_WIDTH = 100
const HEADER_LABEL = 'Local Path'

const CSS_VAR_MIN = '--local-col-min'
const CSS_VAR_NATURAL = '--local-col-natural'

export interface FileListItem {
  localPath: string
  checked: boolean
  extraLabel?: string // 예: "(인터페이스)" / "(구현체)" — 우측 패널 전용
}

export type BulkAction =
  | {
      kind: 'checkbox'
      label: string
      checked: boolean
      indeterminate: boolean
      onClick: () => void
    }
  | { kind: 'button'; label: string; onClick: () => void; disabled?: boolean }

interface FileListColumnProps {
  headerTitle: string
  items: FileListItem[] // 상태 필터 + 검색이 이미 적용된 상태로 전달받는다
  onToggleItem: (localPath: string) => void
  searchTerm: string
  onSearchTermChange: (term: string) => void
  bulkAction: BulkAction
  extraHeaderControl?: ReactNode // 좌측의 Filter 드롭다운 자리(우측엔 없음)
  columnWidthKey: keyof ColumnWidths
  emptyMessage: string
  searchPlaceholder?: string
}

function displayText(item: FileListItem): string {
  return item.extraLabel ? `${item.localPath} ${item.extraLabel}` : item.localPath
}

function Row({
  item,
  onToggle,
  style
}: {
  item: FileListItem
  onToggle: (localPath: string) => void
  style?: CSSProperties
}): React.JSX.Element {
  return (
    <div
      style={{ ...style, width: 'max-content' }}
      className="deploy-files-grid-row deploy-files-row"
    >
      <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.localPath)} />
      <span
        className="deploy-files-row__local deploy-files-row__local--clickable"
        onClick={() => onToggle(item.localPath)}
      >
        {item.localPath}
        {item.extraLabel && (
          <span className="deploy-files-row__extra-label"> {item.extraLabel}</span>
        )}
      </span>
    </div>
  )
}

interface VirtualRowProps {
  items: FileListItem[]
  onToggle: (localPath: string) => void
}

function VirtualRow({
  index,
  style,
  items,
  onToggle
}: RowComponentProps<VirtualRowProps>): React.JSX.Element {
  return <Row item={items[index]} onToggle={onToggle} style={style} />
}

export function FileListColumn({
  headerTitle,
  items,
  onToggleItem,
  searchTerm,
  onSearchTermChange,
  bulkAction,
  extraHeaderControl,
  columnWidthKey,
  emptyMessage,
  searchPlaceholder
}: FileListColumnProps): React.JSX.Element {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current && bulkAction.kind === 'checkbox') {
      headerCheckboxRef.current.indeterminate = bulkAction.indeterminate
    }
  }, [bulkAction])

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

    let max = measure(headerEl, HEADER_LABEL)
    for (const item of items) {
      max = Math.max(max, measure(rowEl, displayText(item)))
    }
    setNaturalWidth(Math.max(max, MIN_COLUMN_WIDTH))
  }, [items])

  const scrollStyle = useMemo(() => {
    const style: Record<string, string> = {}
    const min = columnWidths[columnWidthKey] ?? MIN_COLUMN_WIDTH
    if (columnWidths[columnWidthKey]) style[CSS_VAR_MIN] = `${columnWidths[columnWidthKey]}px`
    style[CSS_VAR_NATURAL] = `${Math.max(naturalWidth, min)}px`
    return style as CSSProperties
  }, [columnWidths, columnWidthKey, naturalWidth])

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>) => {
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
            const next = { ...prev, [columnWidthKey]: finalWidth }
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
    [columnWidthKey]
  )

  return (
    <div className="file-list-column">
      <div className="deploy-files-panel__header">
        <span className="file-list-column__title">{headerTitle}</span>
        {bulkAction.kind === 'checkbox' ? (
          <label>
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={bulkAction.checked}
              onChange={() => bulkAction.onClick()}
            />
            {bulkAction.label}
          </label>
        ) : (
          <button onClick={() => bulkAction.onClick()} disabled={bulkAction.disabled}>
            {bulkAction.label}
          </button>
        )}
        {extraHeaderControl}
      </div>
      <label className="file-list-column__search">
        검색(파일명):
        <input
          type="text"
          value={searchTerm}
          placeholder={searchPlaceholder}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </label>
      <div className="deploy-files-panel__scroll" ref={scrollRef} style={scrollStyle}>
        <div className="deploy-files-grid-row deploy-files-panel__columns">
          <span></span>
          <span data-col="path" className="deploy-files-panel__col-header">
            {HEADER_LABEL}
            <span
              className="deploy-files-resize-handle"
              onMouseDown={handleResizeStart}
              title="드래그해서 최소 폭 조절"
            />
          </span>
          {/* 컬럼 실측 폭 계산용 — 화면에 보이지 않고 레이아웃에도 관여하지 않는다 */}
          <span
            ref={probeHeaderRef}
            data-col="path"
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
          {items.length === 0 ? (
            <div className="status-text">{emptyMessage}</div>
          ) : items.length > VIRTUALIZE_THRESHOLD ? (
            <List
              rowComponent={VirtualRow}
              rowCount={items.length}
              rowHeight={ROW_HEIGHT}
              rowProps={{ items, onToggle: onToggleItem }}
              style={{ height: '100%' }}
            />
          ) : (
            items.map((item) => (
              <Row
                key={item.localPath}
                item={item}
                onToggle={onToggleItem}
                style={{ height: ROW_HEIGHT }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
