import type { StateCreator } from 'zustand'
import { loadExportParentDir, saveExportParentDir } from '../../lib/exportPath'
import { matchesAnyActiveExcludePattern } from '../../lib/excludePatternMatch'
import { api } from '../../api'
import type { AppState } from '../appStore'
import { selectIsAnalysisStale } from './analysisSlice'

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

// RT-31(S1) — appStore.ts에서 Export 위치 선택 + 실제 내보내기 실행만
// 분리한 슬라이스.
export interface ExportSlice {
  // RISK_ISSUES.md §7.1: Export 결과물이 생성될 부모 디렉터리. null이면
  // 저장소 루트가 기본값(Package Builder가 repoPath로 대체). 지정하면
  // localStorage에 전역 저장되어 다른 저장소를 열어도 유지된다.
  exportParentDir: string | null

  exportStatus: 'idle' | 'exporting' | 'done' | 'error'
  exportError: string | null
  lastExportDir: string | null

  browseExportParentDir: () => Promise<void>
  runExport: () => Promise<void>
}

export const createExportSlice: StateCreator<AppState, [], [], ExportSlice> = (set, get) => ({
  exportParentDir: loadExportParentDir(),

  ...idleExportState,

  browseExportParentDir: async () => {
    const path = await api.package.browseExportDir()
    if (!path) return
    saveExportParentDir(path)
    set({ exportParentDir: path })
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
      const result = await api.package.export({
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
  }
})
