import { describe, expect, it } from 'vitest'
import {
  IpcValidationError,
  assertManualFileInHeadTree,
  assertNonEmptyAbsolutePath,
  assertServerPathsWithinDir
} from './validate'

describe('assertNonEmptyAbsolutePath', () => {
  it('절대 경로면 통과한다', () => {
    expect(() => assertNonEmptyAbsolutePath('/repo/export', 'Export 위치')).not.toThrow()
  })

  it('빈 문자열은 거부한다', () => {
    expect(() => assertNonEmptyAbsolutePath('', 'Export 위치')).toThrow(IpcValidationError)
  })

  it('공백만 있는 문자열도 거부한다', () => {
    expect(() => assertNonEmptyAbsolutePath('   ', 'Export 위치')).toThrow(IpcValidationError)
  })

  it('상대 경로는 거부한다', () => {
    expect(() => assertNonEmptyAbsolutePath('git-deploy-extracted', 'Export 위치')).toThrow(
      IpcValidationError
    )
  })
})

describe('assertServerPathsWithinDir', () => {
  const deployDir = '/repo/git-deploy-extracted'

  it('deployDir 안의 정상 경로는 통과한다', () => {
    expect(() =>
      assertServerPathsWithinDir(deployDir, ['src/main/App.java', 'config/app.properties'])
    ).not.toThrow()
  })

  it('..로 deployDir을 벗어나는 경로는 거부한다', () => {
    expect(() => assertServerPathsWithinDir(deployDir, ['../../etc/passwd'])).toThrow(
      IpcValidationError
    )
  })

  it('선행 슬래시가 있는 serverPath는 join()이 이미 deployDir 하위로 접어 넣는다(안전)', () => {
    // path.join(deployDir, '/etc/passwd')는 path.resolve와 달리 루트로
    // 점프하지 않고 deployDir/etc/passwd로 접힌다 — 실제로 벗어나는 건
    // '..' 세그먼트뿐이라 위 케이스가 진짜 취약점이다. 이 동작을 회귀
    // 테스트로 고정해 둔다.
    expect(() => assertServerPathsWithinDir(deployDir, ['/etc/passwd'])).not.toThrow()
  })

  it('여러 개 중 하나라도 벗어나면 거부한다', () => {
    expect(() => assertServerPathsWithinDir(deployDir, ['ok/file.txt', '../escape.txt'])).toThrow(
      IpcValidationError
    )
  })
})

describe('assertManualFileInHeadTree', () => {
  const headTreeFiles = ['src/main/App.java', 'README.md']

  it('HEAD 트리에 있는 경로는 통과한다', () => {
    expect(() => assertManualFileInHeadTree('src/main/App.java', headTreeFiles)).not.toThrow()
  })

  it('HEAD 트리에 없는 경로는 거부한다', () => {
    expect(() => assertManualFileInHeadTree('../../etc/passwd', headTreeFiles)).toThrow(
      IpcValidationError
    )
  })
})
