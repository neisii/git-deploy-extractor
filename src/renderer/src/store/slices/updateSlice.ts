import type { StateCreator } from 'zustand'
import {
  loadUpdateCheckCache,
  saveUpdateCheckCache,
  isUpdateCheckCacheStale
} from '../../lib/updateCheckCache'
import { api } from '../../api'
import type { AppState } from '../appStore'

const initialUpdateCache = loadUpdateCheckCache()

// 연속 클릭 가드(DR-016) — Electron 네이티브 확인창이 이미 떠 있는 동안
// 다시 클릭해도 새 확인창을 띄우지 않는다. 모듈 레벨 변수로 두는 이유:
// 이 값 자체는 UI에 표시되지 않는 순수 가드용 플래그라 굳이 store
// state로 만들 이유가 없다.
let updateDialogOpen = false

// RT-31(S1) — appStore.ts에서 업데이트 확인(REQ-017/DR-016) 상태·액션만
// 분리한 슬라이스. 다른 슬라이스와 상태를 주고받지 않는 완전히 독립적인
// 기능이라 cross-slice 의존이 없다.
export interface UpdateSlice {
  // REQ-017/DR-016 — updateInfo가 null이면 "확인 안 됨/직전 캐시 없이 실패".
  // updateChecking과는 독립적으로 갱신된다(재확인 중에도 직전 값을 그대로
  // 보여주며 스피너만 추가). hasUpdate는 "다르다"가 아니라 "원격이 로컬보다
  // 엄격히 크다" — Main(checkForUpdate)이 이미 이 판정까지 끝내서 반환한다.
  updateInfo: { hasUpdate: boolean; latestVersion: string } | null
  updateChecking: boolean
  appVersion: string // REQ-017 버전 배지 텍스트. update:check 캐시가 신선하면 그건 아예 안 불리므로 별도 채널로 가져온다

  initUpdateCheck: () => Promise<void>
  clickUpdateBadge: () => void
  loadAppVersion: () => Promise<void>
}

export const createUpdateSlice: StateCreator<AppState, [], [], UpdateSlice> = (set, get) => {
  // REQ-017/DR-016. 캐시 나이와 무관하게 항상 실제로 호출한다(캐시
  // 게이트는 호출자 쪽 책임 — initUpdateCheck는 만료 시에만, clickUpdateBadge는
  // 항상 이 함수를 부른다). 이미 진행 중이면 새로 호출하지 않고 조용히
  // 반환한다 — 연속 클릭 시 중복 API 호출을 막기 위함.
  async function performUpdateCheck(): Promise<void> {
    if (get().updateChecking) return
    set({ updateChecking: true })
    try {
      const result = await api.update.check()
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
    // 캐시가 있으면 그 값으로 동기 초기화한다(splitRatio/columnWidths와 동일
    // 패턴) — 마운트 후 비동기로 채우면 첫 렌더링에 배지가 "평시"로 잠깐
    // 반짝이는 깜빡임이 생긴다(RISK_ISSUES.md 결정 이력 #35).
    updateInfo: initialUpdateCache
      ? { hasUpdate: initialUpdateCache.hasUpdate, latestVersion: initialUpdateCache.latestVersion }
      : null,
    updateChecking: false,
    appVersion: '',

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
        void api.update.confirmAndOpen().finally(() => {
          updateDialogOpen = false
        })
      }
      // performUpdateCheck 자신이 updateChecking 가드를 갖고 있어, 이미
      // 진행 중이면 여기서 다시 호출해도 조용히 무시된다.
      void performUpdateCheck()
    },

    loadAppVersion: async () => {
      const version = await api.app.getVersion()
      set({ appVersion: version })
    }
  }
}
