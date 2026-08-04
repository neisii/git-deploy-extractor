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
const ANALYZE_DEBOUNCE_MS = 500
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
  setDeployFilesFilter: (filter: DeployFilesFilter) => void
  setProfile: (profileName: string) => void
  runPreview: () => Promise<void>
  runExport: () => Promise<void>
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let analyzeDebounceTimer: ReturnType<typeof setTimeout> | null = null

function clearAnalyzeDebounce(): void {
  if (analyzeDebounceTimer) {
    clearTimeout(analyzeDebounceTimer)
    analyzeDebounceTimer = null
  }
}

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
      warnings: []
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

  async function runAnalysis(): Promise<void> {
    const { repository, selectedBranch, selectedHashes, selectedProfile } = get()
    if (!repository.path || !selectedBranch || selectedHashes.size === 0) {
      set({ summary: null, deployFiles: [], deleteList: [], warnings: [], analysisError: null })
      return
    }

    set({ analyzing: true, analysisError: null })
    try {
      const plan = await window.api.analysis.preview({
        repoPath: repository.path,
        branch: selectedBranch,
        commitHashes: [...selectedHashes],
        profileName: selectedProfile
      })
      set({
        analyzing: false,
        summary: plan.summary,
        deployFiles: plan.files.map((f) => ({ ...f, included: true })),
        deleteList: plan.deletedServerPaths.map((path) => ({ path })),
        warnings: plan.warnings
      })
    } catch (error) {
      set({
        analyzing: false,
        analysisError: error instanceof Error ? error.message : String(error)
      })
    }
  }

  function scheduleAnalysis(): void {
    clearAnalyzeDebounce()
    analyzeDebounceTimer = setTimeout(() => {
      void runAnalysis()
    }, ANALYZE_DEBOUNCE_MS)
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
        clearAnalyzeDebounce()
        set({ summary: null, deployFiles: [], deleteList: [], warnings: [], analysisError: null })
        return
      }
      scheduleAnalysis()
    },

    setDeployFilesFilter: (filter) => set({ deployFilesFilter: filter }),

    setProfile: (profileName) => {
      set({ selectedProfile: profileName })
      if (get().selectedHashes.size > 0) {
        void runAnalysis()
      }
    },

    runPreview: async () => {
      clearAnalyzeDebounce()
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
