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

// RISK_ISSUES.md §7.3 — 메시지 검색(`git log --grep`)과 파일명 검색(HEAD
// 트리 파일명 부분 일치 → pathspec)은 완전히 다른 git 경로라 모드로 분리한다.
export type CommitSearchMode = 'message' | 'filename'

export interface ListCommitsParams {
  repoPath: string
  branch: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  maxCount: number
  skip: number
  pageSize: number
  searchMode?: CommitSearchMode // 기본 'message'
  // RT-48(U-8) — 키워드 필드(줄바꿈 구분, `-` 접두는 제외)를 파싱한 결과.
  // message 모드: 둘 다 하나의 `-P`(PCRE) `--grep` 패턴으로 결합
  // (포함 OR · 제외 OR · 둘 다 있으면 AND, `main/git/keywordGrep.ts`
  // 참고). filename 모드: includeKeywords만 파일명 부분 일치 OR로 쓰고
  // excludeKeywords는 무시한다(§5.1 RT-48).
  includeKeywords?: string[]
  excludeKeywords?: string[]
  // REQ-022 — 작성자명 부분 일치(대소문자 무관). 여러 개면 OR(하나라도
  // 일치하면 포함) — includeKeywords/excludeKeywords와는 독립적으로 AND 결합된다.
  // 2026-09-14부터 REQ-023 해시 필터와 동일하게 여러 줄 입력을 지원한다.
  authors?: string[]
  // REQ-022 — Merge 커밋 제외 (git --no-merges와 동일). 기본 false(포함).
  excludeMerges?: boolean
  // REQ-023 — 값이 있으면 branch/기간/검색어/authors/excludeMerges 등 다른
  // 모든 조건을 무시하고, 이 해시 목록과 정확히 일치하는 커밋만 반환한다
  // (git이 인정하는 축약 해시 포함).
  hashFilter?: string[]
}

export interface ListCommitsResult {
  commits: CommitEntry[]
  hasMore: boolean
  // RT-10(M-5) — hashFilter 중 16진수 형식이 아니라 걸러진 항목들. 해시
  // 필터를 쓰지 않았거나 전부 유효하면 undefined.
  invalidHashes?: string[]
}

// RT-56(U-16) — 'sub': <exportParentDir>/git-deploy-extracted 하위에 생성
// (기존 방식, 기본값). 'direct': exportParentDir에 바로 생성(빈 폴더
// 전용, a안 — DETAILED_DESIGN.md §5.1 RT-56).
export type ExportMode = 'sub' | 'direct'

export interface BuildPackageParams {
  repoPath: string
  branch: string
  selectedCommits: CommitEntry[] // extract-list.txt 머리말의 원본 커밋 목록(RT-57)에도 쓰인다
  files: DeployPlanFile[] // Mapping Rule이 이미 적용된 상태 (computeDeployPlan 출력)
  deletedServerPaths: string[]
  exportParentDir?: string // 사용자가 지정한 부모 디렉터리. 미지정 시 repoPath가 기본값 (RISK_ISSUES.md §7.1)
  mode: ExportMode
}

// RT-56 — package:validateExportTarget 요청/응답. classifyExportTarget이
// 판정한 저장소 겹침(INSIDE_REPO/CONTAINS_REPO)과 direct 모드의 "폴더가
// 비어 있지 않음"(NOT_EMPTY), 경로 미선택(NO_PATH)을 한 값으로 합친다 —
// 검사 우선순위(①경로 미선택 ②겹침 ③비어있지 않음)는 호출 순서로 이미
// 반영돼 있어 호출부가 다시 고를 필요가 없다.
export interface ValidateExportTargetParams {
  repoPath: string
  exportParentDir?: string
  mode: ExportMode
}

export type ExportTargetErrorCode = 'NO_PATH' | 'INSIDE_REPO' | 'CONTAINS_REPO' | 'NOT_EMPTY'

export type ExportTargetValidation =
  { ok: true } | { ok: false; code: ExportTargetErrorCode; message: string }

export interface BuildPackageResult {
  deployDir: string
}

export interface PreviewRequest {
  repoPath: string
  branch: string
  commitHashes: string[]
  profileName: string
}

// RISK_ISSUES.md §7.2 — 의존성 완결성 검사 (Java/Spring 단일 모듈 전용)
export type JavaDependencyKind = 'interface' | 'class'

// DeployPlanFile과 같은 모양(localPath/serverPath/status)에 kind만 추가한
// 것 — "전체 추가" 시 그대로 deployFiles 배열에 이어붙일 수 있도록
// Mapping Rule까지 이미 적용된 상태로 내려준다(추가 IPC 왕복 없이).
export interface DependencyCandidate {
  localPath: string
  serverPath: string
  status: DeployFileStatus
  kind: JavaDependencyKind
}

export interface DependencyAnalysisResult {
  applicable: boolean
  // applicable=false일 때 이유(Java 파일 없음/@SpringBootApplication 못 찾음 등).
  // applicable=true일 때도 참고용으로 채워질 수 있다(예: 파싱 실패 파일 존재).
  reason?: string
  basePackage?: string
  missingDependencies: DependencyCandidate[]
  parseWarnings: AnalysisWarning[]
}

export interface DependencyAnalysisRequest {
  repoPath: string
  branch: string
  includedLocalPaths: string[] // Preview로 계산된 deployFiles 전체의 localPath (§7.2 point 1 "선택된 파일들")
  profileName: string // Server Path 계산에 Mapping Rule 엔진을 재사용하기 위함
}

// REQ-021/DR-019 — 배포 대상 파일 수동 추가. DependencyCandidate와 같은
// 모양(localPath/serverPath/status)이지만 kind가 없다 — 알고리즘 추천이
// 아니라 사용자가 직접 지정한 경로라 "인터페이스/구현체" 같은 분류 개념이
// 없다. status는 항상 'added'로 고정한다(DETAILED_DESIGN.md §13.4).
export interface ManualFileEntry {
  localPath: string
  serverPath: string
  status: DeployFileStatus
}

export interface ResolveManualFileRequest {
  repoPath: string
  branch: string
  profileName: string
  localPath: string
}

// REQ-017/DR-016 — html_url(특정 태그 딥링크)은 담지 않는다. 클릭 시 항상
// 고정된 릴리스 인덱스 URL만 열도록 확정되어 있어 필요 없다
// (DETAILED_DESIGN.md §10.5, RISK_ISSUES.md 결정 이력 #35).
// hasUpdate 판정(원격이 로컬보다 엄격히 큰지)까지 Main에서 끝내서 반환한다 —
// app.getVersion()이 이미 Main에 있으니 Renderer에 따로 노출할 이유가 없다
// (§10.5 "더 단순한 쪽으로 정한다"에 따른 구현 시점 단순화).
export type CheckUpdateResult =
  { ok: true; hasUpdate: boolean; latestVersion: string } | { ok: false }
