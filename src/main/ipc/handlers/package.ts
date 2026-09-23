import { buildPackage, getDeployDir, deployDirHasContent } from '../../package/buildPackage'
import { validateExportTarget } from '../../package/validateExportTarget'
import {
  assertNonEmptyAbsolutePath,
  assertServerPathsWithinDir,
  assertValidExportMode,
  IpcValidationError
} from '../validate'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { showOpenDirectoryDialog, showConfirmDialog } from '../dialogs'

export function registerPackageHandlers(): void {
  // RISK_ISSUES.md §7.1: Export 결과물을 저장할 부모 디렉터리 선택.
  // repository:browse와 동일한 방식(OS 네이티브 폴더 다이얼로그)이지만
  // 의미가 다른 별도 채널로 분리한다(저장소 선택 vs Export 위치 선택).
  handle(IPC_CHANNELS['package:browseExportDir'], () => {
    // RT-02/RT-56(E2E 테스트 전용 우회) — repository:browse와 같은 이유로
    // Playwright가 네이티브 다이얼로그를 조작할 수 없다. REQ-012 정정
    // (경로 미선택 시 기본값 폐지)으로 e2e에서도 Export 위치를 명시적으로
    // "골라야" 하므로 별도 환경변수로 우회한다.
    if (process.env.GDE_E2E_EXPORT_DIR) {
      return Promise.resolve(process.env.GDE_E2E_EXPORT_DIR)
    }
    return showOpenDirectoryDialog()
  })

  // RT-56(U-16) — 경로 선택 직후·저장소 변경/Reload 직후·모드 변경 시
  // 렌더러가 호출해 즉시 피드백을 준다. package:export도 실행 직전
  // 같은 함수로 재검증한다(UI 상태를 신뢰하지 않음, §5.1 RT-56).
  handle(IPC_CHANNELS['package:validateExportTarget'], (_event, params) => {
    assertValidExportMode(params.mode)
    return validateExportTarget(params)
  })

  handle(IPC_CHANNELS['package:export'], async (_event, params) => {
    // RT-12(R3): exportParentDir이 지정됐다면 절대 경로인지 먼저
    // 확인한다(빈 문자열/상대 경로면 getDeployDir이 예상 밖의 위치를
    // 가리킬 수 있음). files[].serverPath도 Mapping Profile override가
    // deployDir 밖을 가리키지 않는지 전부 쓰기 전에 확인한다.
    assertValidExportMode(params.mode)
    if (params.exportParentDir) {
      assertNonEmptyAbsolutePath(params.exportParentDir, 'Export 위치')
    }

    // RT-56 — Export 직전 재검증(경로 미선택/저장소와 겹침/direct에서
    // 폴더가 비어 있지 않음). UI가 이미 막았어야 하지만 렌더러 상태를
    // 신뢰하지 않고 Main이 권위 있게 다시 확인한다.
    const validation = await validateExportTarget(params)
    if (!validation.ok) {
      throw new IpcValidationError(validation.message)
    }

    const deployDir = getDeployDir(params.repoPath, params.exportParentDir, params.mode)
    assertServerPathsWithinDir(deployDir, [
      ...params.files.map((f) => f.serverPath),
      ...params.deletedServerPaths
    ])

    // §7.1 안전장치: sub 모드에서 대상 폴더(GDE 소유의 고정 이름 하위
    // 폴더)에 이미 내용이 있으면 확인 없이 덮어쓰지 않는다. direct
    // 모드는 validateExportTarget이 이미 "비어 있음"을 보장했으므로
    // 이 확인이 필요 없다(항상 새 폴더에 쓰는 것과 동일).
    if (params.mode === 'sub' && (await deployDirHasContent(deployDir))) {
      const proceed = await showConfirmDialog({
        type: 'warning',
        negativeLabel: '취소',
        positiveLabel: '계속',
        defaultButton: 'negative',
        message: '이미 있는 git-deploy-extracted를 덮어씁니다, 계속할까요?',
        detail: deployDir
      })
      if (!proceed) return null
    }
    return buildPackage(params)
  })
}
