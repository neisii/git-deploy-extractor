import { runGit } from './exec'

// RISK_ISSUES.md §7.2용 — HEAD 트리(작업트리 아님)에서 고정 문자열을 담고
// 있는 파일 경로만 찾는다. `git grep -l <pattern> <branch> -- <pathspecs>`
// 형태(재현 테스트로 확인, DETAILED_DESIGN.md §0.1). 결과는 클래스/애노테이션
// 이름이 실제로 그 의미로 쓰였는지 확정하는 게 아니라 "이 파일을 파싱해서
// 확인해볼 후보"를 좁히는 사전 필터일 뿐이다 — 최종 확정은 항상 파서로 한다.
export async function grepTree(
  repoPath: string,
  branch: string,
  fixedString: string,
  pathspecs: string[]
): Promise<string[]> {
  const result = await runGit(repoPath, [
    'grep',
    '-l',
    '-F',
    fixedString,
    branch,
    '--',
    ...pathspecs
  ])

  // exitCode 1 = 매치 없음(정상). 그 외 0이 아니면 실제 에러(잘못된 pathspec 등).
  if (result.exitCode === 1 && result.stdout.trim() === '') {
    return []
  }
  if (result.exitCode !== 0) {
    throw new Error(`grep 실패 (${branch}, "${fixedString}"): ${result.stderr.trim()}`)
  }

  const prefix = `${branch}:`
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
}
