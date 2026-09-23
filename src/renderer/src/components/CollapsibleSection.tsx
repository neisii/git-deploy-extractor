import { useEffect } from 'react'
import type { ReactNode } from 'react'

export interface CollapsibleSectionProps {
  // RT-47 — section:hide/show 이벤트 detail.key. 섹션마다 고유한 식별자
  // (예: 'commitQuery'/'commits'/'deployFiles').
  sectionKey: string
  title: string
  // RT-47(M-7) — 이 섹션의 접힘 상태를 누가 소유하는지(detail.owner). 'local'은
  // 컴포넌트 자신(예: BranchSearchBar), 'workArea'는 WorkArea가 소유 —
  // WorkArea의 section:hide 리스너가 owner==='workArea'인 섹션이 접힐 때만
  // 열린 팝업을 닫는다(자신이 관리하는 섹션에만 반응).
  owner: 'local' | 'workArea'
  // 접힌 상태에서 헤더 스트립에 보이는 요약(예: "활성 3개").
  summary?: ReactNode
  // RT-47(M-8) — 접힌 상태에서도 헤더에 남겨둘 액션(예: 커밋 섹션의 Preview
  // 버튼). summary와 마찬가지로 접혔을 때만 렌더링한다 — 펼쳤을 때는 본문
  // 안의 원래 버튼이 이미 보이므로 중복 표시하지 않는다.
  headerActions?: ReactNode
  // RT-47 — CommitWorkspace/DeployFilesWorkspace는 SplitPane이 배정한 grid
  // cell을 꽉 채워야 한다(다른 모든 SplitPane 자식과 같은 관례 — commit-
  // list-panel/deploy-files-panel 등이 전부 height:100%를 직접 선언한다).
  // CommitQueryBar(BranchSearchBar)는 app-shell의 평범한 flex 자식이라
  // height:100%를 주면 안 된다(부모 app-shell의 전체 높이(100vh)로
  // 튀어 레이아웃이 깨진다) — 자기 콘텐츠 높이만큼만 차지해야 한다.
  fill?: boolean
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
  sectionKey,
  title,
  owner,
  summary,
  headerActions,
  fill = false,
  collapsed,
  onToggle,
  children
}: CollapsibleSectionProps): React.JSX.Element {
  // RT-47 — WorkArea의 grid 행 재분배·PopupHost의 "속한 섹션이 접히면
  // 팝업 닫기"(M-7)에 쓰는 신호. 이 컴포넌트는 자신을 감싼 조상이 누구인지
  // 모르므로(재사용 가능한 primitive) props로 직접 알릴 방법이 없어
  // DOM CustomEvent로 발행한다. §5.1 RT-47 명세대로 detail은 { key, name,
  // owner } 세 필드, bubbles: true.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(collapsed ? 'section:hide' : 'section:show', {
        detail: { key: sectionKey, name: title, owner },
        bubbles: true
      })
    )
  }, [collapsed, sectionKey, title, owner])

  return (
    <div className={`collapsible-section${fill ? ' fill' : ''}`}>
      <div className="collapsible-section__header">
        <span className="collapsible-section__title">{title}</span>
        {collapsed && summary != null && (
          <span className="collapsible-section__summary">{summary}</span>
        )}
        {collapsed && headerActions}
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
