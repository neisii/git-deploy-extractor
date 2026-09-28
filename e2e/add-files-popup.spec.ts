import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
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

// 파일 패턴은 저장소 구분 없이 전역 파일(patterns.json)에 저장되고
// e2e의 userData가 테스트 실행 사이에도 그대로 남는다 — 아래 새 테스트가
// 추가한 패턴이 정리 안 되면 다음 테스트(이 파일 포함)로 새어 들어간다
// (included-files-pane.spec.ts의 clearAllPatterns와 같은 이유).
async function clearAllPatterns(window: Page): Promise<void> {
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '설정' }).click()
  const popup = window.locator('.popup')
  for (;;) {
    const removeButton = popup.locator('.chip__remove').first()
    if ((await removeButton.count()) === 0) break
    await removeButton.click()
  }
  await popup.locator('.popup__header button').click()
}

test('파일 추가 팝업에서 검색 → 추가 → 칩 표시 → Extract 대상에 반영', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
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

test('정정(2026-09-28) — 활성 제외 패턴에 걸리는 파일은 탐색/검색 모드 모두에서 숨겨진다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  // FileA.txt를 제외하는 패턴을 등록한다(§8.1 M-51과 같은 진입점).
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '설정' }).click()
  const patternPopup = window.locator('.popup')
  await expect(patternPopup).toBeVisible()
  await patternPopup.locator('input[type="text"]').fill('FileA.txt')
  await patternPopup.getByRole('button', { name: '+추가' }).click()
  await patternPopup.locator('.popup__header button').click()
  await expect(patternPopup).toHaveCount(0)

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()

  // 탐색 모드(검색어 없음) — FileA.txt가 후보에서 완전히 숨겨진다.
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toHaveCount(0)

  // 결과 모드(검색어 있음)도 동일하게 숨겨진다.
  await popup.locator('input[type="text"]').fill('FileA')
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toHaveCount(0)

  await popup.locator('.popup__header button').click()
  await clearAllPatterns(window)
})

test('검색어 없이 열면 HEAD 트리 전체를 탐색할 수 있다(RT-53, 이 fixture엔 누락된 의존성 없음)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
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

test('정정(2026-09-28) — 팝업 안 "+ 패턴 추가"로 나가지 않고 패턴을 추가하면 목록이 바로 줄어든다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toBeVisible()

  // 기본은 접힌 상태 — 펼쳐야 입력이 나온다.
  await expect(popup.getByRole('textbox')).toHaveCount(1) // 검색창만
  await popup.getByRole('button', { name: '+ 패턴 추가' }).click()
  await popup.locator('.filter-patterns-popup__add-row input[type="text"]').fill('FileA.txt')
  await popup.getByRole('button', { name: '+추가' }).click()

  // 팝업을 나가지 않고도 트리에서 FileA.txt가 바로 사라진다.
  await expect(popup.locator('.tree-row--file', { hasText: 'FileA.txt' })).toHaveCount(0)
  await expect(popup).toBeVisible()

  await popup.locator('.popup__header button').click()
  await clearAllPatterns(window)
})

test('핫픽스(2026-09-28) — 수동 추가 이력이 늘어나도 칩 영역은 트리 영역을 잠식하지 않는다', async () => {
  // 기본 fixture(FileA/FileB)만으로는 후보가 1개뿐이라 wrap을 재현할 수
  // 없다 — 이 테스트에서만 후보 31개(FileA + M01~M30)로 늘린다(다른
  // 테스트의 "FileA만 남는다" 가정을 건드리지 않기 위해 beforeEach가
  // 아니라 여기서 직접 커밋). 실측(720px 팝업 기준) — 9개까지는 자연
  // wrap만으로도 2줄(44px) 안에 들어가 고정 전후 차이가 안 드러났다.
  // 30개는 고정 전 5줄(116px, 트리 −124px)까지 벌어져 고정 유무가
  // 뚜렷이 갈린다(고정 후 48px, 트리 −56px) — 수치는 이 실측을 근거로
  // 정했다.
  const extraFiles = Array.from(
    { length: 30 },
    (_, i) => `src/M${String(i + 1).padStart(2, '0')}.txt`
  )
  for (const path of extraFiles) {
    writeFileSync(join(fixture.dir, path), 'x\n')
  }
  execFileSync('git', ['add', '-A'], { cwd: fixture.dir })
  execFileSync('git', ['commit', '-q', '-m', 'add extra manual candidates'], { cwd: fixture.dir })

  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()

  const treeArea = popup.locator('.add-files-popup__tree')
  const treeHeightBefore = (await treeArea.boundingBox())?.height ?? 0

  for (const path of ['FileA.txt', ...extraFiles.map((p) => p.split('/')[1])]) {
    await popup.locator('input[type="text"]').fill(path)
    await popup
      .locator('.tree-row--file', { hasText: path })
      .getByRole('button', { name: '추가' })
      .click()
  }
  await popup.locator('input[type="text"]').fill('')

  const chips = popup.locator('.manual-add-popup__chips')
  await expect(chips).toBeVisible()
  await expect(chips.locator('.manual-add-popup__chip')).toHaveCount(31)

  // 칩 영역 자체 높이가 CSS 상한(48px)을 넘지 않는다 — 실측상 고정이
  // 없으면 116px까지 벌어진다(위 주석).
  const chipsHeight = (await chips.boundingBox())?.height ?? 0
  expect(chipsHeight).toBeLessThanOrEqual(52)

  // 트리 영역은 칩이 31개로 늘어난 뒤에도 팝업을 처음 열었을 때와 크게
  // 다르지 않은 높이를 유지한다(실측 −56px, 고정이 없으면 −124px).
  const treeHeightAfter = (await treeArea.boundingBox())?.height ?? 0
  expect(treeHeightBefore - treeHeightAfter).toBeLessThanOrEqual(80)
})

test('핫픽스(2026-09-28) — 파일명이 아주 길어도 행이 줄바꿈 없이 ellipsis로 잘리고 "추가" 버튼이 정상 크기를 유지한다', async () => {
  // 재현 전 원인: .add-files-row__name(flex 컨테이너) 자신에 ellipsis를
  // 걸어둬서 실제로는 안 잘리고 그대로 넘쳤다 — 넘친 텍스트가 "추가"
  // 버튼 폭을 짓눌러 버튼 글자가 두 줄로 접히는 것까지 Playwright
  // 스크린샷으로 직접 확인 후 고쳤다.
  const longName = 'A'.repeat(40) + '_VeryLongFileNameForLayoutDebugging_' + 'B'.repeat(40) + '.txt'
  writeFileSync(join(fixture.dir, `src/${longName}`), 'x\n')
  execFileSync('git', ['add', '-A'], { cwd: fixture.dir })
  execFileSync('git', ['commit', '-q', '-m', 'add long name file'], { cwd: fixture.dir })

  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  await window.getByRole('button', { name: '+ 파일 추가' }).click()
  const popup = window.locator('.popup')
  await expect(popup).toBeVisible()

  await popup.locator('input[type="text"]').fill('VeryLong')
  const row = popup.locator('.tree-row--file', { hasText: 'VeryLongFileNameForLayoutDebugging' })
  await expect(row).toBeVisible()

  // 행 높이가 TreeList의 고정 한 줄 높이(28px)를 벗어나지 않는다 —
  // 벗어난다면 텍스트나 버튼이 줄바꿈됐다는 뜻이다.
  const rowHeight = (await row.boundingBox())?.height ?? 0
  expect(rowHeight).toBeLessThanOrEqual(30)

  // "추가" 버튼도 한 줄 높이를 유지한다(글자가 두 줄로 접히면 커진다).
  const addButton = row.getByRole('button', { name: '추가' })
  const addButtonHeight = (await addButton.boundingBox())?.height ?? 0
  expect(addButtonHeight).toBeLessThanOrEqual(26)

  // 행이 팝업 폭을 가로로 넘치지 않는다.
  const rowBox = await row.boundingBox()
  const popupBox = await popup.boundingBox()
  expect(rowBox && popupBox && rowBox.width).toBeLessThanOrEqual((popupBox?.width ?? 0) + 1)
})
