import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-48(U-8)·RT-49 — 키워드 필터가 실제 IPC 왕복까지 포함해 커밋 목록을
// 걸러내는지, 힌트 툴팁이 포커스/값에 맞춰 나타나고 사라지는지 확인한다.
// 단위 테스트(commitQueryParams.test.ts, commits.test.ts)는 파싱·git 동작을
// 이미 검증했으므로, 여기서는 화면까지 이어지는 통합 동작만 본다.

let fixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  const launched = await launchApp(fixture.dir)
  electronApp = launched.app
  window = launched.window
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row')).toHaveCount(2)
})

test.afterEach(async () => {
  await electronApp.close()
  fixture.cleanup()
})

test('포함 키워드로 커밋 메시지를 걸러낸다', async () => {
  const keyword = window.getByLabel('키워드')
  await keyword.fill('FileA')
  await keyword.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

  await expect(window.locator('.commit-row')).toHaveCount(1, { timeout: 250 })
  await expect(window.locator('.commit-row', { hasText: 'add FileA' })).toBeVisible()
})

test('제외(-) 키워드로 그 조건에 해당하는 커밋만 빠진다', async () => {
  const keyword = window.getByLabel('키워드')
  await keyword.fill('-FileB')
  await keyword.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

  await expect(window.locator('.commit-row')).toHaveCount(1, { timeout: 250 })
  await expect(window.locator('.commit-row', { hasText: 'add FileA' })).toBeVisible()
})

test('힌트 툴팁은 값을 입력하고 포커스가 있는 동안만 보인다', async () => {
  const keyword = window.getByLabel('키워드')
  const hint = window.locator('#query-filter-keyword-hint')

  await expect(hint).not.toBeVisible()

  await keyword.fill('FileA')
  await expect(hint).toBeVisible()

  // 값을 지우면(placeholder가 다시 보이면) 포커스가 있어도 사라진다.
  await keyword.fill('')
  await expect(hint).not.toBeVisible()

  await keyword.fill('FileA')
  await expect(hint).toBeVisible()
  // 포커스를 잃으면 사라진다.
  await window.getByLabel('작성자').click()
  await expect(hint).not.toBeVisible()
})

test('파일명 모드에서 제외(-) 줄이 있으면 힌트에 무시 경고가 추가된다', async () => {
  await window.getByRole('radio', { name: '파일명' }).check()
  const keyword = window.getByLabel('키워드')
  await keyword.click()
  await keyword.fill('-FileB')

  const hint = window.locator('#query-filter-keyword-hint')
  await expect(hint).toContainText('제외(-) 줄')
})
