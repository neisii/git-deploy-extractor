import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-43/RT-44/RT-46 — WorkArea가 소유한 PopupHost(openPopup)로 옮겨간
// 팝업들(Deleted/경고/파일 패턴)과, PreviewSummary의 새 버튼·FilterPatternBar를
// 실제 앱에서 검증한다. createFixtureRepo()의 두 커밋(add FileA/add FileB)에
// FileA를 지우는 커밋을 하나 더 얹어 삭제 목록·"HEAD에 없음" 경고를 모두
// 재현할 수 있게 한다.

let fixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  execFileSync('git', ['rm', '-q', 'src/FileA.txt'], { cwd: fixture.dir })
  execFileSync('git', ['commit', '-q', '-m', 'delete FileA'], { cwd: fixture.dir })
  const launched = await launchApp(fixture.dir)
  electronApp = launched.app
  window = launched.window
})

test.afterEach(async () => {
  await electronApp.close()
  fixture.cleanup()
})

test('PreviewSummary의 Deleted 버튼으로 삭제 목록 팝업을 열고 닫는다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'delete FileA' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'delete FileA' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()

  const deletedButton = window.getByRole('button', { name: 'Deleted: 1 ▸' })
  await expect(deletedButton).toBeEnabled()
  await deletedButton.click()

  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()
  await expect(popup.locator('.popup-plain-list li', { hasText: 'FileA.txt' })).toBeVisible()

  await popup.locator('.popup__header button').click()
  await expect(popup).toHaveCount(0)
})

test('HEAD에 없는 커밋만 선택하면 경고 버튼이 나타나고 팝업에 경로가 보인다(DR-009)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileA' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileA' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()

  const warnButton = window.getByRole('button', { name: '⚠ HEAD에 없음: 1 ▸' })
  await expect(warnButton).toBeVisible()
  await warnButton.click()

  const popup = window.locator('.popup')
  await expect(popup.locator('.popup-plain-list li', { hasText: 'FileA.txt' })).toBeVisible()

  await window.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
})

test('Reload를 누르면 열려 있던 팝업이 닫힌다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'delete FileA' })).toBeVisible()
  await window
    .locator('.commit-row', { hasText: 'delete FileA' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await window.getByRole('button', { name: 'Deleted: 1 ▸' }).click()
  await expect(window.locator('.popup')).toBeVisible()

  await window.getByRole('button', { name: 'Reload' }).click()
  await expect(window.locator('.popup')).toHaveCount(0)
})

test('파일 패턴을 추가하면 매치되는 파일이 숨겨지고, 패턴 팝업에서 토글·삭제할 수 있다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })).toBeVisible()

  await window.locator('.filter-pattern-bar input[type="text"]').fill('FileB.txt')
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '+추가' }).click()

  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })).toHaveCount(0)
  await expect(window.locator('.filter-pattern-bar__summary')).toContainText('1개 숨김')

  await window.locator('.filter-pattern-bar').getByRole('button', { name: '보기' }).click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()
  const chip = popup.locator('.chip', { hasText: 'FileB.txt' })
  await expect(chip).toBeVisible()

  // 라벨 클릭 = 활성 토글 → 꺼지면 숨김이 풀린다.
  await chip.locator('.chip__label').click()
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })).toBeVisible()

  // × = 삭제(확인창 없음, REQ-024) → 등록이 0개가 되어 팝업이 자동으로 닫힌다.
  await chip.locator('.chip__remove').click()
  await expect(popup).toHaveCount(0)
})
