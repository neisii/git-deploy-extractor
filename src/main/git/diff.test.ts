import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getCommitFileChanges, headFileExists } from './diff'
import { GitArgumentError } from './exec'
import { cleanupRepo, commitAll, initRepo, writeFixtureFile } from '../testSupport/gitFixture'

// RT-24 — commitHash는 `analysis:preview` IPC의 commitHashes를 거쳐 이
// 함수까지 그대로 들어온다. commits.ts의 hashFilter(REQ-023)와 달리
// partitionHashFilter 같은 형식 검증을 거치지 않으므로, git/exec.ts의
// assertSafeRevisionArg가 유일한 방어선이다(R1과 같은 유형의 옵션 인젝션).
describe('getCommitFileChanges / headFileExists — 옵션 주입 방지', () => {
  let dir: string
  let head: string

  beforeAll(() => {
    dir = initRepo('gde-diff-injection-')
    writeFixtureFile(dir, 'a.txt', 'v1')
    head = commitAll(dir, 'init')
  })

  afterAll(() => cleanupRepo(dir))

  it("commitHash가 '--output=<path>'면 git을 호출하지 않고 즉시 거부한다", async () => {
    const maliciousPath = join(tmpdir(), `gde-r1-commithash-poc-${Date.now()}.txt`)
    await expect(getCommitFileChanges(dir, `--output=${maliciousPath}`)).rejects.toThrow(
      GitArgumentError
    )
    expect(existsSync(maliciousPath)).toBe(false)
  })

  it("headFileExists의 branch가 '--output=<path>'면 즉시 거부한다", async () => {
    const maliciousPath = join(tmpdir(), `gde-r1-branch-poc-${Date.now()}.txt`)
    await expect(headFileExists(dir, `--output=${maliciousPath}`, 'a.txt')).rejects.toThrow(
      GitArgumentError
    )
    expect(existsSync(maliciousPath)).toBe(false)
  })

  it('정상 입력에서는 기존 동작 그대로다', async () => {
    const changes = await getCommitFileChanges(dir, head)
    expect(changes).toEqual([{ path: 'a.txt', status: 'A' }])
    expect(await headFileExists(dir, 'main', 'a.txt')).toBe(true)
    expect(await headFileExists(dir, 'main', 'missing.txt')).toBe(false)
  })
})
