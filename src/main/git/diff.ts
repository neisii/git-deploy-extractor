import { runGit } from './exec'

export interface FileChange {
  path: string
  status: 'A' | 'M' | 'D'
}

// 모든 git 저장소에서 동일한 empty tree 상수 (DETAILED_DESIGN.md §3.3)
const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

function parseNameStatus(stdout: string): FileChange[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const tabIndex = line.indexOf('\t')
      const status = line.slice(0, tabIndex)
      const path = line.slice(tabIndex + 1)
      if (status !== 'A' && status !== 'M' && status !== 'D') {
        throw new Error(`예상하지 못한 diff-tree 상태 코드: ${status} (${path})`)
      }
      return { path, status }
    })
}

export async function getCommitFileChanges(
  repoPath: string,
  commitHash: string
): Promise<FileChange[]> {
  let result = await runGit(repoPath, [
    'diff-tree',
    '--no-commit-id',
    '--name-status',
    '-r',
    `${commitHash}^1`,
    commitHash
  ])

  if (result.exitCode !== 0) {
    // 부모가 없는 Root Commit — empty tree와 비교 (DETAILED_DESIGN.md §3.3)
    result = await runGit(repoPath, [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-r',
      EMPTY_TREE_HASH,
      commitHash
    ])
  }

  if (result.exitCode !== 0) {
    throw new Error(`Commit 변경 파일 조회 실패 (${commitHash}): ${result.stderr.trim()}`)
  }

  return parseNameStatus(result.stdout)
}

// 존재 여부만 필요할 때는 show 대신 cat-file -e를 쓴다 — 로케일에 따라
// 번역되는 에러 메시지를 문자열 비교할 필요 없이 exit code만으로 판단 가능하다.
export async function headFileExists(
  repoPath: string,
  branch: string,
  path: string
): Promise<boolean> {
  const result = await runGit(repoPath, ['cat-file', '-e', `${branch}:${path}`])
  return result.exitCode === 0
}
