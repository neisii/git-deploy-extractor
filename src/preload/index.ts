import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, type IpcChannelMap } from '../shared/ipc-channels'

// RT-20(S6): 채널명 인자는 `IpcChannelMap`의 키로 제약되고 반환값도
// 채널별 result 타입으로 고정되므로, handlers.ts와 시그니처가 어긋나면
// 여기서 컴파일 타임에 잡힌다.
function invoke<C extends keyof IpcChannelMap>(
  channel: C,
  ...args: IpcChannelMap[C]['params']
): Promise<IpcChannelMap[C]['result']> {
  return ipcRenderer.invoke(channel, ...args)
}

// Custom APIs for renderer
const api = {
  app: {
    getVersion: () => invoke(IPC_CHANNELS['app:getVersion'])
  },
  repository: {
    browse: () => invoke(IPC_CHANNELS['repository:browse']),
    validate: (repoPath: string) => invoke(IPC_CHANNELS['repository:validate'], repoPath)
  },
  git: {
    listBranches: (repoPath: string) => invoke(IPC_CHANNELS['git:listBranches'], repoPath),
    listCommits: (params: IpcChannelMap['git:listCommits']['params'][0]) =>
      invoke(IPC_CHANNELS['git:listCommits'], params),
    getRemoteProjectName: (repoPath: string) =>
      invoke(IPC_CHANNELS['git:getRemoteProjectName'], repoPath),
    listTrackedFiles: (repoPath: string, branch: string) =>
      invoke(IPC_CHANNELS['git:listTrackedFiles'], repoPath, branch)
  },
  mapping: {
    listProfiles: () => invoke(IPC_CHANNELS['mapping:listProfiles'])
  },
  analysis: {
    preview: (req: IpcChannelMap['analysis:preview']['params'][0]) =>
      invoke(IPC_CHANNELS['analysis:preview'], req),
    dependencies: (req: IpcChannelMap['analysis:dependencies']['params'][0]) =>
      invoke(IPC_CHANNELS['analysis:dependencies'], req),
    resolveManualFile: (req: IpcChannelMap['analysis:resolveManualFile']['params'][0]) =>
      invoke(IPC_CHANNELS['analysis:resolveManualFile'], req)
  },
  package: {
    browseExportDir: () => invoke(IPC_CHANNELS['package:browseExportDir']),
    validateExportTarget: (params: IpcChannelMap['package:validateExportTarget']['params'][0]) =>
      invoke(IPC_CHANNELS['package:validateExportTarget'], params),
    export: (params: IpcChannelMap['package:export']['params'][0]) =>
      invoke(IPC_CHANNELS['package:export'], params)
  },
  update: {
    check: () => invoke(IPC_CHANNELS['update:check']),
    confirmAndOpen: () => invoke(IPC_CHANNELS['update:confirmAndOpen'])
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
