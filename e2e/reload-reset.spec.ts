import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-55(U-15, §5.1 RT-55) — Reload 전체 초기화. 순수 상태 초기화는
// repositorySlice.reload.test.ts(vitest)가 이미 검증했으므로, 여기서는
// 화면까지 이어지는 통합 동작(키워드 필터로 목록을 걸러낸 뒤 Reload하면
// 필터가 풀리고 전체 커밋이 다시 보이는지, 선택·Extract 결과가 비는지)만
// 확인한다.

let fixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  const launched = await launchApp(fixture.dir)
  electronApp = launched.app
  window = launched.window
})

test.afterEach(async () => {
  await electronApp.close()
  fixture.cleanup()
})

test('Reload하면 키워드 필터·커밋 선택·Extract 결과가 초기화된다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row')).toHaveCount(2)

  const keyword = window.getByLabel('키워드')
  await keyword.fill('FileA')
  await keyword.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
  await expect(window.locator('.commit-row')).toHaveCount(1, { timeout: 250 })

  await window
    .locator('.commit-row', { hasText: 'add FileA' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // M-14 정정(2026-09-23) — Preview 직후 기본값은 전체 미선택이라 직접
  // 체크해서 Extract로 옮긴다.
  // .check() 대신 .click() — 체크 즉시 행이 사라져(Extract로 이동)
  // .check()의 사후 checked 확인이 타임아웃난다(실측 확인).
  await window
    .locator('.included-row', { hasText: 'FileA.txt' })
    .locator('input[type="checkbox"]')
    .click()
  await expect(window.locator('.extract-row', { hasText: 'FileA.txt' })).toBeVisible()

  await window.getByRole('button', { name: 'Reload' }).click()

  // 키워드 필터가 풀려 전체 2개 커밋이 다시 보인다.
  await expect(window.locator('.commit-row')).toHaveCount(2)
  await expect(keyword).toHaveValue('')
  // 선택이 지워져 체크박스가 전부 해제 상태다.
  for (const checkbox of await window.locator('.commit-row input[type="checkbox"]').all()) {
    await expect(checkbox).not.toBeChecked()
  }
  // Preview 결과(Extract 대상)도 폐기됐다.
  await expect(window.locator('.extract-row', { hasText: 'FileA.txt' })).toHaveCount(0)
})
