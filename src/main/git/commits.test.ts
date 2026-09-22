import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listCommits, getDefaultDateRange } from './commits'
import { cleanupRepo, commitAt, initRepo } from '../testSupport/gitFixture'

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
      searchTerm: 'NEEDLE'
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
