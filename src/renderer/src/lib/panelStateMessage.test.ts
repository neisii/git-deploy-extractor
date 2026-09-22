import { describe, expect, it } from 'vitest'
import { panelStateMessage } from './panelStateMessage'

// RT-40 — §5.1 RT-40 명세의 5가지 PanelState 메시지 문구 고정.

describe('panelStateMessage', () => {
  it('empty/loading/stale은 고정 문구', () => {
    expect(panelStateMessage('empty')).toBe('커밋을 선택하세요')
    expect(panelStateMessage('loading')).toBe('계산 중...')
    expect(panelStateMessage('stale')).toBe('선택이 변경되었습니다 — Preview를 눌러 계산하세요')
  })

  it('error는 detail이 있으면 이어붙이고 없으면 기본 문구', () => {
    expect(panelStateMessage('error', 'network timeout')).toBe('계산 실패: network timeout')
    expect(panelStateMessage('error')).toBe('계산 실패')
  })

  it('na는 detail이 있으면 괄호로 이유를 덧붙이고 없으면 기본 문구', () => {
    expect(panelStateMessage('na', 'Java 파일 없음')).toBe(
      '이 저장소에는 적용할 수 없습니다 (Java 파일 없음)'
    )
    expect(panelStateMessage('na')).toBe('이 저장소에는 적용할 수 없습니다')
  })
})
