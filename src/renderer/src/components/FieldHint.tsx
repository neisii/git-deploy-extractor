import { useEffect, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

export interface FieldHintProps {
  id: string
  anchorRef: RefObject<HTMLElement | null>
  visible: boolean
  children: ReactNode
}

interface Rect {
  top: number
  left: number
  width: number
}

// RT-49(§5.1) — 입력을 시작하면(placeholder가 사라지면) 포커스 중인 필드
// 바로 아래에 겹쳐 뜨는 힌트 툴팁(레이아웃을 밀지 않음, M-42(d) "아래"
// 채택). 일반 문서 흐름에 끼워 넣는 대신 position:fixed로 뷰포트 좌표를
// 직접 계산한다 — 이 필드들은 가로 SplitPane(.split-pane--horizontal의
// overflow-x:auto) 안에 있어서, 조상에 position:absolute로 얹으면
// overflow-y가 auto로 강제 승격되어(CSS 스펙상 overflow-x/-y 중 하나만
// visible이 아니면 나머지도 auto가 된다) 아래로 넘치는 툴팁이 그
// 컨테이너 안에 갇혀 잘린다(실측 확인) — position:fixed는 조상의
// overflow에 영향받지 않는다(이 화면엔 transform 등 새 containing
// block을 만드는 조상이 없다, main.css 확인).
export function FieldHint({
  id,
  anchorRef,
  visible,
  children
}: FieldHintProps): React.JSX.Element | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!visible) return
    const update = (): void => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.bottom, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('resize', update)
    // scroll 이벤트는 버블링하지 않으므로 capture 단계에서 들어야 가로
    // SplitPane의 overflow-x 스크롤(좁은 창) 같은 임의의 조상 스크롤도
    // 잡힌다.
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [visible, anchorRef])

  if (!visible || !rect) return null

  return (
    <div
      id={id}
      role="status"
      className="field-hint"
      style={{ top: rect.top, left: rect.left, minWidth: rect.width }}
    >
      {children}
    </div>
  )
}
