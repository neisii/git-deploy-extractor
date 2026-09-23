import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-45(U-3·U-5) — "포함된 파일"에서 상태 Filter·좌측 검색(REQ-025)을
// 삭제하고, added를 녹색+"+"마커로 구분하고(M-2), "+ 파일 추가"를 제목
// 줄 우측으로 옮기고, 그 대체 안전장치로 파일 패턴에 "화면만"(M-1) 옵션이
// 생겼는지를 검증한다. createFixtureRepo()의 두 커밋(add FileA/add FileB)에
// FileA를 수정하는 커밋을 하나 더 얹어 added/modified 색 대비를 재현한다.

let fixture: Fixture
let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  fixture = createFixtureRepo()
  writeFileSync(join(fixture.dir, 'src/FileA.txt'), 'A v2\n')
  execFileSync('git', ['add', '-A'], { cwd: fixture.dir })
  execFileSync('git', ['commit', '-q', '-m', 'modify FileA'], { cwd: fixture.dir })
  const launched = await launchApp(fixture.dir)
  electronApp = launched.app
  window = launched.window
})

test.afterEach(async () => {
  await electronApp.close()
  fixture.cleanup()
})

// 파일 패턴(gde:excludePatterns)은 저장소별 구분 없이 localStorage에 전역
// 저장된다(REQ-019/DR-018) — 이 앱의 userData가 테스트 실행 사이에도
// 그대로 남아있어, 다른 테스트(이 파일 포함)가 추가하고 정리하지 않은
// 패턴이 다음 실행에 새어 들어올 수 있다. 매 테스트 시작 시 등록된
// 패턴을 전부 지워 커밋/저장소 fixture와 무관하게 결정적인 상태에서
// 시작하게 한다.
async function clearAllPatterns(window: Page): Promise<void> {
  const viewButton = window.locator('.filter-pattern-bar').getByRole('button', { name: '보기' })
  if (await viewButton.isDisabled()) return
  await viewButton.click()
  const popup = window.locator('.popup')
  while (await popup.isVisible()) {
    const removeButton = popup.locator('.chip__remove').first()
    if ((await removeButton.count()) === 0) break
    await removeButton.click()
  }
}

test('좌측 "포함된 파일"에는 Filter·검색 UI가 없고, + 파일 추가가 제목과 같은 줄에 있다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // RT-51(M-14) — Preview 직후 기본값은 전체 Extract로 이동이라, 왼쪽
  // "포함된 파일"(미선택 변경 파일)은 빈 상태로 시작한다.
  await expect(window.locator('.extract-row', { hasText: 'FileB.txt' })).toBeVisible()

  // hasText로 "포함된 파일"을 찾으면 우측 패널의 PanelState na 문구
  // ("...포함된 파일 중 Java 파일이 없습니다")에도 우연히 매치돼 2개가
  // 잡힌다 — "+ 파일 추가" 버튼(좌측 전용)을 갖고 있는 FilePane으로
  // 정확히 스코핑한다.
  const includedPane = window
    .locator('.file-pane')
    .filter({ has: window.getByRole('button', { name: '+ 파일 추가' }) })
  await expect(includedPane.getByText('Filter:')).toHaveCount(0)
  await expect(includedPane.getByText('검색(파일명):', { exact: false })).toHaveCount(0)
  await expect(includedPane).toContainText('전부 Extract 대상으로 이동했습니다')

  const titleRow = includedPane.locator('.file-pane__title')
  await expect(titleRow).toContainText('포함된 파일')
  await expect(titleRow.getByRole('button', { name: '+ 파일 추가' })).toBeVisible()
})

test('added 파일은 녹색 + "+" 마커, modified는 기본색으로 구분된다(M-2)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window
    .locator('.commit-row', { hasText: 'modify FileA' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()

  // RT-51(M-14) — 둘 다 기본값으로 Extract 목록에 바로 들어간다.
  const addedText = window
    .locator('.extract-row', { hasText: 'FileB.txt' })
    .locator('.deploy-files-row__local')
  const modifiedText = window
    .locator('.extract-row', { hasText: 'FileA.txt' })
    .locator('.deploy-files-row__local')
  await expect(addedText).toBeVisible()
  await expect(modifiedText).toBeVisible()

  await expect(addedText).toHaveCSS('color', 'rgb(103, 192, 144)')
  await expect(addedText.locator('.deploy-files-row__status-marker')).toBeVisible()
  await expect(modifiedText).not.toHaveCSS('color', 'rgb(103, 192, 144)')
  await expect(modifiedText.locator('.deploy-files-row__status-marker')).toHaveCount(0)
})

test('"화면만" 패턴은 Extract 목록엔 영향 없고(선택 개수 그대로), 왼쪽으로 되돌리면 화면에서만 숨긴다(M-1)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  const extractRow = window.locator('.extract-row', { hasText: 'FileB.txt' })
  await expect(extractRow).toBeVisible()

  await window.locator('.filter-pattern-bar input[type="text"]').fill('FileB.txt')
  await window.locator('.filter-pattern-bar__screen-only input[type="checkbox"]').check()
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '+추가' }).click()

  // RT-51 — screenOnly 패턴은 Export 대상 계산에 안 쓰이는
  // exportRelevantPatterns에서 애초에 빠지므로, Extract 행은 흐려지지
  // 않고(패턴 제외 태그 없음) "선택" 개수도 그대로다.
  const includedPane = window
    .locator('.file-pane')
    .filter({ has: window.getByRole('button', { name: '+ 파일 추가' }) })
  await expect(extractRow.locator('.extract-row__pattern-tag')).toHaveCount(0)
  await expect(includedPane).toContainText('선택 1개')

  // 왼쪽으로 되돌리면(×) 그제서야 "화면만" 패턴이 실제로 숨긴다 — 왼쪽
  // 목록에서만 통하는 화면 필터라는 걸 확인한다.
  await extractRow.locator('.extract-row__remove').click()
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toHaveCount(0)

  // 전역(localStorage) 패턴 상태라 다음 테스트(다른 spec 파일 포함)로
  // 새어 나가지 않도록 정리한다.
  await clearAllPatterns(window)
})

test('패턴 팝업에서 "화면만"을 토글하면 Extract의 패턴 제외 표시와 선택 개수가 즉시 바뀐다(M-1)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  const extractRow = window.locator('.extract-row', { hasText: 'FileB.txt' })
  await expect(extractRow).toBeVisible()

  // 화면만 체크 없이 추가 → 일반 제외 패턴이라 Export 대상에서도 빠지고
  // (선택 0개) Extract 행이 흐려진다.
  await window.locator('.filter-pattern-bar input[type="text"]').fill('FileB.txt')
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '+추가' }).click()
  const includedPane = window
    .locator('.file-pane')
    .filter({ has: window.getByRole('button', { name: '+ 파일 추가' }) })
  await expect(extractRow.locator('.extract-row__pattern-tag')).toBeVisible()
  await expect(includedPane).toContainText('선택 0개')

  await window.locator('.filter-pattern-bar').getByRole('button', { name: '보기' }).click()
  const popup = window.locator('.popup')
  await popup.locator('.filter-patterns-popup__screen-only-toggle').click()
  await popup.locator('.popup__header button').click()

  // screenOnly로 바뀌면 Export 대상 계산에서 빠지지 않아 Extract 행의
  // 패턴 제외 표시가 없어지고 선택 개수가 복원된다.
  await expect(extractRow.locator('.extract-row__pattern-tag')).toHaveCount(0)
  await expect(includedPane).toContainText('선택 1개')

  // 전역(localStorage) 패턴 상태라 다음 테스트(다른 spec 파일 포함)로
  // 새어 나가지 않도록 정리한다.
  await clearAllPatterns(window)
})
