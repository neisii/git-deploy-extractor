import type { StateCreator } from 'zustand'
import type { CommitSearchMode } from '../../../../shared/types'
import { getDefaultDateRange } from '../../../../shared/dateRange'
import type { AppState } from '../appStore'

const SEARCH_DEBOUNCE_MS = 300

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const defaultRange = getDefaultDateRange()

// RT-31(S1) — appStore.ts에서 커밋 조회 조건(기간/검색어/작성자/해시 필터
// 등) 상태·액션만 분리한 슬라이스. 조건이 바뀔 때마다 commitsSlice의
// loadCommitsFirstPage를 get()으로 호출해 새로 조회한다 — 실제 커밋
// 목록·페이지네이션 자체는 commitsSlice가 소유한다.
export interface CommitQuerySlice {
  startDate: string
  endDate: string
  maxCount: number
  searchTerm: string
  searchMode: CommitSearchMode // RISK_ISSUES.md §7.3 — 메시지/파일명 토글, 기본 'message'
  authorFilter: string // REQ-022 — 원본 텍스트(줄바꿈/쉼표 구분, 2026-09-14부터 여러 작성자 지원). searchTerm과 독립적으로 AND 결합
  excludeMerges: boolean // REQ-022 — Merge 커밋 제외, 기본 true(제외) — 2026-09-14 사용자 요청으로 기본값 변경
  hashFilterText: string // REQ-023 — 원본 텍스트(줄바꿈/쉼표 구분). 값이 있으면 다른 모든 조회 조건을 무시
  // RT-10(M-5) — hashFilterText 중 16진수 형식이 아니라서 git에 넘기지
  // 않고 걸러낸 토큰들(git.listCommits 응답의 invalidHashes를 그대로
  // 보관). 조회할 때마다 새로 채워진다.
  invalidHashFilter: string[]

  setSearchTerm: (term: string) => void
  setSearchMode: (mode: CommitSearchMode) => Promise<void>
  setAuthorFilter: (author: string) => void
  setExcludeMerges: (excludeMerges: boolean) => Promise<void>
  setHashFilterText: (text: string) => void
  triggerSearch: () => Promise<void>
  setDateRange: (startDate: string, endDate: string) => void
  setMaxCount: (maxCount: number) => Promise<void>
}

export const createCommitQuerySlice: StateCreator<AppState, [], [], CommitQuerySlice> = (
  set,
  get
) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  maxCount: 100,
  searchTerm: '',
  searchMode: 'message',
  authorFilter: '',
  excludeMerges: true,
  hashFilterText: '',
  invalidHashFilter: [],

  // §6.1: 검색어/기간/최대개수/검색모드 변경은 전부 선택을 유지한다
  // (keepSelection=true) — "검색 조건을 바꿔가며 여러 번 찾아 누적
  // 체크"하는 워크플로우가 이 기능의 핵심 목적이다.
  setSearchTerm: (term) => {
    set({ searchTerm: term })
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void get().loadCommitsFirstPage(true)
    }, SEARCH_DEBOUNCE_MS)
  },

  setSearchMode: async (mode) => {
    set({ searchMode: mode })
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    await get().loadCommitsFirstPage(true)
  },

  // REQ-022 — searchTerm과 동일한 디바운스 패턴(타이핑마다 재조회하지 않음).
  setAuthorFilter: (author) => {
    set({ authorFilter: author })
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void get().loadCommitsFirstPage(true)
    }, SEARCH_DEBOUNCE_MS)
  },

  // REQ-022 — 체크박스 토글은 즉시 반영(디바운스 불필요, searchMode와 동일).
  setExcludeMerges: async (excludeMerges) => {
    set({ excludeMerges })
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    await get().loadCommitsFirstPage(true)
  },

  // REQ-023 — searchTerm/authorFilter와 동일한 디바운스 패턴. 파싱(공백/쉼표
  // 분리)은 loadCommitsFirstPage/loadNextPage 호출 시점에 한다 — 여기선
  // 원본 텍스트만 그대로 들고 있는다.
  setHashFilterText: (text) => {
    set({ hashFilterText: text })
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void get().loadCommitsFirstPage(true)
    }, SEARCH_DEBOUNCE_MS)
  },

  triggerSearch: async () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    await get().loadCommitsFirstPage(true)
  },

  // RT-16(U6) — 예전엔 디바운스 없이 값이 바뀔 때마다(네이티브 date
  // input이 년/월/일 하위 필드마다 change를 낼 수 있어 타이핑 중간값
  // 포함) 즉시 재조회했다. searchTerm/authorFilter/hashFilterText와
  // 같은 300ms 디바운스로 통일한다.
  setDateRange: (startDate, endDate) => {
    set({ startDate, endDate })
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void get().loadCommitsFirstPage(true)
    }, SEARCH_DEBOUNCE_MS)
  },

  setMaxCount: async (maxCount) => {
    set({ maxCount })
    await get().loadCommitsFirstPage(true)
  }
})
