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

// RT-48(U-8) — 키워드 필드(줄바꿈 구분, `-` 접두는 제외) 파싱. 쉼표는
// 구분자가 아니다(작성자/해시와 다름 — parseMultiValueFilter 재사용 불가).
// 각 줄 앞뒤 공백 제거, 빈 줄 무시, `-`만 있는 줄도 무시.
export interface ParsedKeywords {
  include: string[]
  exclude: string[]
}

export function parseKeywordText(text: string): ParsedKeywords {
  const include: string[] = []
  const exclude: string[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    if (line.startsWith('-')) {
      const rest = line.slice(1).trim()
      if (rest.length === 0) continue
      exclude.push(rest)
    } else {
      include.push(line)
    }
  }
  return { include, exclude }
}

// commitQuerySlice가 들고 있는 조회 조건 중 listCommits 파라미터 조립에
// 필요한 것만 뽑은 최소 형태 — commitsSlice가 그대로 AppState를 넘길 수
// 있다(TS structural typing, RT-01의 SelectionSnapshot과 같은 패턴).
export interface CommitQueryFilters {
  startDate: string
  endDate: string
  maxCount: number
  keywordText: string
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
  const { include, exclude } = parseKeywordText(filters.keywordText)
  return {
    repoPath,
    branch,
    startDate: filters.startDate,
    endDate: filters.endDate,
    maxCount: filters.maxCount,
    skip,
    pageSize,
    searchMode: filters.searchMode,
    includeKeywords: include.length > 0 ? include : undefined,
    excludeKeywords: exclude.length > 0 ? exclude : undefined,
    authors: authors.length > 0 ? authors : undefined,
    excludeMerges: filters.excludeMerges,
    hashFilter: hashFilter.length > 0 ? hashFilter : undefined
  }
}
