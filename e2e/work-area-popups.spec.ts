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
  // RT-53 — 평탄한 목록(popup-plain-list)이 TreeList로 바뀌었다. 이
  // fixture는 파일 하나가 저장소 루트에 바로 있어 폴더 없이 리프 행
  // 하나만 뜬다.
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toBeVisible()

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
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toBeVisible()

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

test('파일 패턴을 추가하면 Extract 행이 흐려지고, 패턴 팝업에서 토글·삭제할 수 있다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // M-14 정정(2026-09-23) — Preview 직후 기본값은 전체 미선택이라 직접
  // 체크해서 Extract로 옮긴다.
  // .check() 대신 .click() — 체크 즉시 행이 사라져(Extract로 이동)
  // .check()의 사후 checked 확인이 타임아웃난다(실측 확인).
  await window
    .locator('.included-row', { hasText: 'FileB.txt' })
    .locator('input[type="checkbox"]')
    .click()
  const extractRow = window.locator('.extract-row', { hasText: 'FileB.txt' })
  await expect(extractRow).toBeVisible()

  // M-51(2026-09-24) — 패턴 추가 입력이 툴바에서 팝업 안으로 옮겨갔다 —
  // "설정" 버튼(M-55, 2026-09-24 — "보기+추가"에서 개명)이 이제 유일한
  // 진입점이다.
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '설정' }).click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()
  await popup.locator('input[type="text"]').fill('FileB.txt')
  await popup.getByRole('button', { name: '+추가' }).click()

  // RT-51(§5.1) — Extract 목록은 패턴에 걸려도 숨기지 않고 흐림+취소선+
  // "패턴 제외" 태그로 표시한다(조용한 누락 방지) — 행 자체는 그대로
  // 보이고, 제목에도 반영된다. 팝업이 열려 있는 채로도 뒤의 상태가
  // 즉시 갱신된다(같은 zustand 스토어를 구독하므로).
  await expect(extractRow.locator('.extract-row__pattern-tag')).toHaveText('패턴 제외')
  await expect(window.locator('.file-pane__title-text', { hasText: 'Extract 대상' })).toContainText(
    '패턴 제외 1개'
  )

  const chip = popup.locator('.chip', { hasText: 'FileB.txt' })
  await expect(chip).toBeVisible()

  // 라벨 클릭 = 활성 토글 → 꺼지면 패턴 제외 표시가 풀린다.
  await chip.locator('.chip__label').click()
  await expect(extractRow.locator('.extract-row__pattern-tag')).toHaveCount(0)

  // × = 삭제(확인창 없음, REQ-024). M-51 — 팝업이 이제 "0개에서 추가"의
  // 진입점이기도 해서, 예전과 달리 0개가 돼도 자동으로 닫히지 않는다.
  await chip.locator('.chip__remove').click()
  await expect(popup).toBeVisible()
  await expect(popup.getByText('없음')).toHaveCount(2)
})
