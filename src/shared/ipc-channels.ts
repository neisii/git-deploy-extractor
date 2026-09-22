// RT-20(S6): IPC 채널명과 각 채널의 params/result 타입을 여기 한 곳에
// 정의한다. 이전에는 채널명 문자열 리터럴이 main/ipc/handlers.ts ·
// preload/index.ts · preload/index.d.ts 세 곳에 각자 따로 적혀 있어서
// 채널을 추가하거나 시그니처를 바꿀 때 세 곳을 손으로 맞춰야 했다(하나만
// 놓쳐도 런타임에야 드러남). 이제 세 파일 모두 아래 `IpcChannelMap`을
// 참조하므로, 채널명 오타나 세 곳 사이의 시그니처 불일치는 컴파일 타임에
// 잡힌다.

import type {
  BuildPackageParams,
  BuildPackageResult,
  CheckUpdateResult,
  DependencyAnalysisRequest,
  DependencyAnalysisResult,
  DeployPlan,
  ListCommitsParams,
  ListCommitsResult,
  ManualFileEntry,
  PreviewRequest,
  RepositoryValidation,
  ResolveManualFileRequest
} from './types'

export interface IpcChannelMap {
  'app:getVersion': { params: []; result: string }
  'repository:browse': { params: []; result: string | null }
  'repository:validate': { params: [repoPath: string]; result: RepositoryValidation }
  'git:listBranches': { params: [repoPath: string]; result: string[] }
  'git:listCommits': { params: [params: ListCommitsParams]; result: ListCommitsResult }
  'git:getRemoteProjectName': { params: [repoPath: string]; result: string | null }
  'git:listTrackedFiles': { params: [repoPath: string, branch: string]; result: string[] }
  'mapping:listProfiles': { params: []; result: string[] }
  'analysis:preview': { params: [req: PreviewRequest]; result: DeployPlan }
  'analysis:dependencies': {
    params: [req: DependencyAnalysisRequest]
    result: DependencyAnalysisResult
  }
  'analysis:resolveManualFile': {
    params: [req: ResolveManualFileRequest]
    result: ManualFileEntry
  }
  'package:browseExportDir': { params: []; result: string | null }
  'package:export': { params: [params: BuildPackageParams]; result: BuildPackageResult | null }
  'update:check': { params: []; result: CheckUpdateResult }
  'update:confirmAndOpen': { params: []; result: boolean }
}

export type IpcChannel = keyof IpcChannelMap

// ipcMain.handle/ipcRenderer.invoke 호출부에서 채널명을 다시 문자열
// 리터럴로 적지 않고 이 상수를 거치게 한다 — 오타는 `IpcChannelMap`에
// 없는 키를 참조하는 순간 타입 에러가 된다.
export const IPC_CHANNELS: { [K in IpcChannel]: K } = {
  'app:getVersion': 'app:getVersion',
  'repository:browse': 'repository:browse',
  'repository:validate': 'repository:validate',
  'git:listBranches': 'git:listBranches',
  'git:listCommits': 'git:listCommits',
  'git:getRemoteProjectName': 'git:getRemoteProjectName',
  'git:listTrackedFiles': 'git:listTrackedFiles',
  'mapping:listProfiles': 'mapping:listProfiles',
  'analysis:preview': 'analysis:preview',
  'analysis:dependencies': 'analysis:dependencies',
  'analysis:resolveManualFile': 'analysis:resolveManualFile',
  'package:browseExportDir': 'package:browseExportDir',
  'package:export': 'package:export',
  'update:check': 'update:check',
  'update:confirmAndOpen': 'update:confirmAndOpen'
}
