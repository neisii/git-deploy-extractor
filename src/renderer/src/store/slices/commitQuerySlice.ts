import type { StateCreator } from 'zustand'
import { getDefaultDateRange } from '../../../../shared/dateRange'
import type { AppState } from '../appStore'

const defaultRange = getDefaultDateRange()

// RT-31(S1) — appStore.ts에서 커밋 조회 조건(기간/검색어/작성자/해시 필터
// 등) 상태·액션만 분리한 슬라이스. 실제 커밋 목록·페이지네이션 자체는
// commitsSlice가 소유한다.
//
// RT-32(S3) — 예전엔 setSearchTerm/setAuthorFilter/setHashFilterText/
// setDateRange가 여기서 직접 디바운스(모듈 전역 타이머 하나를 넷이
// 공유)한 뒤 loadCommitsFirstPage를 호출했다. 디바운스는 "언제 조회를
// 트리거할지"를 결정하는 UI 타이밍 문제라 컴포넌트 쪽 관심사로 보고
// BranchSearchBar.tsx의 useDebouncedAction 훅으로 옮겼다 — 이 네 setter는
// 이제 상태만 즉시 반영하는 순수 setter이고, 실제 조회는 컴포넌트가
// (디바운스했든 즉시든) triggerSearch를 호출해서 일으킨다. 나머지
// (setSearchMode/setExcludeMerges/setMaxCount)는 원래도 디바운스 없이
// 즉시 조회했으므로 그대로 둔다.
export interface CommitQuerySlice {
  startDate: string
  endDate: string
  maxCount: number
  // RT-48(U-8) — 예전 searchTerm(단일행) 대체. 원본 텍스트(줄바꿈 구분,
  // `-` 접두는 제외) — 파싱은 조회 시점에 services/commitQueryParams.ts의
  // parseKeywordText가 한다(쉼표는 구분자가 아니라는 점이 작성자/해시와
  // 다르다).
  keywordText: string
  authorFilter: string // REQ-022 — 원본 텍스트(줄바꿈/쉼표 구분, 2026-09-14부터 여러 작성자 지원). keywordText와 독립적으로 AND 결합
  excludeMerges: boolean // REQ-022 — Merge 커밋 제외, 기본 true(제외) — 2026-09-14 사용자 요청으로 기본값 변경
  hashFilterText: string // REQ-023 — 원본 텍스트(줄바꿈/쉼표 구분). 값이 있으면 다른 모든 조회 조건을 무시
  // RT-10(M-5) — hashFilterText 중 16진수 형식이 아니라서 git에 넘기지
  // 않고 걸러낸 토큰들(git.listCommits 응답의 invalidHashes를 그대로
  // 보관). 조회할 때마다 새로 채워진다.
  invalidHashFilter: string[]

  setKeywordText: (text: string) => void
  setAuthorFilter: (author: string) => void
  setExcludeMerges: (excludeMerges: boolean) => Promise<void>
  setHashFilterText: (text: string) => void
  triggerSearch: () => Promise<void>
  setDateRange: (startDate: string, endDate: string) => void
  setMaxCount: (maxCount: number) => Promise<void>
  // RT-55(U-15) — Reload 전용. 조회 조건을 전부 기본값으로 되돌린다(기간은
  // "지금" 기준으로 다시 계산 — 모듈 최상단의 defaultRange는 앱 시작
  // 시점에 한 번만 계산돼 있어 재사용할 수 없다). 조회 자체는 호출자
  // (reloadRepository)가 뒤이어 loadCommitsFirstPage를 불러 트리거한다.
  resetQuery: () => void
}

export const createCommitQuerySlice: StateCreator<AppState, [], [], CommitQuerySlice> = (
  set,
  get
) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  maxCount: 100,
  keywordText: '',
  authorFilter: '',
  excludeMerges: true,
  hashFilterText: '',
  invalidHashFilter: [],

  // §6.1: 검색어/기간/최대개수 변경은 전부 선택을 유지한다
  // (keepSelection=true, triggerSearch가 loadCommitsFirstPage(true)를
  // 부른다) — "검색 조건을 바꿔가며 여러 번 찾아 누적 체크"하는
  // 워크플로우가 이 기능의 핵심 목적이다. 조회 자체는 컴포넌트가
  // (디바운스 또는 즉시) triggerSearch를 호출해서 일으킨다.
  setKeywordText: (text) => set({ keywordText: text }),

  setAuthorFilter: (author) => set({ authorFilter: author }),

  // REQ-022 — 체크박스 토글은 즉시 반영(디바운스 불필요).
  setExcludeMerges: async (excludeMerges) => {
    set({ excludeMerges })
    await get().loadCommitsFirstPage(true)
  },

  // REQ-023 — 파싱(공백/쉼표 분리)은 loadCommitsFirstPage/loadNextPage
  // 호출 시점에 한다(services/commitQueryParams.ts) — 여기선 원본
  // 텍스트만 그대로 들고 있는다.
  setHashFilterText: (text) => set({ hashFilterText: text }),

  triggerSearch: async () => {
    await get().loadCommitsFirstPage(true)
  },

  // RT-16(U6) — 예전엔 디바운스 없이 값이 바뀔 때마다(네이티브 date
  // input이 년/월/일 하위 필드마다 change를 낼 수 있어 타이핑 중간값
  // 포함) 즉시 재조회했다. 지금은 searchTerm/authorFilter/hashFilterText와
  // 마찬가지로 컴포넌트의 useDebouncedAction이 조회 시점을 결정한다.
  setDateRange: (startDate, endDate) => set({ startDate, endDate }),

  setMaxCount: async (maxCount) => {
    set({ maxCount })
    await get().loadCommitsFirstPage(true)
  },

  resetQuery: () => {
    const range = getDefaultDateRange()
    set({
      startDate: range.startDate,
      endDate: range.endDate,
      maxCount: 100,
      keywordText: '',
      authorFilter: '',
      excludeMerges: true,
      hashFilterText: '',
      invalidHashFilter: []
    })
  }
})
