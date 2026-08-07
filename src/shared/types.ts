// Main Process(git 연동, 분석 엔진)와 Renderer(UI) 양쪽에서 모두 쓰는 타입.
// IPC 경계를 넘나드는 데이터 모양만 여기 둔다 — Main 내부 전용 타입(예:
// GitCommandResult)은 각 모듈 자리에 그대로 둔다.

export interface CommitEntry {
  hash: string
  author: string
  date: string
  message: string
}

export interface MappingOverride {
  from: string // 정확한 Local Path (저장소 루트 기준 상대경로, 와일드카드 없음)
  to: string // 정확한 Server Path
  description?: string
}

export interface MappingProfile {
  profileName: string
  version: string
  overrides: MappingOverride[]
}

export type DeployFileStatus = 'added' | 'modified'

// Mapping Rule까지 적용을 마친, Preview/Export가 공통으로 쓰는 파일 항목
export interface DeployPlanFile {
  localPath: string
  serverPath: string
  status: DeployFileStatus
}

export interface AnalysisWarning {
  path: string
  reason: string
}

export interface DeployPlanSummary {
  files: number
  added: number
  modified: number
  deleted: number
}

export interface DeployPlan {
  files: DeployPlanFile[]
  deletedServerPaths: string[]
  warnings: AnalysisWarning[]
  summary: DeployPlanSummary
}

export interface RepositoryValidation {
  valid: boolean
  error?: string
}

export interface ListCommitsParams {
  repoPath: string
  branch: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  maxCount: number
  skip: number
  pageSize: number
  searchTerm?: string
}

export interface ListCommitsResult {
  commits: CommitEntry[]
  hasMore: boolean
}

export interface BuildPackageParams {
  repoPath: string
  branch: string
  mappingProfileName: string
  selectedCommits: CommitEntry[]
  files: DeployPlanFile[] // Mapping Rule이 이미 적용된 상태 (computeDeployPlan 출력)
  deletedServerPaths: string[]
  warnings: AnalysisWarning[]
  exportParentDir?: string // 사용자가 지정한 부모 디렉터리. 미지정 시 repoPath가 기본값 (RISK_ISSUES.md §7.1)
}

export interface DeploySummary {
  generatedAt: string
  repository: string
  branch: string
  mappingProfile: string
  commits: CommitEntry[]
  summary: DeployPlanSummary
  files: DeployPlanFile[]
  deleted: string[]
  warnings: AnalysisWarning[]
}

export interface BuildPackageResult {
  deployDir: string
  summary: DeploySummary
}

export interface PreviewRequest {
  repoPath: string
  branch: string
  commitHashes: string[]
  profileName: string
}
