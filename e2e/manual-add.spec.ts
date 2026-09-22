import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-02 시나리오 ③ — 파일 수동 추가·팝업(REQ-021/DR-019).
// "add FileB" 커밋만 선택해 Preview하면 FileA는 deployFiles에 없지만
// HEAD 트리에는 있으므로 "+ 파일 추가" 팝업의 후보로 남는다.

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

test('파일 추가 팝업에서 검색 → 추가 → 칩 표시 → 포함된 파일에 반영', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileB.txt' })).toBeVisible()

  // Preview 직후에는 FileA가 아직 목록에 없다(변경 파일이 아니므로).
  await expect(window.locator('.deploy-files-row', { hasText: 'src/FileA.txt' })).toHaveCount(0)

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  // RT-15: 백드롭·박스 클래스가 공용 Popup 컴포넌트로 옮겨지며
  // .manual-add-popup → .popup으로 바뀌었다.
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()

  await popup.locator('input[type="text"]').fill('FileA')
  const resultRow = popup.locator('li', { hasText: 'src/FileA.txt' })
  await expect(resultRow).toBeVisible()
  await resultRow.getByRole('button', { name: '추가' }).click()

  // 칩 이력에 추가된 파일이 보인다.
  await expect(popup.locator('.manual-add-popup__chip', { hasText: 'src/FileA.txt' })).toBeVisible()

  // 닫기 버튼의 글자 내용은 "×"이고 title="닫기"라 접근성 이름은 "×"다.
  await popup.locator('.popup__header button').click()
  await expect(popup).toHaveCount(0)

  // 팝업을 닫은 뒤 좌측 "포함된 파일"에 FileA가 체크된 채로 반영돼 있어야 한다.
  const addedRow = window.locator('.deploy-files-row', { hasText: 'src/FileA.txt' })
  await expect(addedRow).toBeVisible()
  await expect(addedRow.locator('input[type="checkbox"]')).toBeChecked()
})
