import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { validateRepository, listBranches, getRemoteProjectName } from '../git/repository'
import { listCommits } from '../git/commits'
import { listTrackedFiles } from '../git/lsTree'
import { listProfileNames, loadProfile } from '../mapping/profileStore'
import { resolveServerPath } from '../mapping/resolveServerPath'
import { computeDeployPlan } from '../analysis/computeDeployPlan'
import { analyzeDependencies } from '../analysis/dependencyAnalysis'
import { buildPackage, getDeployDir, deployDirHasContent } from '../package/buildPackage'
import { checkForUpdate } from '../update/checkForUpdate'
import type {
  BuildPackageParams,
  BuildPackageResult,
  CheckUpdateResult,
  DependencyAnalysisRequest,
  ListCommitsParams,
  ManualFileEntry,
  PreviewRequest,
  ResolveManualFileRequest
} from '../../shared/types'

// REQ-017: 클릭 시 항상 이 고정 인덱스 URL만 연다 — 특정 릴리스 태그로
// 딥링크하지 않는다(DETAILED_DESIGN.md §10.5).
const RELEASES_URL = 'https://github.com/neisii/git-deploy-extractor/releases'

export function getProfilesDir(): string {
  return join(app.getPath('userData'), 'profiles')
}

export function registerIpcHandlers(): void {
  // REQ-017: 버전 배지에 항상 표시할 현재 앱 버전. update:check는 캐시가
  // 신선하면 아예 호출되지 않으므로, 배지 텍스트 자체는 이 별도 채널로
  // 가져온다.
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('repository:browse', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('repository:validate', (_event, repoPath: string) => {
    return validateRepository(repoPath)
  })

  ipcMain.handle('git:listBranches', (_event, repoPath: string) => {
    return listBranches(repoPath)
  })

  // RepositoryPanel 라벨 표시용 — remote가 없거나 파싱 실패하면
  // null(getRemoteProjectName 자체가 절대 throw하지 않는다). Renderer가
  // null이면 폴더명으로 폴백한다.
  // REQ-021: 배포 대상 파일 수동 추가 팝업의 자동완성 후보 풀 — 선택된
  // Branch의 HEAD 트리 전체 파일 목록. §7.2(dependencyAnalysis.ts)가 이미
  // 쓰는 것과 같은 함수를 pathPrefix 없이 호출한다(Java 한정 아님).
  ipcMain.handle('git:listTrackedFiles', (_event, repoPath: string, branch: string) => {
    return listTrackedFiles(repoPath, branch)
  })

  ipcMain.handle('git:getRemoteProjectName', (_event, repoPath: string) => {
    return getRemoteProjectName(repoPath)
  })

  ipcMain.handle('git:listCommits', (_event, params: ListCommitsParams) => {
    return listCommits(params)
  })

  ipcMain.handle('mapping:listProfiles', () => {
    return listProfileNames(getProfilesDir())
  })

  ipcMain.handle('analysis:preview', async (_event, req: PreviewRequest) => {
    const profile = await loadProfile(getProfilesDir(), req.profileName)
    return computeDeployPlan(req.repoPath, req.branch, req.commitHashes, profile)
  })

  // RISK_ISSUES.md §7.2: Preview 완료 직후 Renderer가 체이닝 호출한다
  // (별도 트리거 버튼 없음 — UI_UX_SPEC.md §2.6a 참고).
  ipcMain.handle('analysis:dependencies', async (_event, req: DependencyAnalysisRequest) => {
    const profile = await loadProfile(getProfilesDir(), req.profileName)
    return analyzeDependencies(req.repoPath, req.branch, req.includedLocalPaths, profile)
  })

  // REQ-021/DR-019: 팝업에서 후보 하나를 선택했을 때 Server Path를 계산한다
  // (§7.2 의존성 후보와 동일하게 Mapping Rule 엔진을 그대로 재사용). status는
  // 항상 'added'로 고정 — 사용자가 지정한 경로라 diff 기반 Added/Modified
  // 구분 개념이 없다(DETAILED_DESIGN.md §13.4).
  ipcMain.handle(
    'analysis:resolveManualFile',
    async (_event, req: ResolveManualFileRequest): Promise<ManualFileEntry> => {
      const profile = await loadProfile(getProfilesDir(), req.profileName)
      return {
        localPath: req.localPath,
        serverPath: resolveServerPath(req.localPath, profile),
        status: 'added'
      }
    }
  )

  // RISK_ISSUES.md §7.1: Export 결과물을 저장할 부모 디렉터리 선택.
  // repository:browse와 동일한 방식(OS 네이티브 폴더 다이얼로그)이지만
  // 의미가 다른 별도 채널로 분리한다(저장소 선택 vs Export 위치 선택).
  ipcMain.handle('package:browseExportDir', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'package:export',
    async (_event, params: BuildPackageParams): Promise<BuildPackageResult | null> => {
      // §7.1 안전장치: 대상 폴더에 이미 내용이 있으면 확인 없이 덮어쓰지 않는다.
      const deployDir = getDeployDir(params.repoPath, params.exportParentDir)
      if (await deployDirHasContent(deployDir)) {
        const window = BrowserWindow.getFocusedWindow()
        const options = {
          type: 'warning' as const,
          buttons: ['취소', '계속'],
          defaultId: 0,
          cancelId: 0,
          message: '이미 있는 git-deploy-extracted를 덮어씁니다, 계속할까요?',
          detail: deployDir
        }
        const confirm = window
          ? await dialog.showMessageBox(window, options)
          : await dialog.showMessageBox(options)
        if (confirm.response === 0) return null
      }
      return buildPackage(params)
    }
  )

  ipcMain.handle('update:check', async (): Promise<CheckUpdateResult> => {
    return checkForUpdate()
  })

  // REQ-017: 클릭 시 뜨는 확인창. update:check(강제 재확인)와는 독립된
  // 흐름이라 그 응답을 기다리지 않는다(DETAILED_DESIGN.md §10.3) — Renderer가
  // 두 IPC를 동시에 호출한다.
  ipcMain.handle('update:confirmAndOpen', async (): Promise<boolean> => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      type: 'question' as const,
      buttons: ['아니오', '네'],
      defaultId: 1,
      cancelId: 0,
      message: 'GitHub 저장소를 여시겠습니까?',
      detail: RELEASES_URL
    }
    const confirm = window
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)
    if (confirm.response !== 1) return false
    await shell.openExternal(RELEASES_URL)
    return true
  })
}
