import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

function sh(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString().trim()
}

function writeFile(dir: string, relPath: string, content: string): void {
  const fullPath = join(dir, relPath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

export interface Fixture {
  dir: string
  cleanup: () => void
}

// RT-02(P0 안전망) — E2E 시나리오 ①·③이 공유하는 최소 저장소.
//  - 커밋1 "add FileA": FileA만 만든다 — 커밋2만 선택해 Preview하면 이
//    파일은 deployFiles에 잡히지 않고 HEAD 트리에만 남아, 시나리오
//    ③(파일 추가 팝업)의 수동 추가 후보로 쓸 수 있다.
//  - 커밋2 "add FileB": FileB를 추가한다 — 이 커밋만 선택하는 게 두
//    시나리오의 공통 전제다.
// 날짜는 항상 "오늘" 커밋되므로 BranchSearchBar 기본 조회 기간(오늘-7일~
// 오늘)에 그대로 들어온다(별도 --date 조작 불필요).
export function createFixtureRepo(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'gde-e2e-'))
  sh(dir, ['init', '-q'])
  sh(dir, ['config', 'user.email', 'e2e@example.com'])
  sh(dir, ['config', 'user.name', 'E2E'])
  sh(dir, ['checkout', '-q', '-b', 'main'])

  writeFile(dir, 'src/FileA.txt', 'A v1\n')
  sh(dir, ['add', '-A'])
  sh(dir, ['commit', '-q', '-m', 'add FileA'])

  writeFile(dir, 'src/FileB.txt', 'B v1\n')
  sh(dir, ['add', '-A'])
  sh(dir, ['commit', '-q', '-m', 'add FileB'])

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  }
}
