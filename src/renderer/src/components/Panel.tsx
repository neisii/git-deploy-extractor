import type { ReactNode } from 'react'

interface SlotProps {
  children: ReactNode
  className?: string
}

// RT-40 — 테두리 + 헤더 + 스크롤 본문 뼈대. 본문(PanelBody)만
// `fill-scroll`(RT-50, flex:1 + `min-height: 0`) + `overflow: auto`를
// 가져서, 넘치는 내용이 있어도 헤더는 고정된 채 본문 안에서만 스크롤된다.
//
// 기존 `.panel`(assets/components/shell.css) 클래스는 지금도 여러 화면이
// 헤더/본문 구분 없이 단일 `<div>`로 쓰고 있어(예: PreviewSummary), 그 시맨틱을 바꾸면
// 안 된다. 그래서 이 primitive는 새 클래스(`panel-frame`)를 쓴다 — 기존
// 화면이 이 컴포넌트로 옮겨가는 시점(RT-41 이후)에 `.panel`을 걷어내고
// 하나로 합친다.
export function Panel({ children, className }: SlotProps): React.JSX.Element {
  return <div className={['panel-frame', className].filter(Boolean).join(' ')}>{children}</div>
}

export function PanelHeader({ children, className }: SlotProps): React.JSX.Element {
  return (
    <div className={['panel-frame__header', className].filter(Boolean).join(' ')}>{children}</div>
  )
}

export function PanelBody({ children, className }: SlotProps): React.JSX.Element {
  return (
    <div className={['panel-frame__body', 'fill-scroll', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
