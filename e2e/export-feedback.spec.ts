import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-16(U7·U8) — Export 완료 메시지의 복사 피드백·선택 변경 시 초기화,
// 파일 행의 키보드 토글(체크박스).

let fixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  const launched = await launchApp(fixture.dir)
  electronApp = launched.app
  window = launched.window

  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })).toBeVisible()
})

test.afterEach(async () => {
  await electronApp.close()
  fixture.cleanup()
})

test('Export 완료 메시지를 클릭하면 복사 성공 피드백이 보인다(U7)', async () => {
  await window.getByRole('button', { name: 'Export' }).click()
  const doneMessage = window.locator('.status-text--copyable')
  await expect(doneMessage).toBeVisible()

  await doneMessage.click()
  await expect(window.locator('text=✓ 복사됨')).toBeVisible()

  const clipboardText = await window.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toContain('git-deploy-extracted')
})

test('Export 완료 후 커밋 선택을 바꾸면 완료 메시지가 사라진다(U7)', async () => {
  await window.getByRole('button', { name: 'Export' }).click()
  await expect(window.locator('.status-text--copyable')).toBeVisible()

  // 선택 변경 — 다른 커밋을 추가로 체크한다.
  await window
    .locator('.commit-row', { hasText: 'add FileA' })
    .locator('input[type="checkbox"]')
    .check()

  await expect(window.locator('.status-text--copyable')).toHaveCount(0)
})

test('파일 행 체크박스는 키보드(Space)로도 토글된다(U8)', async () => {
  const row = window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })
  const checkbox = row.locator('input[type="checkbox"]')
  await expect(checkbox).toBeChecked()

  await checkbox.focus()
  await window.keyboard.press('Space')
  await expect(checkbox).not.toBeChecked()
})
