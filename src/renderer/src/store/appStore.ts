import { create } from 'zustand'
import type {
  AnalysisWarning,
  CommitEntry,
  CommitSearchMode,
  DependencyCandidate,
  DeployFileStatus,
  DeployPlanSummary
} from '../../../shared/types'
import { getDefaultDateRange } from '../../../shared/dateRange'
import { pickDefaultBranch } from '../../../shared/branch'
import { loadExportParentDir, saveExportParentDir } from '../lib/exportPath'
import {
  loadUpdateCheckCache,
  saveUpdateCheckCache,
  isUpdateCheckCacheStale
} from '../lib/updateCheckCache'
import { loadExcludePatterns, saveExcludePatterns } from '../lib/excludePatterns'
import type { ExcludePatternEntry } from '../lib/excludePatterns'
import { matchesAnyActiveExcludePattern } from '../lib/excludePatternMatch'
import { createRequestGuard } from '../lib/requestGuard'

const PAGE_SIZE = 100
const SEARCH_DEBOUNCE_MS = 300

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
export interface AnalyzedSelection {
  hashes: string[]
  branch: string
  profileName: string
}

interface AppState {
  repository: RepositoryState
  // RepositoryPanel 좌측 라벨 표시용 — git remote origin URL에서 유도한
  // "진짜" 프로젝트 이름. 로컬 클론 폴더명과 다를 수 있어 별도로 둔다
  // (null이면 remote 없음/파싱 실패, 폴더명으로 폴백).
  remoteProjectName: string | null
  branches: string[]
  selectedBranch: string | null

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
  deployFilesSearchTerm: string // §7.2 point 8 — 좌측 "포함된 파일" 파일명 검색(부분 일치)
  // REQ-019/DR-018 — "포함된 파일"에만 적용(누락된 의존성은 항상 .java만
  // 나와 무의미). localStorage(gde:excludePatterns)로 동기 초기화.
  excludePatterns: ExcludePatternEntry[]
  // REQ-021/DR-019 — 배포 대상 파일 수동 추가. headTreeFiles는 팝업
  // 자동완성 후보 풀(선택된 Branch의 HEAD 트리 전체, Preview 성공 시
  // best-effort로 갱신), manuallyAddedPaths는 팝업 안 칩 이력 표시 전용이다.
  // 둘 다 localStorage에 저장하지 않는다 — `[Preview]` 재실행 시(deployFiles
  // 전체 교체와 같은 시점) 함께 초기화된다(DR-019 "생명주기").
  headTreeFiles: string[]
  manuallyAddedPaths: string[]
  deleteList: DeleteEntry[]
  warnings: AnalysisWarning[]

  // RISK_ISSUES.md §7.2 — 의존성 완결성 검사(Java/Spring). Preview 성공
  // 직후 자동으로 체이닝 호출된다(별도 트리거 버튼 없음). 실패해도 나머지
  // Preview 결과(summary/deployFiles 등)는 그대로 유효하다 — 이 결과는
  // 우측 "누락된 의존성" 패널 전용이라 실패가 전체 Preview를 막지 않는다.
  dependencyAnalyzing: boolean
  dependencyApplicable: boolean
  dependencyReason: string | null
  missingDependencies: DependencyCandidate[]
  dependencyParseWarnings: AnalysisWarning[]
  dependencySearchTerm: string // §7.2 point 8 — 우측 "누락된 의존성" 파일명 검색(부분 일치)

  profiles: string[]
  selectedProfile: string

  // RISK_ISSUES.md §7.1: Export 결과물이 생성될 부모 디렉터리. null이면
  // 저장소 루트가 기본값(Package Builder가 repoPath로 대체). 지정하면
  // localStorage에 전역 저장되어 다른 저장소를 열어도 유지된다.
  exportParentDir: string | null

  exportStatus: 'idle' | 'exporting' | 'done' | 'error'
  exportError: string | null
  lastExportDir: string | null

  // REQ-017/DR-016 — updateInfo가 null이면 "확인 안 됨/직전 캐시 없이 실패".
  // updateChecking과는 독립적으로 갱신된다(재확인 중에도 직전 값을 그대로
  // 보여주며 스피너만 추가). hasUpdate는 "다르다"가 아니라 "원격이 로컬보다
  // 엄격히 크다" — Main(checkForUpdate)이 이미 이 판정까지 끝내서 반환한다.
  updateInfo: { hasUpdate: boolean; latestVersion: string } | null
  updateChecking: boolean
  appVersion: string // REQ-017 버전 배지 텍스트. update:check 캐시가 신선하면 그건 아예 안 불리므로 별도 채널로 가져온다

  initProfiles: () => Promise<void>
  browseExportParentDir: () => Promise<void>
  browseRepository: () => Promise<void>
  reloadRepository: () => Promise<void>
  setBranch: (branch: string) => Promise<void>
  setSearchTerm: (term: string) => void
  setSearchMode: (mode: CommitSearchMode) => Promise<void>
  setAuthorFilter: (author: string) => void
  setExcludeMerges: (excludeMerges: boolean) => Promise<void>
  setHashFilterText: (text: string) => void
  triggerSearch: () => Promise<void>
  setDateRange: (startDate: string, endDate: string) => void
  setMaxCount: (maxCount: number) => Promise<void>
  loadNextPage: () => Promise<void>
  toggleCommit: (hash: string) => void
  toggleAllCommits: () => void
  setDeployFilesFilter: (filter: DeployFilesFilter) => void
  setDeployFilesSearchTerm: (term: string) => void
  addExcludePattern: (pattern: string) => void
  toggleExcludePattern: (pattern: string) => void
  removeExcludePattern: (pattern: string) => void
  addManualFile: (localPath: string) => Promise<void>
  removeManualFile: (localPath: string) => void
  toggleDeployFileIncluded: (localPath: string) => void
  toggleAllDeployFiles: (visibleLocalPaths: string[]) => void
  setDependencySearchTerm: (term: string) => void
  toggleDependencyIncluded: (localPath: string) => void
  toggleAllMissingDependencies: (visibleLocalPaths: string[]) => void
  setProfile: (profileName: string) => void
  runPreview: () => Promise<void>
  runExport: () => Promise<void>
  initUpdateCheck: () => Promise<void>
  clickUpdateBadge: () => void
  loadAppVersion: () => Promise<void>
}

// selectionMatches가 실제로 읽는 필드만 뽑은 최소 형태. AppState는 구조적으로
// 이 타입을 만족하므로(TS structural typing) 아래 실제 호출부는 그대로
// AppState를 넘길 수 있다 — RT-01에서 vitest로 직접 테스트하기 위해
// 파라미터 타입만 좁혔고, 동작은 바뀌지 않는다.
export interface SelectionSnapshot {
  selectedBranch: string | null
  selectedProfile: string
  selectedHashes: Set<string>
}

// 어떤 선택(a)이 현재 state의 선택과 정확히 같은지 비교하는 공용 함수.
// selectIsAnalysisStale과 runAnalysis()의 레이스 컨디션 가드(§6.1 케이스 C)가
// 이 함수를 공유한다 — 비교 기준이 둘로 갈라지면 나중에 한쪽만 고치는
// 실수가 생기기 쉬우므로 하나로 합쳤다.
export function selectionMatches(a: AnalyzedSelection, state: SelectionSnapshot): boolean {
  if (a.branch !== state.selectedBranch) return false
  if (a.profileName !== state.selectedProfile) return false
  if (a.hashes.length !== state.selectedHashes.size) return false
  return a.hashes.every((h) => state.selectedHashes.has(h))
}

// 현재 선택(브랜치/커밋/프로필)이 마지막 분석 입력과 정확히 같은지 비교한다.
// 값을 별도 boolean으로 저장하지 않고 매번 파생 계산한다 — 저장하면 어느
// 변경 경로에서 갱신을 깜빡할 위험이 있지만, 비교식은 그럴 여지가 없다
// (DeployFilesPanel의 전체 선택 indeterminate 판정과 같은 이유).
export function selectIsAnalysisStale(state: AppState): boolean {
  if (state.selectedHashes.size === 0) return false
  const analyzed = state.analyzedSelection
  if (!analyzed) return true
  return !selectionMatches(analyzed, state)
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// RT-11(R2) — 커밋 조회 요청 순서 가드. loadCommitsFirstPage가 새 조회를
// 시작할 때마다 start()로 새 세대를 발급한다. loadNextPage는 시작 시점의
// 세대를 current()로 캡처해 두고, 응답이 왔을 때 그 세대가 여전히
// 최신인지 비교한다 — runAnalysis의 selectionMatches/analyzedSelection과
// 같은 개념이다. loadCommitsFirstPage 자기 자신도 이 세대를 비교해,
// 검색 조건을 빠르게 여러 번 바꿔 여러 첫 페이지 조회가 겹쳐도 가장
// 나중에 시작한 것만 결과를 반영한다. RT-17의 분석 요청 가드도 같은
// 유틸(createRequestGuard)을 쓴다.
const commitQueryGuard = createRequestGuard()

// RT-17(R4·R5) — 분석(Preview + 의존성 분석) 요청 순서 가드. commitQueryGuard
// 와 같은 유틸을 쓴다. selectionMatches만으로는 "같은 선택으로 Preview를
// 두 번 눌렀을 때 어느 응답이 최신인지"를 구분할 수 없어(선택이 동일하면
// 둘 다 매치) 별도 세대 카운터가 필요하다. 선택이 바뀌는 지점
// (toggleCommit/toggleAllCommits/setProfile/loadCommitsFirstPage)이
// start()로 진행 중인 요청을 무효화하고 analyzing/dependencyAnalyzing을
// 그 자리에서 바로 끈다 — runAnalysis의 stale 응답 처리는 플래그를
// 건드리지 않는다(끄면 그사이 시작된 새 요청의 진행 표시를 지워버릴 수
// 있음, "이전 요청이 끝나며 플래그를 끄는 일이 없어야 함").
const analysisGuard = createRequestGuard()

// 연속 클릭 가드(DR-016) — Electron 네이티브 확인창이 이미 떠 있는 동안
// 다시 클릭해도 새 확인창을 띄우지 않는다. 모듈 레벨 변수로 두는 이유는
// searchDebounceTimer와 같다: 이 값 자체는 UI에 표시되지 않는 순수 가드용
// 플래그라 굳이 store state로 만들 이유가 없다.
let updateDialogOpen = false

const defaultRange = getDefaultDateRange()
const initialUpdateCache = loadUpdateCheckCache()

// 커밋 선택이 리셋되거나 새 Preview를 시작할 때 §7.2 의존성 상태도 같이
// 초기화한다 — 옛 계산 결과가 새 선택의 우측 패널에 남아있지 않도록.
const emptyDependencyState = {
  dependencyAnalyzing: false,
  dependencyApplicable: false,
  dependencyReason: null,
  missingDependencies: [] as DependencyCandidate[],
  dependencyParseWarnings: [] as AnalysisWarning[]
}

// REQ-021/DR-019 — deployFiles가 통째로 교체/초기화되는 지점(새 Preview
// 결과 반영, 선택 비움 등)마다 같이 초기화한다. 별도 영속 상태를 두지
// 않기로 한 결정(DETAILED_DESIGN.md §13.5)에 따라 emptyDependencyState와
// 동일한 성격의 리셋 묶음이다.
const emptyManualAddState = {
  headTreeFiles: [] as string[],
  manuallyAddedPaths: [] as string[]
}

// RT-16(U7) — "Export 완료: <경로>" 성공 메시지가 exportStatus를 바꾸는
// runExport 안에서만 리셋됐다. 커밋 선택이 바뀐 뒤에도 지난 Export의
// 완료 메시지가 그대로 남아있어 "방금 선택한 걸 내보냈다"처럼 보이는
// 문제(toggleCommit/toggleAllCommits에서 재사용).
const idleExportState = {
  exportStatus: 'idle' as const,
  exportError: null,
  lastExportDir: null
}

export const useAppStore = create<AppState>((set, get) => {
  // RISK_ISSUES.md §6.1 — 재조회 시 selectedHashes를 지울지 유지할지는
  // 호출자가 결정한다(케이스 A/B: Repository 전환·Branch 전환은 지움 —
  // 다른 저장소/Branch의 hash가 남아있으면 최종 Export가 "현재 선택된
  // Branch의 HEAD" 기준으로 엉뚱하게 해석될 위험이 있다. 그 외 — Reload,
  // 검색어/모드, 조회 기간, 최대 개수 변경 — 는 전부 유지한다. 그래야
  // "검색 조건을 바꿔가며 여러 번 찾아 누적 체크"하는 워크플로우가 성립한다).
  async function loadCommitsFirstPage(keepSelection = false): Promise<void> {
    const {
      repository,
      selectedBranch,
      startDate,
      endDate,
      maxCount,
      searchTerm,
      searchMode,
      authorFilter,
      excludeMerges,
      hashFilterText
    } = get()
    if (repository.status !== 'valid' || !selectedBranch || !repository.path) return
    const hashFilter = parseMultiValueFilter(hashFilterText)
    const authors = parseMultiValueFilter(authorFilter)
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
      const result = await window.api.git.listCommits({
        repoPath: repository.path,
        branch: selectedBranch,
        startDate,
        endDate,
        maxCount,
        skip: 0,
        pageSize: PAGE_SIZE,
        searchTerm: searchTerm || undefined,
        searchMode,
        authors: authors.length > 0 ? authors : undefined,
        excludeMerges,
        hashFilter: hashFilter.length > 0 ? hashFilter : undefined
      })
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
  }

  // Preview 클릭으로만 호출된다 — 커밋 체크박스/Mapping Profile 변경은
  // 더 이상 자동으로 이 함수를 트리거하지 않는다(과거 디바운스 방식은
  // "선택은 바뀌었는데 화면은 옛 결과"인 구간에 Export를 누르면 최신
  // 선택 중 일부가 조용히 누락되는 문제가 있었다 — Preview를 유일한
  // 트리거로 못박아 이 구간 자체를 없앴다).
  async function runAnalysis(): Promise<void> {
    const {
      repository,
      selectedBranch,
      selectedHashes,
      selectedProfile,
      analyzing,
      dependencyAnalyzing
    } = get()
    // RT-17(R4·R5) 이중 방어 — Preview 버튼이 이미 이 조건으로 비활성화
    // 되지만, runPreview()가 다른 경로로도 호출될 수 있어 여기서도 막는다.
    if (analyzing || dependencyAnalyzing) return

    if (!repository.path || !selectedBranch || selectedHashes.size === 0) {
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
      return
    }

    const hashes = [...selectedHashes]
    const requestSelection: AnalyzedSelection = {
      hashes,
      branch: selectedBranch,
      profileName: selectedProfile
    }
    // RT-17(R4·R5) — 요청 번호 가드. selectionMatches만으로는 "같은
    // 선택으로 Preview를 두 번 눌렀을 때 어느 응답이 최신인지"를 구분할
    // 수 없다(선택이 같으면 둘 다 매치돼버림). isCurrent()가 두 조건을
    // 모두 본다: 이 요청이 여전히 최신 세대인지 + 선택이 그때와 같은지.
    const requestId = analysisGuard.start()
    const isCurrent = (): boolean =>
      analysisGuard.isCurrent(requestId) && selectionMatches(requestSelection, get())

    set({ analyzing: true, analysisError: null, ...emptyDependencyState })
    try {
      const plan = await window.api.analysis.preview({
        repoPath: repository.path,
        branch: selectedBranch,
        commitHashes: hashes,
        profileName: selectedProfile
      })

      // stale이면 결과를 버린다. analyzing/dependencyAnalyzing은 건드리지
      // 않는다 — 그사이 시작된 새 요청의 진행 표시일 수 있어서, 이 응답이
      // 그걸 꺼버리면 안 된다(끄는 건 그 새 요청 자신의 몫이거나, 선택이
      // 바뀐 지점에서 이미 끝났다).
      if (!isCurrent()) return

      set({
        analyzing: false,
        summary: plan.summary,
        deployFiles: plan.files.map((f) => ({ ...f, included: true })),
        deleteList: plan.deletedServerPaths.map((path) => ({ path })),
        warnings: plan.warnings,
        analyzedSelection: requestSelection,
        manuallyAddedPaths: []
      })

      // REQ-021/DR-019: 파일 수동 추가 팝업의 자동완성 후보 풀을 새로
      // 가져온다. 의존성 체이닝과 같은 성격의 best-effort 후속 단계 —
      // 실패해도 팝업 후보가 비어 보일 뿐 나머지 Preview 결과엔 영향 없다.
      try {
        const headTreeFiles = await window.api.git.listTrackedFiles(repository.path, selectedBranch)
        if (isCurrent()) {
          set({ headTreeFiles })
        }
      } catch {
        // 무시 — §7.2 의존성 분석 실패 처리와 동일한 정책
      }

      // §7.2: Preview 완료 직후 자동으로 체이닝 호출한다(별도 트리거 버튼
      // 없음). 실패해도 위에서 이미 반영된 summary/deployFiles 등은 그대로
      // 유효하다 — 우측 패널에만 영향을 주는 best-effort 후속 단계다.
      set({ dependencyAnalyzing: true })
      try {
        const depResult = await window.api.analysis.dependencies({
          repoPath: repository.path,
          branch: selectedBranch,
          includedLocalPaths: plan.files.map((f) => f.localPath),
          profileName: selectedProfile
        })
        if (!isCurrent()) return
        set({
          dependencyAnalyzing: false,
          dependencyApplicable: depResult.applicable,
          dependencyReason: depResult.reason ?? null,
          missingDependencies: depResult.missingDependencies,
          dependencyParseWarnings: depResult.parseWarnings
        })
      } catch (error) {
        if (!isCurrent()) return
        set({
          dependencyAnalyzing: false,
          dependencyApplicable: false,
          dependencyReason: error instanceof Error ? error.message : String(error)
        })
      }
    } catch (error) {
      if (!isCurrent()) return
      set({
        analyzing: false,
        analysisError: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // REQ-017/DR-016. 캐시 나이와 무관하게 항상 실제로 호출한다(캐시
  // 게이트는 호출자 쪽 책임 — initUpdateCheck는 만료 시에만, clickUpdateBadge는
  // 항상 이 함수를 부른다). 이미 진행 중이면 새로 호출하지 않고 조용히
  // 반환한다 — 연속 클릭 시 중복 API 호출을 막기 위함.
  async function performUpdateCheck(): Promise<void> {
    if (get().updateChecking) return
    set({ updateChecking: true })
    try {
      const result = await window.api.update.check()
      if (result.ok) {
        saveUpdateCheckCache({
          checkedAt: Date.now(),
          hasUpdate: result.hasUpdate,
          latestVersion: result.latestVersion
        })
        set({ updateInfo: { hasUpdate: result.hasUpdate, latestVersion: result.latestVersion } })
      }
      // 실패 시 updateInfo를 건드리지 않는다(직전 상태 유지) — 캐시도
      // 갱신하지 않아 다음 트리거 때 다시 시도한다.
    } finally {
      set({ updateChecking: false })
    }
  }

  return {
    repository: { path: null, status: 'idle' },
    remoteProjectName: null,
    branches: [],
    selectedBranch: null,

    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    maxCount: 100,
    searchTerm: '',
    searchMode: 'message',
    authorFilter: '',
    excludeMerges: true,
    hashFilterText: '',
    invalidHashFilter: [],

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
    deployFilesSearchTerm: '',
    excludePatterns: loadExcludePatterns(),
    deleteList: [],
    warnings: [],

    ...emptyDependencyState,
    ...emptyManualAddState,
    dependencySearchTerm: '',

    profiles: [],
    selectedProfile: 'default',

    exportParentDir: loadExportParentDir(),

    exportStatus: 'idle',
    exportError: null,
    lastExportDir: null,

    // 캐시가 있으면 그 값으로 동기 초기화한다(splitRatio/columnWidths와 동일
    // 패턴) — 마운트 후 비동기로 채우면 첫 렌더링에 배지가 "평시"로 잠깐
    // 반짝이는 깜빡임이 생긴다(RISK_ISSUES.md 결정 이력 #35).
    updateInfo: initialUpdateCache
      ? { hasUpdate: initialUpdateCache.hasUpdate, latestVersion: initialUpdateCache.latestVersion }
      : null,
    updateChecking: false,
    appVersion: '',

    initProfiles: async () => {
      const profiles = await window.api.mapping.listProfiles()
      set((state) => ({
        profiles,
        selectedProfile: profiles.includes(state.selectedProfile)
          ? state.selectedProfile
          : (profiles[0] ?? 'default')
      }))
    },

    browseExportParentDir: async () => {
      const path = await window.api.package.browseExportDir()
      if (!path) return
      saveExportParentDir(path)
      set({ exportParentDir: path })
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
      // 라벨 표시용 프로젝트 이름도 Branch 목록과 같은 시점에 같이
      // 가져온다(Promise.all — 순차 호출로 지연시키지 않음). 실패해도
      // getRemoteProjectName 자체가 null을 반환하므로 이 조회가 저장소
      // 전환 흐름을 막지 않는다.
      const [branches, remoteProjectName] = await Promise.all([
        window.api.git.listBranches(path),
        window.api.git.getRemoteProjectName(path)
      ])
      const selectedBranch = pickDefaultBranch(branches)
      set({ branches, selectedBranch, remoteProjectName })
      // §6.1 케이스 A: 다른 저장소로 전환하면 이전 저장소의 커밋 hash로 git
      // 명령을 시도하게 되므로 선택을 지운다(keepSelection 기본값 false).
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
      const [branches, remoteProjectName] = await Promise.all([
        window.api.git.listBranches(repository.path),
        window.api.git.getRemoteProjectName(repository.path)
      ])
      const currentBranch = get().selectedBranch
      const selectedBranch =
        currentBranch && branches.includes(currentBranch)
          ? currentBranch
          : pickDefaultBranch(branches)
      set({ branches, selectedBranch, remoteProjectName })
      // A/B 어느 쪽에도 해당하지 않는다 — 같은 저장소를 다시 읽는 것뿐이라
      // (Branch가 그대로 존재하면 그대로 유지) 선택을 지울 이유가 없다.
      await loadCommitsFirstPage(true)
    },

    setBranch: async (branch) => {
      set({ selectedBranch: branch })
      // §6.1 케이스 B: 서로 다른 Branch의 커밋이 한 Export에 섞이는 걸
      // 막기 위해 Branch 전환 시 선택을 지운다(keepSelection 기본값 false).
      await loadCommitsFirstPage()
    },

    // §6.1: 검색어/기간/최대개수/검색모드 변경은 전부 선택을 유지한다
    // (keepSelection=true) — "검색 조건을 바꿔가며 여러 번 찾아 누적
    // 체크"하는 워크플로우가 이 기능의 핵심 목적이다.
    setSearchTerm: (term) => {
      set({ searchTerm: term })
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        void loadCommitsFirstPage(true)
      }, SEARCH_DEBOUNCE_MS)
    },

    setSearchMode: async (mode) => {
      set({ searchMode: mode })
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
      }
      await loadCommitsFirstPage(true)
    },

    // REQ-022 — searchTerm과 동일한 디바운스 패턴(타이핑마다 재조회하지 않음).
    setAuthorFilter: (author) => {
      set({ authorFilter: author })
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        void loadCommitsFirstPage(true)
      }, SEARCH_DEBOUNCE_MS)
    },

    // REQ-022 — 체크박스 토글은 즉시 반영(디바운스 불필요, searchMode와 동일).
    setExcludeMerges: async (excludeMerges) => {
      set({ excludeMerges })
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
      }
      await loadCommitsFirstPage(true)
    },

    // REQ-023 — searchTerm/authorFilter와 동일한 디바운스 패턴. 파싱(공백/쉼표
    // 분리)은 loadCommitsFirstPage/loadNextPage 호출 시점에 한다 — 여기선
    // 원본 텍스트만 그대로 들고 있는다.
    setHashFilterText: (text) => {
      set({ hashFilterText: text })
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        void loadCommitsFirstPage(true)
      }, SEARCH_DEBOUNCE_MS)
    },

    triggerSearch: async () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
      }
      await loadCommitsFirstPage(true)
    },

    // RT-16(U6) — 예전엔 디바운스 없이 값이 바뀔 때마다(네이티브 date
    // input이 년/월/일 하위 필드마다 change를 낼 수 있어 타이핑 중간값
    // 포함) 즉시 재조회했다. searchTerm/authorFilter/hashFilterText와
    // 같은 300ms 디바운스로 통일한다.
    setDateRange: (startDate, endDate) => {
      set({ startDate, endDate })
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        void loadCommitsFirstPage(true)
      }, SEARCH_DEBOUNCE_MS)
    },

    setMaxCount: async (maxCount) => {
      set({ maxCount })
      await loadCommitsFirstPage(true)
    },

    loadNextPage: async () => {
      const {
        repository,
        selectedBranch,
        startDate,
        endDate,
        maxCount,
        searchTerm,
        searchMode,
        authorFilter,
        excludeMerges,
        hashFilterText,
        commits,
        commitPagination
      } = get()
      if (!repository.path || !selectedBranch) return
      if (!commitPagination.hasMore || commitPagination.loading) return
      const hashFilter = parseMultiValueFilter(hashFilterText)
      const authors = parseMultiValueFilter(authorFilter)
      // RT-11(R2): 이 다음 페이지 요청이 속한 "세대"를 캡처해 둔다 —
      // 응답이 오기 전에 loadCommitsFirstPage가 새 조회를 시작하면(세대가
      // 증가하면) 이 요청은 무효가 된다. 호출 시점의 commits 스냅샷에
      // 이어붙이는 대신 응답 처리 시점에 get().commits를 다시 읽어 붙인다
      // (세대가 안 바뀌었다는 보장과 별개로, 최신 상태를 기준으로 한다).
      const requestId = commitQueryGuard.current()

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
          searchTerm: searchTerm || undefined,
          searchMode,
          authors: authors.length > 0 ? authors : undefined,
          excludeMerges,
          hashFilter: hashFilter.length > 0 ? hashFilter : undefined
        })
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

    setDeployFilesFilter: (filter) => set({ deployFilesFilter: filter }),
    setDeployFilesSearchTerm: (term) => set({ deployFilesSearchTerm: term }),

    // 빈 입력은 무시하고, 이미 있는 패턴이면 새로 추가하지 않고 enabled만
    // 켠다(중복 방지 — 사용자가 예전에 껐던 패턴을 다시 입력했을 때 자연스럽게
    // "다시 켜기"로 동작).
    addExcludePattern: (pattern) => {
      const trimmed = pattern.trim()
      if (!trimmed) return
      set((state) => {
        const exists = state.excludePatterns.some((p) => p.pattern === trimmed)
        const next = exists
          ? state.excludePatterns.map((p) => (p.pattern === trimmed ? { ...p, enabled: true } : p))
          : [...state.excludePatterns, { pattern: trimmed, enabled: true }]
        saveExcludePatterns(next)
        return { excludePatterns: next }
      })
    },

    toggleExcludePattern: (pattern) => {
      set((state) => {
        const next = state.excludePatterns.map((p) =>
          p.pattern === pattern ? { ...p, enabled: !p.enabled } : p
        )
        saveExcludePatterns(next)
        return { excludePatterns: next }
      })
    },

    // REQ-024 — 토글과 달리 이력 자체에서 빠진다(확인 다이얼로그 없이 즉시
    // 처리 — 토글/removeManualFile과 동일한 관례).
    removeExcludePattern: (pattern) => {
      set((state) => {
        const next = state.excludePatterns.filter((p) => p.pattern !== pattern)
        saveExcludePatterns(next)
        return { excludePatterns: next }
      })
    },

    // REQ-021/DR-019: 팝업에서 자동완성 후보를 선택했을 때. Server Path는
    // §7.2 의존성 후보와 동일하게 Main에서 Mapping Rule로 계산한다(Renderer는
    // MappingProfile 전체를 갖고 있지 않다). 이미 deployFiles에 있으면(다른
    // 경로로 이미 들어와 있거나 중복 클릭) 아무 것도 하지 않는다.
    addManualFile: async (localPath) => {
      const { repository, selectedBranch, selectedProfile, deployFiles } = get()
      if (!repository.path || !selectedBranch) return
      if (deployFiles.some((f) => f.localPath === localPath)) return

      const entry = await window.api.analysis.resolveManualFile({
        repoPath: repository.path,
        branch: selectedBranch,
        profileName: selectedProfile,
        localPath
      })

      set((state) => {
        // IPC 왕복 중 이미 추가됐을 수 있다(연속 클릭) — 다시 한번 확인.
        if (state.deployFiles.some((f) => f.localPath === localPath)) return {}
        return {
          deployFiles: [...state.deployFiles, { ...entry, included: true }],
          manuallyAddedPaths: [...state.manuallyAddedPaths, localPath]
        }
      })
    },

    // 팝업 칩의 × — 제외 패턴 칩과 달리 토글이 아니라 철회다(이력성 데이터가
    // 아니라 그 자리에서 추가/철회하는 1회성 액션 — RISK_ISSUES.md 결정
    // 이력 #48).
    removeManualFile: (localPath) => {
      set((state) => ({
        deployFiles: state.deployFiles.filter((f) => f.localPath !== localPath),
        manuallyAddedPaths: state.manuallyAddedPaths.filter((p) => p !== localPath)
      }))
    },

    toggleDeployFileIncluded: (localPath) => {
      set((state) => ({
        deployFiles: state.deployFiles.map((f) =>
          f.localPath === localPath ? { ...f, included: !f.included } : f
        )
      }))
    },

    // 정정(RISK_ISSUES.md 결정 이력 #33): 상태 Filter만 자체적으로 다시
    // 계산하고 검색어는 무시하던 버그를 고쳤다 — 이제 필터 로직을 여기서
    // 다시 계산하지 않고, 화면에 실제로 표시 중인 목록(DeployFilesPanel.tsx의
    // includedItems, 상태 Filter+검색어 둘 다 반영됨)의 경로를 그대로
    // 파라미터로 받는다(단일 진실 공급원). 받은 목록이 전부 included면
    // 전체 해제, 그 외(일부만/전혀 없음)면 전체 선택.
    toggleAllDeployFiles: (visibleLocalPaths) => {
      set((state) => {
        const visibleSet = new Set(visibleLocalPaths)
        const visible = state.deployFiles.filter((f) => visibleSet.has(f.localPath))
        const allIncluded = visible.length > 0 && visible.every((f) => f.included)
        const nextIncluded = !allIncluded
        return {
          deployFiles: state.deployFiles.map((f) =>
            visibleSet.has(f.localPath) ? { ...f, included: nextIncluded } : f
          )
        }
      })
    },

    setDependencySearchTerm: (term) => set({ dependencySearchTerm: term }),

    // 우측 "누락된 의존성" 개별 체크박스 — 이미 좌측(deployFiles)에 들어가
    // 있으면 빼고(다시 "누락됨"으로 보이게), 없으면 추가한다. missingDependencies
    // 자체는 건드리지 않는다 — 우측에 실제로 표시되는 목록은 컴포넌트가
    // "missingDependencies 중 deployFiles에 아직 없는 것"으로 파생 계산한다
    // (전체 선택 indeterminate 판정과 같은 이유로 상태 중복 저장을 피함).
    toggleDependencyIncluded: (localPath) => {
      set((state) => {
        const alreadyIncluded = state.deployFiles.some((f) => f.localPath === localPath)
        if (alreadyIncluded) {
          return { deployFiles: state.deployFiles.filter((f) => f.localPath !== localPath) }
        }
        const candidate = state.missingDependencies.find((d) => d.localPath === localPath)
        if (!candidate) return {}
        return {
          deployFiles: [
            ...state.deployFiles,
            {
              localPath: candidate.localPath,
              serverPath: candidate.serverPath,
              status: candidate.status,
              included: true
            }
          ]
        }
      })
    },

    // "전체 추가"(add-only) 버튼을 "전체 선택"(양방향 토글) 체크박스로
    // 교체 — 좌측 toggleAllDeployFiles()와 같은 패턴. 받은 경로 중 화면에
    // 실제로 보이는 missingDependencies가 전부 이미 추가돼 있으면 전체
    // 제거, 그 외(일부만/전혀 없음)면 아직 없는 것만 전체 추가한다.
    toggleAllMissingDependencies: (visibleLocalPaths) => {
      set((state) => {
        const visibleSet = new Set(visibleLocalPaths)
        const existing = new Set(state.deployFiles.map((f) => f.localPath))
        const visibleMissing = state.missingDependencies.filter((d) => visibleSet.has(d.localPath))
        const allChecked =
          visibleMissing.length > 0 && visibleMissing.every((d) => existing.has(d.localPath))

        if (allChecked) {
          return { deployFiles: state.deployFiles.filter((f) => !visibleSet.has(f.localPath)) }
        }
        const toAdd = visibleMissing.filter((d) => !existing.has(d.localPath))
        if (toAdd.length === 0) return {}
        return {
          deployFiles: [
            ...state.deployFiles,
            ...toAdd.map((d) => ({
              localPath: d.localPath,
              serverPath: d.serverPath,
              status: d.status,
              included: true
            }))
          ]
        }
      })
    },

    setProfile: (profileName) => {
      // RT-17(R4·R5) — toggleCommit과 동일한 이유(선택 구성 요소가
      // 바뀌었으니 진행 중이던 분석은 무효).
      analysisGuard.start()
      set({ selectedProfile: profileName, analyzing: false, dependencyAnalyzing: false })
      // 자동 재계산은 하지 않는다(사용자가 Preview를 다시 눌러야 함).
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
        excludePatterns,
        deleteList,
        warnings,
        exportParentDir
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
          // REQ-019/DR-018: included=true인 것 중, 활성 제외 패턴에 매치되지
          // 않는 것만 Export 대상이다 — deployFiles[].included 자체는 건드리지
          // 않고(파생 계산), 여기서 최종적으로 한 번 더 걸러낸다.
          files: deployFiles
            .filter(
              (f) => f.included && !matchesAnyActiveExcludePattern(f.localPath, excludePatterns)
            )
            .map((f) => ({ localPath: f.localPath, serverPath: f.serverPath, status: f.status })),
          deletedServerPaths: deleteList.map((d) => d.path),
          warnings,
          exportParentDir: exportParentDir ?? undefined
        })
        // null = 덮어쓰기 확인 팝업에서 사용자가 취소함(§7.1). 에러가
        // 아니라 사용자의 명시적 중단이므로 idle로 되돌리고 배너를
        // 띄우지 않는다.
        if (result === null) {
          set({ exportStatus: 'idle' })
          return
        }
        set({ exportStatus: 'done', lastExportDir: result.deployDir })
      } catch (error) {
        set({
          exportStatus: 'error',
          exportError: error instanceof Error ? error.message : String(error)
        })
      }
    },

    // 앱 시작 시 1회 호출(App.tsx). 캐시가 신선하면 아무것도 안 한다 —
    // updateInfo는 이미 스토어 생성 시점에 캐시로 초기화돼 있다.
    initUpdateCheck: async () => {
      if (!isUpdateCheckCacheStale(initialUpdateCache)) return
      await performUpdateCheck()
    },

    // 버전 배지 클릭(DR-016). 확인창과 강제 재확인은 서로 독립된 두
    // 흐름이다 — 확인창 문구가 버전 정보를 담지 않으므로 재확인 결과를
    // 기다릴 이유가 없다("긴급 패치를 바로 인지해야 한다"는 사용자 요구).
    clickUpdateBadge: () => {
      if (!updateDialogOpen) {
        updateDialogOpen = true
        void window.api.update.confirmAndOpen().finally(() => {
          updateDialogOpen = false
        })
      }
      // performUpdateCheck 자신이 updateChecking 가드를 갖고 있어, 이미
      // 진행 중이면 여기서 다시 호출해도 조용히 무시된다.
      void performUpdateCheck()
    },

    loadAppVersion: async () => {
      const version = await window.api.app.getVersion()
      set({ appVersion: version })
    }
  }
})
