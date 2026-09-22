import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface PopupProps {
  title: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// RT-15(U5·U2) — 재사용 가능한 팝업 뼈대(백드롭 + 박스 + 헤더). 기존
// ManualAddPopup이 직접 구현하던 백드롭·박스·닫기 버튼을 여기로 옮기고
// 동작 버그 두 개를 고쳤다.
//
// U5(포커스 트랩 없음): Esc로 닫히고, 열릴 때 포커스가 안으로 이동해(이미
// 자식이 autoFocus로 포커스를 가져갔으면 그대로 둠) Tab이 팝업 밖으로
// 못 나간다. 닫히면 팝업을 연 트리거 요소로 포커스가 돌아온다.
// U2(뷰포트 기준 높이): `max-height: 60vh`가 실제 부모 컨테이너 높이가
// 아니라 뷰포트 기준이라, 세로 SplitPane을 최소 높이로 줄이면 팝업이
// 넘쳐 헤더 `×`가 잘렸다. `.popup`의 `max-height: 100%`는 `.popup-backdrop`
// (앵커 = 가장 가까운 `position: relative` 조상, 현재는
// `.deploy-files-panel`)의 실제 렌더 높이에서 padding을 뺀 값으로
// 해석되므로 부모가 아무리 낮아져도 그 안에 맞춰 클램프된다.
//
// 전체 표준 크기(720×480 등 RT-54의 PopupHost 스펙)는 P4에서 다시
// 다듬는다 — 지금은 기존 ManualAddPopup의 시각적 크기(480px 폭, 부모
// 중앙)를 유지한 채 동작 버그만 고친다.
export function Popup({ title, onClose, children }: PopupProps): React.JSX.Element {
  const popupRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  // 렌더 단계의 지연 초기화 함수는 이 컴포넌트의 첫 렌더링에서 딱 한 번만
  // 실행되고, 그 시점은 커밋(DOM 반영)·effect보다도 앞선다 — Popup이
  // 뜨기 직전에 포커스가 있던 요소(트리거 버튼)를 가장 확실하게 잡아둘 수
  // 있다(effect 안에서 document.activeElement를 읽으면 그사이 포커스
  // 이동 로직과 순서가 꼬일 여지가 있었다).
  const [triggerElement] = useState<HTMLElement | null>(
    () => document.activeElement as HTMLElement | null
  )

  useEffect(() => {
    const container = popupRef.current
    if (container && !container.contains(document.activeElement)) {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(firstFocusable ?? closeButtonRef.current)?.focus()
    }
    return () => {
      triggerElement?.focus()
    }
  }, [triggerElement])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const container = popupRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div
        className="popup"
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup__header">
          <span>{title}</span>
          <button type="button" ref={closeButtonRef} onClick={onClose} title="닫기">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
