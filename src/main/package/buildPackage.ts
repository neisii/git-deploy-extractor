import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { getHeadFileContent } from '../git/showFile'
import type { BuildPackageParams, BuildPackageResult, DeploySummary } from '../../shared/types'

export type { BuildPackageParams, BuildPackageResult, DeploySummary }

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

// Export 결과물이 생성될 위치. 사용자가 부모 디렉터리를 지정하지 않으면
// 저장소 루트가 기본값이다 — 하위 폴더명(git-deploy-extracted)은 항상
// 고정(결정 이력 #20과 일관성 유지, RISK_ISSUES.md §7.1).
export function getDeployDir(repoPath: string, exportParentDir?: string): string {
  return join(exportParentDir ?? repoPath, 'git-deploy-extracted')
}

// 덮어쓰기 확인 팝업을 띄울지 판단하기 위해 IPC 핸들러가 먼저 호출한다.
// 디렉터리가 없으면(첫 Export) false — 확인 없이 바로 진행.
export async function deployDirHasContent(deployDir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(deployDir)
    return entries.length > 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function buildPackage(params: BuildPackageParams): Promise<BuildPackageResult> {
  const {
    repoPath,
    branch,
    mappingProfileName,
    selectedCommits,
    files,
    deletedServerPaths,
    warnings,
    exportParentDir
  } = params

  // §4.1: 파일을 쓰기 전에 대소문자만 다른 경로 충돌부터 검사한다.
  // 발견되면 아무것도 쓰지 않고 즉시 중단한다(자동 덮어쓰기 금지).
  const collisions = findCaseInsensitiveCollisions(files.map((f) => f.serverPath))
  if (collisions.length > 0) {
    const detail = collisions.map((group) => `[${group.join(', ')}]`).join(', ')
    throw new Error(`대소문자만 다른 경로 충돌이 발견되어 중단합니다: ${detail}`)
  }

  const deployDir = getDeployDir(repoPath, exportParentDir)
  // 재실행 시 이전 Export의 잔여 파일이 이번 선택 범위와 섞이지 않도록
  // 매번 완전히 비우고 새로 만든다. 기존 내용이 있는 경우의 사용자 확인은
  // IPC 핸들러(package:export)가 buildPackage 호출 전에 이미 처리했다.
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
    mappingProfile: mappingProfileName,
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
