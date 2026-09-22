import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-02 시나리오 ① — 커밋 검색(저장소 열기로 자동 로드)→선택→Preview→Export.
// docs/refactoring/REFACTORING_TASKS.md P0 안전망: 리팩토링 착수 전 현재
// 동작을 고정해 두는 회귀 테스트다.

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

test('커밋 선택 → Preview → Export까지 한 번에 끝난다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()

  // 저장소 열기 = 브랜치 자동 선택 + 첫 페이지 커밋 조회(loadCommitsFirstPage).
  // 두 커밋(add FileA, add FileB)이 보일 때까지 기다린다.
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()
  await expect(window.locator('.commit-row', { hasText: 'add FileA' })).toBeVisible()

  // "add FileB" 커밋만 선택 — FileA는 이 커밋의 변경사항이 아니므로
  // deployFiles(포함된 파일)에는 FileB만 잡혀야 한다.
  const targetRow = window.locator('.commit-row', { hasText: 'add FileB' })
  await targetRow.locator('input[type="checkbox"]').check()

  await window.getByRole('button', { name: 'Preview' }).click()

  const includedRow = window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })
  await expect(includedRow).toBeVisible()
  // FileA는 이번 선택의 변경 파일이 아니므로 좌측 "포함된 파일"에 없어야 한다.
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileA.txt' })).toHaveCount(0)

  const exportButton = window.getByRole('button', { name: 'Export' })
  await expect(exportButton).toBeEnabled()
  await exportButton.click()

  await expect(window.locator('text=Export 완료')).toBeVisible({ timeout: 10_000 })

  // 기본 Export 위치 = 저장소 루트/git-deploy-extracted(getDeployDir).
  const exportedFile = join(fixture.dir, 'git-deploy-extracted', 'src', 'FileB.txt')
  expect(existsSync(exportedFile)).toBe(true)
  expect(readFileSync(exportedFile, 'utf-8')).toBe('B v1\n')
})
