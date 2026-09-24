import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { getHeadFileContent } from '../git/showFile'
import { buildExtractListText } from './extractListText'
import type { BuildPackageParams, BuildPackageResult, ExportMode } from '../../shared/types'

export type { BuildPackageParams, BuildPackageResult }

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

// Export 결과물이 생성될 위치. 사용자가 부모 디렉터리를 지정하지 않으면
// 저장소 루트가 기본값이다(단위 테스트 편의 — 실제 UI는 REQ-012 정정으로
// 경로를 명시적으로 고를 때까지 Export를 막는다, §5.1 RT-56). mode가
// 'sub'면 하위 폴더명(git-deploy-extracted)이 항상 고정(결정 이력 #20과
// 일관성 유지, RISK_ISSUES.md §7.1)이고, 'direct'면 부모 디렉터리
// 자체가 최종 산출물 위치다(빈 폴더 전용, a안).
export function getDeployDir(
  repoPath: string,
  exportParentDir: string | undefined,
  mode: ExportMode
): string {
  const parent = exportParentDir ?? repoPath
  return mode === 'direct' ? parent : join(parent, 'git-deploy-extracted')
}

// OS가 폴더를 열람할 때 스스로 만들어두는 메타데이터 파일들. 사용자가
// Finder/탐색기로 안에 있던 파일을 전부 지워도 이런 파일은 남을 수
// 있어(macOS Finder는 폴더를 열어보기만 해도 .DS_Store를 새로 만듦),
// 육안으로는 빈 폴더인데도 "비어 있지 않음"으로 오판하게 된다 — 사용자
// 보고(2026-09-24) 재현: `/Users/.../git-deploy-extracted` 안 내용물을
// 다 지웠는데도 direct 모드 NOT_EMPTY가 계속 뜸, 원인은 남아 있던
// .DS_Store.
const IGNORED_METADATA_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

// 덮어쓰기 확인 팝업을 띄울지 판단하기 위해 IPC 핸들러가 먼저 호출한다.
// 디렉터리가 없으면(첫 Export) false — 확인 없이 바로 진행.
export async function deployDirHasContent(deployDir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(deployDir)
    return entries.some((entry) => !IGNORED_METADATA_FILES.has(entry))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function buildPackage(params: BuildPackageParams): Promise<BuildPackageResult> {
  const { repoPath, branch, selectedCommits, files, deletedServerPaths, exportParentDir, mode } =
    params

  // §4.1: 파일을 쓰기 전에 대소문자만 다른 경로 충돌부터 검사한다.
  // 발견되면 아무것도 쓰지 않고 즉시 중단한다(자동 덮어쓰기 금지).
  const collisions = findCaseInsensitiveCollisions(files.map((f) => f.serverPath))
  if (collisions.length > 0) {
    const detail = collisions.map((group) => `[${group.join(', ')}]`).join(', ')
    throw new Error(`대소문자만 다른 경로 충돌이 발견되어 중단합니다: ${detail}`)
  }

  const deployDir = getDeployDir(repoPath, exportParentDir, mode)
  if (mode === 'sub') {
    // 재실행 시 이전 Export의 잔여 파일이 이번 선택 범위와 섞이지 않도록
    // GDE가 소유한 고정 이름 하위 폴더를 매번 완전히 비우고 새로 만든다.
    // 기존 내용이 있는 경우의 사용자 확인은 IPC 핸들러(package:export)가
    // buildPackage 호출 전에 이미 처리했다.
    await fs.rm(deployDir, { recursive: true, force: true })
    await fs.mkdir(deployDir, { recursive: true })
  } else {
    // direct 모드는 사용자가 고른 임의의 폴더에 그대로 쓴다 — 절대
    // fs.rm(recursive)를 호출하지 않는다(§5.1 RT-56). 비어 있음은 이미
    // Main이 buildPackage 호출 전에 검증했다(validateExportTarget).
    await fs.mkdir(deployDir, { recursive: true })
  }

  for (const file of files) {
    const content = await getHeadFileContent(repoPath, branch, file.localPath)
    const targetPath = join(deployDir, file.serverPath)
    await fs.mkdir(dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content) // Buffer 그대로 — 텍스트 처리 없음 (§4.2)
  }

  // RT-57(U-17) — deploy-files.txt/delete-list.txt/deploy-summary.json 3종을
  // extract-list.txt 하나로 통합. 사람이 읽는 용도(프로그램이 읽지 않음).
  const extractListText = buildExtractListText({
    branch,
    generatedAt: new Date(),
    commits: selectedCommits,
    files: files.map((f) => f.serverPath),
    deleted: deletedServerPaths
  })
  await fs.writeFile(join(deployDir, 'extract-list.txt'), extractListText, 'utf8')

  return { deployDir }
}
