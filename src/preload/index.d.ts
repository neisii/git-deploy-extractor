import { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcChannelMap } from '../shared/ipc-channels'

// RT-20(S6): 각 메서드의 파라미터/반환 타입은 shared/ipc-channels.ts의
// `IpcChannelMap`에서 그대로 끌어온다 — DTO를 여기서 다시 import하지
// 않는다.
type Params<C extends keyof IpcChannelMap> = IpcChannelMap[C]['params']
type Result<C extends keyof IpcChannelMap> = IpcChannelMap[C]['result']

export interface Api {
  app: {
    getVersion: () => Promise<Result<'app:getVersion'>>
  }
  repository: {
    browse: () => Promise<Result<'repository:browse'>>
    validate: (...args: Params<'repository:validate'>) => Promise<Result<'repository:validate'>>
  }
  git: {
    listBranches: (...args: Params<'git:listBranches'>) => Promise<Result<'git:listBranches'>>
    listCommits: (...args: Params<'git:listCommits'>) => Promise<Result<'git:listCommits'>>
    getRemoteProjectName: (
      ...args: Params<'git:getRemoteProjectName'>
    ) => Promise<Result<'git:getRemoteProjectName'>>
    listTrackedFiles: (
      ...args: Params<'git:listTrackedFiles'>
    ) => Promise<Result<'git:listTrackedFiles'>>
  }
  mapping: {
    listProfiles: () => Promise<Result<'mapping:listProfiles'>>
  }
  analysis: {
    preview: (...args: Params<'analysis:preview'>) => Promise<Result<'analysis:preview'>>
    dependencies: (
      ...args: Params<'analysis:dependencies'>
    ) => Promise<Result<'analysis:dependencies'>>
    resolveManualFile: (
      ...args: Params<'analysis:resolveManualFile'>
    ) => Promise<Result<'analysis:resolveManualFile'>>
  }
  package: {
    browseExportDir: () => Promise<Result<'package:browseExportDir'>>
    validateExportTarget: (
      ...args: Params<'package:validateExportTarget'>
    ) => Promise<Result<'package:validateExportTarget'>>
    export: (...args: Params<'package:export'>) => Promise<Result<'package:export'>>
  }
  update: {
    check: () => Promise<Result<'update:check'>>
    confirmAndOpen: () => Promise<Result<'update:confirmAndOpen'>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
