import type { StateCreator } from 'zustand'
import {
  loadExportMode,
  loadExportParentDir,
  saveExportMode,
  saveExportParentDir
} from '../../lib/exportPath'
import { createRequestGuard } from '../../lib/requestGuard'
import { buildExportFiles } from '../../services/exportPlan'
import { api } from '../../api'
import type { AppState } from '../appStore'
import { selectIsAnalysisStale } from './analysisSlice'
import type { ExportMode, ExportTargetValidation } from '../../../../shared/types'

// RT-16(U7) — "Export 완료: <경로>" 성공 메시지가 exportStatus를 바꾸는
// runExport 안에서만 리셋됐다. 커밋 선택이 바뀐 뒤에도 지난 Export의
// 완료 메시지가 그대로 남아있어 "방금 선택한 걸 내보냈다"처럼 보이는
// 문제(commitsSlice의 toggleCommit/toggleAllCommits에서 재사용하기 위해
// 여기서 export한다).
export const idleExportState = {
  exportStatus: 'idle' as const,
  exportError: null,
  lastExportDir: null
}

// revalidateExportTarget은 경로 선택·저장소 전환·모드 변경마다 다시
// 불려 서로 경합할 수 있다(§5.1 RT-56 — 검증 시점 4곳). 오래된 응답이
// 나중에 도착해 최신 상태를 덮어쓰지 않도록 requestGuard.ts(RT-11/17이
// 쓰던 것과 같은 패턴)로 세대를 구분한다.
const exportTargetGuard = createRequestGuard()

// RT-31(S1) — appStore.ts에서 Export 위치 선택 + 실제 내보내기 실행만
// 분리한 슬라이스.
export interface ExportSlice {
  // RISK_ISSUES.md §7.1: Export 결과물이 생성될 부모 디렉터리. null이면
  // "선택 안 됨"(RT-56/REQ-012 정정 — 저장소 루트 기본값 폐지, 경로를
  // 고를 때까지 Export가 막힌다). 지정하면 localStorage에 전역 저장되어
  // 다른 저장소를 열어도 유지된다.
  exportParentDir: string | null
  // RT-56(U-16) — 'sub'(하위 폴더 생성 후 추출, 기본값) | 'direct'(선택한
  // 경로에 바로 추출, 빈 폴더 전용). localStorage에 전역 저장(M-27).
  exportMode: ExportMode
  // NO_PATH/INSIDE_REPO/CONTAINS_REPO/NOT_EMPTY 판정 결과. null이면
  // 저장소가 아직 없거나 검증 전(초기 상태).
  exportTargetValidation: ExportTargetValidation | null

  exportStatus: 'idle' | 'exporting' | 'done' | 'error'
  exportError: string | null
  lastExportDir: string | null

  browseExportParentDir: () => Promise<void>
  setExportMode: (mode: ExportMode) => void
  // 경로 선택 직후·저장소 변경(Browse)/Reload 직후·모드 변경 시 호출해
  // exportTargetValidation을 다시 계산한다(§5.1 RT-56 검증 시점 ①~③).
  revalidateExportTarget: () => Promise<void>
  runExport: () => Promise<void>
}

export const createExportSlice: StateCreator<AppState, [], [], ExportSlice> = (set, get) => ({
  exportParentDir: loadExportParentDir(),
  exportMode: loadExportMode(),
  exportTargetValidation: null,

  ...idleExportState,

  browseExportParentDir: async () => {
    const path = await api.package.browseExportDir()
    if (!path) return
    saveExportParentDir(path)
    set({ exportParentDir: path })
    await get().revalidateExportTarget()
  },

  setExportMode: (mode) => {
    saveExportMode(mode)
    set({ exportMode: mode })
    void get().revalidateExportTarget()
  },

  revalidateExportTarget: async () => {
    const { repository, exportParentDir, exportMode } = get()
    const requestId = exportTargetGuard.start()

    if (!repository.path) {
      if (exportTargetGuard.isCurrent(requestId)) set({ exportTargetValidation: null })
      return
    }
    // 경로 미선택은 IPC 왕복 없이 즉시 판정할 수 있다(§5.1 RT-56 ①).
    if (!exportParentDir) {
      if (exportTargetGuard.isCurrent(requestId)) {
        set({
          exportTargetValidation: {
            ok: false,
            code: 'NO_PATH',
            message: '추출할 폴더를 선택하세요.'
          }
        })
      }
      return
    }

    const result = await api.package.validateExportTarget({
      repoPath: repository.path,
      exportParentDir,
      mode: exportMode
    })
    if (exportTargetGuard.isCurrent(requestId)) set({ exportTargetValidation: result })
  },

  runExport: async () => {
    const {
      repository,
      selectedBranch,
      selectedProfile,
      commits,
      selectedHashes,
      deployFiles,
      filePatterns,
      deleteList,
      warnings,
      exportParentDir,
      exportMode,
      exportTargetValidation
    } = get()
    if (!repository.path || !selectedBranch || selectedHashes.size === 0) return
    // UI에서 이미 stale/경로 미검증일 때 버튼을 비활성화하지만, 이중
    // 방어로 한 번 더 막는다(Main이 Export 직전 재검증하는 것과 별개로,
    // 불필요한 IPC 호출 자체를 줄인다).
    if (selectIsAnalysisStale(get())) return
    if (exportTargetValidation !== null && !exportTargetValidation.ok) return

    set({ exportStatus: 'exporting', exportError: null })
    try {
      const result = await api.package.export({
        repoPath: repository.path,
        branch: selectedBranch,
        mappingProfileName: selectedProfile,
        selectedCommits: commits.filter((c) => selectedHashes.has(c.hash)),
        // 어떤 파일이 실제 Export 대상인지의 판정 로직(REQ-019/DR-018)은
        // services/exportPlan.ts에 있다(RT-33).
        files: buildExportFiles(deployFiles, filePatterns),
        deletedServerPaths: deleteList.map((d) => d.path),
        warnings,
        exportParentDir: exportParentDir ?? undefined,
        mode: exportMode
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
  }
})
