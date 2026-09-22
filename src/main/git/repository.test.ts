import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { validateRepository, listBranches, pickDefaultBranch } from './repository'
import { cleanupRepo, initRepo, sh } from '../testSupport/gitFixture'

// scripts/verify-phase1.ts (a)(b)(b-1)의 이식.

describe('validateRepository', () => {
  it('유효한 git 저장소는 valid: true', async () => {
    const dir = initRepo('gde-repo-')
    try {
      const result = await validateRepository(dir)
      expect(result.valid).toBe(true)
    } finally {
      cleanupRepo(dir)
    }
  })

  it('git 저장소가 아닌 경로는 valid: false + error 메시지', async () => {
    const result = await validateRepository(tmpdir())
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('listBranches / pickDefaultBranch — 기본 브랜치 자동 선택', () => {
  it('main만 있으면 main을 기본 브랜치로 고른다', async () => {
    const dir = initRepo('gde-repo-', 'main')
    try {
      sh(dir, ['commit', '-q', '--allow-empty', '-m', 'init'])
      const branches = await listBranches(dir)
      expect(branches).toEqual(['main'])
      expect(pickDefaultBranch(branches)).toBe('main')
    } finally {
      cleanupRepo(dir)
    }
  })

  it('master만 있으면 master를 기본 브랜치로 고른다', async () => {
    const dir = initRepo('gde-repo-master-', 'master')
    try {
      sh(dir, ['commit', '-q', '--allow-empty', '-m', 'init'])
      const branches = await listBranches(dir)
      expect(pickDefaultBranch(branches)).toBe('master')
    } finally {
      cleanupRepo(dir)
    }
  })

  it('main/master 둘 다 없으면 null', () => {
    expect(pickDefaultBranch(['feature/x', 'release/1.0'])).toBeNull()
  })

  it('원격 추적 브랜치(refs/remotes/)는 목록에서 제외된다', async () => {
    const dir = initRepo('gde-repo-remote-', 'main')
    try {
      sh(dir, ['commit', '-q', '--allow-empty', '-m', 'init'])
      const headHash = sh(dir, ['rev-parse', 'main'])
      sh(dir, ['update-ref', 'refs/remotes/origin/main', headHash])
      sh(dir, ['update-ref', 'refs/remotes/origin/develop', headHash])
      const branches = await listBranches(dir)
      expect(branches).toEqual(['main'])
    } finally {
      cleanupRepo(dir)
    }
  })
})
