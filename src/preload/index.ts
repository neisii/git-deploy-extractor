import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BuildPackageParams,
  BuildPackageResult,
  CheckUpdateResult,
  DependencyAnalysisRequest,
  DependencyAnalysisResult,
  DeployPlan,
  ListCommitsParams,
  ListCommitsResult,
  PreviewRequest,
  RepositoryValidation
} from '../shared/types'

// Custom APIs for renderer
const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  repository: {
    browse: (): Promise<string | null> => ipcRenderer.invoke('repository:browse'),
    validate: (repoPath: string): Promise<RepositoryValidation> =>
      ipcRenderer.invoke('repository:validate', repoPath)
  },
  git: {
    listBranches: (repoPath: string): Promise<string[]> =>
      ipcRenderer.invoke('git:listBranches', repoPath),
    listCommits: (params: ListCommitsParams): Promise<ListCommitsResult> =>
      ipcRenderer.invoke('git:listCommits', params),
    getRemoteProjectName: (repoPath: string): Promise<string | null> =>
      ipcRenderer.invoke('git:getRemoteProjectName', repoPath)
  },
  mapping: {
    listProfiles: (): Promise<string[]> => ipcRenderer.invoke('mapping:listProfiles')
  },
  analysis: {
    preview: (req: PreviewRequest): Promise<DeployPlan> =>
      ipcRenderer.invoke('analysis:preview', req),
    dependencies: (req: DependencyAnalysisRequest): Promise<DependencyAnalysisResult> =>
      ipcRenderer.invoke('analysis:dependencies', req)
  },
  package: {
    browseExportDir: (): Promise<string | null> => ipcRenderer.invoke('package:browseExportDir'),
    export: (params: BuildPackageParams): Promise<BuildPackageResult | null> =>
      ipcRenderer.invoke('package:export', params)
  },
  update: {
    check: (): Promise<CheckUpdateResult> => ipcRenderer.invoke('update:check'),
    confirmAndOpen: (): Promise<boolean> => ipcRenderer.invoke('update:confirmAndOpen')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
