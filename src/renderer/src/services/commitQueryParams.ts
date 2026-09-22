import type { CommitSearchMode, ListCommitsParams } from '../../../shared/types'

// RT-32(S2) — commitsSlice의 loadCommitsFirstPage와 loadNextPage가 각자
// 복붙해서 조립하던 listCommits 파라미터(필터 8개)를 여기 한 곳으로
// 모았다. 둘의 차이는 skip 값 하나뿐이었다(첫 페이지는 0, 다음 페이지는
// 이미 로드된 개수) — 그래서 skip만 별도 인자로 받는다.

// REQ-023(해시 필터)에서 처음 도입, 2026-09-14부터 REQ-022 작성자
// 필터도 재사용한다 — 쉼표/공백/줄바꿈 어느 것으로 구분해 붙여넣어도
// 동일하게 처리한다. 빈 입력이면 빈 배열(호출부에서 undefined로 변환해
// 해당 필터 없는 일반 조회로 취급).
// export: RT-01(vitest 안전망)에서 직접 테스트하기 위함 — 동작 변경 없음.
export function parseMultiValueFilter(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

// commitQuerySlice가 들고 있는 조회 조건 중 listCommits 파라미터 조립에
// 필요한 것만 뽑은 최소 형태 — commitsSlice가 그대로 AppState를 넘길 수
// 있다(TS structural typing, RT-01의 SelectionSnapshot과 같은 패턴).
export interface CommitQueryFilters {
  startDate: string
  endDate: string
  maxCount: number
  searchTerm: string
  searchMode: CommitSearchMode
  authorFilter: string
  excludeMerges: boolean
  hashFilterText: string
}

export function buildListCommitsParams(
  repoPath: string,
  branch: string,
  filters: CommitQueryFilters,
  skip: number,
  pageSize: number
): ListCommitsParams {
  const hashFilter = parseMultiValueFilter(filters.hashFilterText)
  const authors = parseMultiValueFilter(filters.authorFilter)
  return {
    repoPath,
    branch,
    startDate: filters.startDate,
    endDate: filters.endDate,
    maxCount: filters.maxCount,
    skip,
    pageSize,
    searchTerm: filters.searchTerm || undefined,
    searchMode: filters.searchMode,
    authors: authors.length > 0 ? authors : undefined,
    excludeMerges: filters.excludeMerges,
    hashFilter: hashFilter.length > 0 ? hashFilter : undefined
  }
}
