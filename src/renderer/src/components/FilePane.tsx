import type { ReactNode } from 'react'
import { Panel, PanelHeader, PanelBody } from './Panel'

export interface FilePaneProps {
  title: ReactNode
  toolbar?: ReactNode
  body: ReactNode
}

// RT-41 — RT-40의 Panel/PanelHeader/PanelBody 위에 지은 슬롯 컴포넌트.
// "좌측 전용 prop 없음"(§5.1 RT-41/42 명세) — excludePatterns나
// onOpenManualAdd 같은 도메인 지식은 이 컴포넌트가 모른다. 호출부
// (지금은 DeployFilesPanel.tsx, RT-42 이후 IncludedFilesPane 등)가
// toolbar/body에 원하는 내용을 그대로 조립해서 넘긴다.
//
// body는 stale 등 분석 상태에서도 PanelState로만 바뀌고 title/toolbar는
// 그대로 유지된다(U1) — 그건 이 컴포넌트가 강제하는 게 아니라, 호출부가
// body prop에 무엇을 넘기느냐로 결정된다(FilePane 자신은 title/toolbar를
// 조건 없이 항상 렌더링할 뿐이다).
export function FilePane({ title, toolbar, body }: FilePaneProps): React.JSX.Element {
  return (
    <Panel className="file-pane">
      <PanelHeader className="file-pane__header">
        <div className="file-pane__title">{title}</div>
        {toolbar != null && <div className="file-pane__toolbar">{toolbar}</div>}
      </PanelHeader>
      <PanelBody className="file-pane__body">{body}</PanelBody>
    </Panel>
  )
}
