import { validateRepository } from '../../git/repository'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { showOpenDirectoryDialog } from '../dialogs'

export function registerRepositoryHandlers(): void {
  handle(IPC_CHANNELS['repository:browse'], async () => {
    // RT-02(E2E 테스트 전용 우회) — Playwright는 OS 네이티브 폴더
    // 다이얼로그를 열 수 없다. 이 환경변수가 있을 때만 다이얼로그 없이
    // 바로 반환하고, 설정하지 않으면(일반 실행) 원래 동작 그대로다.
    if (process.env.GDE_E2E_REPO_PATH) {
      return process.env.GDE_E2E_REPO_PATH
    }
    return showOpenDirectoryDialog()
  })

  handle(IPC_CHANNELS['repository:validate'], (_event, repoPath) => {
    return validateRepository(repoPath)
  })
}
