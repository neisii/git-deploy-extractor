import { shell } from 'electron'
import { checkForUpdate } from '../../update/checkForUpdate'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { showConfirmDialog } from '../dialogs'

// REQ-017: 클릭 시 항상 이 고정 인덱스 URL만 연다 — 특정 릴리스 태그로
// 딥링크하지 않는다(DETAILED_DESIGN.md §10.5).
const RELEASES_URL = 'https://github.com/neisii/git-deploy-extractor/releases'

export function registerUpdateHandlers(): void {
  handle(IPC_CHANNELS['update:check'], async () => {
    return checkForUpdate()
  })

  // REQ-017: 클릭 시 뜨는 확인창. update:check(강제 재확인)와는 독립된
  // 흐름이라 그 응답을 기다리지 않는다(DETAILED_DESIGN.md §10.3) — Renderer가
  // 두 IPC를 동시에 호출한다.
  handle(IPC_CHANNELS['update:confirmAndOpen'], async () => {
    const proceed = await showConfirmDialog({
      type: 'question',
      negativeLabel: '아니오',
      positiveLabel: '네',
      defaultButton: 'positive',
      message: 'GitHub 저장소를 여시겠습니까?',
      detail: RELEASES_URL
    })
    if (!proceed) return false
    await shell.openExternal(RELEASES_URL)
    return true
  })
}
