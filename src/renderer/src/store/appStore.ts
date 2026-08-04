import { create } from 'zustand'
import type {
  AnalysisWarning,
  CommitEntry,
  DeployFileStatus,
  DeployPlanSummary
} from '../../../shared/types'
import { getDefaultDateRange } from '../../../shared/dateRange'
import { pickDefaultBranch } from '../../../shared/branch'

const PAGE_SIZE = 100
const SEARCH_DEBOUNCE_MS = 300

export interface DeployFileEntry {
  localPath: string
  serverPath: string
  status: DeployFileStatus
  included: boolean
}

export interface DeleteEntry {
  path: string
}

interface RepositoryState {
  path: string | null
  status: 'idle' | 'validating' | 'valid' | 'invalid'
  error?: string
}

interface CommitPagination {
  hasMore: boolean
  loading: boolean
}

export type DeployFilesFilter = 'all' | 'added' | 'modified'

// analyzeCommits(REQ-004~008)를 어떤 입력으로 마지막에 돌렸는지 기록한다.
// selectedHashes/selectedBranch/selectedProfile과 비교해 "지금 화면에 보이는
// 계산 결과가 현재 선택과 실제로 일치하는가"를 파생 계산하기 위함이다 —
// Preview를 유일한 분석 트리거로 삼으면서, 선택이 바뀐 뒤 Preview를 다시
// 누르기 전까지 Export가 옛 결과로 나가는 걸 막는 안전장치.
interface AnalyzedSelection {
  hashes: string[]
  branch: string
  profileName: string
}

interface AppState {
  repository: RepositoryState
  branches: string[]
  selectedBranch: string | null

  startDate: string
  endDate: string
  maxCount: number
  searchTerm: string

  commits: CommitEntry[]
  selectedHashes: Set<string>
  commitPagination: CommitPagination
  commitListError: string | null

  analyzing: boolean
  analysisError: string | null
  analyzedSelection: AnalyzedSelection | null
  summary: DeployPlanSummary | null
  deployFiles: DeployFileEntry[]
  deployFilesFilter: DeployFilesFilter
  deleteList: DeleteEntry[]
  warnings: AnalysisWarning[]

  profiles: string[]
  selectedProfile: string

  exportStatus: 'idle' | 'exporting' | 'done' | 'error'
  exportError: string | null
  lastExportDir: string | null

  initProfiles: () => Promise<void>
  browseRepository: () => Promise<void>
  reloadRepository: () => Promise<void>
  setBranch: (branch: string) => Promise<void>
  setSearchTerm: (term: string) => void
  triggerSearch: () => Promise<void>
  setDateRange: (startDate: string, endDate: string) => Promise<void>
  setMaxCount: (maxCount: number) => Promise<void>
  loadNextPage: () => Promise<void>
  toggleCommit: (hash: string) => void
  toggleAllCommits: () => void
  setDeployFilesFilter: (filter: DeployFilesFilter) => void
  toggleDeployFileIncluded: (localPath: string) => void
  toggleAllDeployFiles: () => void
  setProfile: (profileName: string) => void
  runPreview: () => Promise<void>
  runExport: () => Promise<void>
}

// 현재 선택(브랜치/커밋/프로필)이 마지막 분석 입력과 정확히 같은지 비교한다.
// 값을 별도 boolean으로 저장하지 않고 매번 파생 계산한다 — 저장하면 어느
// 변경 경로에서 갱신을 깜빡할 위험이 있지만, 비교식은 그럴 여지가 없다
// (DeployFilesPanel의 전체 선택 indeterminate 판정과 같은 이유).
export function selectIsAnalysisStale(state: AppState): boolean {
  if (state.selectedHashes.size === 0) return false
  const analyzed = state.analyzedSelection
  if (!analyzed) return true
  if (analyzed.branch !== state.selectedBranch) return true
  if (analyzed.profileName !== state.selectedProfile) return true
  if (analyzed.hashes.length !== state.selectedHashes.size) return true
  return !analyzed.hashes.every((h) => state.selectedHashes.has(h))
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const defaultRange = getDefaultDateRange()

export const useAppStore = create<AppState>((set, get) => {
  async function loadCommitsFirstPage(): Promise<void> {
    const { repository, selectedBranch, startDate, endDate, maxCount, searchTerm } = get()
    if (repository.status !== 'valid' || !selectedBranch || !repository.path) return

    set({
      commits: [],
      selectedHashes: new Set(),
      commitPagination: { hasMore: false, loading: true },
      commitListError: null,
      summary: null,
      deployFiles: [],
      deleteList: [],
      warnings: [],
      analyzedSelection: null,
      analysisError: null
    })

    try {
      const result = await window.api.git.listCommits({
        repoPath: repository.path,
        branch: selectedBranch,
        startDate,
        endDate,
        maxCount,
        skip: 0,
        pageSize: PAGE_SIZE,
        searchTerm: searchTerm || undefined
      })
      set({
        commits: result.commits,
        commitPagination: { hasMore: result.hasMore, loading: false }
      })
    } catch (error) {
      set({
        commitPagination: { hasMore: false, loading: false },
        commitListError: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Preview 클릭으로만 호출된다 — 커밋 체크박스/Mapping Profile 변경은
  // 더 이상 자동으로 이 함수를 트리거하지 않는다(과거 디바운스 방식은
  // "선택은 바뀌었는데 화면은 옛 결과"인 구간에 Export를 누르면 최신
  // 선택 중 일부가 조용히 누락되는 문제가 있었다 — Preview를 유일한
  // 트리거로 못박아 이 구간 자체를 없앴다).
  async function runAnalysis(): Promise<void> {
    const { repository, selectedBranch, selectedHashes, selectedProfile } = get()
    if (!repository.path || !selectedBranch || selectedHashes.size === 0) {
      set({
        summary: null,
        deployFiles: [],
        deleteList: [],
        warnings: [],
        analysisError: null,
        analyzedSelection: null
      })
      return
    }

    set({ analyzing: true, analysisError: null })
    try {
      const hashes = [...selectedHashes]
      const plan = await window.api.analysis.preview({
        repoPath: repository.path,
        branch: selectedBranch,
        commitHashes: hashes,
        profileName: selectedProfile
      })
      set({
        analyzing: false,
        summary: plan.summary,
        deployFiles: plan.files.map((f) => ({ ...f, included: true })),
        deleteList: plan.deletedServerPaths.map((path) => ({ path })),
        warnings: plan.warnings,
        analyzedSelection: { hashes, branch: selectedBranch, profileName: selectedProfile }
      })
    } catch (error) {
      set({
        analyzing: false,
        analysisError: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return {
    repository: { path: null, status: 'idle' },
    branches: [],
    selectedBranch: null,

    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    maxCount: 100,
    searchTerm: '',

    commits: [],
    selectedHashes: new Set(),
    commitPagination: { hasMore: false, loading: false },
    commitListError: null,

    analyzing: false,
    analysisError: null,
    analyzedSelection: null,
    summary: null,
    deployFiles: [],
    deployFilesFilter: 'all',
    deleteList: [],
    warnings: [],

    profiles: [],
    selectedProfile: 'default',

    exportStatus: 'idle',
    exportError: null,
    lastExportDir: null,

    initProfiles: async () => {
      const profiles = await window.api.mapping.listProfiles()
      set((state) => ({
        profiles,
        selectedProfile: profiles.includes(state.selectedProfile)
          ? state.selectedProfile
          : (profiles[0] ?? 'default')
      }))
    },

    browseRepository: async () => {
      const path = await window.api.repository.browse()
      if (!path) return

      set({ repository: { path, status: 'validating' } })
      const validation = await window.api.repository.validate(path)
      if (!validation.valid) {
        set({ repository: { path, status: 'invalid', error: validation.error } })
        return
      }

      set({ repository: { path, status: 'valid' } })
      const branches = await window.api.git.listBranches(path)
      const selectedBranch = pickDefaultBranch(branches)
      set({ branches, selectedBranch })
      await loadCommitsFirstPage()
    },

    reloadRepository: async () => {
      const { repository } = get()
      if (!repository.path) return

      set({ repository: { path: repository.path, status: 'validating' } })
      const validation = await window.api.repository.validate(repository.path)
      if (!validation.valid) {
        set({ repository: { path: repository.path, status: 'invalid', error: validation.error } })
        return
      }

      set({ repository: { path: repository.path, status: 'valid' } })
      const branches = await window.api.git.listBranches(repository.path)
      const currentBranch = get().selectedBranch
      const selectedBranch =
        currentBranch && branches.includes(currentBranch)
          ? currentBranch
          : pickDefaultBranch(branches)
      set({ branches, selectedBranch })
      await loadCommitsFirstPage()
    },

    setBranch: async (branch) => {
      set({ selectedBranch: branch })
      await loadCommitsFirstPage()
    },

    setSearchTerm: (term) => {
      set({ searchTerm: term })
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        void loadCommitsFirstPage()
      }, SEARCH_DEBOUNCE_MS)
    },

    triggerSearch: async () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
      }
      await loadCommitsFirstPage()
    },

    setDateRange: async (startDate, endDate) => {
      set({ startDate, endDate })
      await loadCommitsFirstPage()
    },

    setMaxCount: async (maxCount) => {
      set({ maxCount })
      await loadCommitsFirstPage()
    },

    loadNextPage: async () => {
      const {
        repository,
        selectedBranch,
        startDate,
        endDate,
        maxCount,
        searchTerm,
        commits,
        commitPagination
      } = get()
      if (!repository.path || !selectedBranch) return
      if (!commitPagination.hasMore || commitPagination.loading) return

      set({ commitPagination: { ...commitPagination, loading: true } })
      try {
        const result = await window.api.git.listCommits({
          repoPath: repository.path,
          branch: selectedBranch,
          startDate,
          endDate,
          maxCount,
          skip: commits.length,
          pageSize: PAGE_SIZE,
          searchTerm: searchTerm || undefined
        })
        set({
          commits: [...commits, ...result.commits],
          commitPagination: { hasMore: result.hasMore, loading: false }
        })
      } catch (error) {
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
      set({ selectedHashes: next })

      if (next.size === 0) {
        set({
          summary: null,
          deployFiles: [],
          deleteList: [],
          warnings: [],
          analysisError: null,
          analyzedSelection: null
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
      set({ selectedHashes: next })

      if (next.size === 0) {
        set({
          summary: null,
          deployFiles: [],
          deleteList: [],
          warnings: [],
          analysisError: null,
          analyzedSelection: null
        })
      }
    },

    setDeployFilesFilter: (filter) => set({ deployFilesFilter: filter }),

    toggleDeployFileIncluded: (localPath) => {
      set((state) => ({
        deployFiles: state.deployFiles.map((f) =>
          f.localPath === localPath ? { ...f, included: !f.included } : f
        )
      }))
    },

    // 필터에 표시된 행만 대상으로 한다 — 숨겨진 행은 건드리지 않는다
    // (UI_UX_SPEC.md §2.6). 현재 필터된 행이 전부 included면 전체 해제,
    // 그 외(일부만/전혀 없음)면 전체 선택 — indeterminate 상태를 별도
    // 저장하지 않고 파생 계산하는 것과 같은 이유로 이 판정도 매번 계산한다.
    toggleAllDeployFiles: () => {
      set((state) => {
        const filtered =
          state.deployFilesFilter === 'all'
            ? state.deployFiles
            : state.deployFiles.filter((f) => f.status === state.deployFilesFilter)
        const filteredPaths = new Set(filtered.map((f) => f.localPath))
        const allIncluded = filtered.length > 0 && filtered.every((f) => f.included)
        const nextIncluded = !allIncluded
        return {
          deployFiles: state.deployFiles.map((f) =>
            filteredPaths.has(f.localPath) ? { ...f, included: nextIncluded } : f
          )
        }
      })
    },

    setProfile: (profileName) => {
      set({ selectedProfile: profileName })
      // toggleCommit과 동일한 이유로 자동 재계산하지 않는다.
    },

    runPreview: async () => {
      await runAnalysis()
    },

    runExport: async () => {
      const {
        repository,
        selectedBranch,
        selectedProfile,
        commits,
        selectedHashes,
        deployFiles,
        deleteList,
        warnings
      } = get()
      if (!repository.path || !selectedBranch || selectedHashes.size === 0) return
      // UI에서 이미 stale일 때 버튼을 비활성화하지만, 이중 방어로 한 번 더 막는다.
      if (selectIsAnalysisStale(get())) return

      set({ exportStatus: 'exporting', exportError: null })
      try {
        const result = await window.api.package.export({
          repoPath: repository.path,
          branch: selectedBranch,
          mappingProfileName: selectedProfile,
          selectedCommits: commits.filter((c) => selectedHashes.has(c.hash)),
          files: deployFiles
            .filter((f) => f.included)
            .map((f) => ({ localPath: f.localPath, serverPath: f.serverPath, status: f.status })),
          deletedServerPaths: deleteList.map((d) => d.path),
          warnings
        })
        set({ exportStatus: 'done', lastExportDir: result.deployDir })
      } catch (error) {
        set({
          exportStatus: 'error',
          exportError: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }
})
