import { runGit } from './exec'
import type { RepositoryValidation } from '../../shared/types'
import { pickDefaultBranch } from '../../shared/branch'

export type { RepositoryValidation }
export { pickDefaultBranch }

export async function validateRepository(repoPath: string): Promise<RepositoryValidation> {
  let result
  try {
    result = await runGit(repoPath, ['rev-parse', '--is-inside-work-tree'])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { valid: false, error: `git 실행 실패: ${message}` }
  }

  if (result.exitCode === 0 && result.stdout.trim() === 'true') {
    return { valid: true }
  }

  return { valid: false, error: result.stderr.trim() || 'Git 저장소가 아닙니다' }
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const result = await runGit(repoPath, [
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads/',
    'refs/remotes/'
  ])
  if (result.exitCode !== 0) {
    throw new Error(`브랜치 목록 조회 실패: ${result.stderr.trim()}`)
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
