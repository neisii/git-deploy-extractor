import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-02 시나리오 ③ — 파일 수동 추가·팝업(REQ-021/DR-019). RT-51/52로
// ManualAddPopup → AddFilesPopup, 좌측 체크 목록 → Extract 목록(오른쪽)
// 모델로 바뀌었다: "add FileB" 커밋만 선택해 Preview하면 Preview 직후
// 기본값(M-14 정정, 2026-09-23: 전체 미선택)에 따라 FileB는 왼쪽
// "포함된 파일"에 남는다. FileA는 이 선택의 변경 파일이 아니라
// deployFiles에 없고 HEAD 트리에는 있으므로 "+ 파일 추가" 팝업의
// 후보로 남는다.

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

test('파일 추가 팝업에서 검색 → 추가 → 칩 표시 → Extract 대상에 반영', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // M-14 정정(2026-09-23) — Preview 직후 기본값은 전체 미선택이라 FileB는
  // 왼쪽(포함된 파일)에 남는다. RT-53 — 리프는 파일명만 표시한다(전체
  // 경로는 title 툴팁).
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  // FileA는 이번 선택의 변경 파일이 아니므로 어느 목록에도 아직 없다.
  await expect(window.locator('.included-row', { hasText: 'FileA.txt' })).toHaveCount(0)
  await expect(window.locator('.extract-row', { hasText: 'FileA.txt' })).toHaveCount(0)

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  // RT-15: 백드롭·박스 클래스가 공용 Popup 컴포넌트로 옮겨지며
  // .manual-add-popup → .popup으로 바뀌었다.
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()

  await popup.locator('input[type="text"]').fill('FileA')
  const resultRow = popup.locator('.tree-row--file', { hasText: 'FileA.txt' })
  await expect(resultRow).toBeVisible()
  await resultRow.getByRole('button', { name: '추가' }).click()

  // 칩 이력에 추가된 파일이 보인다.
  await expect(popup.locator('.manual-add-popup__chip', { hasText: 'src/FileA.txt' })).toBeVisible()

  // 닫기 버튼의 글자 내용은 "×"이고 title="닫기"라 접근성 이름은 "×"다.
  await popup.locator('.popup__header button').click()
  await expect(popup).toHaveCount(0)

  // 팝업을 닫은 뒤 오른쪽 Extract 대상에 FileA가 "수동" 배지와 함께
  // 반영돼 있어야 한다(원래 목록이 없어 왼쪽으로는 안 감, §3.2).
  const addedRow = window.locator('.extract-row', { hasText: 'FileA.txt' })
  await expect(addedRow).toBeVisible()
  await expect(addedRow.locator('.extract-row__source-badge')).toHaveText('수동')
})

test('검색어 없이 열면 HEAD 트리 전체를 탐색할 수 있다(RT-53, 이 fixture엔 누락된 의존성 없음)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // M-14 정정(2026-09-23) — Preview 직후 기본값은 전체 미선택.
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  const popup = window.locator('.popup')
  // RT-53 — 탐색 모드(검색어 없음)는 이제 HEAD 트리 전체를 보여준다(이미
  // Extract에 있는 FileB는 제외) — 이 fixture엔 FileA만 후보로 남는다.
  // Java/Spring 구조가 아니라 누락된 의존성은 없으므로 "보이는 항목 모두
  // 추가"는 비활성이어야 한다.
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toBeVisible()
  await expect(popup.getByRole('button', { name: /보이는 항목 모두 추가/ })).toBeDisabled()
})
