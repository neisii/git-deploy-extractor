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
    const currentBranch = get().selectedBranch
    const selectedBranch =
      currentBranch && branches.includes(currentBranch)
        ? currentBranch
        : pickDefaultBranch(branches)
    set({ branches, selectedBranch, remoteProjectName })
    // A/B 어느 쪽에도 해당하지 않는다 — 같은 저장소를 다시 읽는 것뿐이라
    // (Branch가 그대로 존재하면 그대로 유지) 선택을 지울 이유가 없다.
    await get().loadCommitsFirstPage(true)
  },

  setBranch: async (branch) => {
    set({ selectedBranch: branch })
    // §6.1 케이스 B: 서로 다른 Branch의 커밋이 한 Export에 섞이는 걸
    // 막기 위해 Branch 전환 시 선택을 지운다(keepSelection 기본값 false).
    await get().loadCommitsFirstPage()
  }
})
