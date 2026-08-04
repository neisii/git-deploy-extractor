import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateRepository, listBranches, pickDefaultBranch } from '../src/main/git/repository'
import { listCommits, getDefaultDateRange } from '../src/main/git/commits'

function sh(cwd: string, args: string[], env?: NodeJS.ProcessEnv): void {
  execFileSync('git', args, { cwd, env: { ...process.env, ...env } })
}

function isoAt(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

function setupRepo(): { dir: string; today: Date; commits: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), 'gde-phase1-'))
  sh(dir, ['init', '-q'])
  sh(dir, ['config', 'user.email', 'test@example.com'])
  sh(dir, ['config', 'user.name', 'Tester'])
  sh(dir, ['checkout', '-q', '-b', 'main'])

  const today = new Date()
  const { startDate } = getDefaultDateRange(today)
  const rangeStart = new Date(`${startDate}T00:00:00`)

  const outsideRange = new Date(rangeStart)
  outsideRange.setDate(outsideRange.getDate() - 1)
  outsideRange.setHours(12, 0, 0, 0)

  const boundaryStart = new Date(rangeStart)
  boundaryStart.setSeconds(boundaryStart.getSeconds() + 1) // T00:00:01, inside the range

  const boundaryEnd = new Date(today)
  boundaryEnd.setHours(23, 59, 0, 0) // same day as endDate, near T23:59:59

  const commitHashes: Record<string, string> = {}

  const makeCommit = (key: string, date: Date, message: string): void => {
    const iso = isoAt(date)
    sh(dir, ['commit', '-q', '--allow-empty', '-m', message], {
      GIT_AUTHOR_DATE: iso,
      GIT_COMMITTER_DATE: iso
    })
    commitHashes[key] = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim()
  }

  makeCommit('outside', outsideRange, 'outside range commit')
  makeCommit('boundaryStart', boundaryStart, 'boundary start commit needle')
  makeCommit('boundaryEnd', boundaryEnd, 'boundary end commit needle')

  return { dir, today, commits: commitHashes }
}

async function main(): Promise<void> {
  console.log('=== Phase 1 검증: Repository 접근 계층 ===\n')

  const { dir, commits } = setupRepo()

  try {
    // (a) 유효성 검사
    console.log('-- (a) Repository 유효성 검사 --')
    const validResult = await validateRepository(dir)
    console.log('valid repo:', validResult)
    assert.equal(validResult.valid, true)

    const invalidResult = await validateRepository(tmpdir())
    console.log('invalid repo (tmpdir):', invalidResult)
    assert.equal(invalidResult.valid, false)
    assert.ok(invalidResult.error)

    // (b) 기본 브랜치 자동 선택
    console.log('\n-- (b) 기본 브랜치 자동 선택 --')
    const branches = await listBranches(dir)
    console.log('branches:', branches)
    assert.deepEqual(branches, ['main'])
    const defaultBranch = pickDefaultBranch(branches)
    console.log('default branch:', defaultBranch)
    assert.equal(defaultBranch, 'main')

    // master-only repo
    const masterDir = mkdtempSync(join(tmpdir(), 'gde-phase1-master-'))
    try {
      sh(masterDir, ['init', '-q'])
      sh(masterDir, ['config', 'user.email', 'test@example.com'])
      sh(masterDir, ['config', 'user.name', 'Tester'])
      sh(masterDir, ['checkout', '-q', '-b', 'master'])
      sh(masterDir, ['commit', '-q', '--allow-empty', '-m', 'init'])
      const masterBranches = await listBranches(masterDir)
      const masterDefault = pickDefaultBranch(masterBranches)
      console.log('master-only repo default branch:', masterDefault)
      assert.equal(masterDefault, 'master')

      const neitherDefault = pickDefaultBranch(['feature/x', 'release/1.0'])
      console.log('neither main/master present -> default:', neitherDefault)
      assert.equal(neitherDefault, null)
    } finally {
      rmSync(masterDir, { recursive: true, force: true })
    }

    // 원격 추적 브랜치(refs/remotes/)는 선택지에서 제외되어야 함
    console.log('\n-- (b-1) 원격 추적 브랜치 제외 --')
    const headHash = execFileSync('git', ['-C', dir, 'rev-parse', 'main']).toString().trim()
    sh(dir, ['update-ref', 'refs/remotes/origin/main', headHash])
    sh(dir, ['update-ref', 'refs/remotes/origin/develop', headHash])
    const branchesWithRemote = await listBranches(dir)
    console.log('원격 추적 ref를 만든 뒤 조회한 branches:', branchesWithRemote)
    assert.deepEqual(branchesWithRemote, ['main'], 'origin/* 는 목록에 없어야 함')

    // (c) 기본 기간(오늘-7일~오늘)/최대 100개 제한
    console.log('\n-- (c) 기본 기간/최대 100개 제한 --')
    const { startDate, endDate } = getDefaultDateRange()
    console.log('default range:', startDate, '~', endDate)
    const defaultRangeResult = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate,
      endDate,
      maxCount: 100,
      skip: 0,
      pageSize: 100
    })
    console.log(
      'commits in default range:',
      defaultRangeResult.commits.map((c) => ({ hash: c.hash.slice(0, 7), message: c.message }))
    )
    const hashesInRange = defaultRangeResult.commits.map((c) => c.hash)
    assert.ok(
      hashesInRange.includes(commits.boundaryStart),
      'boundary start commit (T00:00:00 경계) 포함되어야 함'
    )
    assert.ok(
      hashesInRange.includes(commits.boundaryEnd),
      'boundary end commit (T23:59:59 경계) 포함되어야 함'
    )
    assert.ok(!hashesInRange.includes(commits.outside), 'range 밖 commit은 제외되어야 함')
    assert.equal(defaultRangeResult.hasMore, false)

    // (d) 검색어 필터링
    console.log('\n-- (d) 검색어 필터링 --')
    const searchResult = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate,
      endDate,
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      searchTerm: 'NEEDLE' // 대소문자 무관 검색 확인
    })
    console.log(
      'search "NEEDLE" results:',
      searchResult.commits.map((c) => c.message)
    )
    assert.equal(searchResult.commits.length, 2)
    assert.ok(searchResult.commits.every((c) => c.message.includes('needle')))

    // (e) 스크롤(다음 페이지) 시뮬레이션 - pageSize를 작게 잡아 여러 페이지로 나눠 받는다
    console.log('\n-- (e) 스크롤(다음 페이지) 시뮬레이션 --')
    const pageSize = 1
    const maxCount = 2 // boundaryStart, boundaryEnd 2개만 (outside는 range 밖)
    let skip = 0
    let page = 0
    const collected: string[] = []
    let hasMore = true
    while (hasMore) {
      const pageResult = await listCommits({
        repoPath: dir,
        branch: 'main',
        startDate,
        endDate,
        maxCount,
        skip,
        pageSize
      })
      page += 1
      console.log(
        `page ${page} (skip=${skip}):`,
        pageResult.commits.map((c) => c.hash.slice(0, 7)),
        'hasMore=',
        pageResult.hasMore
      )
      collected.push(...pageResult.commits.map((c) => c.hash))
      hasMore = pageResult.hasMore
      skip += pageSize
      assert.ok(page <= 10, '무한 루프 방지')
    }
    assert.equal(collected.length, maxCount)
    assert.equal(new Set(collected).size, maxCount, '중복 없이 페이지가 나뉘어야 함')

    console.log('\n=== 전체 통과 ===')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error('\n=== 검증 실패 ===')
  console.error(error)
  process.exit(1)
})
