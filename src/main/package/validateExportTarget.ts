import { promises as fs } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { classifyExportTarget } from './classifyExportTarget'
import { getDeployDir, deployDirHasContent } from './buildPackage'
import type {
  ExportTargetErrorCode,
  ExportTargetValidation,
  ValidateExportTargetParams
} from '../../shared/types'

// R·F 둘 다(또는 둘 중 하나) 아직 존재하지 않을 수 있다(추출 위치는
// 아직 한 번도 Export하지 않은 새 경로일 수 있음) — fs.realpath는
// 경로가 없으면 ENOENT를 던지므로, 존재하는 가장 가까운 상위까지만
// realpath하고 나머지(존재하지 않는 꼬리)는 그대로 이어 붙인다(§5.1
// RT-56 — 심볼릭 링크·정션·`.`/`..`·끝 구분자는 존재하는 부분에서 이미
// 해소된다).
async function realpathExistingPrefix(target: string): Promise<string> {
  try {
    return await fs.realpath(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const parent = dirname(target)
    if (parent === target) throw error // 루트까지 올라가도 없음 — 정상적으로는 발생하지 않는다.
    const resolvedParent = await realpathExistingPrefix(parent)
    return join(resolvedParent, basename(target))
  }
}

// Windows·macOS는 파일시스템이 기본적으로 대소문자를 구분하지 않고,
// Linux는 구분한다(§5.1 RT-56 — 플랫폼별 대소문자 정책). 실제 FS의
// 대소문자 구분 여부를 매번 확인하는 대신 OS 기본값으로 판단한다(다른
// IPC 검증들과 같은 수준의 보수적 근사).
export function normalizeForCasePolicy(path: string): string {
  return process.platform === 'linux' ? path : path.toLowerCase()
}

const messages: Record<ExportTargetErrorCode, string> = {
  NO_PATH: '추출할 폴더를 선택하세요.',
  INSIDE_REPO:
    '추출 위치가 저장소와 같거나 저장소 안에 있습니다. 저장소 밖의 다른 폴더를 선택하세요.',
  CONTAINS_REPO: '선택한 위치가 저장소를 포함하고 있어 추출할 수 없습니다. 다른 폴더를 선택하세요.',
  NOT_EMPTY:
    "선택한 폴더가 비어 있지 않아 바로 추출할 수 없습니다. 빈 폴더를 선택하거나 '폴더 생성 후 추출'을 사용하세요."
}

// package:validateExportTarget·package:export 둘 다 이 함수를 호출한다
// (같은 판정을 UI 즉시 피드백과 Export 직전 재검증에 공유 — §5.1
// RT-56). 검사 우선순위: ①경로 미선택 ②저장소와 겹침(INSIDE_REPO/
// CONTAINS_REPO) ③(direct 모드만) 폴더가 비어 있지 않음.
export async function validateExportTarget(
  params: ValidateExportTargetParams
): Promise<ExportTargetValidation> {
  const { repoPath, exportParentDir, mode } = params

  if (!exportParentDir || exportParentDir.trim().length === 0) {
    return { ok: false, code: 'NO_PATH', message: messages.NO_PATH }
  }

  const deployDir = getDeployDir(repoPath, exportParentDir, mode)
  const [repoReal, deployReal] = await Promise.all([
    realpathExistingPrefix(repoPath),
    realpathExistingPrefix(deployDir)
  ])
  const classification = classifyExportTarget(
    normalizeForCasePolicy(repoReal),
    normalizeForCasePolicy(deployReal)
  )
  if (classification === 'INSIDE_REPO') {
    return { ok: false, code: 'INSIDE_REPO', message: messages.INSIDE_REPO }
  }
  if (classification === 'CONTAINS_REPO') {
    return { ok: false, code: 'CONTAINS_REPO', message: messages.CONTAINS_REPO }
  }

  if (mode === 'direct' && (await deployDirHasContent(deployDir))) {
    return { ok: false, code: 'NOT_EMPTY', message: messages.NOT_EMPTY }
  }

  return { ok: true }
}
