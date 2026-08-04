# Git Deploy Extractor 구현 순서 계획

> Version: 0.1
> Status: Draft
> 기준 문서: PRD.md §4(우선순위), ARCHITECTURE.md §4(모듈 구조), DETAILED_DESIGN.md

---

# 0. 우선순위(P0/P1/P2)와 Phase는 다른 축이다

PRD.md §4의 P0/P1/P2는 "이게 없으면 도구가 성립하는가"라는 **중요도** 기준이다. 이 문서의 Phase는 "기술적으로 무엇이 무엇보다 먼저 와야 하는가"라는 **의존성** 기준이다. 그래서 P1인 REQ-008(Mapping Rule)이 Phase 2에, P1인 REQ-010(Export)이 Phase 3에 들어가는 등 두 분류가 정확히 겹치지 않는다. 헷갈리면 이 문서(Phase, 순서) 기준으로 진행한다.

**핵심 설계 원칙**: Phase 1~3은 Electron UI 없이 **CLI/단위 테스트만으로 검증 가능**하게 순서를 짰다. 이 프로젝트의 핵심 가치가 "정확한 파일 계산"이고(REQUIREDMENT.md §1), 정확성 버그는 조용히 실패한다는 게 RISK_ISSUES.md §2.1에서 이미 확인됐다. UI를 붙이기 전에 로직만 따로 떼어 검증하면, UI 버그와 로직 버그가 섞여서 원인을 못 찾는 상황을 피할 수 있다. DETAILED_DESIGN.md §0.1(재현 테스트 검증 원칙)과 같은 맥락이다.

---

# 1. Phase 표

| Phase | 포함 REQ/DR | 산출물 | UI 필요 | 완료 기준 |
|---|---|---|---|---|
| 0 | — | 프로젝트 스캐폴딩 | 최소 | 아래 §2.0 |
| 1 | REQ-001, 002, 003 | Repository 접근 계층 | 불필요 | 아래 §2.1 |
| 2 | REQ-004~008, DR-002~012 | Commit 분석 엔진 + Mapping Rule 엔진 | 불필요 | 아래 §2.2 |
| 3 | REQ-009, 010 | Package Builder | 불필요 | 아래 §2.3 |
| 4 | (Phase 1~3을 화면에 연결) | Electron + React UI | **필요** | 아래 §2.4 |
| 5 | REQ-011 | 개별/전체 파일 선택 | 필요 | 아래 §2.5 |
| 6 (후순위) | — | 리스크 항목 실측 검증 | 무관 | 아래 §2.6 |

---

# 2. Phase별 상세

## 2.0 Phase 0 — 프로젝트 스캐폴딩

Electron + TypeScript + React 프로젝트를 초기화한다. Main/Renderer 프로세스 분리는 ARCHITECTURE.md §3을 따른다. 빌드 도구(Vite 등) 선택은 이 문서에 없는 사항이므로 DETAILED_DESIGN.md §0.2에 따라 새 세션이 통상적인 선택을 하고 진행하되, 특이한 제약(예: 오프라인 빌드 필요 여부)이 있으면 먼저 질문한다.

**완료 기준**: `npm run dev`로 빈 Electron 창이 macOS/Windows에서 뜬다.

## 2.1 Phase 1 — Repository 접근 계층

DETAILED_DESIGN.md §3 전체(공통 실행 규칙, 명령어 매핑, Merge Commit 처리, 페이지네이션)를 구현한다.

- REQ-001: Repository 유효성 검사
- REQ-002: Branch 목록 조회 + main/master 자동 선택
- REQ-003: Commit 목록 조회 (조회 기간/최대 개수 기본값 적용, 페이지네이션, 검색)

**UI 없이 검증**: Node 스크립트나 테스트 러너로 실제 테스트 저장소에 대해 직접 호출해 콘솔 출력을 확인한다. §0.1 원칙에 따라 git 명령어 동작을 다시 한번 재현 테스트로 확인하고 시작한다.

**완료 기준**: 실제 저장소에 대해 (a) 유효성 검사, (b) 기본 브랜치 자동 선택, (c) 기본 기간(오늘-7일~오늘)/최대 100개로 제한된 Commit 목록, (d) 검색어 필터링, (e) 스크롤(다음 페이지) 시뮬레이션이 전부 정확한 결과를 콘솔에 출력한다.

## 2.2 Phase 2 — Commit 분석 엔진 + Mapping Rule 엔진

ARCHITECTURE.md §4.2, §4.3과 DETAILED_DESIGN.md §1을 구현한다.

- REQ-004: 다중 Commit 선택은 이 단계의 입력(hash 배열)일 뿐이므로 별도 구현 없음
- REQ-005~007, DR-002~009: 변경 파일 수집 → 중복 제거 → 상태 분류(Added/Modified/Deleted, Rename 미감지) → Delete 분리 → HEAD 조회
- REQ-008, DR-010~012: Mapping Rule 엔진 (기본 identity, Profile override)

**UI 없이 검증**: Phase 1 결과(Commit 목록)에서 임의로 여러 커밋 hash를 골라 함수를 직접 호출한다. 아래 케이스를 반드시 포함해 검증한다.
- 동일 파일이 여러 커밋에서 수정된 경우 (중복 제거)
- Merge 커밋이 섞인 경우 (§3.3 첫 번째 부모 기준)
- Rename에 해당하는 케이스가 Delete+Add 두 줄로 나오는지 (DR-008)
- HEAD에 없는 파일에 대해 Warning이 뜨는지 (DR-009)
- Mapping Profile override가 있는 경로와 없는 경로 둘 다

**완료 기준**: 위 5개 케이스 전부 DETAILED_DESIGN.md의 예시와 일치하는 결과를 콘솔에 출력한다.

## 2.3 Phase 3 — Package Builder

DETAILED_DESIGN.md §2(Export 포맷), §4(대소문자 검사, binary 쓰기 모드)를 구현한다.

- REQ-009: `git-deploy-extracted/` 생성 + 파일 복사 (원본 구조 유지)
- REQ-010: `deploy-files.txt`, `delete-list.txt`, `deploy-summary.json` 생성

**UI 없이 검증**: Phase 2 출력을 입력으로 받아 실제로 로컬 디스크에 `git-deploy-extracted/` 폴더를 만들어본다.

**완료 기준**: 생성된 `git-deploy-extracted/` 폴더의 파일 내용·줄바꿈이 원본 git blob과 바이트 단위로 동일하고(§4.2), 대소문자만 다른 경로 충돌 시 에러로 중단되며(§4.1), Export 3종 파일이 UTF-8/LF로 생성된다.

이 시점에서 Phase 1~3만으로 **UI 없이 CLI 인자로 전체 파이프라인(Repository → Commit 선택 → git-deploy-extracted/ 생성)을 한 번에 실행할 수 있는 스크립트**를 하나 만들어두면 이후 UI 버그와 로직 버그를 분리해서 디버깅할 때 유용하다.

## 2.4 Phase 4 — Electron + React UI 연결

ARCHITECTURE.md §3(프로세스 경계)과 UI_UX_SPEC.md 전체(컴포넌트 트리, Zustand 스토어, 인터랙션)를 구현한다. Phase 1~3에서 만든 함수들을 IPC로 노출하고 컴포넌트에 연결한다.

컴포넌트 구현 순서 권장: TitleBar/RepositoryPanel(가장 단순) → BranchSearchBar → CommitListPanel(가상 스크롤 포함) → DeploymentPreviewPanel → DeployFilesPanel(전체 선택 토글 제외, REQ-011은 Phase 5) → DeleteListPanel → FooterActionBar.

**완료 기준**: 실제 화면에서 Repository 선택부터 [Export] 클릭까지 전체 플로우가 동작하고, Phase 1~3에서 검증한 CLI 결과와 화면에 표시되는 값이 일치한다.

## 2.5 Phase 5 — REQ-011 개별/전체 파일 선택

UI_UX_SPEC.md §2.6을 구현한다. DeployFilesPanel 체크박스를 인터랙티브하게 만들고, 헤더 전체 선택 토글(indeterminate 상태 포함), 300개 초과 시 가상 스크롤을 추가한다.

**완료 기준**: 개별 파일 체크 해제가 실제 Export 결과(deploy-files.txt, 복사된 파일)에서 제외로 반영된다.

## 2.6 Phase 6 (후순위) — 리스크 항목 실측 검증

RISK_ISSUES.md §2, §1에서 "재검토 필요"/"실측 필요"로 남겨둔 항목을 실제 대형 저장소로 검증한다.

- Merge Commit 첫 번째 부모 기준 처리가 실제 병합 전략과 맞는지
- `maxCount`를 크게 늘렸을 때 `--skip` 성능
- Deploy Files 300개 가상 스크롤 임계값이 실사용에 적절한지

이 Phase는 MVP 출시를 막는 조건이 아니다 — 실사용 데이터가 쌓인 뒤 조정하면 된다.
