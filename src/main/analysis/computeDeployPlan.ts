import { analyzeCommits } from './analyzeCommits'
import type { DeployTargetFile } from './analyzeCommits'
import { resolveServerPath } from '../mapping/resolveServerPath'
import type {
  DeployPlan,
  DeployPlanFile,
  DeployPlanSummary,
  MappingProfile
} from '../../shared/types'

export type { DeployPlan }

// analyzeCommits(로컬 경로 기준)의 결과에 Mapping Rule을 적용해 Server Path를
// 채운다. Preview IPC와 Export IPC가 동일한 계산 결과를 쓰도록 여기서
// 한 번만 매핑한다(ARCHITECTURE.md §5 데이터 흐름 — Mapping 결과가 그대로
// Package Builder 입력이 된다).
export function applyMapping(
  deployTargets: DeployTargetFile[],
  deleteList: string[],
  profile: MappingProfile
): { files: DeployPlanFile[]; deletedServerPaths: string[]; summary: DeployPlanSummary } {
  const files: DeployPlanFile[] = deployTargets.map((target) => ({
    localPath: target.path,
    serverPath: resolveServerPath(target.path, profile),
    status: target.status
  }))
  const deletedServerPaths = deleteList.map((path) => resolveServerPath(path, profile))

  const summary: DeployPlanSummary = {
    files: files.length,
    added: files.filter((f) => f.status === 'added').length,
    modified: files.filter((f) => f.status === 'modified').length,
    deleted: deletedServerPaths.length
  }

  return { files, deletedServerPaths, summary }
}

export async function computeDeployPlan(
  repoPath: string,
  branch: string,
  commitHashes: string[],
  profile: MappingProfile
): Promise<DeployPlan> {
  const analysis = await analyzeCommits(repoPath, branch, commitHashes)
  const mapped = applyMapping(analysis.deployTargets, analysis.deleteList, profile)
  return { ...mapped, warnings: analysis.warnings }
}
