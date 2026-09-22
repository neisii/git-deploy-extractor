import { describe, expect, it } from 'vitest'
import { buildListCommitsParams } from './commitQueryParams'
import type { CommitQueryFilters } from './commitQueryParams'

// RT-32(S2) — commitsSlice의 loadCommitsFirstPage/loadNextPage가 복붙하던
// listCommits 파라미터 조립을 여기로 옮겼다. 둘의 유일한 차이(skip)와
// 빈 문자열/빈 배열 → undefined 변환 규칙이 그대로 보존되는지 확인한다.

const baseFilters: CommitQueryFilters = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  maxCount: 100,
  searchTerm: '',
  searchMode: 'message',
  authorFilter: '',
  excludeMerges: true,
  hashFilterText: ''
}

describe('buildListCommitsParams', () => {
  it('빈 검색어/작성자/해시는 undefined로 변환한다', () => {
    const params = buildListCommitsParams('/repo', 'main', baseFilters, 0, 100)
    expect(params).toEqual({
      repoPath: '/repo',
      branch: 'main',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      searchTerm: undefined,
      searchMode: 'message',
      authors: undefined,
      excludeMerges: true,
      hashFilter: undefined
    })
  })

  it('검색어가 있으면 그대로, 작성자/해시는 파싱해서 배열로 채운다', () => {
    const params = buildListCommitsParams(
      '/repo',
      'main',
      {
        ...baseFilters,
        searchTerm: 'fix bug',
        authorFilter: 'alice, bob',
        hashFilterText: 'a1b2c3d\ne5f6a7b'
      },
      0,
      100
    )
    expect(params.searchTerm).toBe('fix bug')
    expect(params.authors).toEqual(['alice', 'bob'])
    expect(params.hashFilter).toEqual(['a1b2c3d', 'e5f6a7b'])
  })

  it('skip/pageSize는 loadCommitsFirstPage(0)와 loadNextPage(누적 개수)의 유일한 차이다', () => {
    const first = buildListCommitsParams('/repo', 'main', baseFilters, 0, 100)
    const next = buildListCommitsParams('/repo', 'main', baseFilters, 40, 100)
    expect(first.skip).toBe(0)
    expect(next.skip).toBe(40)
    // skip을 뺀 나머지 필드는 전부 동일해야 한다(파라미터 조립 로직 단일화 검증).
    expect({ ...first, skip: 0 }).toEqual({ ...next, skip: 0 })
  })
})

// parseMultiValueFilter 자체(작성자/해시 문자열 파싱 규칙)는 appStore.test.ts
// 의 "parseMultiValueFilter — REQ-022/REQ-023"에서 이미 6개 케이스로
// 검증한다(정의만 이 파일로 옮겨왔을 뿐 재검증할 필요 없음).
