import { describe, expect, it } from 'vitest'
import { createRequestGuard } from './requestGuard'

describe('createRequestGuard', () => {
  it('start()는 매번 새 id를 발급하고 그 id만 isCurrent가 true', () => {
    const guard = createRequestGuard()
    const a = guard.start()
    expect(guard.isCurrent(a)).toBe(true)

    const b = guard.start()
    expect(guard.isCurrent(a)).toBe(false)
    expect(guard.isCurrent(b)).toBe(true)
  })

  it('current()는 발급 없이 지금 세대를 반환한다(다음 페이지처럼 새로 시작하지 않는 후속 요청용)', () => {
    const guard = createRequestGuard()
    const a = guard.start()
    expect(guard.current()).toBe(a)
    guard.start()
    expect(guard.current()).not.toBe(a)
  })

  it('start()를 반환값 없이 호출하면(무효화) 이전에 발급된 id는 전부 stale이 된다', () => {
    const guard = createRequestGuard()
    const a = guard.start()
    const b = guard.start()
    guard.start() // Reload처럼 "무효화만" 하고 id는 안 쓰는 경우
    expect(guard.isCurrent(a)).toBe(false)
    expect(guard.isCurrent(b)).toBe(false)
  })
})
