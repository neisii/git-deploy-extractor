import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { validateRepository, listBranches } from '../git/repository'
import { listCommits } from '../git/commits'
import { listProfileNames, loadProfile } from '../mapping/profileStore'
import { computeDeployPlan } from '../analysis/computeDeployPlan'
import { buildPackage } from '../package/buildPackage'
import type { BuildPackageParams, ListCommitsParams, PreviewRequest } from '../../shared/types'

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

  ipcMain.handle('package:export', (_event, params: BuildPackageParams) => {
    return buildPackage(params)
  })
}
