# Git Deploy Extractor UI/UX 명세

> Version: 0.1
> Status: Draft
> 기준 문서: REQUIREDMENT.md §8, ARCHITECTURE.md §4.5

REQUIREDMENT.md 8번 섹션 와이어프레임을 컴포넌트/상태/인터랙션 단위로 확장한다. 이 앱은 단일 화면 유틸리티이므로(다중 페이지 라우팅 없음), 화면 전체를 하나의 컴포넌트 트리로 정의한다.

---

# 0. 이 문서에서 발견해 확정한 사항 (REQUIREDMENT.md 미명시 gap)

와이어프레임을 컴포넌트 단위로 쪼개는 과정에서 REQUIREDMENT.md에 명시되지 않은 모호한 지점 3개를 발견했고, 아래와 같이 확정했다(2026-08-04, 사용자 확인 완료).

| # | 발견한 모호함 | 확정한 내용 |
|---|---|---|
| 1 | 상단 타이틀바의 `contract2/main ▼`와 "Branch :" 행의 `contract2/main ▼`가 와이어프레임에 중복 등장 | **채택**: 인터랙티브 컨트롤은 "Branch :" 행 하나만, 타이틀바는 읽기 전용 텍스트 |
| 2 | Deploy Files 목록의 체크박스(`☑`)가 표시용인지 조작 가능한지 REQ에 명시 없음 | **확정**: 인터랙티브. 실제로 필요한 파일만 선택해서 추출할 수 있어야 하기 때문. **전체 선택/해제 토글도 추가** → REQ-011로 REQUIREDMENT.md에 반영 완료 |
| 3 | `[Preview] [Export] [Build]` 세 버튼의 차이가 REQUIREDMENT.md에 없음 | **[Build] 버튼 제거, 2버튼 구조로 확정**: Preview=배포될 디렉터리 구조와 파일 목록을 보여주는 확인 단계(부작용 없음) / Export=Preview에서 확인한 내용 그대로 실제 추출(파일 복사 + deploy/ 생성 + txt/json 산출물까지 전부, 기존 "Build"가 하던 일을 흡수). 근거: REQUIREDMENT.md 원본 와이어프레임에 있던 `[Build]`는 "코드 컴파일"이 아니라 "배포 패키지 조립"을 뜻했는데(DR-011이 이미 컴파일은 범위 밖으로 확정), 사용자가 의도한 건 애초에 Preview/Export 2단계 구조였음 |

**시각 자료**: 위 3가지를 그림으로 정리한 자료 — `ambiguity-explainer.html` (같은 프로젝트 루트에 위치)

---

# 1. 컴포넌트 트리

```
AppShell
├── TitleBar                     (읽기 전용 상태 표시)
├── RepositoryPanel               (저장소 선택/새로고침)
├── BranchSearchBar               (브랜치 선택 + 커밋 검색)
├── MainGrid
│   ├── CommitListPanel           (좌: 커밋 목록, 다중 선택)
│   └── DeploymentPreviewPanel    (우: 집계 미리보기, 읽기 전용)
├── DeployFilesPanel              (배포 대상 파일 목록 + 개별/전체 선택)
├── DeleteListPanel               (삭제 대상 목록, 읽기 전용)
└── FooterActionBar               (Mapping Profile 선택 + Preview/Export)
```

---

# 2. 컴포넌트 정의

## 2.1 TitleBar

**책임**: 앱 이름과 현재 저장소/브랜치를 요약해서 보여준다. 인터랙티브 컨트롤 없음(§0-1 결정).

- 표시: `Git Deploy Extractor — {repository 폴더명} / {selectedBranch}` (미선택 시 `—`)

## 2.2 RepositoryPanel

**책임**: REQ-001. 저장소 경로 선택 및 유효성 검사.

| 요소 | 동작 |
|---|---|
| 경로 표시 텍스트 | `repository.path` 표시, 미선택 시 placeholder("저장소를 선택하세요") |
| `[Browse...]` | OS 폴더 선택 다이얼로그(Electron `dialog.showOpenDialog`, Main Process) → 선택 시 유효성 검사 IPC 호출 |
| `[Reload]` | 현재 경로로 유효성 재검사 + 브랜치 목록/커밋 목록 전체 리셋 후 재조회 |

**상태**: `repository: { path: string | null; status: 'idle' | 'validating' | 'valid' | 'invalid'; error?: string }`

## 2.3 BranchSearchBar

**책임**: REQ-002, REQ-003(Search + 조회 범위).

| 요소 | 동작 |
|---|---|
| Branch dropdown | `branches: string[]` 표시. `branches` 로드 완료 시 `main` 우선, 없으면 `master`를 `selectedBranch`에 자동 설정(REQ-002). 사용자가 변경하면 `selectedBranch` 갱신 + CommitListPanel 리셋(첫 페이지부터 재조회) |
| Search 입력 | 로컬 텍스트 상태. 입력 300ms 디바운스 후 자동 검색 트리거(`git log --grep`) |
| `[Search]` 버튼 | 디바운스를 기다리지 않고 즉시 검색 트리거 (보조 수단) |
| "조회 기간 : [시작일] ~ [종료일]" 날짜 선택 | `startDate`/`endDate` 갱신. 변경 시 CommitListPanel 리셋 후 재조회(REQ-003, 기본값 오늘-7일 ~ 오늘) |
| "최대 [N] 개" 입력 | `maxCount` 갱신. 변경 시 CommitListPanel 리셋 후 재조회(REQ-003, 기본값 100). 이 값이 무한 스크롤의 상한선 — 스크롤이 `maxCount`에 도달하면 더 이상 다음 페이지를 요청하지 않는다 |

**상태**: `branches: string[]`, `selectedBranch: string | null`, `searchTerm: string`, `startDate: string`(기본 오늘-7일, `YYYY-MM-DD`), `endDate: string`(기본 오늘), `maxCount: number`(기본 100)

기본값(7일/100개)에서는 `maxCount`(100)와 CommitListPanel 페이지 크기(100, DETAILED_DESIGN.md §3.4)가 같아서 대부분 첫 페이지 한 번으로 끝난다. 사용자가 `maxCount`를 늘리면 그때부터 여러 페이지에 걸쳐 무한 스크롤이 동작한다. `endDate`는 종료일 하루 전체(23:59:59까지)를 포함한다 — git 쪽 시간 경계 처리는 DETAILED_DESIGN.md §3.2 참고.

## 2.4 CommitListPanel

**책임**: REQ-003, REQ-004. 가상 스크롤(react-window) 목록, 체크박스 다중 선택.

| 요소 | 동작 |
|---|---|
| 각 행 | 체크박스 + `hash`(mono) + `message`. 클릭 시 `selectedHashes` 토글 |
| 스크롤 하단 도달 | 다음 페이지 IPC 요청 (DETAILED_DESIGN.md §3.4, `pageSize=100`) |

**상태**: `commits: CommitEntry[]`, `selectedHashes: Set<string>`, `pagination: { hasMore: boolean; loading: boolean }`

**빈/로딩/에러 상태**: §5 참고.

## 2.5 DeploymentPreviewPanel

**책임**: REQ-005~007 계산 결과 집계를 읽기 전용으로 보여준다(Files/Added/Modified/Deleted — Renamed 없음, DR-008).

`selectedHashes`가 바뀔 때마다 500ms 디바운스 후 Commit 분석 엔진 IPC를 호출해 `summary`를 갱신한다. 계산 결과는 DeployFilesPanel/DeleteListPanel과 동일한 소스에서 파생되므로 세 컴포넌트는 항상 같은 계산 1회의 결과를 나눠서 보여준다(중복 계산 없음).

**상태**: `summary: { files, added, modified, deleted } | null`, `analyzing: boolean`

## 2.6 DeployFilesPanel

**책임**: REQ-007, REQ-008, REQ-011. 배포 대상 파일 목록(HEAD 최신본, Mapping Rule 적용 결과) + 개별/전체 파일 수동 제외.

| 요소 | 동작 |
|---|---|
| 헤더 "전체 선택" 체크박스 | 현재 **필터에 표시된 행 기준**으로 전체 체크/해제. 필터로 숨겨진 행은 건드리지 않는다. 표시된 행 일부만 체크된 상태면 indeterminate(가로줄) 표시 |
| Filter dropdown | `all \| added \| modified` (클라이언트 사이드 필터, 재계산 없음. `deleted`는 이 목록 대상이 아니므로 필터 옵션에서 제외. Rename을 별도 감지하지 않으므로 `renamed` 옵션도 없음 — DR-008) |
| 각 행 체크박스 | `included` 토글. 해제된 파일은 Export 시 deploy-files.txt와 실제 복사 대상에서 빠진다(REQ-011) |
| Local Path / Server Path 열 | `localPath`, `serverPath`(Mapping Rule 적용 후) 나란히 표시 |

**상태**: `deployFiles: { localPath: string; serverPath: string; status: 'added'|'modified'; included: boolean }[]`, `filter: 'all'|'added'|'modified'`

**가상 스크롤 임계값**: 필터링된 표시 대상이 **300개를 넘으면** CommitListPanel과 동일하게 react-window 가상 스크롤을 적용한다. 이 목록은 Commit List와 달리 페이지네이션 대상이 아니다 — 계산이 이미 한 번에 끝나 전체가 메모리에 있으므로 렌더링만 가상화하면 된다. 300개는 행 하나(체크박스+경로 2열, DOM 노드 약 4개) 기준 대략치이며, 실사용 데이터로 재조정 가능하다.

`전체 선택` 체크 상태는 별도 필드로 저장하지 않고 `deployFiles`에서 파생 계산한다(`filtered.every(f => f.included)` → checked, `filtered.some(f => f.included)` → indeterminate, 그 외 unchecked) — 상태 중복 저장으로 인한 불일치를 피하기 위함.

## 2.7 DeleteListPanel

**책임**: DR-007. 읽기 전용.

삭제된 파일의 Server Path를 그대로 나열한다. Rename을 별도로 감지하지 않으므로(DR-008), 이 목록에 있는 항목이 실제 삭제인지 Rename으로 인한 이전 이름인지 UI가 구분해주지 않는다 — DeployFilesPanel의 Added 목록과 함께 보고 사용자가 직접 판단한다.

**상태**: `deleteList: { path: string }[]`

## 2.8 FooterActionBar

**책임**: REQ-009, REQ-010. Mapping Profile 선택 + 실행 트리거. (§0-3 결정으로 2버튼 구조 — `[Build]` 없음)

| 요소 | 동작 |
|---|---|
| Mapping Profile dropdown | `profiles: string[]`(userData/profiles/ 디렉터리 목록), 변경 시 DeployFilesPanel의 `serverPath` 재계산 |
| `[Preview]` | 강제 재계산해 DeploymentPreviewPanel/DeployFilesPanel/DeleteListPanel을 최신 상태로 확정 표시. **부작용 없음(파일시스템 변경 없음)** — 사용자가 Export 전 마지막으로 확인하는 단계 |
| `[Export]` | Preview에 표시된 내용을 그대로 실행: `deploy/` 생성 + 파일 복사 + delete-list.txt/deploy-files.txt/deploy-summary.json 생성까지 전부 수행 (DETAILED_DESIGN.md §2, Package Builder 전체) |

버튼 비활성 조건: `selectedHashes.size === 0`일 때 두 버튼 모두 비활성.

---

# 3. 전역 상태 스토어 (Zustand)

ARCHITECTURE.md §2.2에 상태관리로 Zustand를 채택했다. 단일 스토어로 설계한다 — 패널 대부분이 "선택된 Commit → 계산된 배포 대상"이라는 동일한 파생 데이터를 나눠 보기 때문에, 스토어를 쪼개면 오히려 동기화 로직이 늘어난다.

```ts
interface AppState {
  repository: { path: string | null; status: 'idle'|'validating'|'valid'|'invalid'; error?: string };
  branches: string[];
  selectedBranch: string | null;
  startDate: string;   // YYYY-MM-DD, 기본 오늘-7일
  endDate: string;     // YYYY-MM-DD, 기본 오늘
  maxCount: number;    // 기본 100

  commits: CommitEntry[];
  selectedHashes: Set<string>;
  commitPagination: { hasMore: boolean; loading: boolean };

  analyzing: boolean;
  summary: { files: number; added: number; modified: number; deleted: number } | null;
  deployFiles: DeployFileEntry[];
  deleteList: DeleteEntry[];
  warnings: { path: string; reason: string }[];

  profiles: string[];
  selectedProfile: string;

  exportStatus: 'idle' | 'exporting' | 'done' | 'error';
}
```

**파생 계산 흐름**: `selectedHashes` 또는 `selectedBranch` 또는 `selectedProfile` 변경 → 디바운스 → 단일 IPC 호출(Commit 분석 엔진 + Mapping Rule 엔진 결과) → `summary`/`deployFiles`/`deleteList`/`warnings` 동시 갱신. 개별 `included` 토글(DeployFilesPanel)만 예시로 로컬 갱신(재계산 없음).

---

# 4. 인터랙션 정의

| 트리거 | 상태 변화 | IPC 호출 | 대응 |
|---|---|---|---|
| `[Browse...]` 클릭 | `repository.status = 'validating'` | `dialog.showOpenDialog` → `git rev-parse` | REQ-001 |
| Branch 목록 로드 완료 | `selectedBranch`를 main/master 우선순위로 자동 설정 | 없음(로컬 판단) | REQ-002 |
| Branch 변경 | `commits = []`, `selectedHashes = {}`, `commitPagination.loading = true` | `git log --since --max-count` 첫 페이지 | REQ-002 |
| `startDate`/`endDate`/`maxCount` 변경 | `commits = []`, `selectedHashes = {}`, `commitPagination.loading = true` | `git log --since --until` 첫 페이지 | REQ-003 |
| 커밋 목록 스크롤 하단 도달 | `commitPagination.loading = true`. 이미 `maxCount`만큼 로드했으면 요청하지 않음(`hasMore = false`) | `git log --skip` 다음 페이지 | REQ-003 |
| Search 입력 (디바운스) | 없음 (요청 중 표시만) | `git log --grep` | REQ-003 |
| 커밋 체크박스 토글 | `selectedHashes` add/remove → `analyzing = true`(디바운스 후) | Commit 분석 + Mapping 엔진 | REQ-004~008 |
| Mapping Profile 변경 | `analyzing = true` | Mapping 엔진 재실행(Commit 분석은 캐시 재사용, Mapping만 재계산) | REQ-008 |
| DeployFilesPanel 체크박스 토글 | 해당 항목 `included` 반전 | 없음 (로컬) | REQ-011 |
| DeployFilesPanel 전체 선택 토글 | 필터에 표시된 행 전체 `included` 일괄 반전 | 없음 (로컬) | REQ-011 |
| `[Preview]` 클릭 | 강제 재계산(디바운스 무시) | Commit 분석 + Mapping 엔진 | REQ-005~008 |
| `[Export]` 클릭 | `exportStatus = 'exporting'` → `'done'`\|`'error'` | Package Builder(전체: 파일 복사 + 3종 Export) | REQ-009, REQ-010 |

---

# 5. 로딩 / 빈 / 에러 상태

| 컴포넌트 | 빈 상태 | 로딩 상태 | 에러 상태 |
|---|---|---|---|
| RepositoryPanel | "저장소를 선택하세요" | 버튼 disable + 스피너 | "Git 저장소가 아닙니다" 등 구체 메시지 |
| CommitListPanel | "커밋이 없습니다" | 스켈레톤 행 (초기 로드) / 하단 스피너 (다음 페이지) | "커밋 조회 실패" + 재시도 버튼 |
| DeploymentPreviewPanel | "커밋을 선택하세요" | 집계 숫자 자리에 스켈레톤 | 계산 실패 메시지 (드물게 git diff-tree 실패 시) |
| DeployFilesPanel / DeleteListPanel | DeploymentPreviewPanel과 동기화(같은 계산 1회 결과) | 위와 동일 | 위와 동일 |
| FooterActionBar | — | `exportStatus`에 따라 `[Export]` label을 "내보내는 중..." 등으로 변경, 중복 클릭 방지 | 실패 사유를 인라인 배너로 표시, DR-009 Warning은 에러가 아니라 별도 경고 배지로 구분 |

DR-009(HEAD 미존재)로 인한 `warnings`는 에러가 아니라 **경고**다 — 계산은 정상 완료된 상태이므로 Export를 막지 않고, DeployFilesPanel 상단에 노란 배너로 "N개 파일이 HEAD에 없어 제외되었습니다"만 표시한다.

---

# 6. 다음 단계로 넘기는 항목

- §0 3가지 모두 사용자 확인 완료. #2(개별 파일 제외 + 전체 선택)는 REQ-011로 REQUIREDMENT.md에 반영 완료, §8 와이어프레임도 `[Build]` 제거·전체 선택 체크박스 추가로 갱신됨.
- 시각 디자인(색상, 타이포그래피, 간격)은 이 문서 범위 밖이다 — 컴포넌트/상태/인터랙션 정의까지가 DOCUMENT_CHECKLIST.md 4번의 범위다.
