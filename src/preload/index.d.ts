import { ElectronAPI } from '@electron-toolkit/preload'
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
} from '../shared/types'

export interface Api {
  app: {
    getVersion: () => Promise<string>
  }
  repository: {
    browse: () => Promise<string | null>
    validate: (repoPath: string) => Promise<RepositoryValidation>
  }
  git: {
    listBranches: (repoPath: string) => Promise<string[]>
    listCommits: (params: ListCommitsParams) => Promise<ListCommitsResult>
    getRemoteProjectName: (repoPath: string) => Promise<string | null>
    listTrackedFiles: (repoPath: string, branch: string) => Promise<string[]>
  }
  mapping: {
    listProfiles: () => Promise<string[]>
  }
  analysis: {
    preview: (req: PreviewRequest) => Promise<DeployPlan>
    dependencies: (req: DependencyAnalysisRequest) => Promise<DependencyAnalysisResult>
    resolveManualFile: (req: ResolveManualFileRequest) => Promise<ManualFileEntry>
  }
  package: {
    browseExportDir: () => Promise<string | null>
    export: (params: BuildPackageParams) => Promise<BuildPackageResult | null>
  }
  update: {
    check: () => Promise<CheckUpdateResult>
    confirmAndOpen: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
