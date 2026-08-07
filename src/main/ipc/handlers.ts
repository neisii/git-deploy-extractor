import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { validateRepository, listBranches } from '../git/repository'
import { listCommits } from '../git/commits'
import { listProfileNames, loadProfile } from '../mapping/profileStore'
import { computeDeployPlan } from '../analysis/computeDeployPlan'
import { analyzeDependencies } from '../analysis/dependencyAnalysis'
import { buildPackage, getDeployDir, deployDirHasContent } from '../package/buildPackage'
import type {
  BuildPackageParams,
  BuildPackageResult,
  DependencyAnalysisRequest,
  ListCommitsParams,
  PreviewRequest
} from '../../shared/types'

export function getProfilesDir(): string {
  return join(app.getPath('userData'), 'profiles')
}

export function registerIpcHandlers(): void {
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
}
