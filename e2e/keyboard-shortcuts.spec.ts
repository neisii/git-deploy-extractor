import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-14(U4) — 텍스트 영역(작성자/해시 필터)에서는 Enter가 줄바꿈이라
// Ctrl/Cmd+Enter로 디바운스(300ms)를 기다리지 않고 즉시 조회해야 한다.

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

test('해시 필터에서 Ctrl/Cmd+Enter로 300ms 디바운스를 기다리지 않고 즉시 조회된다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()
  await expect(window.locator('.commit-row')).toHaveCount(2)

  const shortHash = await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('.commit-row__hash')
    .innerText()

  const hashFilterTextarea = window.getByPlaceholder(
    '쉼표/공백/줄바꿈 구분, 입력 시 다른 조건 무시'
  )
  await hashFilterTextarea.fill(shortHash)
  await hashFilterTextarea.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

  // 300ms 디바운스보다 확실히 짧은 시간 안에 필터링된 결과(커밋 1개)만
  // 남아야 한다 — 디바운스를 기다린 게 아니라 단축키로 즉시 조회됐다는
  // 신호. preventDefault로 줄바꿈이 들어가지 않았는지도 같이 확인한다.
  await expect(window.locator('.commit-row')).toHaveCount(1, { timeout: 250 })
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()
  expect(await hashFilterTextarea.inputValue()).toBe(shortHash)
})
