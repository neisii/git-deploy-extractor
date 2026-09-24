import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createFixtureRepo, type Fixture } from './support/fixtureRepo'
import { launchApp } from './support/launchApp'
import type { ElectronApplication, Page } from '@playwright/test'

// RT-45(U-3·U-5) — "포함된 파일"에서 상태 Filter·좌측 검색(REQ-025)을
// 삭제하고, added를 녹색+"+"마커로 구분하고(M-2), "+ 파일 추가"를 제목
// 줄 우측으로 옮겼는지 검증한다. B안(2026-09-24, §7 M-46) — REQ-025
// 검색이 패턴과 완전히 분리된 순수 화면 필터로 다시 들어왔다(옛
// "화면만" 패턴 옵션은 폐기). createFixtureRepo()의 두 커밋(add FileA/
// add FileB)에 FileA를 수정하는 커밋을 하나 더 얹어 added/modified 색
// 대비를 재현한다.

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
  // M-51(2026-09-24) — 버튼 이름이 "보기"에서 "보기+추가"로 바뀌었고,
  // 팝업이 이제 패턴 추가 진입점이기도 해서 항상 활성 상태다(예전처럼
  // 등록된 패턴이 없으면 비활성화하지 않는다). M-55(2026-09-24) —
  // "보기+추가"에서 "설정"으로 다시 개명.
  await window.locator('.filter-pattern-bar').getByRole('button', { name: '설정' }).click()
  const popup = window.locator('.popup')
  // M-51 — 패턴이 0개가 돼도 더는 자동으로 닫히지 않으므로, 다 지운 뒤
  // 직접 닫는다(닫아야 다음 상호작용에 팝업이 안 가린다).
  for (;;) {
    const removeButton = popup.locator('.chip__remove').first()
    if ((await removeButton.count()) === 0) break
    await removeButton.click()
  }
  await popup.locator('.popup__header button').click()
}

test('좌측 "포함된 파일"에는 상태 Filter UI가 없고, + 파일 추가가 제목과 같은 줄에 있다', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  // M-14 정정(2026-09-23) — Preview 직후 기본값은 전체 미선택이라, 왼쪽
  // "포함된 파일"(미선택 변경 파일)에 FileB가 그대로 남아있다.
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  // hasText로 "포함된 파일"을 찾으면 우측 패널의 PanelState na 문구
  // ("...포함된 파일 중 Java 파일이 없습니다")에도 우연히 매치돼 2개가
  // 잡힌다 — "+ 파일 추가" 버튼(좌측 전용)을 갖고 있는 FilePane으로
  // 정확히 스코핑한다.
  const includedPane = window
    .locator('.file-pane')
    .filter({ has: window.getByRole('button', { name: '+ 파일 추가' }) })
  await expect(includedPane.getByText('Filter:')).toHaveCount(0)
  // B안(2026-09-24, §7 M-46)으로 검색이 다시 생겼으므로, 검색 자체가
  // 아니라 "포함된 파일"을 갖고 있는지만 확인한다.
  await expect(includedPane.getByLabel('포함된 파일 검색')).toBeVisible()

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

  // M-14 정정(2026-09-23) — 둘 다 기본값으로 왼쪽 "포함된 파일"에 남는다.
  const addedText = window
    .locator('.included-row', { hasText: 'FileB.txt' })
    .locator('.deploy-files-row__local')
  const modifiedText = window
    .locator('.included-row', { hasText: 'FileA.txt' })
    .locator('.deploy-files-row__local')
  await expect(addedText).toBeVisible()
  await expect(modifiedText).toBeVisible()

  await expect(addedText).toHaveCSS('color', 'rgb(103, 192, 144)')
  await expect(addedText.locator('.deploy-files-row__status-marker')).toBeVisible()
  await expect(modifiedText).not.toHaveCSS('color', 'rgb(103, 192, 144)')
  await expect(modifiedText.locator('.deploy-files-row__status-marker')).toHaveCount(0)
})

test('검색은 왼쪽 화면만 걸러내고 Extract 대상·선택 개수엔 영향이 없다(B안, §7 M-46)', async () => {
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
  // M-14 정정 — Preview 직후 기본값은 전체 미선택이라 둘 다 왼쪽에 남는다.
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()
  await expect(window.locator('.included-row', { hasText: 'FileA.txt' })).toBeVisible()

  const search = window.getByLabel('포함된 파일 검색')
  await search.fill('FileB')

  // 검색어와 일치하는 FileB만 남고 FileA는 화면에서 숨는다.
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()
  await expect(window.locator('.included-row', { hasText: 'FileA.txt' })).toHaveCount(0)

  // .check() 대신 .click() — 체크 즉시 행이 사라져(Extract로 이동)
  // .check()의 사후 checked 확인이 타임아웃난다(실측 확인, RT-50 후속).
  await window
    .locator('.included-row', { hasText: 'FileB.txt' })
    .locator('input[type="checkbox"]')
    .click()
  await expect(window.locator('.extract-row', { hasText: 'FileB.txt' })).toBeVisible()

  // 검색어를 지우면 FileA가 다시 보인다(Extract로 옮기지 않았으므로 그대로
  // 남아있었을 뿐 — 검색은 Export/Extract 계산과 무관하다는 걸 보여준다).
  await search.fill('')
  await expect(window.locator('.included-row', { hasText: 'FileA.txt' })).toBeVisible()
})

test('검색어에 * 와일드카드를 쓸 수 있고, 일치하는 게 없으면 안내 문구가 뜬다(B안, §7 M-46)', async () => {
  await window.getByRole('button', { name: 'Browse...' }).click()
  await clearAllPatterns(window)
  await expect(window.locator('.commit-row', { hasText: 'add FileB' })).toBeVisible()

  await window
    .locator('.commit-row', { hasText: 'add FileB' })
    .locator('input[type="checkbox"]')
    .check()
  await window.getByRole('button', { name: 'Preview' }).click()
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  const search = window.getByLabel('포함된 파일 검색')
  await search.fill('*.txt')
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toBeVisible()

  await search.fill('*.java')
  await expect(window.locator('.included-row', { hasText: 'FileB.txt' })).toHaveCount(0)
  const includedPane = window
    .locator('.file-pane')
    .filter({ has: window.getByRole('button', { name: '+ 파일 추가' }) })
  await expect(includedPane).toContainText('검색어와 일치하는 파일이 없습니다')
})
