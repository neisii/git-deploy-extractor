import { BrowserWindow, dialog } from 'electron'

// RT-21(S7) — repository:browse·package:browseExportDir이 각자 복붙해 두고
// 있던 "포커스된 창이 있으면 그 창 기준, 없으면 전역"의 OS 네이티브 폴더
// 선택 다이얼로그를 하나로 합쳤다. 취소하거나 아무 것도 안 고르면 null.
export async function showOpenDirectoryDialog(): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow()
  const result = window
    ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export interface ConfirmDialogOptions {
  type: 'warning' | 'question'
  negativeLabel: string
  positiveLabel: string
  // 다이얼로그가 뜨는 순간 하이라이트되는(Enter로 바로 선택되는) 버튼.
  defaultButton: 'negative' | 'positive'
  message: string
  detail: string
}

// RT-21(S7) — package:export(덮어쓰기 확인)·update:confirmAndOpen(GitHub
// 열기 확인)이 각자 복붙해 두고 있던 "포커스된 창 기준 showMessageBox +
// response 판정"을 하나로 합쳤다. 두 버튼 중 뒤쪽(positiveLabel, index 1)을
// 선택했을 때만 true — cancelId는 항상 0(Esc/닫기 = negativeLabel과 동일
// 취급)으로 기존 두 호출부 모두와 동일하다.
export async function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const window = BrowserWindow.getFocusedWindow()
  const dialogOptions = {
    type: options.type,
    buttons: [options.negativeLabel, options.positiveLabel],
    defaultId: options.defaultButton === 'positive' ? 1 : 0,
    cancelId: 0,
    message: options.message,
    detail: options.detail
  }
  const result = window
    ? await dialog.showMessageBox(window, dialogOptions)
    : await dialog.showMessageBox(dialogOptions)
  return result.response === 1
}
