import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  BuildPackageParams,
  BuildPackageResult,
  DeployPlan,
  ListCommitsParams,
  ListCommitsResult,
  PreviewRequest,
  RepositoryValidation
} from '../shared/types'

export interface Api {
  repository: {
    browse: () => Promise<string | null>
    validate: (repoPath: string) => Promise<RepositoryValidation>
  }
  git: {
    listBranches: (repoPath: string) => Promise<string[]>
    listCommits: (params: ListCommitsParams) => Promise<ListCommitsResult>
  }
  mapping: {
    listProfiles: () => Promise<string[]>
  }
  analysis: {
    preview: (req: PreviewRequest) => Promise<DeployPlan>
  }
  package: {
    browseExportDir: () => Promise<string | null>
    export: (params: BuildPackageParams) => Promise<BuildPackageResult | null>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
