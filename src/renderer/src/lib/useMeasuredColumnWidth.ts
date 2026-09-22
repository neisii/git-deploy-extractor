import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const MIN_COLUMN_WIDTH = 100

// RT-41 — FileListColumn이 갖고 있던 컬럼 실측 폭 계산만 남기고 리사이즈는
// 삭제했다(사용자 결정 2026-09-21: 컬럼이 하나뿐이고 헤더 텍스트도 없어져
// 수동으로 넓힐 이유가 없어짐). 300개 초과 시 react-window 가상 스크롤은
// 화면 밖 행이 렌더링되지 않아 그 행들의 텍스트 폭이 스크롤 영역 폭에
// 반영되지 않는다 — 그래서 전체 아이템 텍스트를 canvas로 미리 재서
// 가로 스크롤이 필요한 최대 폭을 계산해 둔다(DETAILED_DESIGN.md §12.2).
//
// 예전엔 헤더 라벨("Local Path") 폭도 같이 쟀지만, 그 라벨 자체가
// 삭제되어 더 이상 잴 대상이 아니다 — 이제 아이템 텍스트만 본다.
//
// RT-53(TreeList 도입) 이후: 트리 들여쓰기 깊이만큼 폭이 늘어나므로
// (깊이×14px), 그때는 `itemTexts`에 들여쓰기를 반영한 유효 폭을 미리
// 계산해서 넘기거나 이 훅에 depth 파라미터를 추가해야 한다 — 지금은
// 평평한 목록이라 해당 없음.
export function useMeasuredColumnWidth(itemTexts: string[]): {
  naturalWidth: number
  probeRef: RefObject<HTMLSpanElement | null>
} {
  const probeRef = useRef<HTMLSpanElement>(null)
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [naturalWidth, setNaturalWidth] = useState(MIN_COLUMN_WIDTH)

  useLayoutEffect(() => {
    const probeEl = probeRef.current
    if (!probeEl) return
    if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement('canvas')
    const ctx = measureCanvasRef.current.getContext('2d')
    if (!ctx) return

    const computed = getComputedStyle(probeEl)
    ctx.font = computed.font
    const padding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight)

    let max = MIN_COLUMN_WIDTH
    for (const text of itemTexts) {
      max = Math.max(max, Math.ceil(ctx.measureText(text).width + padding))
    }
    setNaturalWidth(max)
  }, [itemTexts])

  return { naturalWidth, probeRef }
}
