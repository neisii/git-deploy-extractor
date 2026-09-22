import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-15(U5) — 공용 Popup 컴포넌트의 Esc 닫기 + 포커스 복귀. 실제 팝업
// (ManualAddPopup)을 통해 검증한다.

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

test('Esc로 팝업이 닫히고, 닫히면 트리거 버튼으로 포커스가 돌아온다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })).toBeVisible()

  const trigger = window.getByRole('button', { name: '+ 파일 추가' })
  await trigger.click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()

  // 열리면 검색 입력으로 포커스가 이동해 있어야 한다(자식의 autoFocus를
  // Popup이 가로채지 않음).
  await expect(popup.locator('input[type="text"]')).toBeFocused()

  await window.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)

  // 닫힌 뒤 포커스가 트리거(+ 파일 추가 버튼)로 돌아와야 한다.
  await expect(trigger).toBeFocused()
})
