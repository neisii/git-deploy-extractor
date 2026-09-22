import { describe, expect, it } from 'vitest'
import { assertSafeRevisionArg, GitArgumentError } from './exec'

// RT-24 — git/exec.ts의 옵션 인젝션 방지 규약(revision 인자는 '-' 시작
// 여부만 막는다, pathspec은 이미 각 호출부가 `--`로 막고 있다). 여기서는
// 이 규약의 핵심 판단 함수만 단위로 검증한다 — 실제 git 호출 경로에서의
// 통합 검증은 commits.test.ts(branch)·diff.test.ts(commitHash) 참고.
describe('assertSafeRevisionArg', () => {
  it("'-'로 시작하는 값은 GitArgumentError를 던진다", () => {
    expect(() => assertSafeRevisionArg('--output=/tmp/pwned', '브랜치')).toThrow(GitArgumentError)
    expect(() => assertSafeRevisionArg('-x', '커밋 해시')).toThrow(GitArgumentError)
  })

  it('정상적인 브랜치명·커밋 해시는 그대로 통과한다', () => {
    expect(() => assertSafeRevisionArg('main', '브랜치')).not.toThrow()
    expect(() => assertSafeRevisionArg('feature/foo', '브랜치')).not.toThrow()
    expect(() => assertSafeRevisionArg('a1b2c3d', '커밋 해시')).not.toThrow()
  })
})
