import type { StateCreator } from 'zustand'
import type {
  AnalysisWarning,
  DependencyCandidate,
  DeployPlanSummary
} from '../../../../shared/types'
import { createRequestGuard } from '../../lib/requestGuard'
import { api } from '../../api'
import type { AppState } from '../appStore'
import { emptyManualAddState } from './deployFilesSlice'

export interface DeleteEntry {
  path: string
}

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

// RT-17(R4·R5) — 분석(Preview + 의존성 분석) 요청 순서 가드. commitsSlice의
// loadCommitsFirstPage/toggleCommit/toggleAllCommits도 이 가드를 공유한다
// (선택이 바뀌는 지점이 start()로 진행 중인 요청을 무효화해야 하므로) —
// 그래서 analysisSlice가 export하고 commitsSlice가 import해서 쓴다.
// selectionMatches만으로는 "같은 선택으로 Preview를 두 번 눌렀을 때 어느
// 응답이 최신인지"를 구분할 수 없어(선택이 동일하면 둘 다 매치) 별도
// 세대 카운터가 필요하다. 선택이 바뀌는 지점(toggleCommit/toggleAllCommits/
// setProfile/loadCommitsFirstPage)이 start()로 진행 중인 요청을 무효화하고
// analyzing/dependencyAnalyzing을 그 자리에서 바로 끈다 — runAnalysis의
// stale 응답 처리는 플래그를 건드리지 않는다(끄면 그사이 시작된 새 요청의
// 진행 표시를 지워버릴 수 있음, "이전 요청이 끝나며 플래그를 끄는 일이
// 없어야 함").
export const analysisGuard = createRequestGuard()

// 커밋 선택이 리셋되거나 새 Preview를 시작할 때 §7.2 의존성 상태도 같이
// 초기화한다 — 옛 계산 결과가 새 선택의 우측 패널에 남아있지 않도록.
// commitsSlice(loadCommitsFirstPage/toggleCommit/toggleAllCommits)도
// 같은 초기화가 필요해 여기서 export한다.
export const emptyDependencyState = {
  dependencyAnalyzing: false,
  dependencyApplicable: false,
  dependencyReason: null,
  missingDependencies: [] as DependencyCandidate[],
  dependencyParseWarnings: [] as AnalysisWarning[]
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
// exportSlice의 runExport가 이걸 쓴다 — appStore.ts(root)가 아니라 여기
// 두는 이유: selectionMatches와 나란히 두면 root↔exportSlice 순환 import를
// 피할 수 있다(root는 이걸 재export만 한다).
export function selectIsAnalysisStale(state: AppState): boolean {
  if (state.selectedHashes.size === 0) return false
  const analyzed = state.analyzedSelection
  if (!analyzed) return true
  return !selectionMatches(analyzed, state)
}

// RT-31(S1) — appStore.ts에서 Preview 실행(BFS 분석 + §7.2 의존성 검사
// 체이닝)과 그 결과(요약/삭제 목록/경고/의존성)만 분리한 슬라이스.
// deployFiles 자체(포함 여부 토글·필터·검색·수동 추가)는 deployFilesSlice가
// 소유한다 — runPreview는 그 배열의 "초기값"만 채워 넣는다.
export interface AnalysisSlice {
  analyzing: boolean
  analysisError: string | null
  analyzedSelection: AnalyzedSelection | null
  summary: DeployPlanSummary | null
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

  initProfiles: () => Promise<void>
  setDependencySearchTerm: (term: string) => void
  setProfile: (profileName: string) => void
  runPreview: () => Promise<void>
}

export const createAnalysisSlice: StateCreator<AppState, [], [], AnalysisSlice> = (set, get) => ({
  analyzing: false,
  analysisError: null,
  analyzedSelection: null,
  summary: null,
  deleteList: [],
  warnings: [],

  ...emptyDependencyState,
  dependencySearchTerm: '',

  profiles: [],
  selectedProfile: 'default',

  initProfiles: async () => {
    const profiles = await api.mapping.listProfiles()
    set((state) => ({
      profiles,
      selectedProfile: profiles.includes(state.selectedProfile)
        ? state.selectedProfile
        : (profiles[0] ?? 'default')
    }))
  },

  setDependencySearchTerm: (term) => set({ dependencySearchTerm: term }),

  setProfile: (profileName) => {
    // RT-17(R4·R5) — toggleCommit과 동일한 이유(선택 구성 요소가
    // 바뀌었으니 진행 중이던 분석은 무효).
    analysisGuard.start()
    set({ selectedProfile: profileName, analyzing: false, dependencyAnalyzing: false })
    // 자동 재계산은 하지 않는다(사용자가 Preview를 다시 눌러야 함).
  },

  // Preview 클릭으로만 호출된다 — 커밋 체크박스/Mapping Profile 변경은
  // 더 이상 자동으로 이 함수를 트리거하지 않는다(과거 디바운스 방식은
  // "선택은 바뀌었는데 화면은 옛 결과"인 구간에 Export를 누르면 최신
  // 선택 중 일부가 조용히 누락되는 문제가 있었다 — Preview를 유일한
  // 트리거로 못박아 이 구간 자체를 없앴다).
  runPreview: async () => {
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
      const plan = await api.analysis.preview({
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
        const headTreeFiles = await api.git.listTrackedFiles(repository.path, selectedBranch)
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
        const depResult = await api.analysis.dependencies({
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
})
