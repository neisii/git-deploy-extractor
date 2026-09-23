import type { StateCreator } from 'zustand'
import type { CommitEntry } from '../../../../shared/types'
import { createRequestGuard } from '../../lib/requestGuard'
import { buildListCommitsParams } from '../../services/commitQueryParams'
import { api } from '../../api'
import type { AppState } from '../appStore'
import { analysisGuard, emptyDependencyState } from './analysisSlice'
import { emptyManualAddState } from './deployFilesSlice'
import { idleExportState } from './exportSlice'

const PAGE_SIZE = 100

interface CommitPagination {
  hasMore: boolean
  loading: boolean
}

// RT-11(R2) — 커밋 조회 요청 순서 가드. loadCommitsFirstPage가 새 조회를
// 시작할 때마다 start()로 새 세대를 발급한다. loadNextPage는 시작 시점의
// 세대를 current()로 캡처해 두고, 응답이 왔을 때 그 세대가 여전히
// 최신인지 비교한다 — analysisSlice의 selectionMatches/analyzedSelection과
// 같은 개념이다. loadCommitsFirstPage 자기 자신도 이 세대를 비교해,
// 검색 조건을 빠르게 여러 번 바꿔 여러 첫 페이지 조회가 겹쳐도 가장
// 나중에 시작한 것만 결과를 반영한다.
const commitQueryGuard = createRequestGuard()

// RT-31(S1) — appStore.ts에서 커밋 목록·선택·페이지네이션만 분리한
// 슬라이스. loadCommitsFirstPage는 repositorySlice(저장소/Branch 전환)와
// commitQuerySlice(검색 조건 변경) 양쪽에서 get()으로 호출되는 진입점이라
// AppState의 공개 액션으로 둔다(예전엔 appStore.ts 안 클로저였다).
export interface CommitsSlice {
  commits: CommitEntry[]
  selectedHashes: Set<string>
  commitPagination: CommitPagination
  commitListError: string | null

  loadCommitsFirstPage: (keepSelection?: boolean) => Promise<void>
  loadNextPage: () => Promise<void>
  toggleCommit: (hash: string) => void
  toggleAllCommits: () => void
  // RT-55(U-15) — Reload 전용. loadCommitsFirstPage(keepSelection=false)도
  // 결과적으로 selectedHashes를 비우지만, Reload는 "재조회가 끝나기 전에
  // 이미 선택이 비었다"를 명확히 하기 위해 이 함수로 먼저 비운다(재조회가
  // 느리거나 실패해도 선택은 지워져 있어야 한다).
  clearSelection: () => void
}

export const createCommitsSlice: StateCreator<AppState, [], [], CommitsSlice> = (set, get) => ({
  commits: [],
  selectedHashes: new Set(),
  commitPagination: { hasMore: false, loading: false },
  commitListError: null,

  // RISK_ISSUES.md §6.1 — 재조회 시 selectedHashes를 지울지 유지할지는
  // 호출자가 결정한다(케이스 A/B: Repository 전환·Branch 전환은 지움 —
  // 다른 저장소/Branch의 hash가 남아있으면 최종 Export가 "현재 선택된
  // Branch의 HEAD" 기준으로 엉뚱하게 해석될 위험이 있다. 그 외 — Reload,
  // 검색어/모드, 조회 기간, 최대 개수 변경 — 는 전부 유지한다. 그래야
  // "검색 조건을 바꿔가며 여러 번 찾아 누적 체크"하는 워크플로우가 성립한다).
  loadCommitsFirstPage: async (keepSelection = false) => {
    const {
      repository,
      selectedBranch,
      startDate,
      endDate,
      maxCount,
      keywordText,
      searchMode,
      authorFilter,
      excludeMerges,
      hashFilterText
    } = get()
    if (repository.status !== 'valid' || !selectedBranch || !repository.path) return
    const requestId = commitQueryGuard.start()
    // RT-17(R4·R5): 첫 페이지를 다시 불러오면 진행 중이던 분석 요청은
    // 전부 무효가 된다(Reload·검색 조건 변경 등 이 함수를 거치는 모든
    // 경로 공통) — analyzing도 여기서 바로 끈다(dependencyAnalyzing은
    // emptyDependencyState에 이미 포함됨).
    analysisGuard.start()

    set({
      commits: [],
      ...(keepSelection ? {} : { selectedHashes: new Set<string>() }),
      commitPagination: { hasMore: false, loading: true },
      commitListError: null,
      invalidHashFilter: [],
      analyzing: false,
      summary: null,
      deployFiles: [],
      deleteList: [],
      warnings: [],
      analyzedSelection: null,
      analysisError: null,
      ...emptyDependencyState,
      ...emptyManualAddState
    })

    try {
      const result = await api.git.listCommits(
        buildListCommitsParams(
          repository.path,
          selectedBranch,
          {
            startDate,
            endDate,
            maxCount,
            keywordText,
            searchMode,
            authorFilter,
            excludeMerges,
            hashFilterText
          },
          0,
          PAGE_SIZE
        )
      )
      // RT-11(R2): 이 조회가 시작된 뒤 더 최신 조회가 시작됐다면(검색
      // 조건을 빠르게 여러 번 바꾼 경우) 이 응답은 버린다 — 늦게 도착한
      // 이전 응답이 최신 결과를 덮어쓰는 걸 막는다.
      if (!commitQueryGuard.isCurrent(requestId)) return
      set({
        commits: result.commits,
        commitPagination: { hasMore: result.hasMore, loading: false },
        invalidHashFilter: result.invalidHashes ?? []
      })
    } catch (error) {
      if (!commitQueryGuard.isCurrent(requestId)) return
      set({
        commitPagination: { hasMore: false, loading: false },
        commitListError: error instanceof Error ? error.message : String(error)
      })
    }
  },

  loadNextPage: async () => {
    const {
      repository,
      selectedBranch,
      startDate,
      endDate,
      maxCount,
      keywordText,
      searchMode,
      authorFilter,
      excludeMerges,
      hashFilterText,
      commits,
      commitPagination
    } = get()
    if (!repository.path || !selectedBranch) return
    if (!commitPagination.hasMore || commitPagination.loading) return
    // RT-11(R2): 이 다음 페이지 요청이 속한 "세대"를 캡처해 둔다 —
    // 응답이 오기 전에 loadCommitsFirstPage가 새 조회를 시작하면(세대가
    // 증가하면) 이 요청은 무효가 된다. 호출 시점의 commits 스냅샷에
    // 이어붙이는 대신 응답 처리 시점에 get().commits를 다시 읽어 붙인다
    // (세대가 안 바뀌었다는 보장과 별개로, 최신 상태를 기준으로 한다).
    const requestId = commitQueryGuard.current()

    set({ commitPagination: { ...commitPagination, loading: true } })
    try {
      const result = await api.git.listCommits(
        buildListCommitsParams(
          repository.path,
          selectedBranch,
          {
            startDate,
            endDate,
            maxCount,
            keywordText,
            searchMode,
            authorFilter,
            excludeMerges,
            hashFilterText
          },
          commits.length,
          PAGE_SIZE
        )
      )
      // 첫 페이지 재조회(Reload/검색 조건 변경/Branch 전환 등)가 이 요청
      // 도중에 시작됐다면, 이 응답을 초기화된 목록에 이어붙이면 안 된다
      // — 응답을 통째로 버린다(R2: "재조회 후 초기화된 목록이 되살아날
      // 수 있음" 재현 방지).
      if (!commitQueryGuard.isCurrent(requestId)) return
      set({
        commits: [...get().commits, ...result.commits],
        commitPagination: { hasMore: result.hasMore, loading: false }
      })
    } catch (error) {
      if (!commitQueryGuard.isCurrent(requestId)) return
      set({
        commitPagination: { ...commitPagination, loading: false },
        commitListError: error instanceof Error ? error.message : String(error)
      })
    }
  },

  toggleCommit: (hash) => {
    const { selectedHashes } = get()
    const next = new Set(selectedHashes)
    if (next.has(hash)) {
      next.delete(hash)
    } else {
      next.add(hash)
    }
    // RT-17(R4·R5) — 선택이 바뀌면 진행 중이던 분석 요청은 그 자리에서
    // 바로 무효화한다(analysisGuard.start()) 및 Preview 버튼을 즉시
    // 다시 활성화한다(analyzing/dependencyAnalyzing을 여기서 끔 — 응답이
    // 늦게 와도 runAnalysis의 stale 처리는 이 플래그를 건드리지 않는다).
    analysisGuard.start()
    set({
      selectedHashes: next,
      ...idleExportState,
      analyzing: false,
      dependencyAnalyzing: false
    })

    if (next.size === 0) {
      set({
        summary: null,
        deployFiles: [],
        deleteList: [],
        warnings: [],
        analysisError: null,
        analyzedSelection: null,
        ...emptyDependencyState,
        ...emptyManualAddState
      })
    }
    // 선택이 비어있지 않은 채로 바뀌었을 때는 아무 계산도 트리거하지
    // 않는다 — selectIsAnalysisStale()이 자동으로 "재계산 필요"를
    // 감지하고, 사용자가 Preview를 눌러야 실제로 계산된다.
  },

  // DeployFilesPanel의 전체 선택과 같은 방식 — 현재 "로드된" commits
  // 기준으로만 동작한다(아직 스크롤로 안 불러온 다음 페이지는 건드리지
  // 않는다). 전부 선택된 상태면 전체 해제, 그 외(일부/전무)면 전체 선택.
  toggleAllCommits: () => {
    const { commits, selectedHashes } = get()
    if (commits.length === 0) return

    const allSelected = commits.every((c) => selectedHashes.has(c.hash))
    const next = new Set(selectedHashes)
    for (const c of commits) {
      if (allSelected) next.delete(c.hash)
      else next.add(c.hash)
    }
    // RT-17(R4·R5) — toggleCommit과 동일한 이유.
    analysisGuard.start()
    set({
      selectedHashes: next,
      ...idleExportState,
      analyzing: false,
      dependencyAnalyzing: false
    })

    if (next.size === 0) {
      set({
        summary: null,
        deployFiles: [],
        deleteList: [],
        warnings: [],
        analysisError: null,
        analyzedSelection: null,
        ...emptyDependencyState,
        ...emptyManualAddState
      })
    }
  },

  clearSelection: () => set({ selectedHashes: new Set() })
})
