import { runGit, assertSafeRevisionArg } from './exec'

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
  // RT-24(exec.ts 규약) — commitHash는 revision 인자(`${commitHash}^1`
  // 형태로도 쓰임)라 '-' 시작 여부를 미리 막는다. 이 값은 analysis:preview
  // IPC의 commitHashes를 거쳐 들어와 아직 IPC 경계에서 형식 검증이 없다
  // (hashFilter처럼 partitionHashFilter를 거치지 않음) — 여기가 유일한
  // 방어선이다.
  assertSafeRevisionArg(commitHash, '커밋 해시')

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
  // RT-24(exec.ts 규약) — showFile.ts의 getHeadFileContent와 동일한 이유.
  assertSafeRevisionArg(branch, '브랜치')

  const result = await runGit(repoPath, ['cat-file', '-e', `${branch}:${path}`])
  return result.exitCode === 0
}
