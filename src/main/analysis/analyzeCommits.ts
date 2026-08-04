import { getCommitFileChanges, headFileExists } from '../git/diff'
import type { FileChange } from '../git/diff'

export type DeployFileStatus = 'added' | 'modified'

export interface DeployTargetFile {
  path: string
  status: DeployFileStatus
}

export interface AnalysisWarning {
  path: string
  reason: string
}

export interface AnalyzeCommitsResult {
  deployTargets: DeployTargetFile[]
  deleteList: string[]
  warnings: AnalysisWarning[]
}

export async function analyzeCommits(
  repoPath: string,
  branch: string,
  commitHashes: string[]
): Promise<AnalyzeCommitsResult> {
  const perPathStatuses = new Map<string, Set<FileChange['status']>>()

  const allChanges = await Promise.all(
    commitHashes.map((hash) => getCommitFileChanges(repoPath, hash))
  )
  for (const changes of allChanges) {
    for (const change of changes) {
      const statuses = perPathStatuses.get(change.path) ?? new Set()
      statuses.add(change.status)
      perPathStatuses.set(change.path, statuses)
    }
  }

  const deployTargets: DeployTargetFile[] = []
  const deleteList: string[] = []
  const warnings: AnalysisWarning[] = []

  // Delete가 선택된 Commit 중 하나에서라도 관측되면 그 파일은 삭제로 확정한다
  // (DR-007, 무조건 Delete List). 그 외(Added/Modified만 관측)에 한해서만
  // HEAD 존재 여부를 확인해 Warning 여부를 가른다(DR-009).
  await Promise.all(
    [...perPathStatuses.entries()].map(async ([path, statuses]) => {
      if (statuses.has('D')) {
        deleteList.push(path)
        return
      }
      const exists = await headFileExists(repoPath, branch, path)
      if (exists) {
        deployTargets.push({ path, status: statuses.has('A') ? 'added' : 'modified' })
      } else {
        warnings.push({ path, reason: 'HEAD에 존재하지 않음 (DR-009)' })
      }
    })
  )

  deployTargets.sort((a, b) => a.path.localeCompare(b.path))
  deleteList.sort((a, b) => a.localeCompare(b))
  warnings.sort((a, b) => a.path.localeCompare(b.path))

  return { deployTargets, deleteList, warnings }
}
