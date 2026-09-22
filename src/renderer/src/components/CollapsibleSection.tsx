import { useEffect } from 'react'
import type { ReactNode } from 'react'

export interface CollapsibleSectionProps {
  title: string
  // 접힌 상태에서 헤더 스트립에 보이는 요약(예: "활성 3개").
  summary?: ReactNode
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}

// RT-40 — 구조 규칙(사용자 결정 2026-09-21): 제목·접기 버튼이 있는 헤더
// 행은 접히는 본문 박스의 **밖(위)**에 놓는다 — 헤더 행은 접히지 않는
// 얇은 스트립, 본문만 그 아래에서 접힌다. 헤더를 본문 박스 안에 감싸면
// 접기 버튼이 그 영역의 일부처럼 보여 커밋·배포 영역과 모양이 달라진다.
//
// 본문은 collapsed여도 unmount하지 않는다(HTML `hidden` 속성으로만
// 숨김) — 입력 중이던 값(예: 필터 패턴 입력창)이 접었다 펼쳐도 그대로
// 남는다.
export function CollapsibleSection({
  title,
  summary,
  collapsed,
  onToggle,
  children
}: CollapsibleSectionProps): React.JSX.Element {
  // RT-47이 WorkArea의 grid 행 재분배·PopupHost의 "속한 섹션이 접히면
  // 팝업 닫기"에 쓸 신호. 이 컴포넌트는 자신을 감싼 조상이 누구인지
  // 모르므로(재사용 가능한 primitive) props로 직접 알릴 방법이 없어
  // DOM CustomEvent로 발행한다 — 실제로 듣는 쪽(WorkArea)은 RT-47에서
  // 붙는다, 지금은 이 컴포넌트가 신호를 내보내는 것까지만 확정한다.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(collapsed ? 'section:hide' : 'section:show', { detail: { title } })
    )
  }, [collapsed, title])

  return (
    <div className="collapsible-section">
      <div className="collapsible-section__header">
        <span className="collapsible-section__title">{title}</span>
        {collapsed && summary != null && (
          <span className="collapsible-section__summary">{summary}</span>
        )}
        <button
          type="button"
          className="collapsible-section__toggle"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {collapsed ? '▾ 펼치기' : '▴ 접기'}
        </button>
      </div>
      <div className="collapsible-section__body" hidden={collapsed}>
        {children}
      </div>
    </div>
  )
}
