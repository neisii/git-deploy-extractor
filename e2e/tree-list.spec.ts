import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-53(§5.1 RT-53, U-13·U-18) — TreeList의 새 동작: 폴더 단위 이동/복귀
// (미선택 변경 파일·Extract), 폴더 체크박스 indeterminate(M-20), 경로 복사
// 버튼(U-18). createFixtureRepo()의 두 커밋(add FileA/add FileB)을 모두
// 선택해 둘 다 "src/" 폴더 아래 함께 있는 상태로 재현한다.

let fixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  const launched = await launchApp(fixture.dir)
  electronApp = launched.app
  window = launched.window

  await window.getByRole('button', { name: 'Browse...' }).click()
  await window
    .locator('.commit-row', { hasText: 'add FileA' })
    .locator('input[type="checkbox"]')
    .check()
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // M-14 정정(2026-09-23) — Preview 직후 기본값은 전체 미선택이라, 이
  // 파일의 세 테스트가 전제하는 "둘 다 Extract에서 시작"을 재현하려면
  // 왼쪽 "src" 폴더 체크박스로 둘 다 옮겨야 한다.
  await window
    .locator('.included-row.tree-row--folder', { hasText: 'src' })
    .locator('input[type="checkbox"]')
    .click()
})

test.afterEach(async () => {
  await electronApp.close()
  fixture.cleanup()
})

test('Extract 폴더 ×로 하위 전체를 되돌리고, 왼쪽 폴더 체크박스로 다시 한꺼번에 이동한다', async () => {
  // beforeEach에서 폴더 체크박스로 옮겨둔 상태 — 둘 다 Extract에서 시작, "src" 폴더 하나에 2개.
  await expect(window.locator('.file-pane__title-text', { hasText: 'Extract 대상' })).toContainText(
    '2개'
  )

  const extractFolder = window.locator('.extract-row.tree-row--folder', { hasText: 'src' })
  await expect(extractFolder).toContainText('2')
  await extractFolder.locator('.extract-row__remove').click()

  // 폴더 × → 하위 전체가 왼쪽으로 복귀, Extract는 빈다.
  await expect(window.locator('.file-pane__title-text', { hasText: 'Extract 대상' })).toContainText(
    '0개'
  )
  const includedFolder = window.locator('.included-row.tree-row--folder', { hasText: 'src' })
  await expect(includedFolder).toBeVisible()
  await expect(includedFolder).toContainText('2')

  // 폴더 체크박스 클릭 → 하위 전체가 다시 Extract로 이동.
  await includedFolder.locator('input[type="checkbox"]').click()
  await expect(window.locator('.file-pane__title-text', { hasText: 'Extract 대상' })).toContainText(
    '2개'
  )
  await expect(window.locator('.included-row.tree-row--folder', { hasText: 'src' })).toHaveCount(0)
})

test('폴더 안 일부만 Extract로 이동하면 왼쪽 폴더 체크박스가 indeterminate로 표시된다(M-20)', async () => {
  // FileA만 왼쪽으로 되돌린다 — FileB는 그대로 Extract에 남는다.
  await window
    .locator('.extract-row', { hasText: 'FileA.txt' })
    .locator('.extract-row__remove')
    .click()

  const folderCheckbox = window
    .locator('.included-row.tree-row--folder', { hasText: 'src' })
    .locator('input[type="checkbox"]')
  await expect(folderCheckbox).toBeVisible()
  await expect(folderCheckbox).not.toBeChecked()
  expect(await folderCheckbox.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true)
})

test('경로 복사 버튼을 누르면 클립보드에 저장소 기준 상대경로가 복사되고 ✓ 피드백이 보인다(U-18)', async () => {
  const row = window.locator('.extract-row', { hasText: 'FileA.txt' })
  await row.hover()
  const copyButton = row.locator('.copy-path-button')
  await copyButton.click()

  await expect(copyButton).toHaveText('✓')
  const clipboardText = await window.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe('src/FileA.txt')
})
