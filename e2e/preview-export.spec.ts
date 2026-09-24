import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createExportDirFixture, createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-02 시나리오 ① — 커밋 검색(저장소 열기로 자동 로드)→선택→Preview→Export.
// docs/refactoring/REFACTORING_TASKS.md P0 안전망: 리팩토링 착수 전 현재
// 동작을 고정해 두는 회귀 테스트다.

let fixture: Fixture
let exportDirFixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  // RT-56(REQ-012 정정) — 경로를 명시적으로 고르지 않으면 Export가
  // 막히므로(저장소 루트 기본값 폐지), 저장소와 겹치지 않는 빈 폴더를
  // 미리 준비해 GDE_E2E_EXPORT_DIR로 넘긴다.
  exportDirFixture = createExportDirFixture()
  const launched = await launchApp(fixture.dir, exportDirFixture.dir)
  electronApp = launched.app
  window = launched.window
})

test.afterEach(async () => {
  // 전역(localStorage) Export 경로 상태라 다음 테스트(다른 spec 파일
  // 포함)로 새어 나가지 않도록 정리한다(included-files-pane.spec.ts의
  // clearAllPatterns와 같은 이유).
  await window.evaluate(() => localStorage.removeItem('gde:exportParentDir'))
  await electronApp.close()
  fixture.cleanup()
  exportDirFixture.cleanup()
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

  // M-14 정정(2026-09-23) — Preview 직후 기본값은 "전체 미선택"이라
  // FileB는 왼쪽 "포함된 파일"에 남아있다 — 직접 체크해서 Extract로 옮긴다.
  const includedRow = window.locator('.included-row', { hasText: 'FileB.txt' })
  await expect(includedRow).toBeVisible()
  // .check() 대신 .click()을 쓴다 — 체크하는 순간 이 행이 왼쪽 목록에서
  // 사라져 Extract로 옮겨가므로, .check()의 클릭 후 "checked 상태 확인"
  // 단계가 사라진 요소를 계속 기다리다 타임아웃난다(실측 확인).
  await includedRow.locator('input[type="checkbox"]').click()

  const extractRow = window.locator('.extract-row', { hasText: 'FileB.txt' })
  await expect(extractRow).toBeVisible()
  // FileA는 이번 선택의 변경 파일이 아니므로 어느 목록에도 없어야 한다.
  await expect(window.locator('.included-row', { hasText: 'FileA.txt' })).toHaveCount(0)
  await expect(window.locator('.extract-row', { hasText: 'FileA.txt' })).toHaveCount(0)

  // RT-56(REQ-012 정정) — 경로를 명시적으로 고르기 전에는 Export가
  // 막힌다. "변경"으로 exportDirFixture.dir을 고른다(GDE_E2E_EXPORT_DIR
  // 우회, launchApp.ts 참고) — 다른 spec 파일이 남긴 전역(localStorage)
  // Export 경로가 있어도 이 클릭이 결정적으로 exportDirFixture.dir로
  // 덮어쓴다.
  await window.getByRole('button', { name: '변경' }).click()
  const exportButton = window.getByRole('button', { name: 'Export' })
  await expect(exportButton).toBeEnabled()
  await exportButton.click()

  await expect(window.locator('text=Export 완료')).toBeVisible({ timeout: 10_000 })

  // 기본 Export 방식(sub) = <선택 경로>/git-deploy-extracted(getDeployDir).
  const exportedFile = join(exportDirFixture.dir, 'git-deploy-extracted', 'src', 'FileB.txt')
  expect(existsSync(exportedFile)).toBe(true)
  expect(readFileSync(exportedFile, 'utf-8')).toBe('B v1\n')
})
