# Git Deploy Extractor UI/UX 명세

> **현행 기준: v0.7.0**(2026-09-24 RT-60 문서 동기화로 갱신). P4 리팩토링(RT-40~59)으로 컴포넌트 트리·상태 스토어·배포 대상 파일 UI가 전면 재구성됐다 — §1·§2.6·§2.7·§2.8·§3·§4는 옛 구조를 점진적으로 정정하는 대신 현재 구조로 다시 썼다. v0.6.0 이전 구조와 그 사이의 세부 정정 이력이 필요하면 git 이력 또는 [`docs/refactoring/REFACTORING_TASKS.md`](docs/refactoring/REFACTORING_TASKS.md) §2·§5.1을 참고하라.

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
AppShell (App.tsx, .app-shell)
├── RepositoryPanel                 (저장소 선택/새로고침 + 저장소/브랜치 요약 라벨 + 버전 배지, REQ-017/018)
├── BranchSearchBar                 (코드상 파일명은 그대로지만, 개념상 "CommitQueryBar" — 조회 조건 그룹. CollapsibleSection, owner:'local')
│   ├── SearchConditionGroup          (좌: Branch·Search·조회 기간·최대 개수·Merge 제외)
│   ├── (SplitPane 좌우 경계)          (드래그 폭 조절, 비율 영속)
│   └── QueryFilterGroup              (우: 키워드·작성자·해시 필터 — 세 텍스트 영역이 같은 줄에 나란히)
├── WorkArea                        (WorkArea.tsx — SplitPane direction="vertical" 소유 + openPopup의 유일한 소유자·PopupHost 앵커)
│   ├── commitWorkspace prop           (App.tsx가 조립해서 넘김, WorkArea 내부에서 CollapsibleSection로 감쌈, owner:'workArea')
│   │   └── SplitPane (className="main-grid", direction="horizontal" 기본값)
│   │       ├── CommitListPanel          (좌: 커밋 목록, 다중 선택 + 전체 선택 + Preview 트리거)
│   │       └── PreviewSummary            (우: 집계 미리보기 + Deleted/경고 버튼, 읽기 전용)
│   ├── deployFilesWorkspace prop      (DeployFilesPanel.tsx → DeployFilesWorkspace.tsx, WorkArea가 CollapsibleSection로 감쌈)
│   │   └── SplitPane
│   │       ├── IncludedFilesPane        (좌: "포함된 파일" — 아직 Extract로 안 옮긴 변경 파일. 전체 선택+검색+패턴 요약을 한 줄에, TreeList)
│   │       └── ExtractTargetsPane       (우: "Extract 대상" — 실제 Export될 파일. TreeList, 각 행 ×로 되돌리기 + "모두 되돌리기")
│   └── PopupHost                     (WorkArea 자식 — openPopup 값에 따라 하나만 렌더링, 720×480 고정+뷰포트 클램프)
│       ├── AddFilesPopup               (openPopup==='addFiles' — HEAD 트리 탐색 + 누락된 의존성 통합, REQ-021)
│       ├── FilterPatternsPopup         (openPopup==='patterns' — 제외/포함 패턴 추가+칩 관리, REQ-026)
│       ├── DeletedFilesPopup           (openPopup==='deleted' — 삭제 대상 목록, 읽기 전용, DR-007)
│       └── WarningsPopup               (openPopup==='warnings' — HEAD에 없어 제외된 파일, DR-009)
├── FooterActionBar                 (Export 위치 방식 선택(ExportModeSelect) + 경로 선택 + Export, REQ-012)
└── Credit                          (화면 우측 하단 고정, 제작자 GitHub 링크)
```

**설계 원칙(RT-43)**: `openPopup`은 `WorkArea`에만 존재한다 — `PreviewSummary`(Deleted/경고 버튼)와 `DeployFilesWorkspace`(파일 추가/패턴 버튼)가 이 상태의 공통 부모라서 어느 쪽에서 올라오는 열기 이벤트든 받을 수 있다. 팝업은 종류와 무관하게 **동시에 하나만** 열리고, `Esc`로 닫히며 닫히면 트리거 버튼으로 포커스가 돌아온다(포커스 트랩 포함).

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

## 2.3 BranchSearchBar (CommitQueryBar)

**책임**: REQ-002, REQ-003(Search + 조회 범위 + 키워드), REQ-015(선택 유지/Reload 초기화), REQ-022(작성자/Merge 커밋 제외), REQ-023(해시로 커밋 필터링).

**정정(2026-09-24 문서 동기화, RT-48/RT-49/M-49)**: "검색 대상(메시지/파일명)" 라디오(REQ-016)가 폐기되고, 키워드는 항상 커밋 메시지만 대상으로 한다. 좌우 두 그룹(검색 조건/필터)으로 나뉘어 `SplitPane`으로 드래그 조절 가능하게 재구성됐다.

| 요소 | 동작 |
|---|---|
| Branch dropdown | `branches: string[]` 표시. `branches` 로드 완료 시 `main` 우선, 없으면 `master`를 `selectedBranch`에 자동 설정(REQ-002). 사용자가 변경하면 `selectedBranch` 갱신 + 재조회(첫 페이지부터, **`selectedHashes`도 초기화** — DR-015 예외) |
| `[Search]` 버튼 | 디바운스를 기다리지 않고 즉시 검색 트리거. 키워드/작성자/해시 텍스트 영역에서 Ctrl(Cmd)+Enter도 동일하게 즉시 트리거한다 |
| "조회 기간 : [시작일] ~ [종료일]" 날짜 선택 | `startDate`/`endDate` 갱신. 300ms 디바운스 후 재조회(REQ-003, 기본값 오늘-7일 ~ 오늘) |
| "최대 [N] 개" 입력 | 타이핑 중에는 로컬 문자열로만 들고 있다가 blur/Enter에서 `maxCount`를 확정하고 그때 재조회(REQ-003, 기본값 100) — 비우면 즉시 1로 스냅하던 옛 버그 수정. 이 값이 무한 스크롤의 상한선 |
| **키워드** textarea (REQ-003) | 한 줄에 하나씩 입력. 앞에 `-`를 붙이면 그 줄은 제외 조건. 글자 그대로(대소문자 무시) 부분 일치, 포함은 OR·제외는 OR, 포함·제외는 AND로 결합. `git log --grep`(포함, `-i --extended-regexp`로 OR 결합) + 매치된 커밋 중 제외 키워드에 걸리는 것 제거. 300ms 디바운스 후 자동 검색, 포커스 있는 동안 힌트 툴팁 표시 |
| **작성자** textarea (REQ-022) | 쉼표·공백·줄바꿈으로 구분된 여러 작성자명을 붙여넣을 수 있다 — `git log --author=<값> -i`를 값마다 반복 추가(OR 결합). 키워드와는 독립적으로 AND 결합. 설명 문구는 `placeholder`로 표시 |
| **해시 필터** textarea (REQ-023) | 값을 파싱(공백/쉼표/줄바꿈으로 분리)해 `git log --no-walk`로 그 해시와 정확히 일치하는 커밋만 조회 — 값이 있으면 branch·기간·키워드·작성자·Merge 제외를 **전부 무시**한다. 16진수 4~64자만 유효(M-5), 무효 입력은 화면에 무시됨을 알린다 |
| "Merge 커밋 제외" 체크박스 (REQ-022) | `excludeMerges` 갱신, 디바운스 없이 즉시 재조회 — `git log --no-merges`. 기본값 `true`(제외) |

**필터 그룹 레이아웃**: 키워드·작성자·해시 필터 세 텍스트 영역이 같은 줄에 왼쪽→오른쪽 순서로 나란히 놓이고, 높이가 동일하며 정확히 2줄이 스크롤 없이 보인다(3줄부터 영역 내부 스크롤). 비어 있으면 placeholder만, 입력을 시작하면 포커스 중인 필드 아래에 힌트 툴팁이 뜬다(레이아웃 불변, 포커스 해제·값 삭제 시 사라짐).

**정정(선택 유지, REQ-015/DR-015)**: Branch 변경만 `selectedHashes`를 지운다. 나머지 재조회 트리거(키워드/작성자/해시/기간/최대 개수/Merge 제외)는 전부 `selectedHashes`를 유지한다. Reload는 별도로 조회 조건 자체를 기본값으로 되돌리면서 선택도 함께 지운다(REQ-015 정정 참고).

**상태**: `branches: string[]`, `selectedBranch: string | null`, `keywordText: string`(REQ-003, 한 줄에 하나·`-` 접두 제외), `startDate: string`(기본 오늘-7일), `endDate: string`(기본 오늘), `maxCount: number`(기본 100), `authorFilter: string`(기본 `''`, REQ-022), `excludeMerges: boolean`(기본 `true`), `hashFilterText: string`(기본 `''`, REQ-023 — 값이 있으면 다른 모든 조회 조건 무시)

기본값(7일/100개)에서는 `maxCount`(100)와 CommitListPanel 페이지 크기(100, DETAILED_DESIGN.md §3.4)가 같아서 대부분 첫 페이지 한 번으로 끝난다. 사용자가 `maxCount`를 늘리면 그때부터 여러 페이지에 걸쳐 무한 스크롤이 동작한다. `endDate`는 종료일 하루 전체(23:59:59까지)를 포함한다 — git 쪽 시간 경계 처리는 DETAILED_DESIGN.md §3.2 참고.

## 2.4 CommitListPanel

**책임**: REQ-003, REQ-004. 가상 스크롤(react-window) 목록, 체크박스 다중 선택. 헤더에 `[Preview]`도 포함한다 — 원래 FooterActionBar에 있었으나 "커밋을 고르고 바로 그 자리에서 계산한다"는 흐름이 더 직관적이라는 사용자 피드백으로 이동했다(2026-08-04).

| 요소 | 동작 |
|---|---|
| 헤더 "전체 선택" 체크박스 (좌측) | 현재 **로드된 commits 기준**으로 전체 체크/해제(아직 스크롤로 안 불러온 다음 페이지는 건드리지 않음). 일부만 체크된 상태면 indeterminate 표시 — DeployFilesPanel의 전체 선택(§2.6)과 동일한 방식(추가, 2026-08-04, 사용자 요청). `commits.length === 0`이면 비활성 |
| 헤더 "N개 선택됨" 카운터 ("전체 선택" 바로 옆) | `selectedHashes.size`(현재 로드/표시된 commits와 무관하게 **전체 선택 개수**)를 항상 표시. 0개여도 표시(추가, RISK_ISSUES.md §6.1 케이스 D, 2026-08-07, 사용자 요청) |
| 헤더 `[Preview]` 버튼 (우측) | 헤더 행 최우측, "전체 선택"과 같은 줄에 배치. `selectedHashes.size === 0`이거나 이미 분석 중이면 비활성. 클릭 시 Commit 분석 + Mapping 엔진을 실행해 PreviewSummary/IncludedFilesPane/ExtractTargetsPane을 최신 상태로 확정 표시하고 `analyzedSelection`(§2.5)을 갱신한다. **정정(2026-09-24, RT-47)**: 클릭(재실행 시작) 시점에 열려 있던 팝업이 있으면 자동으로 닫는다. **부작용 없음(파일시스템 변경 없음)** — 이 앱에서 계산이 일어나는 유일한 경로다(§2.5 참고) |
| 각 행 | 체크박스 + `hash`(mono, 7자) + `author` + `date`(mono, ISO-strict 그대로) + `message` 순서로 표시(REQ-003의 Hash/Author/Date/Message 순서 그대로). 클릭 시 `selectedHashes` 토글 |
| 스크롤 하단 도달 | 다음 페이지 IPC 요청 (DETAILED_DESIGN.md §3.4, `pageSize=100`) |

**상태**: `commits: CommitEntry[]`, `selectedHashes: Set<string>`, `pagination: { hasMore: boolean; loading: boolean }`

**빈/로딩/에러 상태**: §5 참고.

**정정 (SplitPane 셀 높이 꽉 채우기, RISK_ISSUES.md §7.4, 2026-08-07, 사용자 요청)**: MainGrid가 `SplitPane`(§7.4)으로 구현된 이후, `.commit-list-panel`에 `height:100%`가 빠져 있어서 커밋이 몇 줄 없을 때 패널이 콘텐츠 높이로만 줄어들고 `SplitPane`이 배정한 나머지 공간이 빈 배경으로 남아있었다. `.file-list-column`(§2.6)이 이미 쓰던 것과 같은 규칙(`height:100%`)을 추가해 항상 배정된 높이를 꽉 채우도록 고쳤다.

**정정 (빈/로딩/에러 상태에서도 헤더 유지, RISK_ISSUES.md §6.1 케이스 D, 2026-08-07, 사용자 요청)**: "N개 선택됨" 카운터를 추가하면서, 기존에 로딩/빈 목록/에러 상태를 패널 전체를 다른 문구로 대체하던 방식(early return)을 그대로 두면 오히려 문제가 커진다는 게 드러났다 — REQ-015로 선택이 검색 조건과 무관하게 유지되는 상황에서, 검색 결과가 0건이 되면 카운터까지 같이 사라져 "선택은 남아있는데 화면 어디에도 안 보이는" 상태가 본문뿐 아니라 헤더까지 번진다. 그래서 헤더(체크박스+카운터+Preview 버튼)는 항상 렌더링하고, 로딩/빈 목록/에러 문구는 `.commit-list-panel__body` 안쪽만 갈아끼우는 구조로 바꿨다 — DeployFilesPanel의 좌우 `FileListColumn`이 각자 자기 빈/로딩/에러를 자기 `.panel` 안에서 보여주는 것(§2.6)과 같은 방향의 수정이다.

## 2.5 PreviewSummary (구 DeploymentPreviewPanel)

**책임**: REQ-005~007 계산 결과 집계를 읽기 전용으로 보여준다(Files/Added/Modified/Deleted — Renamed 없음, DR-008). REQ-009/010 정정에 따라 Deleted·경고 목록은 이 컴포넌트의 버튼으로 여는 팝업이 담당한다.

**정정(2026-09-24 문서 동기화, RT-43/RT-44)**: 이름이 `DeploymentPreviewPanel`에서 `PreviewSummary`로 바뀌었고, 상시 표시되던 Delete List(§2.7, 삭제됨)·경고 배너가 이 패널의 버튼으로 옮겨왔다.

| 요소 | 동작 |
|---|---|
| 집계 숫자 | Files/Added/Modified 표시(REQ-005~007) |
| `Deleted: N ▸` 버튼 | 삭제된 파일이 0건이면 비활성. 클릭 시 `WorkArea`의 `openPopup`을 `'deleted'`로 설정해 `DeletedFilesPopup`(DR-007, 트리 뷰)을 연다 |
| `⚠ HEAD에 없음: N ▸` 버튼 | `warnings`(DR-009)가 0건이면 렌더링하지 않는다. 클릭 시 `openPopup='warnings'`로 `WarningsPopup`(트리 뷰)을 연다 |

**정정(자동 재계산 제거, Preview가 유일한 트리거, 2026-08-04)**: 이전 초안은 `selectedHashes`가 바뀔 때마다 500ms 디바운스 후 자동으로 재계산하도록 설계했다. 하지만 이 방식은 "선택은 바뀌었는데 화면은 옛 결과"인 구간(디바운스 대기 중)이 항상 존재해, 그 구간에 `[Export]`를 누르면 방금 추가/해제한 커밋이 반영 안 된 채로 조용히 나갈 수 있는 위험이 있었다(§2.8 참고). 커밋 체크박스 변경은 이제 어떤 계산도 트리거하지 않는다 — `[Preview]` 클릭이 유일한 계산 트리거다.

화면이 최신 상태인지는 `selectedHashes`/`selectedBranch`(현재 선택)과 `analyzedSelection`(마지막으로 Preview가 실제로 계산한 입력)을 비교해 파생 계산한다(`isStale`). 선택이 있는데 아직 한 번도 Preview를 안 눌렀거나, Preview 이후 선택/브랜치가 하나라도 바뀌면 `isStale = true`이며, 이때는 집계 숫자 대신 "선택이 변경되었습니다 — Preview를 눌러 계산하세요"를 표시한다. 계산 결과는 IncludedFilesPane/ExtractTargetsPane과 동일한 소스에서 파생되므로 이 컴포넌트들은 항상 같은 계산 1회의 결과를 나눠서 보여주고, `isStale`도 동일한 기준으로 함께 판단한다(중복 계산·중복 판정 없음).

**상태**: `summary: { files, added, modified, deleted } | null`, `analyzing: boolean`, `analyzedSelection: { hashes: string[]; branch: string } | null`(마지막 Preview 계산 입력, `isStale` 파생용)

## 2.6 배포 대상 파일 (IncludedFilesPane / ExtractTargetsPane / 패턴·파일 추가 팝업)

**정정(2026-09-24 문서 동기화, RT-40~53)**: 옛 `DeployFilesPanel`(좌: 포함된 파일 + 상태 Filter, 우: 누락된 의존성, `FileListColumn` 공용 + `ManualAddPopup`)이 완전히 재구성됐다 — "상태 Filter"는 삭제, "체크 = 제외 토글"은 "체크 = Extract 대상으로 실제 이동"으로 바뀌었고, 목록은 평탄한 목록이 아니라 접고 펼치는 폴더 트리(`TreeList`)다. 아래는 v0.7.0 현재 구조다.

**책임**: REQ-007, REQ-008, REQ-011(Extract 대상 이동 모델), REQ-013(의존성 완결성 검사, AddFilesPopup에 통합), REQ-020(선택 카운터/누락 배지), REQ-021(수동 추가), REQ-025(화면 검색), REQ-026(파일 패턴).

### IncludedFilesPane (좌 — "포함된 파일")

| 요소 | 동작 |
|---|---|
| 제목 | `FilePaneCountTitle` — "포함된 파일 (선택 N개/전체 N개(필터 전 전체 N개))"(REQ-020) |
| `+ 파일 추가` 버튼(제목 줄 우측) | `openPopup('addFiles')`. `headTreeFiles.length===0`(Preview 미실행)이면 비활성 + 안내 title. 처리 못 한 누락된 의존성이 있으면 `누락 N` 배지(50 초과 시 붉은색, REQ-020 정정) |
| 전체 선택 체크박스(toolbar 맨 왼쪽) | 화면에 보이는(패턴+검색 적용 후) 파일을 전부 Extract 대상으로 이동. 표시된 항목이 없으면 비활성. `TriStateCheckbox`(indeterminate 없음 — 이 목록엔 항상 미이동분만 있음) |
| 검색 입력(toolbar, 체크박스 오른쪽, 50% 폭) | `includedSearchTerm`, `*` 와일드카드 지원(REQ-025). 화면 표시에만 영향, Export 대상·선택 카운터와 무관 |
| 패턴 요약(toolbar 오른쪽 끝) | `FilterPatternBar` — "패턴: 포함 N개/제외 N개" + `설정` 버튼(`openPopup('patterns')`) + 패턴에 걸려 숨은 개수 |
| 목록(`TreeList`) | 폴더 접기/펼치기, 각 리프 체크박스 클릭 시 그 파일을 Extract 대상으로 이동. 폴더 체크박스는 그 아래 화면에 보이는 파일 전체를 이동(일부가 이미 이동/패턴 제외로 안 보이면 indeterminate) |

빈 상태 문구: 미선택 변경 파일이 아예 없으면 "전부 Extract 대상으로 이동했습니다", 검색어가 있으면 "검색어와 일치하는 파일이 없습니다", 그 외엔 "패턴에 걸려 모든 변경 파일이 숨겨졌습니다".

### ExtractTargetsPane (우 — "Extract 대상")

| 요소 | 동작 |
|---|---|
| 제목 | "Extract 대상 (N개 · 패턴 제외 N개)" + `모두 되돌리기` 버튼(제목 줄 우측 끝, Extract 대상이 0개면 비활성) |
| 목록(`TreeList`) | 변경 파일(체크로 이동)·누락된 의존성(AddFilesPopup에서 추가)·수동 추가 파일이 전부 여기 모인다. 각 행: 경로 복사 버튼, ×(원래 자리로 되돌리기 — 출처에 따라 "포함된 파일"/"AddFilesPopup 후보"로 복귀, 수동 추가는 철회), 출처 배지(`변경`/`수동`, 의존성 출처는 배지 없이 종류 배지만) |
| 패턴 제외 표시 | 활성 파일 패턴(REQ-026)에 걸린 항목은 숨기지 않고 흐리게+취소선+"패턴 제외" 태그로 표시(조용한 누락 방지) — 실제로는 Export되지 않는다 |

### FilterPatternsPopup (`openPopup==='patterns'`, REQ-026)

제외/포함 두 구역으로 칩을 나열한다. 상단에 패턴 추가 입력(모드 선택 `제외`/`포함`, 텍스트 입력 — 쉼표·줄바꿈으로 여러 개 동시 추가, `+추가` 버튼, 입력에 포커스가 있고 값이 있을 때만 뜨는 해석 미리보기 오버레이). 각 칩은 해석된 종류 배지(`경로`/`패키지`/`파일명`)와 현재 매치 개수(`·N`)를 보여준다. 라벨 클릭=활성 토글, `×`=삭제(REQ-024, 확인창 없음). 패턴이 0개가 돼도 자동으로 닫히지 않는다(0개에서 첫 패턴을 추가하는 진입점이기도 해서).

### AddFilesPopup (`openPopup==='addFiles'`, REQ-021/REQ-013)

검색어 없이 열어도 HEAD 트리 전체가 폴더 트리로 보인다(탐색 모드 — 경로 1단계 펼침 ∪ 누락된 의존성 조상 폴더는 기본 펼침). 검색어를 입력하면 결과 모드(매칭 최대 50개, 전부 펼침)로 전환. 누락된 의존성은 트리 안에서 붉은 글자 + `Impl`/`I` 종류 배지로 표시되고, "보이는 항목 모두 추가 (N)" 버튼으로 화면에 보이는 것만 한 번에 추가할 수 있다. 이미 Extract 대상에 있는 경로는 후보에서 숨긴다. 추가한 파일은 곧바로 Extract 대상으로 이동한다(ExtractTargetsPane 참고) — 좌측 "포함된 파일"에는 들어가지 않는다.

### 공통 사항

**Extract 대상 이동은 상태 중복 저장이 아니다**: `deployFiles[].included`(변경 파일)를 직접 토글하거나, `missingDependencies`/`manuallyAddedPaths`에 추가/제거하는 것으로 표현되며, "포함된 파일"/"Extract 대상" 두 목록은 이 원본에서 파생 계산될 뿐 별도 필드를 갖지 않는다.

**가상 스크롤/컬럼 리사이즈**: `TreeList`는 react-window 가상 스크롤을 쓰지 않는다(폴더 트리는 화면에 보이는 행 수가 평탄한 목록보다 적음) — 대신 각 패널이 `.fill-scroll`로 자체 스크롤한다. 옛 "Local Path 컬럼 리사이즈"(canvas 실측 폭)는 삭제됐다 — 컬럼이 파일명 하나뿐이라 리사이즈 대상 자체가 없어졌다.

**상태**: (스토어 슬라이스별 상세는 §3 참고) `deployFiles`, `missingDependencies`, `manuallyAddedPaths`, `headTreeFiles`, `includedSearchTerm`, `filePatterns: { pattern: string; mode: 'exclude'|'include'; enabled: boolean }[]`(REQ-026, `localStorage` 전역 저장), `dependencyApplicable`, `dependencyReason`, `dependencyAnalyzing`, `dependencyParseWarnings`.

**경고 배너**: "N개 파일이 HEAD에 없어 제외되었습니다"(DR-009)와 "N개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다"(`dependencyParseWarnings`)는 더 이상 상시 배너가 아니라 PreviewSummary의 버튼으로 여는 팝업 안에서 보여준다(§2.5).

## 2.7 DeletedFilesPopup (구 DeleteListPanel)

**정정(2026-09-24 문서 동기화, RT-43)**: 상시 표시되던 별도 패널에서, PreviewSummary(§2.5)의 `Deleted: N ▸` 버튼으로 여는 팝업(`openPopup==='deleted'`)으로 바뀌었다. 책임(DR-007, 읽기 전용)은 동일하다.

삭제된 파일의 Server Path를 트리(`TreeList`)로 보여준다. Rename을 별도로 감지하지 않으므로(DR-008), 이 목록에 있는 항목이 실제 삭제인지 Rename으로 인한 이전 이름인지 UI가 구분해주지 않는다 — Extract 대상의 Added 표시와 함께 보고 사용자가 직접 판단한다.

**상태**: `deleteList: { path: string }[]`

## 2.8 FooterActionBar

**책임**: REQ-009, REQ-010, REQ-012. Export 위치 방식 선택(`ExportModeSelect`) + 경로 변경 + Export 실행. (§0-3 결정으로 Preview/Export 2단계 구조 확정 — `[Build]` 없음)

**정정(2026-09-24 문서 동기화, RT-56/U-16)**: "선택 안 하면 저장소 루트가 기본값" 원칙이 폐지되고, 추출 위치 방식(폴더 생성 후 추출/바로 추출) 선택이 추가됐다. Mapping Profile은 여전히 화면에 없다(v0.6.0부터 숨김 유지, 내부적으로 `default` 고정).

| 요소 | 동작 |
|---|---|
| `[변경]` 버튼 | `package:browseExportDir` IPC로 OS 네이티브 폴더 다이얼로그를 연다(자유 텍스트 입력 없음). 선택하면 `exportParentDir`를 갱신하고 `localStorage`(`gde:exportParentDir`)에 저장해 재실행 후에도 유지한다(REQ-012) |
| 경로 표시 텍스트 | `exportParentDir`을 표시. 아직 선택하지 않았으면 "추출할 폴더를 선택하세요" placeholder(더 이상 저장소 루트로 암묵 대체하지 않는다). 넘치면 ellipsis, `title` 툴팁으로 전체 경로 확인 |
| `ExportModeSelect` 드롭다운 | `sub`(기본값, "git-deploy-extracted 폴더 생성 후 추출") \| `direct`("선택한 경로에 바로 추출", 빈 폴더 전용 — REQ-012) |
| `[Export]` | Preview에 표시된 내용을 그대로 실행: 선택한 방식대로 폴더 생성/직접 추출 + 파일 복사 + `extract-list.txt` 생성(REQ-010 정정). 다른 버튼과 달리 더 진한 배경색(`.button--primary`)으로 시각적으로 구분한다 |

레이아웃 순서: `[변경] [경로 표시] ... [ExportModeSelect] [Export]`.

**버튼 비활성 조건(정정)**: `[Export]`는 `selectedHashes.size===0`이거나 `isStale`(§2.5)이거나, 경로 미선택이거나, 저장소와 위치가 겹치거나(`INSIDE_REPO`/`CONTAINS_REPO`), `direct` 모드인데 선택 경로가 비어 있지 않으면(`NOT_EMPTY`, OS 메타데이터 파일 제외) 비활성이다. 비활성 사유는 버튼 옆 상태 텍스트로 안내한다.

**추가(덮어쓰기 확인, DR-013 정정)**: `sub` 모드에서 대상 폴더(`git-deploy-extracted`)에 이미 내용이 있으면 `dialog.showMessageBox`로 확인한다. `direct` 모드는 애초에 빈 폴더에서만 허용되므로 이 확인창이 뜨지 않는다. "취소" 선택 시 `exportStatus`가 `'idle'`로 되돌아가고 에러 배너 없이 조용히 중단된다.

**정정(Export 직전 레이스 컨디션 방지, 2026-08-04)**: 이전 초안(자동 재계산)에서는 디바운스 대기 중에 `[Export]`를 누르면 선택과 계산 결과가 어긋난 채로 나갈 위험이 있었다 — `[Export]`를 `isStale`일 때 비활성화하는 것만으로 이 구간 자체가 없어진다(추가로 `runExport()` 내부에서도 한 번 더 확인한다).

**추가(Export 완료 메시지 — 한 줄 고정 + title + 클립보드 복사, 2026-08-04)**: `exportStatus === 'done'`일 때 표시되는 완료 메시지는 한 줄로 고정되고 넘치는 부분은 ellipsis로 잘린다. 전체 경로는 `title` 툴팁으로 확인하고, 메시지를 클릭하면 클립보드에 복사된다(성공/실패 피드백 포함). 커밋 선택을 바꾸면 지난 완료 메시지는 사라진다.

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

**정정(2026-09-24 문서 동기화, RT-31/S1)**: 단일 평면 인터페이스 하나였던 스토어가 여러 slice로 나뉘었다(`combine`으로 합성, `useAppStore`는 여전히 하나) — `repositorySlice`·`commitQuerySlice`·`commitsSlice`·`analysisSlice`·`deployFilesSlice`·`exportSlice`·`updateSlice`. 나누되 여전히 하나의 스토어라 파생 계산(아래 `isStale` 등)은 그대로 슬라이스를 넘나들며 읽을 수 있다 — 자세한 분리 기준은 ARCHITECTURE.md §2.2 참고. 아래는 UI가 직접 참조하는 필드만 슬라이스별로 요약한다(전체 타입은 각 `store/slices/*.ts` 참고).

```ts
// repositorySlice
repository: { path: string | null; status: 'idle'|'validating'|'valid'|'invalid'; error?: string };
remoteProjectName: string | null;  // REQ-018/DR-017
branches: string[];
selectedBranch: string | null;

// commitQuerySlice — 조회 조건(§2.3). Reload 시 전부 기본값으로 리셋(REQ-015 정정)
startDate: string; endDate: string;   // YYYY-MM-DD, 기본 오늘-7일~오늘
maxCount: number;                     // 기본 100
keywordText: string;                  // REQ-003, 한 줄에 하나·`-` 접두 제외(REQ-016 폐기로 searchMode 없음)
authorFilter: string;                 // REQ-022
excludeMerges: boolean;               // REQ-022, 기본 true
hashFilterText: string;               // REQ-023, 값이 있으면 다른 조회 조건 전부 무시

// commitsSlice
commits: CommitEntry[];
selectedHashes: Set<string>;
commitPagination: { hasMore: boolean; loading: boolean };
commitListError: string | null;

// analysisSlice — Preview/의존성 분석 결과
analyzing: boolean;
analysisError: string | null;
analyzedSelection: { hashes: string[]; branch: string } | null;   // isStale 파생용
summary: { files: number; added: number; modified: number; deleted: number } | null;
deleteList: DeleteEntry[];
warnings: { path: string; reason: string }[];
dependencyAnalyzing: boolean;
dependencyApplicable: boolean;
dependencyReason: string | null;
dependencyParseWarnings: { path: string; reason: string }[];

// deployFilesSlice — "포함된 파일"/"Extract 대상"/패턴/수동 추가(§2.6). REQ-011 정정 —
// included 토글이 곧 "Extract 대상으로 이동"이다. filePatterns는 localStorage(gde:filePatterns) 영속.
deployFiles: DeployFileEntry[];   // { localPath, serverPath, status:'added'|'modified', included }
missingDependencies: { localPath: string; serverPath: string; status: 'added'; kind: 'interface'|'class' }[];
manuallyAddedPaths: string[];     // Preview 재실행 시 headTreeFiles와 함께 초기화
headTreeFiles: string[];          // AddFilesPopup 탐색 대상(REQ-021 정정)
includedSearchTerm: string;       // REQ-025, 화면 전용
filePatterns: { pattern: string; mode: 'exclude'|'include'; enabled: boolean }[];   // REQ-026

// exportSlice — REQ-012 정정(추출 위치 방식 추가, 기본값 폐지)
exportParentDir: string | null;
exportMode: 'sub' | 'direct';     // 기본 'sub', localStorage(gde:exportMode) 영속
exportStatus: 'idle' | 'exporting' | 'done' | 'error';
exportError: string | null;
lastExportDir: string | null;

// updateSlice — REQ-017/DR-016
updateInfo: { hasUpdate: boolean; latestVersion: string } | null;
updateChecking: boolean;
```

**파생 계산 흐름**: `selectedHashes`/`selectedBranch` 변경은 IPC를 트리거하지 않는다 — `[Preview]` 클릭만이 단일 IPC 호출(Commit 분석 엔진 + Mapping Rule 엔진 결과)을 일으키고, 그 결과로 `summary`/`deployFiles`/`deleteList`/`warnings`/`analyzedSelection`이 동시 갱신된다. `isStale = 현재 (selectedHashes, selectedBranch) ≠ analyzedSelection`으로 파생 계산하며, PreviewSummary(§2.5)와 `[Export]` 비활성 조건(§2.8)이 이 값을 공유한다. 개별 `included` 토글(§2.6)만 예외로 로컬 갱신(재계산도 staleness 판정도 없음).

**의존성 검사 체이닝(REQ-013)**: `[Preview]`가 성공하면 곧바로 두 번째 IPC(`analysis:dependencies`)를 자동으로 호출해 `missingDependencies`/`dependencyApplicable`/`dependencyReason`/`dependencyParseWarnings`를 채운다. 실패해도 첫 번째 IPC의 결과는 그대로 유효하다.

**업데이트 확인(REQ-017/DR-016)**: `updateInfo`/`updateChecking`은 다른 파생 계산과 무관한 독립 상태다. 앱 시작 시 `localStorage`(`gde:lastUpdateCheck`) 캐시가 24시간 지났으면, 버전 배지 클릭 시엔 캐시 나이와 무관하게 항상 재확인한다.

---

# 4. 인터랙션 정의

**정정(2026-09-24 문서 동기화)**: REQ-016(파일명 검색 모드) 폐기·REQ-011(Extract 이동 모델)·REQ-012(Export 방식 분기)·REQ-015(Reload 전체 초기화)·REQ-019→026(패턴 제외+포함)·REQ-021(AddFilesPopup 트리 탐색)을 반영해 아래 표를 다시 썼다.

| 트리거 | 상태 변화 | IPC 호출 | 대응 |
|---|---|---|---|
| `[Browse...]` 클릭 | `repository.status = 'validating'` | `dialog.showOpenDialog` → `git rev-parse` | REQ-001 |
| Branch 목록 로드 완료 | `selectedBranch`를 main/master 우선순위로 자동 설정 | 없음(로컬 판단) | REQ-002 |
| Branch 변경 | `commits = []`, **`selectedHashes = {}`**(DR-015 예외), `commitPagination.loading = true` | `git log --since --max-count` 첫 페이지 | REQ-002, DR-015 |
| Repository Reload | 조회 조건 전부 기본값으로, `commits = []`, **`selectedHashes`도 초기화**(REQ-015 정정), 분석 결과 폐기(Extract 대상 포함) | `git log --since --max-count` 첫 페이지 | REQ-015, DR-015 |
| `startDate`/`endDate`/`maxCount`/키워드/작성자/Merge 제외 변경, Search 트리거 | `commits = []`, `selectedHashes`는 **유지**, `commitPagination.loading = true` | `git log --since --until --grep --author --no-merges` 첫 페이지 | REQ-003, REQ-015, REQ-022 |
| 커밋 목록 스크롤 하단 도달 | `commitPagination.loading = true`. 이미 `maxCount`만큼 로드했으면 요청하지 않음(`hasMore = false`) | `git log --skip` 다음 페이지(현재 조회 조건 유지) | REQ-003 |
| 해시 필터 입력 (디바운스) | `commits = []`, `selectedHashes`는 **유지**. 값이 있으면 다른 모든 조회 조건 무시 | `git log --no-walk <hash1> <hash2> ...` | REQ-023 |
| 커밋 체크박스 토글 | `selectedHashes` add/remove. IPC도, 어떤 계산도 트리거하지 않는다 — `isStale`이 즉시 파생 계산으로 true가 된다 | 없음 | REQ-004~008 |
| `[Preview]` 클릭 | 열려 있던 팝업을 닫는다(RT-47). `analyzing = true` → 완료 시 `summary`/`deployFiles`/`deleteList`/`warnings`/`analyzedSelection` 동시 갱신(`manuallyAddedPaths`/`headTreeFiles`/`includedSearchTerm`도 함께 초기화), 이어서 `dependencyAnalyzing = true` → 완료 시 `missingDependencies` 등 갱신(체이닝). `deployFiles[].included`는 전부 `false`로 시작(포함된 파일에 전체 미선택) | Commit 분석 + Mapping 엔진 → 의존성 완결성 검사 | REQ-005~008, REQ-011, REQ-013 |
| IncludedFilesPane 체크박스 토글 | 해당 항목 `included = true`(Extract 대상으로 이동) | 없음 (로컬) | REQ-011 |
| IncludedFilesPane 전체 선택 토글 | 검색+패턴 적용 후 화면에 보이는 행 전체 `included = true` | 없음 (로컬) | REQ-011 |
| IncludedFilesPane 검색 입력 | `includedSearchTerm` 갱신, 즉시 클라이언트 필터링(디바운스 없음). `*` 포함 시 와일드카드 매치, 없으면 부분 일치 | 없음 (로컬) | REQ-025 |
| ExtractTargetsPane 행 `×` 클릭 | 출처에 따라 `included=false`(변경 파일)/`missingDependencies`에서 제거(의존성)/`manuallyAddedPaths`에서 제거(수동, 철회) | 없음 (로컬) | REQ-011 |
| ExtractTargetsPane "모두 되돌리기" 클릭 | Extract 대상 전체를 각자 출처로 되돌린다 | 없음 (로컬) | REQ-011 |
| `+ 파일 추가` 클릭 | `openPopup('addFiles')`. `headTreeFiles.length===0`(Preview 미실행)이면 비활성 | 없음 (로컬) | REQ-021 |
| AddFilesPopup 검색 입력 | 없음(탐색/결과 모드 전환, 디바운스 없음) | 없음 (로컬) | REQ-021 |
| AddFilesPopup 후보 클릭/"보이는 항목 모두 추가" | `deployFiles`에 없으면 추가(의존성이면 `missingDependencies`에서 이동, 그 외 `manuallyAddedPaths`에 push) — 곧바로 Extract 대상으로 들어간다 | 없음 (로컬) | REQ-013, REQ-021 |
| 패턴 `설정` 클릭 | `openPopup('patterns')` | 없음 (로컬) | REQ-026 |
| 패턴 추가 (팝업 안, 모드+텍스트+`+추가`) | `filePatterns`에 `{pattern, mode, enabled:true}` 추가(이미 있으면 활성화), `localStorage` 저장 | 없음 (로컬) | REQ-026 |
| 패턴 칩 클릭/`×` | `enabled` 토글 / 이력에서 완전 삭제(REQ-024), `localStorage` 저장 | 없음 (로컬) | REQ-024, REQ-026 |
| `ExportModeSelect` 변경 | `exportMode` 갱신, `localStorage` 저장 | 없음 (로컬) | REQ-012 |
| `[변경]` 클릭 (FooterActionBar) | 취소 시 상태 변화 없음. 선택 시 `exportParentDir` 갱신 + `localStorage` 저장 | `dialog.showOpenDialog`(`package:browseExportDir`) | REQ-012 |
| `[Export]` 클릭 | `exportStatus = 'exporting'` → `'done'`\|`'error'`\|(취소 시)`'idle'` | `sub` 모드는 기존 내용 있으면 먼저 확인창. 대상 파일은 Extract 대상 중 활성 패턴에 안 걸리는 것만(REQ-026) | REQ-009, REQ-010, DR-013 |
| SplitPane 경계 드래그 | 드래그 중 실시간 비율 반영, mouseup 시 `localStorage`에 최종 비율 저장 | 없음 (로컬) | REQ-014 |
| CollapsibleSection 접기/펼치기 | 해당 섹션 `collapsed` 토글(미영속, RT-47) — WorkArea 소유 섹션이 접히면 열려 있던 팝업도 닫힌다 | 없음 (로컬) | — |
| 앱 시작(캐시 24h 초과 시) | `updateChecking = true` → 완료 시 `updateInfo` 갱신(성공) 또는 유지(실패), `updateChecking = false` | `checkForUpdate`(GitHub `releases/latest`) | REQ-017, DR-016 |
| 버전 배지 클릭 | 캐시 나이 무관하게 재확인 + 응답을 기다리지 않고 확인창 표시 | `checkForUpdate` + (확인 시)`shell.openExternal` | REQ-017, DR-016 |

---

# 5. 로딩 / 빈 / 에러 상태

**정정(2026-09-24 문서 동기화)**: DeleteListPanel은 DeletedFilesPopup으로, "누락된 의존성"은 AddFilesPopup으로 옮겨갔다.

| 컴포넌트 | 빈 상태 | 로딩 상태 | 에러 상태 |
|---|---|---|---|
| RepositoryPanel | "저장소를 선택하세요" | 버튼 disable + 스피너 | "Git 저장소가 아닙니다" 등 구체 메시지 |
| CommitListPanel | "커밋이 없습니다" | 스켈레톤 행 (초기 로드) / 하단 스피너 (다음 페이지) | "커밋 조회 실패" + 재시도 버튼 |
| PreviewSummary | "커밋을 선택하세요" | 집계 숫자 자리에 스켈레톤 | 계산 실패 메시지 (드물게 git diff-tree 실패 시) |
| IncludedFilesPane / ExtractTargetsPane | PreviewSummary와 동기화(같은 계산 1회 결과). "미선택 변경 파일이 없습니다"/"Extract 대상이 없습니다" 등 세부 문구는 §2.6 | 위와 동일 | 위와 동일 |
| AddFilesPopup(누락된 의존성 부분) | "누락된 의존성이 없습니다" | "의존성 확인 중..."(`dependencyAnalyzing`) | 이 저장소에 적용할 수 없으면(`dependencyApplicable=false`) `dependencyReason` 텍스트로 대체 표시 — 에러가 아니라 REQ-013의 정상적인 비적용 상태. HEAD 트리 자체는 계속 탐색 가능 |
| FooterActionBar | — | `exportStatus`에 따라 `[Export]` label을 "내보내는 중..." 등으로 변경, 중복 클릭 방지 | 실패 사유를 인라인 배너로 표시 |

DR-009(HEAD 미존재)로 인한 `warnings`와 `dependencyParseWarnings`는 에러가 아니라 **경고**다 — 계산은 정상 완료된 상태이므로 Export를 막지 않고, PreviewSummary의 버튼(§2.5)으로 여는 팝업에서 확인한다.

**추가 상태 — Stale**: 빈/로딩/에러 외에 네 번째 상태가 있다. 선택은 비어있지 않은데 `isStale`(§2.5)이 true인 경우로, PreviewSummary/IncludedFilesPane/ExtractTargetsPane 모두 "선택이 변경되었습니다 — Preview를 눌러 계산하세요"를 표시하고, FooterActionBar는 `[Export]`를 비활성화한 채 안내를 보여준다.

---

# 6. 다음 단계로 넘기는 항목

- §0 3가지 모두 사용자 확인 완료. #2(개별 파일 제외 + 전체 선택)는 REQ-011로 REQUIREDMENT.md에 반영 완료, §8 와이어프레임도 `[Build]` 제거·전체 선택 체크박스 추가로 갱신됨.
- 시각 디자인(색상, 타이포그래피, 간격)은 이 문서 범위 밖이다 — 컴포넌트/상태/인터랙션 정의까지가 DOCUMENT_CHECKLIST.md 4번의 범위다.
