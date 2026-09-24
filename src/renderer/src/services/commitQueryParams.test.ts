import { describe, expect, it } from 'vitest'
import { buildListCommitsParams, parseKeywordText } from './commitQueryParams'
import type { CommitQueryFilters } from './commitQueryParams'

// RT-32(S2) — commitsSlice의 loadCommitsFirstPage/loadNextPage가 복붙하던
// listCommits 파라미터 조립을 여기로 옮겼다. 둘의 유일한 차이(skip)와
// 빈 문자열/빈 배열 → undefined 변환 규칙이 그대로 보존되는지 확인한다.

const baseFilters: CommitQueryFilters = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  maxCount: 100,
  keywordText: '',
  authorFilter: '',
  excludeMerges: true,
  hashFilterText: ''
}

describe('buildListCommitsParams', () => {
  it('빈 키워드/작성자/해시는 undefined로 변환한다', () => {
    const params = buildListCommitsParams('/repo', 'main', baseFilters, 0, 100)
    expect(params).toEqual({
      repoPath: '/repo',
      branch: 'main',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      maxCount: 100,
      skip: 0,
      pageSize: 100,
      includeKeywords: undefined,
      excludeKeywords: undefined,
      authors: undefined,
      excludeMerges: true,
      hashFilter: undefined
    })
  })

  it('키워드는 포함/제외로 파싱해서, 작성자/해시는 그대로 파싱해서 배열로 채운다', () => {
    const params = buildListCommitsParams(
      '/repo',
      'main',
      {
        ...baseFilters,
        keywordText: 'fix bug\n-wip',
        authorFilter: 'alice, bob',
        hashFilterText: 'a1b2c3d\ne5f6a7b'
      },
      0,
      100
    )
    expect(params.includeKeywords).toEqual(['fix bug'])
    expect(params.excludeKeywords).toEqual(['wip'])
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

// RT-48(U-8) 수용 기준 — 줄바꿈 구분·빈 줄 무시·앞뒤 공백 제거·`-` 접두
// 제외·`-`만 있는 줄 무시·쉼표/대괄호/`.`/`*`가 리터럴로 취급됨(구분자로
// 안 쓰임 — 그 자체를 하나의 키워드로 그대로 보존하는지로 검증).
describe('parseKeywordText', () => {
  it('빈 입력은 둘 다 빈 배열', () => {
    expect(parseKeywordText('')).toEqual({ include: [], exclude: [] })
  })

  it('줄바꿈으로 구분, 빈 줄 무시, 앞뒤 공백 제거', () => {
    expect(parseKeywordText('fix\n\n  bug  \n')).toEqual({
      include: ['fix', 'bug'],
      exclude: []
    })
  })

  it('`-` 접두는 제외 키워드, `-` 뒤 공백 제거', () => {
    expect(parseKeywordText('fix\n-  wip')).toEqual({
      include: ['fix'],
      exclude: ['wip']
    })
  })

  it('`-`만 있는 줄은 무시', () => {
    expect(parseKeywordText('fix\n-\n-  ')).toEqual({ include: ['fix'], exclude: [] })
  })

  it('쉼표는 구분자가 아니라 키워드 안의 글자 그대로', () => {
    expect(parseKeywordText('guarantee, payment')).toEqual({
      include: ['guarantee, payment'],
      exclude: []
    })
  })

  it('대괄호·`.`·`*`도 리터럴로 보존된다(정규식/와일드카드로 해석하지 않음)', () => {
    expect(parseKeywordText('[skip ci]\na.b\n*.java')).toEqual({
      include: ['[skip ci]', 'a.b', '*.java'],
      exclude: []
    })
  })
})

// parseMultiValueFilter 자체(작성자/해시 문자열 파싱 규칙)는 appStore.test.ts
// 의 "parseMultiValueFilter — REQ-022/REQ-023"에서 이미 6개 케이스로
// 검증한다(정의만 이 파일로 옮겨왔을 뿐 재검증할 필요 없음).
