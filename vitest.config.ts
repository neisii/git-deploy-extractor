import { defineConfig } from 'vitest/config'

// RT-01(P0 안전망) — 순수 함수 단위 테스트 전용 설정. electron.vite.config.ts의
// main/preload/renderer 3분할 빌드 설정과는 별개다. 대상 함수들이 DOM/Node API에
// 의존하지 않으므로 environment는 'node'로 충분하다(jsdom 도입은 RT-02의
// Playwright 몫).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
