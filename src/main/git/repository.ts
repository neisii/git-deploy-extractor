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

// RepositoryPanel 라벨에 표시할 "진짜" 프로젝트 이름. 로컬 클론 폴더명은 사용자가
// 임의로 바꿀 수 있어(예: deep-backend를 shallow-backend로 리네임해서
// clone) git remote origin URL에서 유도한 이름과 다를 수 있다 — 재현
// 테스트로 확인(§0.1): HTTPS(.git 있음/없음)·SSH scp-like(GitLab 서브그룹
// 포함) 셋 다 ".git" 접미사를 떼고 "/"로 쪼갠 마지막 조각이 정확히
// 프로젝트명과 일치한다. origin이 없거나(exit code 2) 파싱 결과가
// 비어있으면 null — Renderer가 폴더명으로 폴백한다. 이 기능은 순수
// 부가정보라 실패해도 절대 throw하지 않는다.
function parseProjectNameFromRemoteUrl(url: string): string | null {
  const trimmed = url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
  const segments = trimmed.split('/')
  const last = segments[segments.length - 1]
  return last || null
}

export async function getRemoteProjectName(repoPath: string): Promise<string | null> {
  try {
    const result = await runGit(repoPath, ['remote', 'get-url', 'origin'])
    if (result.exitCode !== 0) return null
    const url = result.stdout.trim()
    if (!url) return null
    return parseProjectNameFromRemoteUrl(url)
  } catch {
    return null
  }
}

// 원격 추적 브랜치(refs/remotes/)는 선택지에서 제외한다 — 로컬 브랜치만
// 대상으로 한다. fetch가 오래되어 stale할 수 있는 원격 스냅샷을 사용자가
// "로컬 기준"으로 착각해 선택하는 상황을 막기 위함.
export async function listBranches(repoPath: string): Promise<string[]> {
  const result = await runGit(repoPath, [
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads/'
  ])
  if (result.exitCode !== 0) {
    throw new Error(`브랜치 목록 조회 실패: ${result.stderr.trim()}`)
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
