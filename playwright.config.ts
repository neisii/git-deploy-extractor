import { defineConfig } from '@playwright/test'

// RT-02(P0 안전망) — Electron 앱 자체를 구동하는 E2E다. electron-vite build
// 산출물(out/main/index.js)을 대상으로 하므로, 실행 전에 `npm run build`가
// 먼저 끝나 있어야 한다(`npm run test:e2e`가 이를 보장한다).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false, // 각 테스트가 독립된 Electron 인스턴스를 띄우지만, 여러 개가 동시에 뜨면 무거워서 직렬 실행
  workers: 1,
  timeout: 30_000,
  reporter: [['list']]
})
