import { buildPackage, getDeployDir, deployDirHasContent } from '../../package/buildPackage'
import { assertNonEmptyAbsolutePath, assertServerPathsWithinDir } from '../validate'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { showOpenDirectoryDialog, showConfirmDialog } from '../dialogs'

export function registerPackageHandlers(): void {
  // RISK_ISSUES.md §7.1: Export 결과물을 저장할 부모 디렉터리 선택.
  // repository:browse와 동일한 방식(OS 네이티브 폴더 다이얼로그)이지만
  // 의미가 다른 별도 채널로 분리한다(저장소 선택 vs Export 위치 선택).
  handle(IPC_CHANNELS['package:browseExportDir'], () => {
    return showOpenDirectoryDialog()
  })

  handle(IPC_CHANNELS['package:export'], async (_event, params) => {
    // RT-12(R3): exportParentDir이 지정됐다면 절대 경로인지 먼저
    // 확인한다(빈 문자열/상대 경로면 getDeployDir이 예상 밖의 위치를
    // 가리킬 수 있음). files[].serverPath도 Mapping Profile override가
    // deployDir 밖을 가리키지 않는지 전부 쓰기 전에 확인한다.
    if (params.exportParentDir) {
      assertNonEmptyAbsolutePath(params.exportParentDir, 'Export 위치')
    }
    const deployDir = getDeployDir(params.repoPath, params.exportParentDir)
    assertServerPathsWithinDir(deployDir, [
      ...params.files.map((f) => f.serverPath),
      ...params.deletedServerPaths
    ])

    // §7.1 안전장치: 대상 폴더에 이미 내용이 있으면 확인 없이 덮어쓰지 않는다.
    if (await deployDirHasContent(deployDir)) {
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
