import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CommitEntry } from '../git/types'
import { getHeadFileContent } from '../git/showFile'
import type { AnalysisWarning, DeployTargetFile } from '../analysis/analyzeCommits'
import type { MappingProfile } from '../mapping/types'
import { resolveServerPath } from '../mapping/resolveServerPath'

export interface BuildPackageParams {
  repoPath: string
  branch: string
  mappingProfile: MappingProfile
  selectedCommits: CommitEntry[]
  deployTargets: DeployTargetFile[]
  deleteList: string[]
  warnings: AnalysisWarning[]
}

export interface DeploySummaryFile {
  localPath: string
  serverPath: string
  status: 'added' | 'modified'
}

export interface DeploySummary {
  generatedAt: string
  repository: string
  branch: string
  mappingProfile: string
  commits: CommitEntry[]
  summary: { files: number; added: number; modified: number; deleted: number }
  files: DeploySummaryFile[]
  deleted: string[]
  warnings: AnalysisWarning[]
}

export interface BuildPackageResult {
  deployDir: string
  summary: DeploySummary
}

function formatIsoWithOffset(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60))
  const offsetMins = pad(Math.abs(offsetMinutes) % 60)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${offsetHours}:${offsetMins}`
  )
}

function findCaseInsensitiveCollisions(paths: string[]): string[][] {
  const groups = new Map<string, Set<string>>()
  for (const path of paths) {
    const key = path.toLowerCase()
    const group = groups.get(key) ?? new Set<string>()
    group.add(path)
    groups.set(key, group)
  }
  return [...groups.values()].filter((group) => group.size > 1).map((group) => [...group])
}

function toLfText(lines: string[]): string {
  return lines.length > 0 ? lines.join('\n') + '\n' : ''
}

export async function buildPackage(params: BuildPackageParams): Promise<BuildPackageResult> {
  const { repoPath, branch, mappingProfile, selectedCommits, deployTargets, deleteList, warnings } =
    params

  const files: DeploySummaryFile[] = deployTargets.map((target) => ({
    localPath: target.path,
    serverPath: resolveServerPath(target.path, mappingProfile),
    status: target.status
  }))
  const deletedServerPaths = deleteList.map((path) => resolveServerPath(path, mappingProfile))

  // §4.1: 파일을 쓰기 전에 대소문자만 다른 경로 충돌부터 검사한다.
  // 발견되면 아무것도 쓰지 않고 즉시 중단한다(자동 덮어쓰기 금지).
  const collisions = findCaseInsensitiveCollisions(files.map((f) => f.serverPath))
  if (collisions.length > 0) {
    const detail = collisions.map((group) => `[${group.join(', ')}]`).join(', ')
    throw new Error(`대소문자만 다른 경로 충돌이 발견되어 중단합니다: ${detail}`)
  }

  const deployDir = join(repoPath, 'deploy')
  // 재실행 시 이전 Export의 잔여 파일이 이번 선택 범위와 섞이지 않도록
  // 매번 완전히 비우고 새로 만든다.
  await fs.rm(deployDir, { recursive: true, force: true })
  await fs.mkdir(deployDir, { recursive: true })

  for (const file of files) {
    const content = await getHeadFileContent(repoPath, branch, file.localPath)
    const targetPath = join(deployDir, file.serverPath)
    await fs.mkdir(dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content) // Buffer 그대로 — 텍스트 처리 없음 (§4.2)
  }

  await fs.writeFile(
    join(deployDir, 'deploy-files.txt'),
    toLfText(files.map((f) => f.serverPath)),
    'utf8'
  )
  await fs.writeFile(join(deployDir, 'delete-list.txt'), toLfText(deletedServerPaths), 'utf8')

  const summary: DeploySummary = {
    generatedAt: formatIsoWithOffset(new Date()),
    repository: repoPath,
    branch,
    mappingProfile: mappingProfile.profileName,
    commits: selectedCommits,
    summary: {
      files: files.length,
      added: files.filter((f) => f.status === 'added').length,
      modified: files.filter((f) => f.status === 'modified').length,
      deleted: deletedServerPaths.length
    },
    files,
    deleted: deletedServerPaths,
    warnings
  }
  await fs.writeFile(
    join(deployDir, 'deploy-summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
    'utf8'
  )

  return { deployDir, summary }
}
