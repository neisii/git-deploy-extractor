import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'node:path'

// RT-02(P0 안전망) — electron-vite build 산출물(out/main/index.js)을 그대로
// 구동한다. repository:browse는 GDE_E2E_REPO_PATH가 있으면 OS 다이얼로그
// 없이 그 경로를 바로 반환한다(main/ipc/handlers.ts 참고) — Playwright가
// 네이티브 폴더 선택 창을 조작할 수 없기 때문에 필요한 최소 우회다.
export async function launchApp(repoPath: string): Promise<{
  app: ElectronApplication
  window: Page
}> {
  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
    env: { ...process.env, GDE_E2E_REPO_PATH: repoPath }
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return { app, window }
}
