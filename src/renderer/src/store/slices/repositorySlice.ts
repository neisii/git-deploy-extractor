import type { StateCreator } from 'zustand'
import { pickDefaultBranch } from '../../../../shared/branch'
import { api } from '../../api'
import type { AppState } from '../appStore'

export interface RepositoryState {
  path: string | null
  status: 'idle' | 'validating' | 'valid' | 'invalid'
  error?: string
}

// RT-31(S1) — appStore.ts에서 저장소/Branch 관련 상태·액션만 분리한 슬라이스.
// browseRepository/reloadRepository/setBranch는 저장소·Branch가 바뀌면
// 커밋 목록을 다시 불러와야 하므로 commitsSlice의 loadCommitsFirstPage를
// get()으로 호출한다(슬라이스끼리는 이렇게 get()을 통해서만 서로의
// 액션을 부른다 — 파일 간 직접 import는 하지 않는다).
export interface RepositorySlice {
  repository: RepositoryState
  // RepositoryPanel 좌측 라벨 표시용 — git remote origin URL에서 유도한
  // "진짜" 프로젝트 이름. 로컬 클론 폴더명과 다를 수 있어 별도로 둔다
  // (null이면 remote 없음/파싱 실패, 폴더명으로 폴백).
  remoteProjectName: string | null
  branches: string[]
  selectedBranch: string | null

  browseRepository: () => Promise<void>
  reloadRepository: () => Promise<void>
  setBranch: (branch: string) => Promise<void>
}

export const createRepositorySlice: StateCreator<AppState, [], [], RepositorySlice> = (
  set,
  get
) => ({
  repository: { path: null, status: 'idle' },
  remoteProjectName: null,
  branches: [],
  selectedBranch: null,

  browseRepository: async () => {
    const path = await api.repository.browse()
    if (!path) return

    set({ repository: { path, status: 'validating' } })
    const validation = await api.repository.validate(path)
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
      api.git.listBranches(path),
      api.git.getRemoteProjectName(path)
    ])
    const selectedBranch = pickDefaultBranch(branches)
    set({ branches, selectedBranch, remoteProjectName })
    // §6.1 케이스 A: 다른 저장소로 전환하면 이전 저장소의 커밋 hash로 git
    // 명령을 시도하게 되므로 선택을 지운다(keepSelection 기본값 false).
    await get().loadCommitsFirstPage()
  },

  reloadRepository: async () => {
    const { repository } = get()
    if (!repository.path) return

    set({ repository: { path: repository.path, status: 'validating' } })
    const validation = await api.repository.validate(repository.path)
    if (!validation.valid) {
      set({ repository: { path: repository.path, status: 'invalid', error: validation.error } })
      return
    }

    set({ repository: { path: repository.path, status: 'valid' } })
    const [branches, remoteProjectName] = await Promise.all([
      api.git.listBranches(repository.path),
      api.git.getRemoteProjectName(repository.path)
    ])
    // RT-55(U-15) — Reload는 "같은 저장소를 다시 읽는 것"이 아니라 전체
    // 초기화다(REQ-015 정정). 예전엔 Branch가 여전히 존재하면 그대로
    // 유지·선택도 유지(loadCommitsFirstPage(true))했지만, 이제 Reload는
    // 조회 조건·선택·분석 결과를 전부 기본값으로 되돌리고 재조회한다 —
    // 유지하는 건 파일 패턴 이력·Export 경로/방식·접힘 상태·분할 비율·
    // 트리 펼침뿐이다(M-22, 각자 다른 slice/컴포넌트 로컬 상태라 여기서
    // 건드릴 필요가 없다). 열려 있는 팝업을 닫는 것도 별도 처리가
    // 필요없다 — WorkArea가 이미 repository.status==='validating' 전환을
    // 감지해 닫는다(RT-43). 확인 대화상자는 두지 않는다(M-24).
    const selectedBranch = pickDefaultBranch(branches)
    get().resetQuery()
    get().clearSelection()
    get().resetAnalysis()
    set({ branches, selectedBranch, remoteProjectName })
    await get().loadCommitsFirstPage(false)
  },

  setBranch: async (branch) => {
    set({ selectedBranch: branch })
    // §6.1 케이스 B: 서로 다른 Branch의 커밋이 한 Export에 섞이는 걸
    // 막기 위해 Branch 전환 시 선택을 지운다(keepSelection 기본값 false).
    await get().loadCommitsFirstPage()
  }
})
