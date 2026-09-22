import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'

// RT-46 — addFilePatterns/toggleFilePattern/removeFilePattern(§3.1·§5.1)
// 동작 검증. 저장(localStorage)은 이 vitest 환경(environment: 'node')에서는
// 조용히 실패할 뿐이다(filePatterns.ts의 try/catch) — 여기서는 상태
// 자체(filePatterns 배열)와 addFilePatterns의 반환값(피드백 문구용
// added/activated)만 검증한다.

describe('addFilePatterns (RT-46)', () => {
  beforeEach(() => {
    useAppStore.setState({ filePatterns: [] })
  })

  it('쉼표로 구분한 여러 패턴이 한 번에 추가되고 모드가 전체에 적용된다', () => {
    const result = useAppStore.getState().addFilePatterns('*.png, *.md', 'exclude')
    expect(result).toEqual({ added: 2, activated: 0 })
    expect(useAppStore.getState().filePatterns).toEqual([
      { pattern: '*.png', mode: 'exclude', enabled: true },
      { pattern: '*.md', mode: 'exclude', enabled: true }
    ])
  })

  it('붙여 넣은 여러 줄(줄바꿈)도 쉼표와 동일하게 나뉜다', () => {
    const result = useAppStore.getState().addFilePatterns('*.png\n*.md', 'include')
    expect(result).toEqual({ added: 2, activated: 0 })
    expect(useAppStore.getState().filePatterns.map((p) => p.mode)).toEqual(['include', 'include'])
  })

  it('같은 입력 안의 중복은 한 번만 추가된다', () => {
    const result = useAppStore.getState().addFilePatterns('*.png, *.png', 'exclude')
    expect(result).toEqual({ added: 1, activated: 0 })
    expect(useAppStore.getState().filePatterns).toHaveLength(1)
  })

  it('빈 항목만 있으면 아무것도 추가되지 않는다', () => {
    const result = useAppStore.getState().addFilePatterns(', ,,', 'exclude')
    expect(result).toEqual({ added: 0, activated: 0 })
    expect(useAppStore.getState().filePatterns).toEqual([])
  })

  it('이미 있는 (pattern, mode)는 새로 추가하지 않고 활성화만 한다', () => {
    useAppStore.setState({
      filePatterns: [{ pattern: '*.png', mode: 'exclude', enabled: false }]
    })
    const result = useAppStore.getState().addFilePatterns('*.png', 'exclude')
    expect(result).toEqual({ added: 0, activated: 1 })
    expect(useAppStore.getState().filePatterns).toEqual([
      { pattern: '*.png', mode: 'exclude', enabled: true }
    ])
  })

  it('중복 추가 시(이미 활성) 항목 수가 늘지 않는다', () => {
    useAppStore.getState().addFilePatterns('*.png', 'exclude')
    useAppStore.getState().addFilePatterns('*.png', 'exclude')
    expect(useAppStore.getState().filePatterns).toHaveLength(1)
  })

  it('같은 패턴 문자열이라도 모드가 다르면 별도 항목이다', () => {
    useAppStore.getState().addFilePatterns('*.png', 'exclude')
    useAppStore.getState().addFilePatterns('*.png', 'include')
    expect(useAppStore.getState().filePatterns).toHaveLength(2)
  })
})

describe('toggleFilePattern / removeFilePattern (RT-46)', () => {
  beforeEach(() => {
    useAppStore.setState({
      filePatterns: [
        { pattern: '*.png', mode: 'exclude', enabled: true },
        { pattern: '*.png', mode: 'include', enabled: true }
      ]
    })
  })

  it('(pattern, mode)가 일치하는 항목만 토글한다', () => {
    useAppStore.getState().toggleFilePattern('*.png', 'exclude')
    expect(useAppStore.getState().filePatterns).toEqual([
      { pattern: '*.png', mode: 'exclude', enabled: false },
      { pattern: '*.png', mode: 'include', enabled: true }
    ])
  })

  it('(pattern, mode)가 일치하는 항목만 삭제한다', () => {
    useAppStore.getState().removeFilePattern('*.png', 'exclude')
    expect(useAppStore.getState().filePatterns).toEqual([
      { pattern: '*.png', mode: 'include', enabled: true }
    ])
  })
})
