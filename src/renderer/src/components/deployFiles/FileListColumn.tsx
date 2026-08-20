import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { loadColumnWidths, saveColumnWidths } from '../../lib/columnWidths'
import type { ColumnWidths } from '../../lib/columnWidths'
import type { ExcludePatternEntry } from '../../lib/excludePatterns'

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

// 좌우 둘 다 같은 체크박스 하나로 통일됐다(우측도 "전체 추가"에서 "전체
// 선택"으로 바뀌면서 kind:'button' 변형이 더 이상 쓰이지 않게 되어 제거).
export interface BulkSelectAction {
  checked: boolean
  indeterminate: boolean
  onClick: () => void
}

interface FileListColumnProps {
  headerTitle: string
  items: FileListItem[] // 상태 필터 + 검색 + 제외 패턴이 이미 적용된 상태로 전달받는다
  onToggleItem: (localPath: string) => void
  searchTerm: string
  onSearchTermChange: (term: string) => void
  bulkAction: BulkSelectAction
  extraHeaderControl?: ReactNode // 좌측의 Filter 드롭다운 자리(우측엔 없음)
  columnWidthKey: keyof ColumnWidths
  emptyMessage: string
  searchPlaceholder?: string
  // REQ-020 — "선택"/"(필터 전 전체)"는 Filter/검색과 무관한 절대값이라
  // items에서 파생할 수 없다. DeployFilesPanel.tsx가 원본 배열 기준으로
  // 계산해서 내려준다.
  selectedCount: number
  totalBeforeFilter: number
  // REQ-020 — "누락된 의존성"에만 50을 넘겨준다("포함된 파일"은 전달 안 함
  // → 경고 비활성).
  overCountThreshold?: number
  // REQ-019/DR-018 — "포함된 파일"에만 전달한다(누락된 의존성엔 적용 안 함).
  // 셋 다 없으면 이 UI 자체가 렌더링되지 않는다.
  excludePatterns?: ExcludePatternEntry[]
  onAddExcludePattern?: (pattern: string) => void
  onToggleExcludePattern?: (pattern: string) => void
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
  searchPlaceholder,
  selectedCount,
  totalBeforeFilter,
  overCountThreshold,
  excludePatterns,
  onAddExcludePattern,
  onToggleExcludePattern
}: FileListColumnProps): React.JSX.Element {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = bulkAction.indeterminate
    }
  }, [bulkAction])

  const [newPattern, setNewPattern] = useState('')

  // REQ-020 — "전체"(=items.length, 상태 Filter+검색+제외패턴 적용 후 화면
  // 표시 개수)만 여기서 파생 계산한다. "선택"/"(필터 전 전체)"는 원본 배열이
  // 있어야 계산 가능해 DeployFilesPanel.tsx가 prop으로 내려준다(§12.3).
  const total = items.length
  const isOverThreshold = overCountThreshold !== undefined && total > overCountThreshold

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
    <div className="panel file-list-column">
      <div className="deploy-files-panel__header">
        <span className="file-list-column__title">
          {headerTitle} (선택 {selectedCount}개/
          <span
            className={isOverThreshold ? 'status-text--error' : undefined}
            title={isOverThreshold ? '50개를 초과했습니다' : undefined}
          >
            전체 {total}개
          </span>
          (필터 전 전체 {totalBeforeFilter}개))
        </span>
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
      {excludePatterns && onAddExcludePattern && onToggleExcludePattern && (
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
                onAddExcludePattern(newPattern)
                setNewPattern('')
              }}
            />
          </label>
          <button
            onClick={() => {
              onAddExcludePattern(newPattern)
              setNewPattern('')
            }}
          >
            +추가
          </button>
          {excludePatterns.length > 0 && (
            <div className="file-list-column__exclude-pattern-chips">
              {excludePatterns.map((p) => (
                <button
                  key={p.pattern}
                  type="button"
                  className={
                    p.enabled
                      ? 'exclude-pattern-chip exclude-pattern-chip--active'
                      : 'exclude-pattern-chip'
                  }
                  onClick={() => onToggleExcludePattern(p.pattern)}
                  title={p.enabled ? '클릭하면 이 패턴을 끕니다' : '클릭하면 이 패턴을 켭니다'}
                >
                  {p.pattern}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="deploy-files-panel__scroll" ref={scrollRef} style={scrollStyle}>
        <div className="deploy-files-grid-row deploy-files-panel__columns">
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={bulkAction.checked}
            onChange={() => bulkAction.onClick()}
            title={bulkAction.checked ? '전체 해제' : '전체 선택'}
          />
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
              // DETAILED_DESIGN.md §12.2 — react-window List가 세로 가상
              // 스크롤을 위해 자기 루트에 overflowY:auto를 설정하면 CSS
              // 스펙상 overflow-x도 auto로 강제 승격되어, 바깥 컨테이너
              // (.deploy-files-panel__scroll)와 별개로 자체 가로 스크롤
              // 컨텍스트가 생겼다(300개 초과 시 재현 확인). 이 컴포넌트가
              // 내부에서 style prop을 마지막에 spread한다는 걸 소스로
              // 확인해 overflowX:hidden으로 억제 — 가로 스크롤은 항상
              // 바깥 컨테이너 하나만 담당하게 한다.
              style={{ height: '100%', overflowX: 'hidden' }}
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
