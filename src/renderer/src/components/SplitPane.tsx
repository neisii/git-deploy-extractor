import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { loadSplitRatio, saveSplitRatio } from '../lib/splitRatio'

// RISK_ISSUES.md §7.4 — 두 영역의 비율을 마우스 드래그로 조절하는 스플릿
// 페인. 가로(좌우, `direction="horizontal"` 기본값)와 세로(상하,
// `direction="vertical"`) 둘 다 지원한다. 적용 대상 3곳: MainGrid(가로),
// DeployFilesPanel 좌우 분할(가로), MainGrid↔DeployFilesPanel 상하 분할(세로).
//
// RISK #21의 컬럼 리사이즈(handleResizeStart)와는 성격이 다르다 — 그건
// 컬럼 하나의 "최소 폭"을 늘리는 것이었고, 이건 두 영역이 전체 폭/높이를
// 나눠 갖는 비율 자체를 조절한다. 다만 mousedown/mousemove/mouseup 드래그
// 처리 패턴(진행 중엔 로컬 좌표 계산, mouseup에서 한 번 더 같은 계산으로
// 확정 값을 저장 — 드래그 시작 시점의 stale closure를 피하기 위함)은
// 그대로 재사용한다.
interface SplitPaneProps {
  storageKey: string
  defaultRatio: number
  minStartPx: number
  minEndPx: number
  start: ReactNode
  end: ReactNode
  direction?: 'horizontal' | 'vertical'
  className?: string
  // RT-47 — WorkArea가 CommitWorkspace/DeployFilesWorkspace의 접힘 상태를
  // 반영하는 데만 쓴다(다른 두 SplitPane 사용처는 넘기지 않아 기존 동작
  // 그대로). 어느 한쪽이라도 true면 핸들은 비활성(높이/폭 0), 접힌 쪽
  // 트랙은 auto(헤더 높이만), 펼쳐진 쪽은 1fr(남은 공간 전부).
  startCollapsed?: boolean
  endCollapsed?: boolean
}

// 핸들의 실제 드래그 가능 영역(그리드 트랙 크기)은 잡기 편하도록 넓게
// 두되, 눈에 보이는 막대(.split-pane__handle-bar)는 CSS에서 2px로 얇게
// 그린다 — 굵어 보이지 않으면서도 클릭 판정 영역은 좁지 않다.
const HANDLE_HIT_PX = 8

export function SplitPane({
  storageKey,
  defaultRatio,
  minStartPx,
  minEndPx,
  start,
  end,
  direction = 'horizontal',
  className,
  startCollapsed = false,
  endCollapsed = false
}: SplitPaneProps): React.JSX.Element {
  const [ratio, setRatio] = useState(() => loadSplitRatio(storageKey, defaultRatio))
  const containerRef = useRef<HTMLDivElement>(null)
  const isHorizontal = direction === 'horizontal'

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const size = isHorizontal ? rect.width : rect.height
      const origin = isHorizontal ? rect.left : rect.top

      const computeRatio = (clientPos: number): number => {
        if (size <= 0) return ratio
        const raw = (clientPos - origin) / size
        // 컨테이너가 두 최소 크기의 합보다 좁으면(overflow가 이미 넘겨받은
        // 상황) minRatio > maxRatio가 될 수 있다 — 그때는 0.5로 수렴시켜
        // 더 이상 드래그가 이상하게 튀지 않게 한다.
        const minRatio = Math.min(minStartPx / size, 0.5)
        const maxRatio = Math.max(1 - minEndPx / size, 0.5)
        return Math.min(Math.max(raw, minRatio), maxRatio)
      }

      const onMouseMove = (moveEvent: MouseEvent): void => {
        setRatio(computeRatio(isHorizontal ? moveEvent.clientX : moveEvent.clientY))
      }
      const onMouseUp = (upEvent: MouseEvent): void => {
        const finalRatio = computeRatio(isHorizontal ? upEvent.clientX : upEvent.clientY)
        setRatio(finalRatio)
        saveSplitRatio(storageKey, finalRatio)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [minStartPx, minEndPx, storageKey, ratio, isHorizontal]
  )

  // RT-47 — 접힌 쪽은 헤더 높이만(auto), 펼쳐진 쪽은 남은 공간 전부(1fr).
  // 둘 다 접히면 두 헤더가 위에 붙고(auto auto) 나머지는 빈 공간으로
  // 남는다(§5.1 "둘 다 접힘 → 위에 붙임" — .split-pane--vertical의
  // align-content: start가 그 빈 공간을 아래로 밀어낸다).
  const eitherCollapsed = startCollapsed || endCollapsed
  const tracks = eitherCollapsed
    ? `${startCollapsed ? 'auto' : '1fr'} 0px ${endCollapsed ? 'auto' : '1fr'}`
    : `minmax(${minStartPx}px, ${ratio * 100}%) ${HANDLE_HIT_PX}px minmax(${minEndPx}px, 1fr)`
  const style: CSSProperties = isHorizontal
    ? { gridTemplateColumns: tracks }
    : { gridTemplateRows: tracks }

  return (
    <div
      ref={containerRef}
      className={`split-pane split-pane--${direction} ${className ?? ''}`}
      style={style}
    >
      <div className="split-pane__start">{start}</div>
      <div
        className="split-pane__handle"
        onMouseDown={eitherCollapsed ? undefined : handleMouseDown}
        title={isHorizontal ? '드래그해서 좌우 비율 조절' : '드래그해서 상하 비율 조절'}
      >
        <div className="split-pane__handle-bar" />
      </div>
      <div className="split-pane__end">{end}</div>
    </div>
  )
}
