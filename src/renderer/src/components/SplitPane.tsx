import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { loadSplitRatio, saveSplitRatio } from '../lib/splitRatio'

// RISK_ISSUES.md §7.4 — 좌우 두 영역의 폭 비율을 마우스 드래그로 조절하는
// 스플릿 페인. 적용 대상은 정확히 2곳(MainGrid, DeployFilesPanel 좌우
// 분할) — 둘 다 이 컴포넌트를 재사용한다.
//
// RISK #21의 컬럼 리사이즈(handleResizeStart)와는 성격이 다르다 — 그건
// 컬럼 하나의 "최소 폭"을 늘리는 것이었고, 이건 두 영역이 전체 폭을 나눠
// 갖는 비율 자체를 조절한다. 다만 mousedown/mousemove/mouseup 드래그 처리
// 패턴(진행 중엔 로컬 좌표 계산, mouseup에서 한 번 더 같은 계산으로 확정
// 값을 저장 — 드래그 시작 시점의 stale closure를 피하기 위함)은 그대로
// 재사용한다.
interface SplitPaneProps {
  storageKey: string
  defaultRatio: number
  minLeftPx: number
  minRightPx: number
  left: ReactNode
  right: ReactNode
  className?: string
}

const HANDLE_WIDTH_PX = 6

export function SplitPane({
  storageKey,
  defaultRatio,
  minLeftPx,
  minRightPx,
  left,
  right,
  className
}: SplitPaneProps): React.JSX.Element {
  const [ratio, setRatio] = useState(() => loadSplitRatio(storageKey, defaultRatio))
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      const computeRatio = (clientX: number): number => {
        if (rect.width <= 0) return ratio
        const raw = (clientX - rect.left) / rect.width
        // 컨테이너가 두 최소 폭의 합보다 좁으면(overflow-x가 이미 넘겨받은
        // 상황) minRatio > maxRatio가 될 수 있다 — 그때는 0.5로 수렴시켜
        // 더 이상 드래그가 이상하게 튀지 않게 한다.
        const minRatio = Math.min(minLeftPx / rect.width, 0.5)
        const maxRatio = Math.max(1 - minRightPx / rect.width, 0.5)
        return Math.min(Math.max(raw, minRatio), maxRatio)
      }

      const onMouseMove = (moveEvent: MouseEvent): void => {
        setRatio(computeRatio(moveEvent.clientX))
      }
      const onMouseUp = (upEvent: MouseEvent): void => {
        const finalRatio = computeRatio(upEvent.clientX)
        setRatio(finalRatio)
        saveSplitRatio(storageKey, finalRatio)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [minLeftPx, minRightPx, storageKey, ratio]
  )

  const style: CSSProperties = {
    gridTemplateColumns: `minmax(${minLeftPx}px, ${ratio * 100}%) ${HANDLE_WIDTH_PX}px minmax(${minRightPx}px, 1fr)`
  }

  return (
    <div ref={containerRef} className={`split-pane ${className ?? ''}`} style={style}>
      <div className="split-pane__left">{left}</div>
      <div
        className="split-pane__handle"
        onMouseDown={handleMouseDown}
        title="드래그해서 좌우 비율 조절"
      />
      <div className="split-pane__right">{right}</div>
    </div>
  )
}
