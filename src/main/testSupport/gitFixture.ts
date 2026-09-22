import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

// RT-04(P0 안전망) — scripts/verify-phase1~3.ts(폐기됨)에서 세 파일 모두
// 거의 그대로 중복하던 git 픽스처 보일러플레이트를 한 곳으로 모았다.
// vitest.config.ts의 include(`src/**/*.test.ts`)에 걸리지 않도록 파일명에
// `.test.`를 붙이지 않는다 — 테스트가 아니라 테스트가 공유하는 헬퍼다.

export function sh(cwd: string, args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env
  })
    .toString()
    .trim()
}

export function writeFixtureFile(dir: string, relPath: string, content: Buffer | string): void {
  const fullPath = join(dir, relPath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

export function initRepo(prefix: string, branch = 'main'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  sh(dir, ['init', '-q'])
  sh(dir, ['config', 'user.email', 'test@example.com'])
  sh(dir, ['config', 'user.name', 'Tester'])
  sh(dir, ['checkout', '-q', '-b', branch])
  return dir
}

export function cleanupRepo(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

// GIT_AUTHOR_DATE/GIT_COMMITTER_DATE를 지정해 특정 시각의 커밋을 만든다
// (listCommits의 날짜 범위 경계값 테스트용). --allow-empty라 파일 변경 없이
// 커밋 시각만 재현할 수 있다.
export function commitAt(dir: string, date: Date, message: string): string {
  const iso = date.toISOString().replace('.000Z', 'Z')
  sh(dir, ['commit', '-q', '--allow-empty', '-m', message], {
    GIT_AUTHOR_DATE: iso,
    GIT_COMMITTER_DATE: iso
  })
  return sh(dir, ['rev-parse', 'HEAD'])
}

// git add -A 후 커밋하고 HEAD 해시를 반환한다(작업 트리 변경을 실제로
// 커밋해야 하는 analyzeCommits/computeDeployPlan/buildPackage 계열 픽스처용).
export function commitAll(dir: string, message: string): string {
  sh(dir, ['add', '-A'])
  sh(dir, ['commit', '-q', '-m', message])
  return sh(dir, ['rev-parse', 'HEAD'])
}
