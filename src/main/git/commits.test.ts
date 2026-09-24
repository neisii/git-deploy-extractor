import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listCommits, getDefaultDateRange, partitionHashFilter } from './commits'
import { GitArgumentError } from './exec'
import {
  cleanupRepo,
  commitAll,
  commitAt,
  initRepo,
  writeFixtureFile
} from '../testSupport/gitFixture'

// scripts/verify-phase1.ts (c)(d)(e)의 이식 — 기본 조회 기간 경계값,
// 검색어 필터링, 페이지네이션.

describe('listCommits — 기본 기간/검색/페이지네이션', () => {
  let dir: string
  const hashes: Record<string, string> = {}

  beforeAll(() => {
    dir = initRepo('gde-commits-')
    const today = new Date()
    const { startDate } = getDefaultDateRange(today)
    const rangeStart = new Date(`${startDate}T00:00:00`)

    const outsideRange = new Date(rangeStart)
    outsideRange.setDate(outsideRange.getDate() - 1)
    outsideRange.setHours(12, 0, 0, 0)

    const boundaryStart = new Date(rangeStart)
    boundaryStart.setSeconds(boundaryStart.getSeconds() + 1) // T00:00:01, 범위 안

    const boundaryEnd = new Date(today)
    boundaryEnd.setHours(23, 59, 0, 0) // endDate와 같은 날, T23:59:59 근처

    hashes.outside = commitAt(dir, outsideRange, 'outside range commit')
    hashes.boundaryStart = commitAt(dir, boundaryStart, 'boundary start commit needle')
    hashes.boundaryEnd = commitAt(dir, boundaryEnd, 'boundary end commit needle')
  })

  afterAll(() => cleanupRepo(dir))

  it('기본 기간(오늘-7일~오늘)에 경계값 포함, 범위 밖 커밋은 제외', async () => {
    const { startDate, endDate } = getDefaultDateRange()
    const result = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate,
      endDate,
      maxCount: 100,
      skip: 0,
      pageSize: 100
    })
    const hashesInRange = result.commits.map((c) => c.hash)
    expect(hashesInRange).toContain(hashes.boundaryStart)
    expect(hashesInRange).toContain(hashes.boundaryEnd)
    expect(hashesInRange).not.toContain(hashes.outside)
    expect(result.hasMore).toBe(false)
  })

  it('검색어는 대소문자 무관 부분 일치', async () => {
    const { startDate, endDate } = getDefaultDateRange()
    const result = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate,
      endDate,
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      includeKeywords: ['NEEDLE']
    })
    expect(result.commits).toHaveLength(2)
    expect(result.commits.every((c) => c.message.includes('needle'))).toBe(true)
  })

  it('스크롤(다음 페이지)은 중복 없이 나뉘어 온다', async () => {
    const { startDate, endDate } = getDefaultDateRange()
    const pageSize = 1
    const maxCount = 2 // boundaryStart, boundaryEnd 2개만(outside는 range 밖)
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
      collected.push(...pageResult.commits.map((c) => c.hash))
      hasMore = pageResult.hasMore
      skip += pageSize
      expect(page).toBeLessThanOrEqual(10) // 무한 루프 방지
    }
    expect(collected).toHaveLength(maxCount)
    expect(new Set(collected).size).toBe(maxCount)
  })
})

// RT-10(R1/M-5) — 해시 필터 옵션 주입 방지.

describe('partitionHashFilter', () => {
  it('16진수(4~64자)만 valid로 분류한다', () => {
    expect(partitionHashFilter(['a1b2c3d', 'ABCDEF12'])).toEqual({
      valid: ['a1b2c3d', 'ABCDEF12'],
      invalid: []
    })
  })

  it('16진수가 아니거나 너무 짧은 토큰은 invalid로 분류한다', () => {
    expect(partitionHashFilter(['abc', '--output=/tmp/pwned', 'zzzzzzz'])).toEqual({
      valid: [],
      invalid: ['abc', '--output=/tmp/pwned', 'zzzzzzz']
    })
  })
})

describe('listCommits — 해시 필터 옵션 주입 방지', () => {
  let dir: string

  beforeAll(() => {
    dir = initRepo('gde-hash-injection-')
    writeFixtureFile(dir, 'a.txt', 'v1')
    commitAll(dir, 'init')
  })

  afterAll(() => cleanupRepo(dir))

  it('`--output=<path>`를 해시로 넣어도 그 경로에 파일이 생기지 않는다', async () => {
    const maliciousPath = join(tmpdir(), `gde-r1-poc-${Date.now()}.txt`)
    const result = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate: '2020-01-01',
      endDate: '2030-01-01',
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      hashFilter: [`--output=${maliciousPath}`]
    })
    expect(existsSync(maliciousPath)).toBe(false)
    expect(result.commits).toHaveLength(0)
    expect(result.invalidHashes).toEqual([`--output=${maliciousPath}`])
  })

  it('유효한 해시와 잘못된 토큰이 섞이면 유효한 것만 조회되고 나머지는 invalidHashes로 보고된다', async () => {
    const head = (
      await listCommits({
        repoPath: dir,
        branch: 'main',
        startDate: '2020-01-01',
        endDate: '2030-01-01',
        maxCount: 100,
        skip: 0,
        pageSize: 100
      })
    ).commits[0].hash

    const result = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate: '2020-01-01',
      endDate: '2030-01-01',
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      hashFilter: [head, '--not-a-hash']
    })
    expect(result.commits.map((c) => c.hash)).toEqual([head])
    expect(result.invalidHashes).toEqual(['--not-a-hash'])
  })
})

// RT-48(U-8, M-4) — 키워드(포함/제외) 필터. `-P`(PCRE) + `\Q…\E`로
// `--grep`의 기존 BRE 결함(`[skip ci]`가 문자 클래스로 오인되던 것)을
// 해소하고, 리터럴 취급·대소문자 무시·OR/AND 결합을 실제 git으로 검증한다.
describe('listCommits — 키워드(포함/제외)', () => {
  let dir: string
  const hashes: Record<string, string> = {}

  beforeAll(() => {
    dir = initRepo('gde-keyword-')
    hashes.skipCi = commitAt(dir, new Date('2026-01-01T00:00:00Z'), '[skip ci] release notes')
    hashes.normal = commitAt(dir, new Date('2026-01-02T00:00:00Z'), 'normal commit c i s k p')
    hashes.fixBug = commitAt(dir, new Date('2026-01-03T00:00:00Z'), 'fix: payment bug')
    hashes.wipFix = commitAt(dir, new Date('2026-01-04T00:00:00Z'), 'WIP fix: guarantee flow')
    hashes.dotLiteral = commitAt(dir, new Date('2026-01-05T00:00:00Z'), 'a.b handler added')
  })

  afterAll(() => cleanupRepo(dir))

  async function search(includeKeywords?: string[], excludeKeywords?: string[]): Promise<string[]> {
    const result = await listCommits({
      repoPath: dir,
      branch: 'main',
      startDate: '2020-01-01',
      endDate: '2030-01-01',
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      includeKeywords,
      excludeKeywords
    })
    return result.commits.map((c) => c.hash)
  }

  it('`[skip ci]`는 대괄호를 문자 클래스로 오인하지 않고 그 문구가 있는 커밋만 찾는다(BRE 결함 해소)', async () => {
    const found = await search(['[skip ci]'])
    expect(found).toEqual([hashes.skipCi])
  })

  it('대소문자 무시', async () => {
    const found = await search(['WIP'])
    expect(found).toEqual([hashes.wipFix])
    const found2 = await search(['wip'])
    expect(found2).toEqual([hashes.wipFix])
  })

  it('`.`과 `*`는 정규식/글롭이 아니라 글자 그대로(`a.b`가 다른 문구에 일치하지 않음)', async () => {
    const found = await search(['a.b'])
    expect(found).toEqual([hashes.dotLiteral])
    expect(await search(['axb'])).toEqual([])
  })

  it('포함 키워드 여러 개는 OR', async () => {
    const found = await search(['payment', 'guarantee'])
    expect(new Set(found)).toEqual(new Set([hashes.fixBug, hashes.wipFix]))
  })

  it('제외 키워드만 입력하면 그 조건에 해당하는 커밋만 빠진다', async () => {
    const found = await search(undefined, ['fix'])
    expect(found).not.toContain(hashes.fixBug)
    expect(found).not.toContain(hashes.wipFix)
    expect(found).toContain(hashes.skipCi)
    expect(found).toContain(hashes.normal)
  })

  it('포함+제외는 AND(포함되지만 제외에도 걸리면 빠짐)', async () => {
    const found = await search(['fix'], ['wip'])
    expect(found).toEqual([hashes.fixBug])
  })
})

// RT-48(M-4) — 제외 키워드가 있으면 클라이언트에서 걸러낸다(위 commits.ts
// 주석 참고). git의 --skip/-n을 그대로 쓰지 않고 [skip, skip+limit)을
// 직접 슬라이스하므로, 여러 페이지를 이어 불러와도 중복·누락이 없어야
// 한다 — 재설계 전 naive 구현(git --skip=걸러진 개수)이 실제로 중복을
// 냈던 버그의 회귀 방지 테스트.
describe('listCommits — 제외 키워드 페이지네이션(중복/누락 방지)', () => {
  let dir: string
  const surviving: string[] = []

  beforeAll(() => {
    dir = initRepo('gde-keyword-exclude-pagination-')
    // 0,3,6,9...는 제외 키워드('drop')가 있어 걸러진다 — 매 3개 중 1개.
    for (let i = 0; i < 12; i++) {
      const message = i % 3 === 0 ? `drop commit ${i}` : `keep commit ${i}`
      const hash = commitAt(dir, new Date(Date.UTC(2026, 0, 1 + i)), message)
      if (i % 3 !== 0) surviving.push(hash)
    }
  })

  afterAll(() => cleanupRepo(dir))

  it('pageSize보다 작은 페이지를 이어 불러와도 중복·누락 없이 전부 모인다', async () => {
    const pageSize = 3
    const maxCount = 100
    let skip = 0
    let hasMore = true
    const collected: string[] = []
    let iterations = 0
    while (hasMore) {
      const result = await listCommits({
        repoPath: dir,
        branch: 'main',
        startDate: '2020-01-01',
        endDate: '2030-01-01',
        maxCount,
        skip,
        pageSize,
        excludeKeywords: ['drop']
      })
      collected.push(...result.commits.map((c) => c.hash))
      skip += result.commits.length
      hasMore = result.hasMore
      iterations += 1
      expect(iterations).toBeLessThanOrEqual(20) // 무한 루프 방지
      if (result.commits.length === 0 && hasMore) break // 안전장치
    }
    // 최신순(date desc)이므로 surviving도 같은 순서로 뒤집어 비교한다.
    expect(collected).toEqual([...surviving].reverse())
    expect(new Set(collected).size).toBe(surviving.length)
  })
})

// RT-24 — hashFilter와 별개로, branch 자체도 `git log <branch> ...`의
// 첫 positional 인자라 같은 유형의 옵션 인젝션에 노출돼 있었다(R1과 같은
// 유형, hashFilter처럼 형식 검증이 없었음).
describe('listCommits — branch 옵션 주입 방지', () => {
  let dir: string

  beforeAll(() => {
    dir = initRepo('gde-branch-injection-')
    writeFixtureFile(dir, 'a.txt', 'v1')
    commitAll(dir, 'init')
  })

  afterAll(() => cleanupRepo(dir))

  it("branch가 '--output=<path>'면 git을 호출하지 않고 즉시 거부한다", async () => {
    const maliciousPath = join(tmpdir(), `gde-r1-branch-poc-${Date.now()}.txt`)
    await expect(
      listCommits({
        repoPath: dir,
        branch: `--output=${maliciousPath}`,
        startDate: '2020-01-01',
        endDate: '2030-01-01',
        maxCount: 100,
        skip: 0,
        pageSize: 100
      })
    ).rejects.toThrow(GitArgumentError)
    expect(existsSync(maliciousPath)).toBe(false)
  })
})
