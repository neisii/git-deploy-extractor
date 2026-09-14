# Git Deploy Extractor UI/UX 명세

> Version: 0.1
> Status: Draft
> 기준 문서: REQUIREDMENT.md §8, ARCHITECTURE.md §4.6

REQUIREDMENT.md 8번 섹션 와이어프레임을 컴포넌트/상태/인터랙션 단위로 확장한다. 이 앱은 단일 화면 유틸리티이므로(다중 페이지 라우팅 없음), 화면 전체를 하나의 컴포넌트 트리로 정의한다.

---

# 0. 이 문서에서 발견해 확정한 사항 (REQUIREDMENT.md 미명시 gap)

와이어프레임을 컴포넌트 단위로 쪼개는 과정에서 REQUIREDMENT.md에 명시되지 않은 모호한 지점 3개를 발견했고, 아래와 같이 확정했다(2026-08-04, 사용자 확인 완료).

| # | 발견한 모호함 | 확정한 내용 |
|---|---|---|
| 1 | 상단 타이틀바의 `contract2/main ▼`와 "Branch :" 행의 `contract2/main ▼`가 와이어프레임에 중복 등장 | **채택**: 인터랙티브 컨트롤은 "Branch :" 행 하나만, 타이틀바는 읽기 전용 텍스트 |
| 2 | Deploy Files 목록의 체크박스(`☑`)가 표시용인지 조작 가능한지 REQ에 명시 없음 | **확정**: 인터랙티브. 실제로 필요한 파일만 선택해서 추출할 수 있어야 하기 때문. **전체 선택/해제 토글도 추가** → REQ-011로 REQUIREDMENT.md에 반영 완료 |
| 3 | `[Preview] [Export] [Build]` 세 버튼의 차이가 REQUIREDMENT.md에 없음 | **[Build] 버튼 제거, 2버튼 구조로 확정**: Preview=배포될 디렉터리 구조와 파일 목록을 보여주는 확인 단계(부작용 없음) / Export=Preview에서 확인한 내용 그대로 실제 추출(파일 복사 + git-deploy-extracted/ 생성 + txt/json 산출물까지 전부, 기존 "Build"가 하던 일을 흡수). 근거: REQUIREDMENT.md 원본 와이어프레임에 있던 `[Build]`는 "코드 컴파일"이 아니라 "배포 패키지 조립"을 뜻했는데(DR-011이 이미 컴파일은 범위 밖으로 확정), 사용자가 의도한 건 애초에 Preview/Export 2단계 구조였음 |

**시각 자료**: 위 3가지를 그림으로 정리한 자료 — `ambiguity-explainer.html` (같은 프로젝트 루트에 위치)

---

# 1. 컴포넌트 트리

```
AppShell
├── RepositoryPanel               (저장소 선택/새로고침 + 저장소/브랜치 요약 라벨, REQ-018)
├── BranchSearchBar               (브랜치 선택 + 커밋 검색)
├── SplitPane (direction="vertical", className="vertical-main-split")
│   ├── start: SplitPane (MainGrid, direction="horizontal" 기본값)
│   │   ├── CommitListPanel        (좌: 커밋 목록, 다중 선택 + 전체 선택 + Preview 트리거)
│   │   └── DeploymentPreviewPanel (우: 집계 미리보기, 읽기 전용)
│   └── end: DeployFilesPanel
│       ├── SplitPane
│       │   ├── FileListColumn     (좌: 포함된 파일, 개별/전체 선택 + 상태 Filter + 파일명 검색 + 파일 수동 추가 트리거, REQ-021)
│       │   └── FileListColumn     (우: 누락된 의존성, 개별 선택 + 전체 선택(양방향, 2026-08-20) + 파일명 검색)
│       └── ManualAddPopup         (부모 중앙 모달, REQ-021 — 열렸을 때만 렌더링, 좌우 목록 위를 가릴 수 있음)
├── DeleteListPanel               (삭제 대상 목록, 읽기 전용)
├── FooterActionBar               (Export 경로 선택 + Export)
└── Credit                        (화면 우측 하단 고정, 제작자 GitHub 링크)
```

**정정 (MainGrid↔DeployFilesPanel 상하 분할 추가, RISK_ISSUES.md §7.4, 2026-08-07, 결정 이력 #27)**: `SplitPane`이 처음엔 가로(좌우) 방향만 지원했으나, "커밋 목록/분석 요약 영역 전체와 포함된 파일/누락된 의존성 영역 전체 사이의 높이 비율도 드래그로 조절하고 싶다"는 사용자 요청으로 `direction: 'horizontal'|'vertical'` prop을 추가해 세로(상하) 방향도 지원하도록 확장했다. 이 확장에 맞춰 `left`/`right`/`minLeftPx`/`minRightPx`이던 prop 이름이 방향 중립적인 `start`/`end`/`minStartPx`/`minEndPx`로 정정됐다. 세로 SplitPane의 `start` 자리에 기존 MainGrid(가로 SplitPane)가 그대로 중첩된다.

**정정 (Preview 위치 이동, 2026-08-04, 사용자 요청)**: `[Preview]`는 원래 FooterActionBar에 있었으나, "커밋을 고르고 → 바로 그 자리에서 계산한다"는 흐름이 더 직관적이라는 사용자 피드백으로 CommitListPanel 헤더로 옮겼다 — "전체 선택" 체크박스와 같은 행, 패널 우측 끝에 배치한다(§2.4).

**정정 (MainGrid 비율 80:20 → 드래그 조절 가능, RISK_ISSUES.md §7.4, 2026-08-07)**: CommitListPanel과 DeploymentPreviewPanel은 원래 폭을 50:50으로 균등 분할했으나, CommitListPanel은 hash/author/date/message 네 개 컬럼을 담아야 하는 반면 DeploymentPreviewPanel은 짧은 집계 숫자 4줄뿐이라 균등 분할이 불필요하게 넓다는 사용자 피드백으로 대략 80:20 비율(`minmax(320px, 4fr) minmax(180px, 1fr)`)로 바꿨다(2026-08-04, 결정 이력 #22). 이후 §7.4로 이 고정 비율이 **사용자가 마우스로 드래그해 조절 가능한 값**으로 대체됐다 — 80:20은 이제 `SplitPane`(`src/renderer/src/components/SplitPane.tsx`)의 `defaultRatio={0.8}` 초기값일 뿐이다. 각 영역은 지정된 최소 폭(`minStartPx=320`/`minEndPx=180`) 아래로는 줄어들지 않으며, 창을 그 합보다 더 좁히면 우측이 잘려 보이지 않도록 `overflow-x: auto`를 안전망으로 뒀다(`SplitPane` 공용 스타일). 조절한 비율은 `localStorage`(`gde:splitRatio:mainGrid`)에 저장되어 재실행 후에도 유지된다.

**정정 (핸들 두께 축소, 2026-08-07, 사용자 피드백)**: 좌우/상하 구분선(드래그 핸들)이 처음엔 그리드 트랙 6px + 양옆 `gap` 8px씩(합 22px)이라 두꺼워 보였고, 그만큼 실제 목록이 보여줄 수 있는 공간을 줄이고 있었다. 그리드 트랙은 마우스로 잡기 편하도록 8px로 유지하되 `gap`은 0으로 없애고, 트랙 안에는 2px 두께의 얇은 막대만 중앙에 그리도록 바꿨다 — 영역 사이 낭비 폭이 22px → 8px로 줄어 그만큼 목록에 더 많은 데이터가 보인다.

**정정 (DeployFilesPanel 최소 높이 = MainGrid, 2026-08-04, 사용자 요청)**: DeployFilesPanel은 MainGrid보다 최소 높이가 낮게 잡혀 있어(flex-basis 160px/min-height 120px) MainGrid(240px/200px)보다 눈에 띄게 낮게 보였다. 여러 파일을 보여줘야 하는 영역인데 공간이 상대적으로 적게 배정돼 있었다는 점에서 위 80:20 비율 건과 같은 성격의 문제라, DeployFilesPanel의 flex-basis·min-height를 MainGrid와 동일한 값(240px/200px)으로 맞췄다 — 두 영역이 같은 flex-grow 비율로 남은 세로 공간을 나눠 가지므로 사실상 항상 같은 높이로 자란다.

---

# 2. 컴포넌트 정의

**정정 (TitleBar를 RepositoryPanel로 흡수, REQ-018/DR-017, 2026-08-12, RISK_ISSUES.md 결정 이력 #38)**: 별도 컴포넌트였던 TitleBar(앱 최상단 별도 행)를 없애고 RepositoryPanel로 합쳤다 — 이 문서의 §2.1 번호는 이제 쓰지 않는다(건너뜀). 아래 §2.2 RepositoryPanel이 원래 TitleBar가 하던 역할까지 포함한다.

## 2.2 RepositoryPanel

**책임**: REQ-001(저장소 경로 선택/유효성 검사) + REQ-018(저장소/브랜치 요약 라벨).

| 요소 | 동작 |
|---|---|
| 저장소/브랜치 요약 라벨(좌측, REQ-018) | `{RepoLabel} / {selectedBranch}`(브랜치 미선택 시 `—`). `RepoLabel`은 `git remote origin` URL에서 유도한 이름을 로컬 폴더명보다 우선 표시(사용자가 로컬 폴더명을 임의로 바꿀 수 있어서) — remote 이름이 폴더명과 다르면 `{remote 이름} ({폴더명})`(폴더명은 흐린 색 `--ev-c-text-2`), 같으면 `{remote 이름}`만, remote 없음/조회 실패면 `{폴더명}`만(DETAILED_DESIGN.md §11.4). "Git Deploy Extractor —" 같은 앱 이름 접두어는 안 붙인다 — macOS/Windows 창 제목과 중복이라서(대안으로 검토한 "창 제목에 저장소/브랜치 넣기"는 mac 풀스크린에서 창 타이틀 자체가 사라지고, 커서로 여는 화면 상단 바는 창 타이틀이 아니라 macOS 전역 메뉴바라 애초에 동적 텍스트를 못 받아 기각 — DETAILED_DESIGN.md §11.1) |
| 경로 표시 텍스트 | `repository.path` 표시, 미선택 시 placeholder("저장소를 선택하세요"). 요약 라벨이 왼쪽에 붙으면서 행이 붐빌 수 있어 `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` + hover 시 `title` 툴팁으로 전체 경로 표시(REQ-018 정정, `footer-action-bar__export-path`와 동일 패턴) |
| `[Browse...]` | OS 폴더 선택 다이얼로그(Electron `dialog.showOpenDialog`, Main Process) → 선택 시 유효성 검사 IPC 호출 |
| `[Reload]` | 현재 경로로 유효성 재검사 + 브랜치 목록/커밋 목록 전체 리셋 후 재조회 |
| 버전 배지(우측, REQ-017) | `vX.Y.Z`(현재 앱 버전) 텍스트. 새 GitHub Release 있으면 배경 강조(제안 `#d4ff00`/`#1a1a1a`) + title 툴팁 "새 버전으로 업데이트 하세요 (vX.Y.Z)", 최신이면 배경 없음 + title "최신 버전입니다". 재확인 중엔 기존 배지 유지한 채 로딩 스피너 추가 표시. 클릭 시 `dialog.showMessageBox`("GitHub 저장소를 여시겠습니까?", `[아니오,네]`) — **재확인 완료를 기다리지 않고 클릭 즉시 표시**, "네" 응답 시 `shell.openExternal`로 릴리스 목록 페이지를 시스템 브라우저에서 열기. 클릭은 캐시 나이와 무관하게 항상 강제 재확인도 함께 트리거(§4, DETAILED_DESIGN.md §10) |

**상태**: `repository: { path: string | null; status: 'idle' | 'validating' | 'valid' | 'invalid'; error?: string }`, `remoteProjectName: string | null`(REQ-018)

**추가 (업데이트 알림, REQ-017/DR-016, 2026-08-12)**: 앱 시작 시 `localStorage`(`gde:lastUpdateCheck`) 캐시가 24시간 지났으면 자동으로 백그라운드 확인. 실패(오프라인 등)해도 조용히 무시하고 직전 상태를 유지 — REQ-010(인터넷 연결 없이 동작 가능)과 충돌하지 않도록 실패가 핵심 기능에 영향을 주지 않는다. 자세한 흐름/상태표는 DETAILED_DESIGN.md §10 참고.

## 2.3 BranchSearchBar

**책임**: REQ-002, REQ-003(Search + 조회 범위), REQ-015(선택 유지), REQ-016(파일명 검색), REQ-022(작성자/Merge 커밋 제외), REQ-023(해시로 커밋 필터링).

| 요소 | 동작 |
|---|---|
| Branch dropdown | `branches: string[]` 표시. `branches` 로드 완료 시 `main` 우선, 없으면 `master`를 `selectedBranch`에 자동 설정(REQ-002). 사용자가 변경하면 `selectedBranch` 갱신 + CommitListPanel 리셋(첫 페이지부터 재조회, **`selectedHashes`도 초기화** — DR-015 예외 (b)) |
| "검색 대상 : (●메시지 ○파일명)" 라디오 토글 | `searchMode` 갱신(`'message'\|'filename'`, 기본 메시지). 즉시 같은 검색어로 재조회(REQ-016). `selectedHashes`는 유지된다 |
| Search 입력 | 로컬 텍스트 상태. 입력 300ms 디바운스 후 자동 검색 트리거 — `searchMode`에 따라 `git log --grep`(메시지) 또는 파일명 부분 일치 pathspec(REQ-016) 경로로 분기 |
| `[Search]` 버튼 | 디바운스를 기다리지 않고 즉시 검색 트리거 (보조 수단) |
| "조회 기간 : [시작일] ~ [종료일]" 날짜 선택 | `startDate`/`endDate` 갱신. 변경 시 CommitListPanel 리셋 후 재조회(REQ-003, 기본값 오늘-7일 ~ 오늘) |
| "최대 [N] 개" 입력 | `maxCount` 갱신. 변경 시 CommitListPanel 리셋 후 재조회(REQ-003, 기본값 100). 이 값이 무한 스크롤의 상한선 — 스크롤이 `maxCount`에 도달하면 더 이상 다음 페이지를 요청하지 않는다 |
| "작성자 :" 입력 (REQ-022) | 로컬 텍스트 상태. Search 입력과 동일하게 300ms 디바운스 후 자동 검색 트리거 — `git log --author=<값> -i`로 부분 일치(대소문자 무관). `searchTerm`/`searchMode`와 독립적으로 AND 결합 |
| "Merge 커밋 제외" 체크박스 (REQ-022) | `excludeMerges` 갱신, 디바운스 없이 즉시 재조회 — `git log --no-merges`. 기본값 `false`(포함) |
| "해시 필터 (쉼표/공백/줄바꿈 구분, 입력 시 다른 조건 무시)" textarea (REQ-023) | 로컬 텍스트 상태. Search 입력과 동일하게 300ms 디바운스 후 자동 검색 트리거. 값을 파싱(공백/쉼표로 분리)해 `git log --no-walk`로 그 해시와 정확히 일치하는 커밋만 조회 — 값이 있으면 branch/기간/검색어/작성자/Merge 제외를 **전부 무시**한다 |

**정정 (선택 유지, REQ-015, 2026-08-07)**: 검색 대상 토글/Search/조회 기간/최대 개수 — 이 네 가지로 인한 재조회는 전부 `selectedHashes`를 **유지**한다(Branch 변경만 예외로 초기화, 위 표 참고). 이전에는 "CommitListPanel 리셋"이 `commits`와 `selectedHashes` 둘 다를 항상 지우는 의미였지만, 이제는 `commits`만 항상 지우고 `selectedHashes`는 재조회 경로에 따라 다르다 — 자세한 규칙은 REQUIREDMENT.md DR-015, DETAILED_DESIGN.md §8.1 참고. **작성자/Merge 제외(REQ-022)·해시 필터(REQ-023)도 동일하게 `selectedHashes`를 유지한다** — 검색 조건 계열에 새로 추가된 필터일 뿐, 별도 예외를 두지 않았다.

**상태**: `branches: string[]`, `selectedBranch: string | null`, `searchTerm: string`, `searchMode: 'message'|'filename'`(기본 `'message'`), `startDate: string`(기본 오늘-7일, `YYYY-MM-DD`), `endDate: string`(기본 오늘), `maxCount: number`(기본 100), `authorFilter: string`(기본 `''`, REQ-022), `excludeMerges: boolean`(기본 `false`, REQ-022), `hashFilterText: string`(기본 `''`, REQ-023 — 값이 있으면 다른 모든 조회 조건 무시)

**정정 (2줄 레이아웃 고정, 2026-08-07, 사용자 요청)**: REQUIREDMENT.md §8 원본 와이어프레임은 "Branch/Search"를 1줄, "조회 기간/최대"를 2줄로 그렸지만, 구현은 단일 `flex-wrap` 컨테이너 하나에 네 그룹을 전부 넣어 창 폭에 따라 우연히만 2줄로 보였다(넓은 창에서는 네 그룹이 한 줄에 다 들어감). 항상 와이어프레임대로 2줄로 고정되도록 `branch-search-bar__row` 두 개(Branch+Search+버튼 / 조회기간+최대)로 분리했다 — 바깥 컨테이너는 세로 flex, 각 줄 내부에서만 flex-wrap이 적용된다(좁은 창에서 한 줄 내부 항목이 넘치는 경우의 안전망은 유지).

기본값(7일/100개)에서는 `maxCount`(100)와 CommitListPanel 페이지 크기(100, DETAILED_DESIGN.md §3.4)가 같아서 대부분 첫 페이지 한 번으로 끝난다. 사용자가 `maxCount`를 늘리면 그때부터 여러 페이지에 걸쳐 무한 스크롤이 동작한다. `endDate`는 종료일 하루 전체(23:59:59까지)를 포함한다 — git 쪽 시간 경계 처리는 DETAILED_DESIGN.md §3.2 참고.

## 2.4 CommitListPanel

**책임**: REQ-003, REQ-004. 가상 스크롤(react-window) 목록, 체크박스 다중 선택. 헤더에 `[Preview]`도 포함한다 — 원래 FooterActionBar에 있었으나 "커밋을 고르고 바로 그 자리에서 계산한다"는 흐름이 더 직관적이라는 사용자 피드백으로 이동했다(2026-08-04).

| 요소 | 동작 |
|---|---|
| 헤더 "전체 선택" 체크박스 (좌측) | 현재 **로드된 commits 기준**으로 전체 체크/해제(아직 스크롤로 안 불러온 다음 페이지는 건드리지 않음). 일부만 체크된 상태면 indeterminate 표시 — DeployFilesPanel의 전체 선택(§2.6)과 동일한 방식(추가, 2026-08-04, 사용자 요청). `commits.length === 0`이면 비활성 |
| 헤더 "N개 선택됨" 카운터 ("전체 선택" 바로 옆) | `selectedHashes.size`(현재 로드/표시된 commits와 무관하게 **전체 선택 개수**)를 항상 표시. 0개여도 표시(추가, RISK_ISSUES.md §6.1 케이스 D, 2026-08-07, 사용자 요청) |
| 헤더 `[Preview]` 버튼 (우측) | 헤더 행 최우측, "전체 선택"과 같은 줄에 배치. `selectedHashes.size === 0`일 때 비활성. 클릭 시 Commit 분석 + Mapping 엔진을 실행해 DeploymentPreviewPanel/DeployFilesPanel/DeleteListPanel을 최신 상태로 확정 표시하고 `analyzedSelection`(§2.5)을 갱신한다. **부작용 없음(파일시스템 변경 없음)** — 이 앱에서 계산이 일어나는 유일한 경로다(§2.5 참고) |
| 각 행 | 체크박스 + `hash`(mono, 7자) + `author` + `date`(mono, ISO-strict 그대로) + `message` 순서로 표시(REQ-003의 Hash/Author/Date/Message 순서 그대로). 클릭 시 `selectedHashes` 토글 |
| 스크롤 하단 도달 | 다음 페이지 IPC 요청 (DETAILED_DESIGN.md §3.4, `pageSize=100`) |

**상태**: `commits: CommitEntry[]`, `selectedHashes: Set<string>`, `pagination: { hasMore: boolean; loading: boolean }`

**빈/로딩/에러 상태**: §5 참고.

**정정 (SplitPane 셀 높이 꽉 채우기, RISK_ISSUES.md §7.4, 2026-08-07, 사용자 요청)**: MainGrid가 `SplitPane`(§7.4)으로 구현된 이후, `.commit-list-panel`에 `height:100%`가 빠져 있어서 커밋이 몇 줄 없을 때 패널이 콘텐츠 높이로만 줄어들고 `SplitPane`이 배정한 나머지 공간이 빈 배경으로 남아있었다. `.file-list-column`(§2.6)이 이미 쓰던 것과 같은 규칙(`height:100%`)을 추가해 항상 배정된 높이를 꽉 채우도록 고쳤다.

**정정 (빈/로딩/에러 상태에서도 헤더 유지, RISK_ISSUES.md §6.1 케이스 D, 2026-08-07, 사용자 요청)**: "N개 선택됨" 카운터를 추가하면서, 기존에 로딩/빈 목록/에러 상태를 패널 전체를 다른 문구로 대체하던 방식(early return)을 그대로 두면 오히려 문제가 커진다는 게 드러났다 — REQ-015로 선택이 검색 조건과 무관하게 유지되는 상황에서, 검색 결과가 0건이 되면 카운터까지 같이 사라져 "선택은 남아있는데 화면 어디에도 안 보이는" 상태가 본문뿐 아니라 헤더까지 번진다. 그래서 헤더(체크박스+카운터+Preview 버튼)는 항상 렌더링하고, 로딩/빈 목록/에러 문구는 `.commit-list-panel__body` 안쪽만 갈아끼우는 구조로 바꿨다 — DeployFilesPanel의 좌우 `FileListColumn`이 각자 자기 빈/로딩/에러를 자기 `.panel` 안에서 보여주는 것(§2.6)과 같은 방향의 수정이다.

## 2.5 DeploymentPreviewPanel

**책임**: REQ-005~007 계산 결과 집계를 읽기 전용으로 보여준다(Files/Added/Modified/Deleted — Renamed 없음, DR-008).

**정정 (SplitPane 셀 높이 꽉 채우기, 2026-08-07)**: CommitListPanel과 같은 이유로 `.deployment-preview-panel`에도 `height:100%`를 추가했다 — 자세한 배경은 §2.4의 같은 날짜 정정 참고.

**정정 (자동 재계산 제거, Preview가 유일한 트리거, 2026-08-04)**: 이전 초안은 `selectedHashes`가 바뀔 때마다 500ms 디바운스 후 자동으로 재계산하도록 설계했다. 하지만 이 방식은 "선택은 바뀌었는데 화면은 옛 결과"인 구간(디바운스 대기 중)이 항상 존재해, 그 구간에 `[Export]`를 누르면 방금 추가/해제한 커밋이 반영 안 된 채로 조용히 나갈 수 있는 위험이 있었다(§2.8 참고). 커밋 체크박스/Mapping Profile 변경은 이제 어떤 계산도 트리거하지 않는다 — `[Preview]` 클릭이 유일한 계산 트리거다.

화면이 최신 상태인지는 `selectedHashes`/`selectedBranch`/`selectedProfile`(현재 선택)과 `analyzedSelection`(마지막으로 Preview가 실제로 계산한 입력)을 비교해 파생 계산한다(`isStale`). 선택이 있는데 아직 한 번도 Preview를 안 눌렀거나, Preview 이후 선택/브랜치/Profile이 하나라도 바뀌면 `isStale = true`이며, 이때는 집계 숫자 대신 "선택이 변경되었습니다 — Preview를 눌러 계산하세요"를 표시한다. 계산 결과는 DeployFilesPanel/DeleteListPanel과 동일한 소스에서 파생되므로 세 컴포넌트는 항상 같은 계산 1회의 결과를 나눠서 보여주고, `isStale`도 동일한 기준으로 세 컴포넌트가 함께 판단한다(중복 계산·중복 판정 없음).

**상태**: `summary: { files, added, modified, deleted } | null`, `analyzing: boolean`, `analyzedSelection: { hashes: string[]; branch: string; profileName: string } | null`(마지막 Preview 계산 입력, `isStale` 파생용)

## 2.6 DeployFilesPanel

**책임**: REQ-007, REQ-008, REQ-011. 배포 대상 파일 목록(HEAD 최신본, Mapping Rule 적용 결과) + 개별/전체 파일 수동 제외.

최소 높이가 MainGrid(위쪽 CommitListPanel/DeploymentPreviewPanel 행)와 동일하게 맞춰져 있다 — §1 참고.

| 요소 | 동작 |
|---|---|
| "전체 선택" 체크박스(위치 정정, 2026-08-20) | `Local Path` 컬럼 헤더 왼쪽(각 행 체크박스와 동일 x 위치 — CSS 그리드 24px 열을 그대로 공유)에 위치. 좌우 `FileListColumn` 공통(우측도 이 시점부터 체크박스로 통일 — 아래 정정 참고). 현재 **필터에 표시된 행 기준**으로 전체 체크/해제. 필터로 숨겨진 행은 건드리지 않는다. 표시된 행 일부만 체크된 상태면 indeterminate(가로줄) 표시. 텍스트 라벨 없이 `title` 툴팁("전체 선택"/"전체 해제")만 제공(패널 헤더 영역엔 더 이상 렌더링되지 않음) |
| 헤더 옆 선택 카운터(신규, REQ-020, 2026-08-20 세 숫자로 확정) | `(선택 N개/전체 N개(필터 전 전체 N개))`. **선택**은 Filter/검색과 무관한 절대값(Export될 파일 수 — REQ-019 제외 패턴에 매치되면 실제로 Export 안 되니 이건 반영됨). **전체**는 상태 Filter+검색+제외 패턴이 적용된 뒤 화면에 보이는 개수(기존 확정 유지). **(필터 전 전체)**는 모든 필터를 무시한 참고용 순수 전체 개수. 좌우 `FileListColumn` 공통. 우측(누락된 의존성)만: "전체" 부분의 N이 50 초과면 그 부분만 붉은 글씨(`status-text--error`)로 강조 + `title="50개를 초과했습니다"` 툴팁. 50개 기준은 "전체"(화면 표시 기준)와 동일한 값으로 판단 — 검색으로 좁혀서 50개 이하로 보이면 경고도 사라진다. "선택"·"(필터 전 전체)"는 이 경고와 무관 |
| Filter dropdown | `all \| added \| modified` (클라이언트 사이드 필터, 재계산 없음. `deleted`는 이 목록 대상이 아니므로 필터 옵션에서 제외. Rename을 별도 감지하지 않으므로 `renamed` 옵션도 없음 — DR-008) |
| 제외 패턴 입력(신규, REQ-019, 좌측만) | 검색(파일명) 아래 새 행 — 텍스트 입력 + `[+추가]`. `.gitignore` 문법(`*.png`처럼 슬래시 없으면 파일명 매치, `src/test/**`처럼 슬래시 있으면 경로 매치). 등록한 패턴은 칩으로 나열되고 클릭해서 켜고 끌 수 있다(활성 패턴만 실제 적용) — 앱 재실행 후에도 유지(전역 `localStorage`, 저장소 무관) |
| 각 행 체크박스 | `included` 토글. 해제된 파일은 Export 시 deploy-files.txt와 실제 복사 대상에서 빠진다(REQ-011). Local Path 열의 파일명 텍스트를 클릭해도 동일하게 토글된다(추가, 2026-08-04) |
| Local Path 열 | `localPath` 표시. 열 헤더 오른쪽 경계를 드래그하면 최소 폭을 조절할 수 있다 |

**상태**: `deployFiles: { localPath: string; serverPath: string; status: 'added'|'modified'; included: boolean }[]`, `filter: 'all'|'added'|'modified'` — `serverPath`는 화면에는 더 이상 표시되지 않지만 Export 시 IPC 페이로드(`BuildPackageParams.files[].serverPath`)에는 그대로 쓰인다(§7.1 정정 참고).

**가상 스크롤 임계값**: 필터링된 표시 대상이 **300개를 넘으면** CommitListPanel과 동일하게 react-window 가상 스크롤을 적용한다. 이 목록은 Commit List와 달리 페이지네이션 대상이 아니다 — 계산이 이미 한 번에 끝나 전체가 메모리에 있으므로 렌더링만 가상화하면 된다. 300개는 행 하나(체크박스+경로 1열, DOM 노드 약 3개) 기준 대략치이며, 실사용 데이터로 재조정 가능하다.

`전체 선택` 체크 상태는 별도 필드로 저장하지 않고 `deployFiles`에서 파생 계산한다(`filtered.every(f => f.included)` → checked, `filtered.some(f => f.included)` → indeterminate, 그 외 unchecked) — 상태 중복 저장으로 인한 불일치를 피하기 위함.

**추가 (Local Path 컬럼 가로 스크롤·리사이즈, 2026-08-04, 사용자 피드백)**: 긴 경로가 잘려 보이는 문제를 해결하기 위해 텍스트를 자르지 않는다(ellipsis 없음) — 컬럼 폭보다 내용이 길면 패널 전체가 가로로 스크롤되어 전체 경로를 볼 수 있다. 열 헤더의 리사이즈 핸들을 드래그하면 "최소 폭"을 지정할 수 있는데, 실제 렌더링 폭은 항상 (지정한 최소 폭, 내용 길이) 중 큰 값이므로 아무리 좁게 줄여도 텍스트가 잘리지 않는다. 조절한 폭은 `localStorage`에 전역 설정 하나로 저장되어(저장소별 구분 없음) 앱 재실행 후에도 유지된다.

**정정 (헤더-목록 컬럼 폭 불일치 버그 수정, 2026-08-04, 사용자 발견)**: 위 "내용 길이 중 큰 값" 계산을 헤더 행과 각 데이터 행이 서로 별도의 CSS Grid 컨테이너로 구현하다 보니, 각 컨테이너가 `max-content`를 자기 내용(헤더는 "Local Path"라는 라벨 텍스트, 각 행은 그 행 자신의 파일 경로)만 기준으로 독립 계산해 헤더와 목록의 폭이 어긋나는 버그가 있었다. CSS의 `max-content`에 맡기는 대신 JS(`canvas.measureText` + `getComputedStyle`)로 현재 필터링된 전체 행과 헤더 라벨 중 가장 넓은 폭을 실측해 모든 행(가상 스크롤 포함)에 동일한 값을 주입하는 방식으로 바꿔 해소했다.

**정정 (300개 초과 시 중첩 가로 스크롤 수정 완료, 2026-08-20, 사용자 발견)**: 아래 문단은 발견 당시의 "알려진 제약" 기록이며, 지금은 해결된 과거 상태다. 재현 테스트로 정확한 조건(정확히 300개 초과, 그 미만은 문제 없음)을 확인한 뒤, react-window `List`가 `style` prop을 자기 루트에 마지막에 spread한다는 걸 소스 코드로 확인해(DETAILED_DESIGN.md §12.2) `style={{ overflowX: 'hidden' }}`을 추가하는 것만으로 해결했다 — CSS 선택자 우회 불필요. 450개 fixture로 재검증해 중첩 스크롤 컨텍스트가 사라진 것을 확인했다.

**알려진 제약(해결됨, 아래는 발견 당시 기록)**: 위 수정으로 컬럼 **폭 자체**는 필터링된 표시 대상 개수와 무관하게 항상 헤더와 목록이 일치한다. 다만 필터링된 표시 대상이 300개를 넘어 가상 스크롤이 적용되는 경우, react-window가 세로 가상 스크롤을 위해 자기 루트에 `overflow-y:auto`를 설정하는데 CSS 스펙상 이것이 가로축에도 전이되어(visible과 non-visible을 함께 쓸 수 없음) 리스트 자신이 별도의 가로 **스크롤 위치** 컨텍스트가 된다. 그 결과 리스트 내부 스크롤로 긴 경로를 전부 볼 수는 있지만, 사용자가 리스트를 가로로 스크롤하면 헤더 라벨("Local Path")의 스크롤 위치가 그걸 따라가지 않는다(폭 불일치가 아니라 스크롤 위치 동기화 문제) — `overflowX:'hidden'` 적용 후에는 react-window 내부 루트가 애초에 가로 스크롤 컨텍스트를 갖지 않으므로 이 문제 자체가 사라진다.

**정정 (Server Path 열 삭제, RISK_ISSUES.md §7.1, 2026-08-07)**: FooterActionBar(§2.8)에서 Mapping Profile 드롭다운을 숨기면서, 유일한 프로필인 `default`의 `overrides`가 항상 빈 배열이라는 게 재확인되었다 — 즉 Server Path가 사실상 항상 Local Path와 같은 값이었다. 화면에 항상 동일한 두 열을 나란히 보여줄 이유가 없어 Server Path 열을 삭제하고 Local Path 단일 컬럼으로 바꿨다. 위 세 문단(컬럼 리사이즈/폭 불일치 수정/알려진 제약)에 있던 Server Path 관련 서술은 이번 정정으로 모두 제거됐다.

**정정 (좌우 분할 재구성 — 의존성 완결성 검사, REQ-013, RISK_ISSUES.md §7.2, 2026-08-07)**: 위에서 설명한 단일 목록 구조를 `SplitPane`(§7.4)으로 좌우 분할했다. 이 정정 이후의 최신 구조는 다음과 같다 — 위 문단들의 "컬럼 실측 폭/리사이즈/가상 스크롤" 메커니즘 자체는 그대로 재사용되지만(공용 컴포넌트 `FileListColumn`, `src/renderer/src/components/deployFiles/FileListColumn.tsx`), 좌우 각각 독립적으로 적용된다.

**책임 추가**: REQ-013(의존성 완결성 검사)도 이 패널이 담당한다.

| 구성 | 설명 |
|---|---|
| 패널 제목 | `Deploy Files (HEAD Latest Version)` — 테두리 없는 얇은 부모 영역 상단에 한 번만 표시(양쪽 공통 헤더가 아니라 부모 전체 제목) |
| 좌: 포함된 파일 (`FileListColumn`) | 기존 `deployFiles` 그대로 — "전체 선택" 체크박스(Local Path 컬럼 헤더에 위치, 필터에 표시된 행 기준, indeterminate 지원), Filter 드롭다운(`all\|added\|modified`), 파일명 검색 입력, 제외 패턴 입력(REQ-019), Local Path 단일 컬럼 |
| 우: 누락된 의존성 (`FileListColumn`) | REQ-013 결과(`missingDependencies`) — **정정(2026-08-20)**: 원래는 `[전체 추가]` 버튼(단방향, 아직 추가 안 된 것만 추가)이었으나 좌측과 동일한 "전체 선택" 체크박스(양방향, 전체 추가 ↔ 전체 제거)로 교체. Filter 드롭다운 없음(상태 개념이 없으므로), 파일명 검색 입력, 경로 옆에 `(인터페이스)`/`(구현체)` 라벨 |
| 좌우 경계 | `SplitPane`으로 드래그 조절(§7.4), 기본 50:50, 최소 폭 260px씩 |

**정정 (부모/자식 패널 경계 분리 — 독립 스크롤, 2026-08-07, 사용자 요청)**: 처음 §7.2 구현 시점에는 `DeployFilesPanel` 바깥 div 하나가 `.panel`(테두리+배경+`overflow:auto`)이었고 제목·좌우 `FileListColumn` 전부를 그 안에 담았다 — MainGrid(CommitListPanel/DeploymentPreviewPanel이 각자 독립된 `.panel`이고, 그걸 감싸는 `SplitPane`은 제목도 테두리도 없는 순수 레이아웃 wrapper인 구조)와 다른 패턴이었다. 사용자가 "누락된 의존성 목록과 포함된 파일 목록의 스크롤을 개별적으로 하고 싶다"고 요청하면서 MainGrid와 같은 패턴으로 맞췄다 — `DeployFilesPanel`의 바깥 div는 이제 `.panel` 클래스를 갖지 않는 얇은 제목 전용 컨테이너이고(`main-grid`처럼 세로 flex 크기만 담당), 좌우 `FileListColumn` 각각이 `.panel`(자기 테두리 + 자기 배경)이 되어 그 안의 `.deploy-files-panel__scroll`이 완전히 독립적으로 스크롤된다. Stale 상태(§2.5 `isStale`) 표시도 이 변경에 맞춰 부모 전체를 한 메시지로 대체하던 방식에서, 좌우 각자의 `.panel` 박스 안에서 개별적으로 표시하는 방식으로 바뀌었다(MainGrid에서 CommitListPanel/DeploymentPreviewPanel이 각자 자기 빈/로딩/에러 상태를 보여주는 것과 동일한 패턴).

**우측 패널의 로딩/비활성 상태**: Preview 완료 후 의존성 검사가 자동으로 체이닝 실행되는 동안(`dependencyAnalyzing`)은 "의존성 확인 중..."을 표시한다. 이 저장소에 적용할 수 없으면(`dependencyApplicable === false` — Java 파일이 대상에 없거나 `@SpringBootApplication`을 못 찾은 경우) 그 사유(`dependencyReason`)를 표시하고 목록/검색 UI 자체를 렌더링하지 않는다. 실패해도 좌측 패널과 나머지 화면은 정상 동작한다(best-effort). 이 상태들도 위 정정과 같은 이유로 좌/우 각자의 `.panel` 박스 안에서 개별적으로 표시된다.

**우측 항목의 체크 시맨틱**: 체크(추가)해도 목록에서 사라지지 않는다 — 좌측 `included`처럼 "이미 `deployFiles`에 들어갔는가"를 계속 보여준다(체크 해제하면 `deployFiles`에서 다시 빠진다). 경로 텍스트 클릭도 체크박스와 동일하게 토글된다(좌측과 동일한 상호작용 재사용).

**파일명 검색(좌우 공통, 신규)**: 경로 전체가 아니라 **파일명(경로의 마지막 조각)** 부분 일치로 필터링한다 — §7.3(파일명으로 커밋 검색)과 매칭 기준을 통일했다. 상태 Filter(좌측만 있음) 이후에 적용된다.

**추가 (배포 대상 파일 제외 패턴, REQ-019, DR-018, 2026-08-12)**: 좌측(포함된 파일)에만 적용되는 별도 필터. 파일명 검색과 역할이 다르다 — 검색은 "지금 찾고 싶은 것만 보기"(매번 새로 입력, 지워지는 일시적 포함 필터)인 반면, 제외 패턴은 "이 종류는 앞으로도 계속 안 올린다"(한 번 등록하면 재사용하는 지속적 제외 필터). 활성 패턴에 매치되는 파일은 목록에서 완전히 숨겨지고 Export 대상에서도 제외된다(단, `deployFiles[].included`를 직접 고치지 않고 Export 시점에 별도로 한 번 더 걸러내는 파생 계산 방식 — DETAILED_DESIGN.md §12.1). 우측(누락된 의존성)에는 적용하지 않는다 — 그 목록은 항상 `.java` 파일만 나오도록 설계되어 있어(REQ-013) 이 패턴이 사실상 적용될 일이 없다.

**정정 (전체 선택/전체 추가가 검색어를 무시하는 버그 수정 완료, 2026-08-12, 코드 리딩으로 발견)**: 좌측 "전체 선택"은 상태 Filter(드롭다운)만 반영해 다시 계산하고 파일명 검색은 무시했고, 우측 "전체 추가"는 Filter/검색 둘 다 무시하고 항상 `missingDependencies` 전체를 대상으로 했다 — 이 문서 위쪽 표(§2.6 "전체 선택" 행)에 적혀 있던 "필터에 표시된 행 기준"이라는 의도와 실제 동작이 어긋나 있었다. 근본 원인은 필터 로직이 `DeployFilesPanel.tsx`(화면 표시용)와 store(토글 대상 계산용) 두 곳에 중복 구현되어 서로 어긋난 것 — 수정 후에는 **좌우 둘 다 상태 Filter + 파일명 검색이 모두 적용된, 화면에 실제로 보이는 행만** 대상으로 한다(단일 진실 공급원: 화면 표시 목록을 그대로 액션 파라미터로 전달). DETAILED_DESIGN.md §9 표, RISK_ISSUES.md 결정 이력 참고.

**정정 (우측도 "전체 선택" 체크박스로 통일, 2026-08-20)**: 위 문단의 우측 "전체 추가"는 이후 좌측과 동일한 양방향 "전체 선택" 체크박스로 완전히 교체됐다(DETAILED_DESIGN.md §12.4) — 단방향 add-only 버튼 자체가 없어졌다. "화면에 실제로 보이는 행만 대상"이라는 이 정정의 핵심 원칙은 그대로 유지된다.

**상태 추가**: `missingDependencies: { localPath: string; serverPath: string; status: 'added'; kind: 'interface'|'class' }[]`, `dependencyApplicable: boolean`, `dependencyReason: string | null`, `dependencyAnalyzing: boolean`, `dependencyParseWarnings: { path: string; reason: string }[]`, `deployFilesSearchTerm: string`, `dependencySearchTerm: string`(§3 참고), `excludePatterns: { pattern: string; enabled: boolean }[]`(REQ-019, `localStorage` 전역 저장·복원, §3 참고).

**경고 배너 추가**: 기존 "N개 파일이 HEAD에 없어 제외되었습니다"(DR-009) 배너 아래, 의존성 검사 중 파싱에 실패한 파일이 있으면 "N개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다" 배너를 추가로 보여준다(`dependencyParseWarnings`).

**추가 (배포 대상 파일 수동 추가, REQ-021/DR-019, 2026-08-22)**: 좌측(포함된 파일) 패널 헤더에 `+ 파일 추가` 트리거 버튼을 추가한다. 클릭하면 팝업이 뜨는데, 안에는 (1) 선택된 Branch의 HEAD 트리 파일 전체를 대상으로 한 자동완성 검색 입력, (2) 입력값에 매치되는 후보 목록(클릭해야 추가되며, 후보에 없는 자유 텍스트는 추가 불가), (3) 이번 Preview 결과에 수동으로 추가한 파일의 칩 이력이 들어간다.

**정정 (팝업 위치·크기, 2026-08-22)**: 최초엔 팝업이 트리거 버튼 아래 "포함된 파일" 목록을 안 가리는 위치까지만 확장되는 형태였으나, 목록을 가려도 상관없다는 사용자 결정으로 좌우 두 컬럼을 감싸는 부모(`DeployFilesPanel`) 중앙에 고정 크기(480px, 최대 뷰포트의 60%)로 뜨는 모달로 바뀌었다. 배경을 반투명 backdrop으로 덮고, backdrop 클릭이나 `×`로 닫는다. 목록(좌/우 둘 다) 위를 그대로 덮을 수 있는 대신, 팝업 안 "수동 추가 이력" 칩을 REQ-017 버전 배지와 같은 강조색(연두색)으로 눈에 띄게 표시해 — 목록이 안 보여도 지금까지 뭘 추가했는지는 팝업 안에서 바로 확인된다.

추가한 파일은 diff로 들어온 파일·REQ-013 의존성 후보로 추가된 파일과 목록 안에서 시각적으로 구분되지 않는다(동일한 `deployFiles` 항목으로 취급 — REQ-019 제외 패턴도 예외 없이 동일 적용). 구분이 필요한 시점(추가 직후 확인)은 팝업 안 강조색 칩 이력이 담당한다.

**생명주기**: `[Preview]`를 다시 실행해 `deployFiles`가 새 결과로 전체 교체되면, 수동으로 추가했던 파일과 팝업 안 칩 이력이 함께 초기화된다(REQ-013 의존성 후보와 동일한 생명주기 — DR-019에 트레이드오프 근거 기록).

## 2.7 DeleteListPanel

**책임**: DR-007. 읽기 전용.

삭제된 파일의 Server Path를 그대로 나열한다. Rename을 별도로 감지하지 않으므로(DR-008), 이 목록에 있는 항목이 실제 삭제인지 Rename으로 인한 이전 이름인지 UI가 구분해주지 않는다 — DeployFilesPanel의 Added 목록과 함께 보고 사용자가 직접 판단한다.

**상태**: `deleteList: { path: string }[]`

## 2.8 FooterActionBar

**책임**: REQ-009, REQ-010, REQ-012. Export 경로 변경 + Export 실행. (§0-3 결정으로 Preview/Export 2단계 구조 확정 — `[Build]` 없음)

**정정 (Preview 위치 이동, 2026-08-04, 사용자 요청)**: `[Preview]`는 원래 이 컴포넌트에 있었으나, "커밋을 고르고 → 바로 그 자리에서 계산한다"는 흐름이 더 직관적이라는 피드백으로 CommitListPanel 헤더(§2.4)로 옮겼다.

**정정 (Mapping Profile 숨김 + Export 경로 변경 UI로 교체, RISK_ISSUES.md §7.1, 2026-08-07)**: Mapping Profile 드롭다운을 화면에서 숨겼다 — 현재 "default" 하나뿐이고 사용자가 프로필을 만들거나 편집할 UI가 없어 사실상 무의미했기 때문이다(내부 로직은 `selectedProfile: 'default'`를 그대로 계산에 넘기며 동작 변경 없음). 대신 REQ-012(Export 경로 선택) UI가 이 자리에 들어왔다.

| 요소 | 동작 |
|---|---|
| `[변경]` 버튼 | `package:browseExportDir` IPC로 OS 네이티브 폴더 다이얼로그를 연다(자유 텍스트 입력 없음). 선택하면 `exportParentDir`를 갱신하고 `localStorage`(`gde:exportParentDir`)에 저장해 재실행 후에도 유지한다(REQ-012) |
| 경로 표시 텍스트 | `exportParentDir ?? repository.path`를 표시(`[변경]` 버튼 바로 오른쪽). 커스텀 경로를 한 번도 선택하지 않았으면 저장소 루트가 기본값이다. 넘치면 ellipsis, `title` 툴팁으로 전체 경로 확인 |
| `[Export]` | Preview에 표시된 내용을 그대로 실행: `<exportParentDir ?? repoPath>/git-deploy-extracted/` 생성 + 파일 복사 + delete-list.txt/deploy-files.txt/deploy-summary.json 생성까지 전부 수행(DETAILED_DESIGN.md §2, §4.3, Package Builder 전체). 다른 버튼과 달리 더 진한 배경색(`.button--primary`)으로 시각적으로 구분한다 — 실제로 파일을 쓰는 유일한 버튼이기 때문 |

레이아웃 순서: `[변경] [경로 표시] ... [Export]` — 변경 버튼이 경로 값의 왼쪽에 온다(RISK_ISSUES.md §7.5 와이어프레임).

버튼 비활성 조건: `[Export]`는 `selectedHashes.size === 0`이거나 `isStale`(§2.5)일 때 비활성 — 마지막 Preview 결과가 지금 선택과 정확히 일치할 때만 눌러진다. `isStale`인데 선택이 비어있지 않으면 "Preview를 먼저 실행하세요" 안내를 버튼 옆에 표시한다.

**추가 (덮어쓰기 확인, DR-013, 2026-08-07)**: `[Export]` 클릭 시 대상 폴더(`<exportParentDir ?? repoPath>/git-deploy-extracted`)에 이미 내용이 있으면, Main Process가 `dialog.showMessageBox`(네이티브 모달)로 "이미 있는 git-deploy-extracted를 덮어씁니다, 계속할까요?"를 확인한다. 사용자가 "취소"를 선택하면 `exportStatus`가 `'idle'`로 되돌아가고 에러 배너 없이 조용히 중단된다(에러가 아니라 사용자의 명시적 취소이기 때문 — DETAILED_DESIGN.md §4.3).

**정정 (Export 직전 레이스 컨디션 방지, 2026-08-04)**: 이전 초안(자동 재계산)에서는 디바운스 대기 중에 `[Export]`를 누르면, 방금 바뀐 선택이 `selectedCommits`(즉석 계산이라 정확)엔 반영되지만 `deployFiles`/`deleteList`(디바운스 후에야 갱신되는 옛 계산 결과)엔 반영 안 된 채로 나가는 문제가 있었다 — `deploy-summary.json`은 선택한 커밋을 전부 기록하는데 실제 복사된 파일은 일부 커밋 분만 빠지는, 에러 없이 조용히 틀린 결과였다. `[Export]`를 `isStale`일 때 비활성화하는 것만으로 이 구간 자체가 없어진다(추가로 `runExport()` 내부에서도 한 번 더 확인한다).

**추가 (Export 완료 메시지 — 한 줄 고정 + title + 클립보드 복사, 2026-08-04, 사용자 요청)**: `exportStatus === 'done'`일 때 표시되는 "Export 완료: {절대 경로}" 메시지는 한 줄로 고정되고 넘치는 부분은 ellipsis(`...`)로 잘린다 — 경로가 길면 여러 줄로 줄바꿈되며 패널/뷰포트 밖으로 넘쳐 잘리는 버그가 재현 테스트로 발견되어(§6 참고) 이 방식으로 막았다. 전체 경로는 `title` 툴팁(호버)으로 확인하고, 메시지를 클릭하면 `navigator.clipboard.writeText()`로 클립보드에 복사된다. Credit(§2.9)이 화면 우측 하단에 고정 배치되면서 FooterActionBar 우측 끝과 겹칠 수 있어, `padding-right: 60px`(Credit 이미지 폭만큼)도 함께 추가했다.

## 2.9 Credit

**책임**: 없음(REQ/DR 대상 아님). 제작자 GitHub 링크, 화면 우측 하단 고정. 2026-08-04 사용자 요청으로 추가된, 요구사항 문서 범위 밖의 장식용 UI 요소다.

| 요소 | 동작 |
|---|---|
| 이미지 링크 | 제작자 자작 캐릭터 이미지(50×50, `src/renderer/src/assets/goraeng.png`)를 원본 크기로 표시. 클릭 시 `https://github.com/neisii/git-deploy-extractor`(이 저장소 페이지)를 시스템 기본 브라우저로 연다(`target="_blank"` + `rel="noopener noreferrer"`, Main Process의 `webContents.setWindowOpenHandler`가 새 창 생성을 가로채 `shell.openExternal`로 위임 — 앱 내부 네비게이션 없음). 호버 시 `title="클릭 시 이 저장소의 Github 페이지로 이동합니다."` 툴팁 표시 |

**정정 (링크 대상: 제작자 프로필 → 저장소 페이지, 2026-08-20, 사용자 요청)**: 기존엔 `https://github.com/neisii`(제작자 GitHub 프로필)로 연결했으나, 이 저장소 페이지(`https://github.com/neisii/git-deploy-extractor`)로 바꾼다 — 클릭 시 도착지가 이 앱의 이슈/릴리스/소스코드를 바로 볼 수 있는 곳이 되는 게 더 유용하다는 판단. 툴팁 문구도 그에 맞게 정정.

**상태 없음** — 정적 요소, Zustand 스토어와 무관하다. `position: fixed`로 배치되어 다른 패널의 레이아웃(높이 등)에 영향을 주지 않는다.

**접근성**: `alt=""`로 장식용 이미지임을 명시(스크린리더가 무시하도록 하는 유효한 시맨틱 — 완전히 생략하는 것과 다르다). 스크린리더 전반 지원은 이 앱의 목표가 아니라는 게 사용자 확인 사항이다(2026-08-04).

---

# 3. 전역 상태 스토어 (Zustand)

ARCHITECTURE.md §2.2에 상태관리로 Zustand를 채택했다. 단일 스토어로 설계한다 — 패널 대부분이 "선택된 Commit → 계산된 배포 대상"이라는 동일한 파생 데이터를 나눠 보기 때문에, 스토어를 쪼개면 오히려 동기화 로직이 늘어난다.

```ts
interface AppState {
  repository: { path: string | null; status: 'idle'|'validating'|'valid'|'invalid'; error?: string };
  remoteProjectName: string | null; // REQ-018/DR-017, TitleBar 표시용 — git remote origin에서 유도, null이면 폴더명으로 폴백
  branches: string[];
  selectedBranch: string | null;
  startDate: string;   // YYYY-MM-DD, 기본 오늘-7일
  endDate: string;     // YYYY-MM-DD, 기본 오늘
  maxCount: number;    // 기본 100
  searchTerm: string;
  searchMode: 'message' | 'filename';   // REQ-016, 기본 'message'
  authorFilter: string;   // REQ-022, 기본 '' — 작성자명 부분 일치, searchTerm과 독립적으로 AND 결합
  excludeMerges: boolean; // REQ-022, 기본 false(포함) — Merge 커밋 제외
  hashFilterText: string; // REQ-023, 기본 '' — 값이 있으면 branch/기간/검색어/author/excludeMerges 전부 무시

  commits: CommitEntry[];
  selectedHashes: Set<string>;
  commitPagination: { hasMore: boolean; loading: boolean };
  commitListError: string | null;   // §5 에러 상태("커밋 조회 실패")에 대응

  analyzing: boolean;
  analysisError: string | null;     // §5 에러 상태("계산 실패 메시지")에 대응
  analyzedSelection: { hashes: string[]; branch: string; profileName: string } | null;  // §2.5 isStale 파생용
  summary: { files: number; added: number; modified: number; deleted: number } | null;
  deployFiles: DeployFileEntry[];
  deployFilesFilter: 'all' | 'added' | 'modified';   // §2.6 Filter dropdown 상태
  deployFilesSearchTerm: string;    // §2.6, REQ-013과 함께 추가 — 좌측 파일명 검색
  // REQ-019/DR-018 — localStorage(gde:excludePatterns)로 동기 초기화(lazy
  // initializer, updateInfo/columnWidths와 동일 패턴). enabled인 것만 실제
  // 적용되고, 비활성 패턴도 이력으로 남아있어 다시 켤 수 있다.
  excludePatterns: { pattern: string; enabled: boolean }[];
  // REQ-021/DR-019 — 팝업 안 칩 이력 표시 전용. localStorage에 저장하지
  // 않는다(제외 패턴과 달리 영속시킬 이유가 없음). Preview 재실행 시
  // deployFiles와 함께 초기화된다(§2.6 "생명주기" 참고).
  manuallyAddedPaths: string[];
  deleteList: DeleteEntry[];
  warnings: { path: string; reason: string }[];

  // REQ-013, §2.6 우측 "누락된 의존성" 패널. Preview 성공 직후 자동 체이닝된다.
  dependencyAnalyzing: boolean;
  dependencyApplicable: boolean;
  dependencyReason: string | null;
  missingDependencies: { localPath: string; serverPath: string; status: 'added'; kind: 'interface'|'class' }[];
  dependencyParseWarnings: { path: string; reason: string }[];
  dependencySearchTerm: string;

  profiles: string[];
  selectedProfile: string;

  exportParentDir: string | null;   // §2.8, REQ-012. null이면 저장소 루트가 기본값

  exportStatus: 'idle' | 'exporting' | 'done' | 'error';
  exportError: string | null;       // §5 에러 상태("실패 사유를 인라인 배너로 표시")에 대응
  lastExportDir: string | null;     // Export 완료 후 결과 경로 표시용

  // REQ-017/DR-016, §2.2 버전 배지. updateInfo가 null이면 "확인 안 됨/직전 캐시
  // 없이 실패"로 간주(배경 없음), updateChecking과는 독립적으로 갱신된다 —
  // 재확인 중에도 직전에 알던 updateInfo를 그대로 보여주며 스피너만 추가한다.
  // hasUpdate는 "다르다"가 아니라 "latestVersion > 현재 app.getVersion()"(엄격히
  // 큼) — 로컬이 원격보다 같거나 앞서면 false(DETAILED_DESIGN.md §10.2). 클릭 시
  // 여는 URL은 항상 고정된 릴리스 인덱스 페이지라 releaseUrl(특정 태그 딥링크)은
  // 상태로 들고 있지 않는다(§10.5, 안 쓰는 데이터를 만들지 않는다).
  // 스토어 생성 시점에 localStorage(gde:lastUpdateCheck)로 동기 초기화한다
  // (splitRatio/columnWidths와 동일한 lazy initializer 패턴) — 마운트 후
  // 비동기로 채우면 첫 렌더링에 배지가 잠깐 "평시"로 반짝이는 깜빡임이 생긴다.
  updateInfo: { hasUpdate: boolean; latestVersion: string } | null;
  updateChecking: boolean;
}
```

**파생 계산 흐름 (정정, 2026-08-04)**: `selectedHashes`/`selectedBranch`/`selectedProfile` 변경은 더 이상 IPC를 트리거하지 않는다 — `[Preview]` 클릭만이 단일 IPC 호출(Commit 분석 엔진 + Mapping Rule 엔진 결과)을 일으키고, 그 결과로 `summary`/`deployFiles`/`deleteList`/`warnings`/`analyzedSelection`이 동시 갱신된다. `isStale = 현재 (selectedHashes, selectedBranch, selectedProfile) ≠ analyzedSelection`으로 파생 계산하며, 세 미리보기 패널(§2.5~2.7)과 `[Export]` 비활성 조건(§2.8)이 모두 이 값을 공유한다. 개별 `included` 토글(DeployFilesPanel)만 예외로 로컬 갱신(재계산도, staleness 판정도 없음 — 이미 계산된 목록 안에서의 선택/해제이기 때문).

**추가 (의존성 검사 체이닝, REQ-013, 2026-08-07)**: `[Preview]`가 성공하면(위 IPC 완료 직후) 곧바로 두 번째 IPC(`analysis:dependencies`)를 자동으로 호출해 `missingDependencies`/`dependencyApplicable`/`dependencyReason`/`dependencyParseWarnings`를 채운다 — 별도 버튼 없음. 이 두 번째 호출이 실패해도 첫 번째 IPC의 결과(`summary`/`deployFiles` 등)는 그대로 유효하다(우측 패널에만 영향). `missingDependencies`의 개별/전체 추가·제거(`toggleDependencyIncluded`/`toggleAllMissingDependencies`, 2026-08-20 이전 이름은 `addAllMissingDependencies`)도 `toggleDeployFileIncluded`와 동일하게 로컬 갱신이며 재계산·staleness 판정을 일으키지 않는다 — 대상이 `deployFiles` 배열에 항목을 추가/제거하는 것뿐이기 때문이다.

**추가 (업데이트 확인, REQ-017/DR-016, 2026-08-12)**: `updateInfo`/`updateChecking`은 다른 파생 계산(§2.5 `isStale` 등)과 무관한 독립 상태다. 앱 시작 시 `localStorage`(`gde:lastUpdateCheck`) 캐시가 24시간 지났으면, 버전 배지 클릭 시엔 캐시 나이와 무관하게 항상, `updateChecking=true`로 두고 Main IPC(`window.api.checkForUpdate`)를 호출한다. 응답이 오면 성공 시 `updateInfo`를 갱신하고 캐시도 새로 쓰지만, 실패 시엔 `updateInfo`를 건드리지 않고(직전 상태 유지) 캐시도 갱신하지 않는다 — 두 경우 모두 `updateChecking`은 false로 되돌린다. 클릭 시 뜨는 `dialog.showMessageBox` 확인창은 이 IPC 호출과 별개로 즉시 트리거되며 응답을 기다리지 않는다(DETAILED_DESIGN.md §10.3).

---

# 4. 인터랙션 정의

| 트리거 | 상태 변화 | IPC 호출 | 대응 |
|---|---|---|---|
| `[Browse...]` 클릭 | `repository.status = 'validating'` | `dialog.showOpenDialog` → `git rev-parse` | REQ-001 |
| Branch 목록 로드 완료 | `selectedBranch`를 main/master 우선순위로 자동 설정 | 없음(로컬 판단) | REQ-002 |
| Branch 변경 | `commits = []`, **`selectedHashes = {}`**(DR-015 예외), `commitPagination.loading = true` | `git log --since --max-count` 첫 페이지 | REQ-002, DR-015 |
| Repository Reload | `commits = []`, `selectedHashes`는 **유지**, `commitPagination.loading = true` | `git log --since --max-count` 첫 페이지 | REQ-015, DR-015 |
| `startDate`/`endDate`/`maxCount`/`searchMode` 변경, Search 트리거 | `commits = []`, `selectedHashes`는 **유지**, `commitPagination.loading = true` | `git log --since --until`(+`--grep` 또는 파일명 pathspec) 첫 페이지 | REQ-003, REQ-015, REQ-016 |
| 커밋 목록 스크롤 하단 도달 | `commitPagination.loading = true`. 이미 `maxCount`만큼 로드했으면 요청하지 않음(`hasMore = false`) | `git log --skip` 다음 페이지(현재 `searchMode`/`authorFilter`/`excludeMerges`/`hashFilterText` 유지) | REQ-003 |
| Search 입력 (디바운스) | 없음 (요청 중 표시만) | `searchMode`에 따라 `git log --grep` 또는 파일명 pathspec | REQ-003, REQ-016 |
| 작성자 입력 (디바운스) | `commits = []`, `selectedHashes`는 **유지**, `commitPagination.loading = true` | `git log --author=<값> -i` 추가 | REQ-022 |
| "Merge 커밋 제외" 체크박스 토글 | `commits = []`, `selectedHashes`는 **유지**, `commitPagination.loading = true`, 디바운스 없이 즉시 | `git log --no-merges` 추가/제거 | REQ-022 |
| 해시 필터 입력 (디바운스) | `commits = []`, `selectedHashes`는 **유지**, `commitPagination.loading = true`. 값이 있으면 branch/기간/검색어/author/excludeMerges 무시 | `git log --no-walk <hash1> <hash2> ...`(일부 오류 시 `cat-file -e`로 개별 검증 후 재시도) | REQ-023 |
| 검색 대상 라디오 토글 | `searchMode` 갱신, 즉시 재조회(디바운스 없음) | `searchMode`에 따라 `git log --grep` 또는 파일명 pathspec | REQ-016 |
| 커밋 체크박스 토글 | `selectedHashes` add/remove. IPC도, 어떤 계산도 트리거하지 않는다 — `isStale`이 즉시 파생 계산으로 true가 된다 | 없음 | REQ-004~008 |
| Mapping Profile 변경 | `selectedProfile` 갱신. 마찬가지로 계산을 트리거하지 않는다 | 없음 | REQ-008 |
| DeployFilesPanel(좌) 체크박스 토글 | 해당 항목 `included` 반전 | 없음 (로컬) | REQ-011 |
| DeployFilesPanel(좌) 전체 선택 토글 | 필터+검색에 표시된 행 전체 `included` 일괄 반전 | 없음 (로컬) | REQ-011 |
| DeployFilesPanel(좌/우) 파일명 검색 입력 | `deployFilesSearchTerm`/`dependencySearchTerm` 갱신, 즉시 클라이언트 필터링(디바운스 없음) | 없음 (로컬) | REQ-013 |
| `[Preview]` 클릭 | `analyzing = true` → 완료 시 `summary`/`deployFiles`/`deleteList`/`warnings`/`analyzedSelection` 동시 갱신(`manuallyAddedPaths`도 함께 초기화 — REQ-021), 이어서 `dependencyAnalyzing = true` → 완료 시 `missingDependencies` 등 갱신(체이닝) | Commit 분석 + Mapping 엔진 → 의존성 완결성 검사 | REQ-005~008, REQ-013, REQ-021 |
| DeployFilesPanel(우) 개별 체크박스 토글 | `deployFiles`에 없으면 추가, 있으면 제거 | 없음 (로컬) | REQ-013 |
| "전체 선택" 토글 (우, 2026-08-20 체크박스로 통일) | 필터+검색에 표시된 `missingDependencies`가 전부 이미 `deployFiles`에 있으면 그 경로들을 전부 제거(전체 해제), 그 외(일부/전무)면 아직 없는 것만 전체 추가 — 좌측 `toggleAllDeployFiles`와 동일한 양방향 판정 방식 | 없음 (로컬) | REQ-013 |
| `[변경]` 클릭 (FooterActionBar) | 취소 시 상태 변화 없음. 선택 시 `exportParentDir` 갱신 + `localStorage` 저장 | `dialog.showOpenDialog`(`package:browseExportDir`) | REQ-012 |
| `[Export]` 클릭 | `exportStatus = 'exporting'` → `'done'`\|`'error'`\|(취소 시)`'idle'` | Package Builder(전체: 파일 복사 + 3종 Export). 대상 폴더에 기존 내용 있으면 먼저 `dialog.showMessageBox` 확인. 대상 파일은 `included:true`이면서 **활성 제외 패턴에 매치되지 않는** 것만(REQ-019, DR-018) | REQ-009, REQ-010, DR-013 |
| SplitPane 경계 드래그(MainGrid/DeployFilesPanel) | 드래그 중 실시간 비율 반영, mouseup 시 `localStorage`에 최종 비율 저장 | 없음 (로컬) | REQ-014 |
| 앱 시작(캐시 24h 초과 시) | `updateChecking = true` → 완료 시 `updateInfo` 갱신(성공, `hasUpdate`는 원격이 로컬보다 엄격히 클 때만 true) 또는 유지(실패), `updateChecking = false` | `checkForUpdate`(GitHub `releases/latest`) | REQ-017, DR-016 |
| 버전 배지 클릭 | 캐시 나이 무관하게 `updateChecking = true`(위와 동일 흐름) — **응답을 기다리지 않고 즉시** `dialog.showMessageBox` 확인창도 같이 뜬다. "네" 응답 시에만 `shell.openExternal`(고정 인덱스 URL). **이미 `updateChecking===true`거나 확인창이 이미 열려 있으면** 새 네트워크 호출/확인창을 추가로 띄우지 않는다(연속 클릭 가드) | `checkForUpdate` + (확인 시)`shell.openExternal` | REQ-017, DR-016 |
| 제외 패턴 `[+추가]` 클릭 (좌) | `excludePatterns`에 `{pattern, enabled:true}` 추가, `localStorage` 저장. 즉시 해당 패턴에 매치되는 행이 목록에서 숨겨짐 | 없음 (로컬) | REQ-019, DR-018 |
| 제외 패턴 칩 클릭 (좌) | 해당 패턴의 `enabled` 토글, `localStorage` 저장. 비활성화하면 그 패턴 때문에 숨겨졌던 행이 즉시 다시 보임(원래 `included` 값 그대로 — 별도 복원 로직 없음) | 없음 (로컬) | REQ-019, DR-018 |
| `+ 파일 추가` 클릭 (좌) | `DeployFilesPanel`의 `manualAddOpen = true` — 부모(`.deploy-files-panel`) 중앙에 모달 팝업이 뜬다 | 없음 (로컬) | REQ-021, DR-019 |
| 팝업 검색 입력 (자동완성) | 없음 (표시용 후보 필터링만, 디바운스 없음) | 없음 (로컬) | REQ-021, DR-019 |
| 팝업 후보 클릭 | `deployFiles`에 없으면 추가 + `manuallyAddedPaths`에 경로 push(강조색 칩으로 표시). 이미 있으면 무시 | 없음 (로컬, HEAD 파일 내용은 이미 §6 경로로 조회된 값 재사용) | REQ-021, DR-019 |
| 팝업 칩 `×` 클릭 | `deployFiles`에서 해당 경로 제거, `manuallyAddedPaths`에서도 제거(제외 패턴 칩과 달리 토글이 아니라 철회) | 없음 (로컬) | REQ-021, DR-019 |
| 팝업 backdrop 클릭 또는 `[×]` | `manualAddOpen = false` — 팝업만 닫힘, 이미 추가된 파일은 그대로 유지 | 없음 (로컬) | REQ-021, DR-019 |

**정정 (커밋 선택 유지, REQ-015/016, 2026-08-07)**: 위 표에서 "`selectedHashes = {}`"로 표시된 두 트리거(Browse, Branch 변경)만 선택을 지운다 — 나머지 재조회 트리거는 전부 `selectedHashes`를 유지한다. 이전 버전 이 표는 모든 재조회 트리거가 "CommitListPanel 리셋"이라는 이름으로 뭉뚱그려져 있었고, 그 리셋이 `selectedHashes`까지 항상 지운다는 뜻이었다 — 검색 조건을 바꿔가며 관련 커밋을 여러 번 찾아 누적 체크하는 워크플로우가 실사용에서 나오면서, 이 전면 초기화가 워크플로우를 방해한다는 게 확인되어 DR-015로 예외 범위를 좁혔다.

**정정 (전체 선택/전체 추가 필터 무시 버그, 2026-08-12)**: 위 표의 "DeployFilesPanel(좌) 전체 선택 토글"/"`[전체 추가]` 클릭 (우)" 두 행은 이 문서가 원래 의도했던 동작(필터+검색에 표시된 행만 대상)을 그대로 적어둔 것이지만, 실제 구현은 좌측이 상태 Filter만 반영하고 검색어를 무시했고, 우측은 Filter/검색 둘 다 무시하고 있었다 — §2.6, §3 정정 참고. 이 표는 수정 이후(의도한 동작)를 기준으로 작성되어 있다.

**정정 (자동 재계산 완전 제거, `[Preview]`가 유일한 트리거, 2026-08-04)**: 이전 초안(및 그 초안을 최적화하려던 캐싱 계획)은 커밋 체크박스나 Mapping Profile이 바뀔 때마다 디바운스 후 자동으로 재계산하는 것을 전제로 했다. 하지만 이 방식은 "선택은 바뀌었는데 화면·Export 대상은 옛 결과"인 구간(디바운스 대기 중)이 항상 존재해, 그 구간에 `[Export]`를 누르면 방금 바뀐 선택 일부가 반영 안 된 채로 조용히 나갈 수 있는 위험이 있었다(§2.8 "Export 직전 레이스 컨디션 방지" 참고). 자동 재계산 자체를 없애고 `[Preview]`를 유일한 계산 트리거로 확정하면서, 애초에 "자동 재계산을 최적화(캐싱)할지" 논의 자체가 무의미해졌다 — 자동 재계산이 없으니 최적화할 대상도 없다.

---

# 5. 로딩 / 빈 / 에러 상태

| 컴포넌트 | 빈 상태 | 로딩 상태 | 에러 상태 |
|---|---|---|---|
| RepositoryPanel | "저장소를 선택하세요" | 버튼 disable + 스피너 | "Git 저장소가 아닙니다" 등 구체 메시지 |
| CommitListPanel | "커밋이 없습니다" | 스켈레톤 행 (초기 로드) / 하단 스피너 (다음 페이지) | "커밋 조회 실패" + 재시도 버튼 |
| DeploymentPreviewPanel | "커밋을 선택하세요" | 집계 숫자 자리에 스켈레톤 | 계산 실패 메시지 (드물게 git diff-tree 실패 시) |
| DeployFilesPanel(좌) / DeleteListPanel | DeploymentPreviewPanel과 동기화(같은 계산 1회 결과) | 위와 동일 | 위와 동일 |
| DeployFilesPanel(우, 누락된 의존성) | "누락된 의존성이 없습니다"(검사는 끝났지만 후보가 0건) | "의존성 확인 중..."(`dependencyAnalyzing`) | 이 저장소에 적용할 수 없으면(`dependencyApplicable=false`) `dependencyReason` 텍스트로 대체 표시(목록/검색 자체를 숨김) — 에러가 아니라 REQ-013의 정상적인 비적용 상태 |
| FooterActionBar | — | `exportStatus`에 따라 `[Export]` label을 "내보내는 중..." 등으로 변경, 중복 클릭 방지 | 실패 사유를 인라인 배너로 표시, DR-009 Warning은 에러가 아니라 별도 경고 배지로 구분 |

DR-009(HEAD 미존재)로 인한 `warnings`는 에러가 아니라 **경고**다 — 계산은 정상 완료된 상태이므로 Export를 막지 않고, DeployFilesPanel 상단에 노란 배너로 "N개 파일이 HEAD에 없어 제외되었습니다"만 표시한다. 같은 방식으로 의존성 검사 중 파싱에 실패한 파일이 있으면(`dependencyParseWarnings`) "N개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다" 배너를 추가로 보여준다(DR-014).

**추가 상태 — Stale (2026-08-04)**: 빈/로딩/에러 외에 네 번째 상태가 있다. 선택은 비어있지 않은데 `isStale`(§2.5)이 true인 경우로, DeploymentPreviewPanel/DeployFilesPanel/DeleteListPanel 모두 "선택이 변경되었습니다 — Preview를 눌러 계산하세요"를 표시하고, FooterActionBar는 `[Export]`를 비활성화한 채 "Preview를 먼저 실행하세요"를 보여준다. 커밋을 하나라도 체크한 직후(아직 한 번도 Preview를 안 누른 상태)는 이 Stale 상태의 특수한 경우다.

---

# 6. 다음 단계로 넘기는 항목

- §0 3가지 모두 사용자 확인 완료. #2(개별 파일 제외 + 전체 선택)는 REQ-011로 REQUIREDMENT.md에 반영 완료, §8 와이어프레임도 `[Build]` 제거·전체 선택 체크박스 추가로 갱신됨.
- 시각 디자인(색상, 타이포그래피, 간격)은 이 문서 범위 밖이다 — 컴포넌트/상태/인터랙션 정의까지가 DOCUMENT_CHECKLIST.md 4번의 범위다.
