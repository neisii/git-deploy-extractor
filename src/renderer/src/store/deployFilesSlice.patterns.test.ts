import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from './appStore'
import { setApiForTesting, resetApiForTesting } from '../api'
import type { Api } from '../api'
import { loadLegacyFilePatterns } from '../lib/filePatterns'

// initFilePatterns()의 마이그레이션 분기는 lib/filePatterns.ts의
// loadLegacyFilePatterns()(localStorage 기반)에 의존하는데, 이 vitest
// 환경(environment: 'node')에는 실제 localStorage 전역이 없다(Node 22도
// 기본 비활성) — 그 함수 자체를 목킹해 반환값만 통제한다.
vi.mock('../lib/filePatterns', () => ({
  loadLegacyFilePatterns: vi.fn(() => [])
}))

// RT-46 — addFilePatterns/toggleFilePattern/removeFilePattern(§3.1·§5.1)
// 동작 검증. REQ-026 정정(2026-09-28) — 저장이 patterns:save IPC(파일
// 기반)로 바뀌면서, api.patterns.save를 목킹해 실제 IPC 왕복 없이
// 상태(filePatterns 배열)와 addFilePatterns의 반환값(피드백 문구용
// added/activated)만 검증한다.

describe('addFilePatterns (RT-46)', () => {
  beforeEach(() => {
    useAppStore.setState({ filePatterns: [] })
    setApiForTesting({
      patterns: { save: async () => undefined }
    } as unknown as Api)
  })

  afterEach(() => resetApiForTesting())

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
    setApiForTesting({
      patterns: { save: async () => undefined }
    } as unknown as Api)
  })

  afterEach(() => resetApiForTesting())

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

// REQ-026 정정(2026-09-28) — initFilePatterns()의 로드/마이그레이션 분기.
describe('initFilePatterns (REQ-026)', () => {
  beforeEach(() => {
    useAppStore.setState({ filePatterns: [] })
    vi.mocked(loadLegacyFilePatterns).mockReturnValue([])
  })

  afterEach(() => resetApiForTesting())

  it('patterns.json에 데이터가 있으면 그대로 채우고 마이그레이션하지 않는다', async () => {
    const save = vi.fn(async () => undefined)
    setApiForTesting({
      patterns: {
        load: async () => [{ pattern: '*.png', mode: 'exclude', enabled: true }],
        save
      }
    } as unknown as Api)

    await useAppStore.getState().initFilePatterns()

    expect(useAppStore.getState().filePatterns).toEqual([
      { pattern: '*.png', mode: 'exclude', enabled: true }
    ])
    expect(save).not.toHaveBeenCalled()
  })

  it('patterns.json이 비어있고 예전 localStorage 값이 있으면 마이그레이션한다', async () => {
    vi.mocked(loadLegacyFilePatterns).mockReturnValue([
      { pattern: '*.md', mode: 'include', enabled: false }
    ])
    const save = vi.fn(async () => undefined)
    setApiForTesting({
      patterns: { load: async () => [], save }
    } as unknown as Api)

    await useAppStore.getState().initFilePatterns()

    expect(useAppStore.getState().filePatterns).toEqual([
      { pattern: '*.md', mode: 'include', enabled: false }
    ])
    expect(save).toHaveBeenCalledWith([{ pattern: '*.md', mode: 'include', enabled: false }])
  })

  it('patterns.json도 비어있고 예전 값도 없으면 빈 배열로 둔다', async () => {
    const save = vi.fn(async () => undefined)
    setApiForTesting({
      patterns: { load: async () => [], save }
    } as unknown as Api)

    await useAppStore.getState().initFilePatterns()

    expect(useAppStore.getState().filePatterns).toEqual([])
    expect(save).not.toHaveBeenCalled()
  })
})
