import { runGit, assertSafeRevisionArg } from './exec'

// RISK_ISSUES.md §7.2용 — 특정 경로 접두사 아래 HEAD 트리에 존재하는 파일
// 목록만 조회한다. `-- <pathPrefix>`는 와일드카드 없이도 디렉터리 접두사
// 매칭으로 동작한다(재현 테스트로 확인, DETAILED_DESIGN.md §0.1). 접두사
// 아래 파일이 하나도 없으면 exitCode 0에 빈 출력 — 에러가 아니다.
export async function listTrackedFiles(
  repoPath: string,
  branch: string,
  pathPrefix?: string
): Promise<string[]> {
  // RT-24(exec.ts 규약) — branch는 revision 인자, pathPrefix는 pathspec이라
  // 서로 다른 방식으로 막는다: branch는 '-' 시작 검증, pathPrefix는 이미
  // 아래처럼 `--` 뒤에 둔다.
  assertSafeRevisionArg(branch, '브랜치')

  const args = ['ls-tree', '-r', branch, '--name-only']
  if (pathPrefix) args.push('--', pathPrefix)

  const result = await runGit(repoPath, args)
  if (result.exitCode !== 0) {
    throw new Error(`파일 목록 조회 실패 (${branch}): ${result.stderr.trim()}`)
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
