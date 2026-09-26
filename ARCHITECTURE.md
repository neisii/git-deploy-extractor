# Git Deploy Extractor 아키텍처 설계 문서

> **현행 기준: v0.7.0**(2026-09-24 RT-60 문서 동기화로 갱신).

> Version: 0.1
> Status: Draft
> 기준 문서: REQUIREDMENT.md, core-scenario-diagram.html

---

# 1. 아키텍처 목표

REQUIREDMENT.md 섹션 10(비기능요구사항)에서 아키텍처를 직접 제약하는 항목은 다음과 같다.

| 요구사항 | 아키텍처 영향 |
|---|---|
| macOS / Windows 지원 | 크로스플랫폼 Desktop 프레임워크 필요 |
| Git CLI 사용 | Git 라이브러리 임베딩 대신 `git` 프로세스 셸아웃 |
| 인터넷 연결 없이 동작 | 런타임에 외부 네트워크 호출(CDN, 원격 API, 자동 업데이트 체크) 금지 |
| 수천 개 Commit에서도 원활한 조회 | Commit 목록 lazy load / 가상 스크롤 필요 |
| Profile 저장 지원 | 로컬 파일 기반 설정 영속화 필요 |

전제: 배포 대상 PC(외부망 개발자 PC)에는 `git`이 설치되어 PATH에 등록되어 있다.

---

# 2. 기술 스택

## 2.1 Desktop 프레임워크: Electron

- 프론트엔드/백엔드 모두 TypeScript로 통일
- Main Process(Node.js) — 파일시스템 접근, `git` 프로세스 실행, Deploy Package 생성
- Renderer Process(React) — UI 렌더링
- 최초 배포는 외부망(인터넷 가능 환경)에서 빌드 후 사내망으로 1회 전달되는 구조이므로, Electron의 상대적으로 큰 설치 용량은 반복 전송 비용으로 이어지지 않는다. 자동 업데이트 기능은 사용하지 않는다(오프라인 요구사항).

## 2.2 세부 스택 (제안)

| 영역 | 선택 | 근거 |
|---|---|---|
| UI 프레임워크 | React + TypeScript | Electron 생태계 표준 조합 |
| 상태관리 | Zustand (단일 전역 스토어) | Redux는 이 앱 규모(단일 화면, 패널 간 파생 상태 공유) 대비 보일러플레이트 과함. Context+useState는 여러 패널이 같은 선택 상태를 구독/파생하는 구조에서 prop-drilling 심해짐 |
| Commit 목록 렌더링 | 가상 스크롤 (예: react-window) | "수천 개 Commit" 요구사항 대응 |
| Git 연동 | Node `child_process` → `git` CLI 셸아웃 | 섹션 10 요구사항, DR-005 정확성 확보 |
| Profile 저장 | Electron `userData` 디렉터리에 JSON 파일 | 별도 DB 불필요, 오프라인 요구사항과 부합 |
| Java 파싱(의존성 검사) | `java-parser`(chevrotain 기반) | REQ-013. 실제 프로덕션 도구(prettier-java)가 쓰는 라이브러리, 재현 테스트로 실사용 Java 문법 파싱 확인(DETAILED_DESIGN.md §6.1). 전이 의존성(lodash) npm audit 경고는 오프라인 로컬 도구라 공격 표면이 없다고 판단해 감수 |
| 패키징 | electron-builder (mac: dmg/zip, win: nsis/zip) | 서명/배포 파이프라인 구성 용이 |

> Profile 저장 포맷의 구체 스키마는 DOCUMENT_CHECKLIST.md 3번 항목(상세 설계)에서 확정한다.

**추가(모듈 배치 기준, 2026-09-24 문서 동기화, RT-23/L2)**: `src/shared/`와 `src/renderer/src/lib/`를 나누는 기준을 명문화한다 — **Main과 Renderer 양쪽에서 참조하거나(타입·IPC 채널 정의) Node 런타임에 의존하지 않는 순수 로직**은 `shared/`, **Renderer 전용**(DOM/브라우저 API를 쓰거나 렌더러 상태에만 의존)은 `renderer/src/lib/`에 둔다. 예: `shared/ipc-channels.ts`(양쪽이 참조)는 `shared/`, `lib/filePattern.ts`(순수 함수지만 렌더러 스토어 타입에만 쓰임)는 `lib/`.

---

# 3. 프로세스 경계

```
┌─────────────────────────────┐        ┌─────────────────────────────┐
│      Renderer Process        │  IPC   │        Main Process          │
│  (React UI)                  │◄──────►│  (Node.js)                   │
│                               │        │                               │
│  - Repository/Branch 선택 UI │        │  - Repository Access Layer   │
│  - Commit List / 검색        │        │  - Commit Analysis Engine    │
│  - Deployment Preview        │        │  - Mapping Rule Engine       │
│  - Deploy Files / Delete List│        │  - Package Builder           │
│  - Preview/Export 트리거     │        │  - Profile 저장/조회         │
└─────────────────────────────┘        └─────────────────────────────┘
```

Git 프로세스 실행, 파일시스템 쓰기(Deploy Package 생성)는 전부 Main Process에서 수행한다. Renderer는 IPC를 통해 결과만 전달받아 렌더링한다 (Node 통합을 Renderer에 직접 노출하지 않음 — Electron 보안 권장사항).

**추가(IPC 계층 구조화, 2026-09-24 문서 동기화, RT-12/20/21)**:
- **채널명·타입 단일 정의**(RT-20): 모든 IPC 채널명과 요청/응답 타입은 `src/shared/ipc-channels.ts` 하나에서만 정의한다. `preload`/`main/ipc/handlers`/렌더러 쪽 `.d.ts` 전부 이 파일을 통해서만 채널을 참조한다 — 채널 문자열을 여러 곳에 따로 적어두다 오타로 어긋나는 걸 막는다.
- **입력 검증 계층**(RT-12, R3): `main/ipc/validate.ts`가 Renderer에서 오는 IPC 요청 인자를 핸들러 진입 시점에 검증한다(예: 해시 필터 16진수 검증, Export 경로 검증) — Renderer가 신뢰할 수 없는 입력(사용자가 직접 타이핑)을 그대로 git/파일시스템 명령 인자로 흘려보내지 않기 위한 방어선.
- **핸들러 그룹 분리**(RT-21): `main/ipc/handlers.ts` 단일 파일이 `main/ipc/handlers/`(채널 그룹별 — repository/commits/analysis/package 등) + `main/ipc/dialogs.ts`(네이티브 다이얼로그 공용 헬퍼)로 나뉘었다.

---

# 4. 모듈 구조

```
┌───────────────────────────────────────────────────────────────┐
│                         UI 계층 (Renderer)                     │
└───────────────────────────────────────────────────────────────┘
                              │ IPC
┌───────────────────────────────────────────────────────────────┐
│                      Main Process (Node.js)                    │
│                                                                   │
│  ┌─────────────────────┐   REQ-001~004                         │
│  │ Repository 접근 계층 │   Repository/Branch 선택, Commit 조회 │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│  ┌──────────▼──────────┐   REQ-005~007, DR-002~009               │
│  │ Commit 분석 엔진     │   변경 파일 수집, 중복 제거,           │
│  │                      │   상태 분류(Added/Modified/Deleted,    │
│  │                      │   Rename 미감지-DR-008), HEAD 미존재   │
│  │                      │   Warning                              │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│  ┌──────────▼──────────┐   REQ-008, DR-010~012                   │
│  │ Mapping Rule 엔진    │   기본값: identity mapping             │
│  │                      │   (Spring 표준 구조 전제)              │
│  │                      │   예외: Mapping Profile 규칙 적용      │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│  ┌──────────▼──────────┐   REQ-009~010                          │
│  │ Package Builder      │   git-deploy-extracted/ 생성, 파일 복사,             │
│  │                      │   Export(txt/json) 생성                │
│  └─────────────────────┘                                        │
└───────────────────────────────────────────────────────────────┘
```

**추가 (REQ-013, 2026-08-07)**: 위 4개 모듈은 REQ-001~011(MVP)의 필수 순차 파이프라인이다. 여기에 다섯 번째 모듈로 **의존성 완결성 검사 엔진**(§4.5)이 추가됐다 — Mapping Rule 엔진 출력을 입력받지만 Package Builder와 달리 필수 경로가 아니라 `[Preview]` 이후 자동 체이닝되는 **선택적/best-effort** 경로다(Java/Spring 저장소가 아니면 비활성화). 다이어그램에 넣으면 Package Builder 옆에 나란히 붙는 분기 박스가 되므로, 가독성을 위해 텍스트로만 남긴다 — 자세한 흐름은 DETAILED_DESIGN.md §6 참고.

## 4.1 Repository 접근 계층

**책임**: Git CLI 프로세스 실행 및 결과 파싱. REQ-001~004 담당(REQ-013/016용 저장소 전체 탐색 기능도 이 계층에 함께 둔다 — 아래 마지막 2행).

| 기능 | 내부 구현 | 대응 요구사항 |
|---|---|---|
| Repository 유효성 검사 | `git rev-parse --is-inside-work-tree` | REQ-001 |
| Branch 목록 조회 | `git branch --list` / `git for-each-ref` | REQ-002 |
| Commit 목록 조회 | `git log --pretty=format:...` (lazy load, `--skip`/`-n` 페이지네이션). `--grep=<키워드> -i --extended-regexp`(포함 키워드 OR 결합, REQ-003 — **정정 2026-09-24**: REQ-016 폐기로 파일명 검색 분기는 삭제, 항상 메시지 대상)/`--author=<값> -i`(작성자 부분 일치, 여러 값을 반복 push해 git 기본 OR로 결합)/`--no-merges`(Merge 제외, REQ-022)는 조건부로 추가 결합. 해시 필터(REQ-023)가 있으면 위 조건을 전부 무시하고 `git log --no-walk <hash...>`로 완전히 분리된 경로로 조회 | REQ-003, REQ-022, REQ-023 |
| Commit 상세 diff | `git diff-tree` / `git show --name-status` | REQ-005 |
| HEAD 파일 조회 | `git show <branch>:<path>` | REQ-007, DR-003 |
| 경로 접두사 하위 파일 목록 | `git ls-tree -r <branch> --name-only -- <prefix>`(접두사 생략 시 전체 트리 — AddFilesPopup의 HEAD 트리 탐색이 접두사 없이 호출) | REQ-013, REQ-021 |
| 텍스트 사전 필터 검색 | `git grep -l -F <문자열> <branch> -- <pathspec>` | REQ-013 |
| RepositoryPanel 라벨용 프로젝트 이름 유도 | `git remote get-url origin`(없거나 실패하면 `null`, 절대 throw 안 함) | REQ-018, DR-017 |

이 계층은 Git CLI의 원시 출력만 파싱해서 상위 계층에 넘긴다. Merge/Rebase 전략 해석(DR-005)은 이 계층이 아니라 Commit 분석 엔진의 책임이다 — `git diff-tree`로 각 commit의 변경 파일만 뽑으면 Merge 전략과 무관하게 동일한 인터페이스로 처리 가능하기 때문이다.

## 4.2 Commit 분석 엔진

**책임**: 선택된 Commit 집합으로부터 배포 대상 파일 목록을 계산. REQ-005~007, DR-002~009 담당.

처리 순서:
1. 선택된 각 Commit의 변경 파일 목록 수집 (DR-005: 전략 무관, Rename 감지 없이 순수 Add/Modify/Delete로만 수집 — DR-008)
2. 파일 경로 기준 중복 제거 (REQ-006, DR-004)
3. 파일별 상태 분류: Added / Modified / Deleted
4. Deleted 파일 → Delete List로 분리, 이후 단계에서 제외 (DR-007)
5. Added/Modified 파일 → 기준 Branch HEAD 존재 여부 확인
   - 존재 → HEAD 최신 버전 사용 (REQ-007, DR-003)
   - 미존재 → Warning 표시, 복사 대상에서 제외 (DR-009)

Rename을 별도 상태로 분류하지 않는다(DR-008) — Delete+Add를 각각 4·5단계에 그대로 흘려보내면 이전 이름은 자동으로 Delete List에, 새 이름은 자동으로 HEAD 기준 배포 대상에 들어가 결과적으로 "최종 파일명 기준 처리"가 별도 로직 없이 성립한다. 어떤 삭제/추가 쌍이 실제로는 하나의 Rename인지는 Preview 단계에서 사용자가 직접 판단한다(UI_UX_SPEC.md 참고).

출력: `{ deployTargets: FileEntry[], deleteList: string[], warnings: string[] }`

## 4.3 Mapping Rule 엔진

**책임**: Local Path → Server Path 변환. REQ-008, DR-010~012 담당.

```
기본 동작 (Spring 표준 구조 전제):
  src/main/java/**        → 변환 없음 (DR-011)
  src/main/resources/**   → 변환 없음 (DR-012)

예외 동작:
  Mapping Profile에 정의된 규칙이 있는 경우에만 별도 변환 적용 (DR-010)
```

이 엔진은 "규칙 기반으로 매핑을 계산하는" 범용 엔진이 아니라, **기본값이 identity function이고 Mapping Profile로 override 가능한 얇은 계층**으로 설계한다. 이는 DR-011/012 확정 이후 결정된 사항으로, 향후 Mapping Profile 스키마가 복잡한 규칙(정규식 치환 등)을 요구하지 않는 한 이 형태를 유지한다.

## 4.4 Package Builder

**책임**: Deploy Package 생성 및 Export. REQ-009~010 담당.

1. `git-deploy-extracted/` 디렉터리 생성
2. Mapping Rule 엔진 출력에 따라 각 파일을 HEAD 버전 내용으로 복사 (원본 디렉터리 구조 유지, DR-011/012)
3. **`extract-list.txt` 생성(U-17, RT-57, 2026-09-23 — 기존 `delete-list.txt`·
   `deploy-files.txt`·`deploy-summary.json` 3종 통합)**: 머리말(생성 시각·기준
   브랜치·원본 커밋 목록, 최대 10줄) + 배포 대상 파일 트리 + 삭제 대상 파일 트리를
   BOM 없는 UTF-8·LF 텍스트 한 파일로 기록한다. 사람이 읽는 용도이며 프로그램이
   다시 읽지 않는다. 순수 함수 `treeText`/`buildExtractListText`
   (`src/main/package/extractListText.ts`)로 분리돼 있어 시각을 주입해
   결정적으로 테스트한다.

## 4.5 의존성 완결성 검사 엔진 (REQ-013, 2026-08-07 추가)

**책임**: Java/Spring 단일 모듈에서, 배포 대상 파일들이 참조하는 다른 Java 파일이 목록에 빠졌는지 HEAD 트리 기준으로 확인. Mapping Rule 엔진 출력(`deployFiles`)을 입력받지만, Package Builder와 달리 **선택적** 경로다 — `@SpringBootApplication` 클래스를 못 찾으면(Java/Spring 저장소가 아니면) 비활성화된다.

1. `git grep`으로 `@SpringBootApplication` 후보를 저장소 전체에서 빠르게 좁히고, 파싱으로 확정해 base package 판별(하드코딩 금지)
2. base package 경로 아래 `.java` 파일 목록(`git ls-tree`)으로 경로↔FQN 인덱스 구성(내용을 읽지 않고 경로에서 유도)
3. 포함된 `.java` 파일들에서 시작해 BFS로 import/`implements`/`extends`/필드·생성자 파라미터 타입을 전이적으로 추적(깊이 제한 없음)
4. 필드/파라미터로 참조된 타입이 인터페이스로 확인되면 `git grep`으로 구현체 후보를 좁히고 파싱으로 `implements` + stereotype 애노테이션 확정(모호하면 전부 후보로 제안)

출력: `{ applicable: boolean, missingDependencies: DependencyCandidate[], parseWarnings }` — 자세한 알고리즘은 DETAILED_DESIGN.md §6 참고. **정정(2026-09-24, RT-22)**: 구현이 단일 파일 `dependencyAnalysis.ts`에서 `src/main/analysis/dependencyAnalysis/{projectIndex,resolve,implementations,index}.ts`(책임별 분할, `index.ts`가 재조립)로 나뉘었다. `src/main/analysis/java/parseJavaFile.ts`는 그대로.

## 4.6 UI 계층

**정정(2026-09-24 문서 동기화, RT-40~53)**: REQUIREDMENT.md §8 와이어프레임(P4 리팩토링으로 전면 재구성, UI_UX_SPEC.md §1 참고) 기준. 담당 화면 요소:

- Repository 선택 / Branch 선택 / Commit 키워드 검색(항상 메시지 대상, 제외는 `-` 접두 — REQ-003, REQ-016 폐기) / 작성자·Merge 제외 필터(REQ-022) / 해시 필터(REQ-023)
- Commit List (가상 스크롤, 다중 선택 체크박스, 재조회 시 선택 유지·Reload 시 전체 초기화 — REQ-015/DR-015)
- PreviewSummary (Files/Added/Modified/Deleted 집계, Rename 미감지 — DR-008. Deleted·경고는 버튼으로 여는 팝업)
- IncludedFilesPane("포함된 파일") / ExtractTargetsPane("Extract 대상") — 체크 시 실제 이동(REQ-011 정정), 좌측에만 화면 검색(REQ-025)·파일 패턴 요약(REQ-026)
- 팝업 4종(동시 하나만) — 파일 추가(HEAD 트리 탐색+누락된 의존성 통합, REQ-013/021), 파일 패턴 관리(REQ-026), 삭제 목록(DR-007), 경고 목록(DR-009)
- Export 위치 방식 선택(폴더 생성/바로 추출) + 경로 선택 + Export 액션 (REQ-012 정정. Mapping Profile 선택 UI는 계속 숨김)
- 분할 영역 드래그 리사이즈 (REQ-014, WorkArea 세로 분할 포함)
- 섹션별 접기/펼치기 (CollapsibleSection)
- 버전 배지 — 새 GitHub Release 알림 + 클릭 시 릴리스 페이지 오픈 (REQ-017)

세부 컴포넌트 분해와 상태(State) 정의는 UI_UX_SPEC.md에서 진행한다.

## 4.7 업데이트 확인 모듈 (REQ-017, DR-016, 2026-08-12 추가)

**책임**: GitHub Releases API로 최신 릴리스 태그를 확인해 Renderer에 전달. 다른 모듈과 달리 로컬 git 저장소나 파일시스템을 전혀 건드리지 않는 유일한 모듈이다 — 순수 외부 네트워크 호출(`https.get` 또는 `fetch`, `GET https://api.github.com/repos/neisii/git-deploy-extractor/releases/latest`, 타임아웃 5초) + 버전 문자열 비교뿐이다.

Main process는 상태를 갖지 않는다(stateless) — 캐시(마지막 확인 시각/결과)는 Renderer의 `localStorage`에 있다(다른 화면 설정과 동일한 위치, ARCHITECTURE.md §2.2). Main은 호출될 때마다 매번 실제로 GitHub API를 때리고, 24시간 캐시 게이트는 Renderer가 IPC를 호출하기 전에 스스로 판단한다.

실패(오프라인, 타임아웃, GitHub API 오류, 응답에서 기대한 필드를 못 찾거나 버전 형식이 `vX.Y.Z`가 아닌 경우 포함)는 예외를 던지지 않고 `{ ok: false }` 형태로 Renderer에 그대로 전달한다 — REQ-010(인터넷 연결 없이 동작 가능)과 공존해야 하므로, 이 모듈의 실패가 앱의 다른 어떤 기능에도 영향을 줘서는 안 된다. 5초 타임아웃이 있어 이 IPC 호출은 항상 유한 시간 내 응답한다.

출력: `{ ok: true; hasUpdate: boolean; latestVersion: string } | { ok: false }` — 특정 릴리스 태그로의 딥링크(`html_url`)는 담지 않는다(클릭 시 항상 고정된 릴리스 인덱스 URL만 열도록 확정되어 필요 없음). `hasUpdate` 판정(원격이 로컬보다 엄격히 큰지)까지 이 모듈이 끝내서 반환한다 — `app.getVersion()`이 이미 Main에 있어 Renderer에 따로 노출할 이유가 없기 때문(구현 시점 단순화, DETAILED_DESIGN.md §10.1 참고). 배지에 항상 표시할 현재 버전 텍스트는 이 IPC와 별도로 `app:getVersion`을 통해 가져온다(캐시가 신선하면 `checkForUpdate` 자체가 호출 안 될 수 있어서). 자세한 흐름/캐시 규칙/"엄격히 크다" 비교 기준은 DETAILED_DESIGN.md §10 참고.

## 4.8 파일 수동 추가 (REQ-021, DR-019, 2026-08-23 추가)

**책임**: 커밋 diff나 §4.5 의존성 완결성 검사와 무관하게, 선택된 Branch의 HEAD 트리에 있는 임의 파일을 사용자가 직접 검색해 배포 대상에 추가. 새 엔진을 두지 않고 기존 모듈을 재사용하는 얇은 조합이다 — §4.2가 이미 쓰는 `git ls-tree`(파일 목록)와 §4.3 Mapping Rule 엔진의 Server Path 계산을 그대로 가져다 쓴다.

IPC 채널 2개만 추가된다: `git:listTrackedFiles`(후보 풀 — HEAD 트리 전체 파일 경로, Java 한정 아님)와 `analysis:resolveManualFile`(선택한 경로 하나의 Server Path 계산, `status`는 항상 `'added'`로 고정). 둘 다 상태를 갖지 않는다 — Renderer(Zustand store)가 `headTreeFiles`/`manuallyAddedPaths`로 결과를 들고 있다가 `deployFiles`에 직접 병합한다.

리비전 싱크 문제(내부망에 실제로 뭐가 반영됐는지)는 이 모듈이 풀지 않는다 — 망분리 환경에서 GDE는 그 상태를 원리적으로 관측할 수 없어(RISK_ISSUES.md 결정 이력 #48), 탐지 대신 사용자 판단에 맡기는 것이 이 모듈의 설계 전제다. **정정(2026-09-24, RT-52/53)**: UI는 자동완성 텍스트 입력에서 HEAD 트리 탐색(`AddFilesPopup.tsx`, 옛 `ManualAddPopup.tsx` 대체)으로 바뀌었고, REQ-013 누락된 의존성도 이 팝업 안으로 통합됐다. 자세한 UI/생명주기는 DETAILED_DESIGN.md §18.5 참고.

## 4.9 파일 패턴 관리 (REQ-026, 2026-09-24 신규)

**책임**: 사용자가 등록한 제외/포함 패턴으로 "포함된 파일"/"Extract 대상" 화면 표시와 Export 대상을 걸러낸다. 순수 함수 계층(`src/renderer/src/lib/filePattern.ts`)이며 IPC나 Main Process를 전혀 거치지 않는다 — 매치 판정이 로컬 문자열 비교(글롭→정규식)로 충분해 파일시스템/git 접근이 필요 없기 때문이다. 저장은 Renderer `localStorage`(`gde:filePatterns`, 전역). Package Builder(§4.4)가 Export 시점에 같은 판정 함수를 한 번 더 호출해 최종 대상을 거른다. 알고리즘은 DETAILED_DESIGN.md §18.1 참고.

---

# 5. 데이터 흐름

핵심 시나리오 10단계(core-scenario-diagram.html)를 모듈 호출 순서로 재구성하면 다음과 같다.

```
[Renderer] Repository/Branch 선택
        │ IPC
        ▼
[Main] Repository 접근 계층 ── git branch, git log ──► Commit 목록
        │ IPC (lazy load)
        ▼
[Renderer] Commit 다중 선택
        │ IPC
        ▼
[Main] Repository 접근 계층 ── git diff-tree ──► 각 Commit 변경 파일
        ▼
[Main] Commit 분석 엔진 ── 수집·중복제거·상태분류·HEAD조회 ──► 배포 대상 파일 목록
        ▼
[Main] Mapping Rule 엔진 ── 경로 변환(기본: identity) ──► Server Path 매핑 결과
        │ IPC
        ▼
[Renderer] Deployment Preview / Deploy Files 렌더링 (사용자 확인, 개별/전체 파일 선택 — REQ-011)
        │ IPC ([Preview] 재계산 → [Export] 트리거)
        ▼
[Main] Package Builder ── 파일 복사 ──► git-deploy-extracted/
        ▼
[Main] Package Builder ── Export ──► extract-list.txt (RT-57, U-17)
```

Main Process 내부 모듈 간 호출은 함수 호출이며, Renderer와의 경계에서만 IPC 직렬화 비용이 발생한다. Commit 목록처럼 큰 데이터는 IPC 페이로드를 페이지 단위로 나눠 전달한다(성능 요구사항 대응).

---

# 6. 오류 처리 원칙

- HEAD에 파일이 없는 경우(DR-009): 예외를 던져 흐름을 중단하지 않고, `warnings` 배열에 누적해 UI에서 사용자가 확인 후 진행 여부를 판단하게 한다.
- Git 프로세스 실행 실패(예: `git` 미설치, Repository 경로 오류): Repository 접근 계층에서 즉시 사용자에게 에러로 노출한다(REQ-001 Repository 선택 단계에서 조기 검증).
- Package Builder 단계의 파일시스템 쓰기 실패(권한 등): 부분 실패 허용하지 않고 전체 Export를 중단한다 — 불완전한 Deploy Package가 내부망으로 전달되는 것을 방지하기 위함(프로젝트 목적: "정확하게 추출").

---

# 7. 오픈 이슈 → 전부 DETAILED_DESIGN.md에서 확정됨 (해결됨)

DOCUMENT_CHECKLIST.md 3번(상세 설계 문서)으로 이관했던 항목이며, 전부 해결되었다:

- `deploy-summary.json` 필드 스키마 → DETAILED_DESIGN.md §2.3
- Mapping Profile 저장 파일 포맷 및 스키마 → DETAILED_DESIGN.md §1.3
- Commit 목록 페이지네이션 크기 및 캐싱 전략 → DETAILED_DESIGN.md §3.4

새로 남은 리스크/미해결 항목은 RISK_ISSUES.md에서 추적한다.
