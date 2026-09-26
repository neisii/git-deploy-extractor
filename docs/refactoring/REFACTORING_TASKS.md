# Refactoring Tasks

> 상태: **계획 문서 — 아직 코드는 하나도 바뀌지 않았다.** (작성 2026-09-21)
> 기준 자료: [`component-playground.html`](component-playground.html) — 목표 UI 구조를 직접 조작해 보는 단일 HTML 목업. 실제 앱 코드와 연결돼 있지 않고, 아래 결정은 이 목업에서 사용자와 합의한 내용이다.
> 관련 문서: RISK_ISSUES.md §8(백로그), REQUIREDMENT.md, HANDOFF.md (REQ-026 등 기존 문서의 미커밋 수정은 폐기됨 — 아래 §6 머리말 참고)

이 문서는 세 가지를 한곳에 모은다. (1) 목업에서 확정한 UI/컴포넌트 결정, (2) 코드 분석에서 나온 버그·구조 문제, (3) 그것을 실행하는 단계별 작업 목록.

---

## 0. 제품 사용 맥락 (사용자 설명, 2026-09-21)

**내부망 배포 흐름**: 외부(개발) 환경에서 GDE로 파일을 추출 → 추출한 파일을 **`src` 경로 구조 그대로 내부망 저장소에 덮어쓰기** → 내부망 저장소에서 commit & push → CI 파이프라인을 거쳐 (개발) 서버에 반영. 내부망과는 **완전히 분리된 네트워크**이며, 파일은 사람이 전달한다(REQUIREDMENT.md REQ-021 배경의 "개발 장비 → 팀장 → 내부망 메신저"와 같은 흐름).

**이 맥락이 못 박는 전제**
- 내부망 저장소 작업 폴더가 GDE를 쓰는 PC에서 **접근 가능한 경로로 보이는 일(마운트, 공유 드라이브 등)은 없고, 앞으로도 도입되지 않는다.** → GDE는 내부망 저장소에 직접 쓰지 않는다. `direct` 모드는 "빈 전달용 폴더에 모으기" 용도이므로 **빈 폴더만 허용(a안)으로 충분**하고, 병합 덮어쓰기(b안)는 **폐기**한다(M-25).
- 덮어쓰기 방식이므로 내부망 저장소의 해당 파일은 HEAD 최신본으로 통째로 교체된다 → **누락된 의존성 알림**(빠진 파일은 내부망 빌드 실패로 직결)이 핵심 안전장치다.
- 삭제 대상은 자동으로 반영되지 않고 담당자가 **직접 삭제**한다 → `extract-list.txt`는 **사람이 읽는 안내 파일**(프로그램이 읽지 않음)이며, 삭제 목록이 트리·경계선으로 구분돼 있는 것이 그 용도에 맞다.
- 내부망 저장소에 commit할 때 커밋 메시지를 쓰는 데 원본 커밋 목록을 참고한다 → `extract-list.txt` 머리말에 원본 커밋 목록을 남긴다(RT-57).
- 저장소 루트 기준 상대경로가 곧 내부망 저장소에서의 경로다 → 경로 복사 기능(제안 단계)의 기준 경로로 적합.

---

## 0.1 용어 정의 (2026-09-21 확정)

이 문서와 이후 명세는 아래 용어만 쓴다. 이전에 임시로 쓰던 "후보"·"후보 목록"은 **폐기**한다(REQ-013의 "의존성 후보"와 혼동되고, 기본값에서 비어 있는 목록에 어울리지 않음).

| 용어 | 뜻 | 코드 근거 |
|---|---|---|
| **변경 파일** | 선택한 커밋들의 변경사항으로 기록된 파일 중, **삭제되지 않았고 HEAD에 존재하는 것**(Added/Modified). REQ-005 "변경 파일 추출"과 같은 어휘. 추출되는 내용은 커밋 시점이 아니라 **HEAD 최신본**(DR-003) | `analyzeCommits.ts`의 `deployTargets` |
| **삭제 대상** | 선택한 커밋 중 하나라도 삭제(D)한 파일(다른 커밋에서 다시 추가·수정돼도 삭제, DR-007) | `deleteList` |
| **HEAD에 없음(경고)** | 변경사항으로 기록됐지만 HEAD에 없어 제외된 파일(DR-009) | `warnings` |
| **누락된 의존성** | 커밋 변경사항에 **없지만** 정적 분석이 추천한 파일(REQ-013). 변경 파일이 아님 | `dependencyAnalysis.ts` |
| **수동 추가 파일** | 사용자가 `+ 파일 추가`로 직접 지정한 파일(REQ-021). 변경 파일이 아님 | — |
| **Extract 대상** | 위 세 출처(변경 파일 · 누락된 의존성 · 수동 추가) 중 **확정해 Export할 것**. 오른쪽 목록 | — |
| **미선택 변경 파일** | 변경 파일 중 **아직 Extract로 옮기지 않은 것**. 왼쪽 목록(화면 이름은 아직 `포함된 파일`, 이름 확정은 M-14). 기본값(전체 Extract)에서는 시작 시 비어 있음 | — |
| **출처 배지**(Extract 행) | 변경 파일 = `변경`, 수동 추가 = `수동`, **누락된 의존성은 출처 글자 없이 종류 배지 `Impl`/`I`만 표시**(의존성·구현체·인터페이스 한글 병기 삭제, 2026-09-21). 이전 `diff` 표기는 `변경`으로 통일 | — |

※ 목업(`component-playground.html`)은 2026-09-21에 이 용어(`변경 파일`·`미선택 변경 파일`·배지 `변경`)로 갱신했다. 단, 목업과 다르면 이 표와 §5.1 명세가 우선한다(§1.1).

---

## 1. 목업(component-playground.html) 사용법

| 컨트롤 | 용도 |
|---|---|
| 컴포넌트 경계·이름·상태 소유 표시 | 모든 컴포넌트에 `이름 [S]/[L]/[D]` 라벨과 깊이(D0~D6)별 색 표시 |
| 검사 모드 | 클릭으로 컴포넌트 선택 → 우측 인스펙터에 부모 › 자식 경로·상태·이벤트 표시 |
| 분석 단계 | ready / stale / empty / loading / error / 의존성 확인 중 / 의존성 적용 불가 |
| 기존 방식 재현 | stale 시 좌측 패널 통째 교체(버그 U1) 비교 |
| 팝업 | 파일 추가 / 파일 패턴 / Deleted / 경고 — `openPopup` 하나만 열림 |
| 팝업 높이 클램프 | 끄면 기존 `60vh` 동작(버그 U2) 비교 |
| 슬라이더 | 작업 영역 높이, 위:아래 비율, 화면 폭(기본 1100px), 좌:우 비율 |
| 이벤트 로그 | 접기/펼치기 시 `section:hide` / `section:show` 발행 확인 |

- 연 방법: `docs/refactoring/`에서 `open component-playground.html` (외부 의존성 없음).
- 한계: 상태·이벤트는 목업 안에서만 동작. 스토어/IPC/실제 git과 무관.
- **위 표의 컨트롤은 전부 목업 전용이다(구현 대상 아님).** 무엇이 실제 앱 UI이고 무엇이 시연 도구인지는 아래 §1.1에 정리했다.

### 1.1 목업 전용 요소 (구현 대상 아님)

**이 목업은 방향 확인용이라 세부 인터랙션은 의도적으로 생략·단순화했다. 실제 동작 규칙은 §5.1(작업별 상세 명세)에 적고, 목업과 다르면 §5.1이 우선한다.**

**판별 기준**: 좌·우 사이드 패널의 모든 것은 시연 도구다. 가운데 "모의 앱" 안에서는 아래 B·C·D·E에 적은 것만 목업 전용이고, 나머지(컴포넌트 이름이 붙은 UI, §2·§3)가 구현 대상이다. "경계·이름 표시"를 켜면 구현 대상 컴포넌트에만 `이름 [S]/[L]/[D]` 라벨이 붙는다.

**A. 좌측 컨트롤 패널 — 전부 목업 전용**
| 요소 | 목업에서의 용도 | 실제 앱에서는 |
|---|---|---|
| 컴포넌트 경계·이름·상태 소유 표시 | 컴포넌트 트리·소유 상태 시각화(`data-comp` 오버레이) | 없음 |
| 검사 모드 | 클릭으로 컴포넌트 선택, 동작 차단 | 없음 |
| 분석 단계 선택상자(ready/stale/empty/…) | 상태별 화면 확인 | 스토어 상태에서 **파생**(사용자가 고르지 않음, `useAnalysisPhase`) |
| 기존 방식 재현(stale 시 패널 교체) | 버그 U1 전후 비교 | 없음(항상 새 방식) |
| Extract 목록: Preview 직후 기본값 선택상자 | 전체 Extract ↔ 전체 미선택 비교 | 미결 M-14에서 하나로 확정(설정 UI는 요구된 바 없음) |
| `Preview 재실행 (초기화)` 버튼 | Extract 초기 상태 시연 — **실제 분석을 하지 않는다** | 없음(실제 Preview 버튼은 `CommitListHeader`에 있음) |
| Export 시뮬레이션: 추출 경로와 저장소의 관계 선택상자(정상/같음/하위/포함/미선택) + "선택한 경로가 비어 있지 않음" 체크박스 | 검증 규칙(`INSIDE_REPO`·`CONTAINS_REPO`·`NO_PATH`·`NOT_EMPTY`)과 우선순위 시연 | 없음(Main이 실제 경로를 검사, RT-56) |
| 팝업 버튼 5개(`+ 파일 추가`·`파일 패턴 [보기]`·`Deleted 목록`·`경고 목록`·`닫기`) | 팝업을 바로 여는 단축키 | 실제 트리거는 각 UI의 버튼(`+ 파일 추가`, `[보기]`, `Deleted ▸`, `⚠ HEAD에 없음 ▸`), 닫기는 팝업의 `×`/백드롭/Esc |
| 팝업 높이 클램프 체크박스 | 버그 U2 전후 비교 | 없음(항상 클램프) |
| 슬라이더 4개(작업 영역 높이·위:아래 비율·화면 폭·Extract 패널 폭 비율) | 레이아웃 반응 확인 | 창 크기 / `SplitPane` 드래그(비율은 `localStorage` 저장) |

**B. 우측 사이드 패널 — 전부 목업 전용**: 인스펙터, 실시간 상태(JSON 덤프), 이벤트 로그, 소유 규칙 안내문. (단 접기/펼치기의 `section:hide`/`section:show` 이벤트 **발행 자체**는 구현 대상이고 로그 UI만 목업 전용.)

**C. 모의 앱 안의 시연 장치**
| 요소 | 설명 |
|---|---|
| Export 후 `Export 완료(목업)` 줄과 그 아래 **`extract-list.txt` 내용 미리보기**(`<details>` + `<pre>`) | 파일 형식 시연용. 실제 앱은 파일을 쓰기만 하고 내용을 화면에 보여주지 않는다. **파일 내용의 형식(RT-57)만** 구현 대상 |
| 파일 패턴 팝업 하단의 `sample-1/** … sample-14/**` 더미 칩 14개 | 팝업 내부 스크롤 시연용 |
| 폴더 이동·팝업·Extract 변경 시 강조 애니메이션(`flash`) | 어디가 바뀌었는지 보여주는 시연 효과(실제 앱 애니메이션은 결정된 바 없음) |
| 컴포넌트 라벨·점선 오버레이 | 위 A의 경계 표시 결과물 |

**D. 고정된 가짜 데이터**: 저장소 표시(`deep-backend (shallow-backend) / main`), 버전 배지 `v0.6.0`, 브랜치 3개(main/develop/release/1.0), 커밋 8개(해시·작성자·메시지), 초기 선택 커밋 3개, 변경 파일 10개, 누락된 의존성 2개(구현체/인터페이스), 삭제 대상 7개, HEAD에 없는 파일 2개, 파싱 실패 1개, 초기 파일 패턴 5개, HEAD 트리 검색 결과(`BeanProvider*` 등), Export 기본 경로 `D:\deploy-output`. (조회 기간의 "오늘-7일~오늘"만 실제 날짜로 계산.)

**E. 실제 앱과 다르게 단순화된 동작 — 구현할 때 목업을 그대로 따르면 안 되는 부분**
| 항목 | 목업 | 실제 구현에서는 |
|---|---|---|
| `Browse...`, `Preview`, `Search`, `Export`의 일부 | `Browse...`·`Preview`는 동작 없음, Export는 문구만 표시 | 실제 IPC 호출(폴더 선택, 분석, 파일 생성) |
| 조회 조건 필터링 | **메시지 제외만** 커밋 목록에 실제 반영. Branch·검색 대상·검색어·기간·최대 개수·Merge 제외·작성자·해시는 값만 바뀌고 목록은 안 바뀜 | 모두 `git log`에 반영, 페이지네이션·가상 스크롤 포함 |
| Reload | 조건·선택·분석 결과 초기화만 시연 | 저장소 재검증·브랜치 재조회·첫 페이지 재조회까지 수행(U-15) |
| Export | 파일을 쓰지 않음. 폴더 비어 있음 확인은 체크박스로 가정, `sub`의 덮어쓰기 확인창은 텍스트 한 줄로 가정 | 실제 파일 생성, Main의 폴더 검사, 네이티브 확인창 |
| 분석(Preview·변경 파일·의존성) | 고정 데이터와 `분석 단계` 수동 선택 | `git diff`·HEAD 확인·Java 정적 분석 |
| 파일 패턴 저장 | 메모리에만 유지(새로고침하면 초기화). `localStorage`에 저장되는 것은 Export 방식(`gde:exportMode`)뿐 | 패턴 이력은 `localStorage` 전역 영속(REQ-019) |
| 접힘·펼침·분할 비율 | 새로고침하면 초기화 | 분할 비율은 영속(REQ-014), 접힘 영속 여부는 M-7 |
| 팝업 직접 검색 | 고정 배열 검색 | 선택 Branch의 HEAD 트리(`listTrackedFiles`) |
| 스타일 | 자체 CSS, 라이트 테마 하나 | 앱의 기존 `main.css`·토큰(다크 테마 지원 여부는 별도) |
| 없는 것들 | `Credit`, 업데이트 확인·버전 배지 동작, 커밋 목록 가상 스크롤·무한 로딩, 트리의 300개 가상 스크롤, 컬럼 실측 폭(가상 스크롤의 가로 스크롤 폭용) | 그대로 구현 필요(리사이즈 핸들은 삭제 결정 — RT-41) |


---

## 2. 목표 컴포넌트 구조

### 2.1 트리와 상태 소유 (`[S]` 스토어 · `[L]` 로컬 · `[D]` 파생)

```
D1 AppShell                         레이아웃만
├ D2 RepositoryBar                  [S] repository·update
│   ├ D3 RepoLabel · RepoBarRight(RepoPathActions[Browse... · Reload] · VersionBadge — 오른쪽 끝 정렬)      (props/events만)
├ D2 CommitQueryBar                 [S] commitQuery · [L] collapsed
│   ├ D3 BranchSelect · SearchModeRadio · DateRangeField · MergeToggle
│   ├ D3 MaxCountField             [L] 입력 중 문자열 (blur/Enter에서 확정)
│   ├ D3 MultiValueField ×3        (우측 그룹) 키워드 · 작성자 · 해시 필터 — 같은 높이의 텍스트 영역, 모두 줄바꿈 구분
│   ├ D3 QueryConditionGroup       검색 조건 그룹(Branch·Search·조회 기간·최대 개수·Merge 제외) — 별도 상자
│   ├ D3 SplitHandle               두 그룹 사이 경계(드래그, 비율 localStorage 영속)
│   └ D3 QueryFilterGroup          필터 그룹(키워드·작성자·해시) — 별도 상자, 같은 높이(2줄)의 텍스트 영역 세 개
├ D2 WorkArea                       [L] openPopup · splitRatio · collapsed(commits/deploy)
│   ├ D3 CommitWorkspace            (SectionHeader + 가로 SplitPane 80:20)
│   │   ├ D4 CommitList → D5 CommitListHeader · CommitRow
│   │   └ D4 PreviewSummary         [S] summary — 여기에 Deleted / ⚠ HEAD에 없음 버튼
│   ├ D3 DeployFilesWorkspace       [S] analysis (팝업 상태는 갖지 않음) — 2분할 SplitPane(미선택 변경 파일 | Extract)
│   │   ├ D4 IncludedFilesPane      [D] useIncludedFilesView
│   │   │   └ D5 FilePane → D6 FilePaneTitle(+ AddFileButton 우측) · FileList
│   │   │   └ D5 FilterPatternBar   [L] newMode·newPattern · [S] patterns
│   │   └ D4 ExtractTargetsPane     [D] useExtractTargetsView — 실제 Export 대상 목록
│   │       └ D5 FilePane → FilePaneTitle(+ 모두 되돌리기) · FileList → ExtractRow(파일명 · × RemoveButton · 출처 배지)
│   └ D3 PopupHost                  openPopup 수신: 'manual'|'patterns'|'deleted'|'warnings'|null
│       └ D5 AddFilesPopup          [L] query — 단일 화면(탭 없음): 툴바 · 분석 상태 안내 · HeadTreeBrowser(누락된 의존성은 붉은색+Impl/I 배지)
├ D2 ExportBar                      [S] export
└ Credit
```

### 2.2 primitives (도메인 지식 없음)

`Panel`(+Header/Body) · `PanelState`(`empty|loading|stale|error|na`, 본문 슬롯에만) · `Popup`(Esc, 포커스 트랩, 부모 높이 클램프) · `Chip`(토글 버튼 + 삭제 버튼 분리) · `TriStateCheckbox` · `TreeList`(+`TreeFolderRow`) · `CollapsibleSection`(SectionHeader + 접히는 본문) · `SplitPane`(기존 유지)

### 2.3 규칙

- D4 이상 컨테이너만 스토어/훅에 접근. D5·D6은 props와 콜백만 받는다. 이벤트는 소유자까지 올라간다.
- `openPopup`은 **`WorkArea`에만** 존재한다(`PreviewSummary`와 `DeployFilesWorkspace`의 공통 부모여야 두 가지에서 열 수 있다).
- 팝업은 종류와 무관하게 동시에 하나(`openPopup` 단일 값으로 구조적 보장).
- 접힘 상태 소유: `CommitQueryBar`는 자기 로컬, `CommitWorkspace`·`DeployFilesWorkspace`는 `WorkArea`(트랙 높이 재분배 때문).
- 파일당 150줄 이하, props 8개 이하 목표. 기능을 켜고 끄는 boolean/optional 콜백 prop 대신 슬롯이나 별도 컴포넌트.
- `WorkArea` 자식은 항상 자기 grid 트랙 높이를 100% 채운다(`min-height: 0`), 넘치는 내용은 각 목록 내부에서만 스크롤. 접힌 자식은 헤더 높이(auto)만 차지하고 남은 높이를 펼쳐진 자식이 흡수. 트랙 최소 높이: 위 90px / 아래 120px(현재 앱은 140px — 통일 필요).

---

## 3. 목업에서 확정한 UI 변경 (현재 앱 대비)

| # | 변경 | 세부 | 영향받는 기존 요소 |
|---|---|---|---|
| U-1 | **Delete List 영역 삭제** | `PreviewSummary`의 `Deleted: N ▸` 클릭 → `'deleted'` 팝업(삭제 파일 목록). 0건이면 비활성 | `DeleteListPanel` 폐기, REQ-009 Export의 `delete-list.txt`는 유지(화면 표시만 이동) |
| U-2 | **DeployFilesHeader 삭제** | 제목은 "포함된 파일" 툴팁(DR-003 HEAD 최신 기준). 경고 배너 이전: HEAD에 없음 → `PreviewSummary`의 `⚠ HEAD에 없음: N ▸`(`'warnings'` 팝업), 파싱 실패 → 파일 추가 팝업 상단 분석 상태 안내 줄(`ParseWarningNotice`) | `DeployFilesPanel`의 제목·`warning-banner` 2개 |
| U-3 | **StatusFilter(All/Added/Modified) 삭제** | `added` 파일만 글자색 녹색. 수동 추가 파일도 항상 added(DR-019)라 녹색 | `deployFilesFilter` 상태, `setDeployFilesFilter`, UI_UX_SPEC §2.6 Filter 행 |
| U-4 | **`+ 파일 추가` 위치** | "포함된 파일" 제목 줄의 우측 끝(제목과 같은 선상) | `FileListColumn`의 `extraHeaderControl` 자리 |
| U-5 | **포함된 파일의 검색(파일명) 삭제** | 파일 패턴(제외/포함)으로 대체. **우측 "누락된 의존성" 검색은 유지**(패턴이 그쪽엔 적용되지 않으므로). ~~⚠ 미결 M-1 참고~~ **B안 정정(2026-09-24, §7 M-46): 검색을 다시 들였다** — M-1이 우려한 위험(패턴을 검색 대용으로 쓰다가 Export에 조용히 영향)이 실제로 사용자에게 혼란을 줘서, "화면 전용" 예외를 패턴에 얹는 대신 검색 자체를 되살려 패턴과 역할을 분리했다. REQ-025는 사실상 부활 | REQ-025 ~~폐기~~ **부활(M-46)**, `deployFilesSearchTerm` → `includedSearchTerm` |
| U-6 | **세 영역 접기/펼치기** | `CommitQueryBar`·`CommitWorkspace`·`DeployFilesWorkspace` 우측 상단 버튼. 접힌 헤더에 한 줄 요약. `section:hide`/`section:show` 이벤트 발행 | RISK §8.3 |
| U-7 | **파일 패턴: 제외 + 포함** | 아래 §3.1 | REQ-019/024, REQ-026 재정의 |
| U-8 | **키워드 검색 통합(A안, 간단형)** | ~~검색 대상(메시지/파일명)+~~Search 입력과 메시지 제외 입력을 **하나의 텍스트 영역**으로 통합. 한 줄에 하나, **앞에 `-`를 붙이면 제외**, 글자 그대로(대소문자 무시) 부분 일치(정규식·`*` 없음), 포함 OR·제외 OR. ~~검색 대상 선택은 키워드 필드 헤더에 둠.~~ 메시지 제외 입력은 폐지. **M-49 정정(2026-09-24): 검색 대상 라디오 자체를 삭제, 키워드는 항상 메시지 대상**(REQ-016 폐기). 상세 RT-48 | REQ-003·~~REQ-016~~·REQ-022 정정 |
| U-9 | **조회 조건을 두 그룹으로 나누고 경계 조절 가능** | **검색 조건 그룹**(왼쪽: Branch·Search·기간·최대 개수·Merge 제외)과 **필터 그룹**(오른쪽: 키워드·작성자·해시 필터)을 각각 테두리 상자로 두고 사이 **경계를 드래그로 조절**(포함된 파일 ↔ Extract 대상과 같은 방식, 비율 `localStorage` 영속). 필터 세 필드는 **같은 높이로 2줄이 한 번에 보임**, 모두 줄바꿈 구분. placeholder는 유지하고 **입력을 시작하면 힌트 툴팁** 표시. 상세 RT-49 | 현재 단일 상자 안 좌우 배치 |
| U-11 | **Extract 대상 목록 분리** | 아래 §3.2 | `deployFiles[].included` 체크박스 모델, REQ-011, `FooterActionBar` Export 대상 계산 |
| U-12 | **누락된 의존성 영역을 파일 추가 팝업에 통합** | 아래 §3.3 | `MissingDependenciesPane` 폐기, REQ-013/020 표시 방식 |
| U-13 | **모든 파일 목록을 디렉터리 트리로 표시** | 아래 §3.4 | `FileList` 행 렌더링, 가상 스크롤(300개 임계값) |
| U-18 | **파일·폴더 행 경로 복사 버튼**(저장소 기준 상대경로) | 아래 RT-53 명세(§5.1). 근거: §0(저장소 루트 기준 상대경로 = 내부망 저장소 경로) | `TreeList` 리프·폴더 행, Extract 행 배치 |
| U-19 | **파일 추가 팝업: 검색어가 없을 때 HEAD 트리를 경로 세그먼트 기준 2단계까지 펼쳐 보여줌** | 아래 RT-52·RT-53 명세(§5.1) | `HeadTreeBrowser`, `TreeList`(기본 펼침 깊이·compact 시작 깊이) |
| U-20 | **파일 추가 팝업의 직접 검색과 누락된 의존성을 하나의 HEAD 트리 화면으로 통합**(탭 폐기) — 누락된 의존성은 붉은색 글자 + `Impl`/`I` 배지, 누락 폴더 자동 펼침, `보이는 항목 모두 추가`는 누락된 의존성 한정 | 아래 §3.3, RT-52 | U-12의 탭 구성 대체, `MissingDependenciesTab`·`HeadTreeSearchTab` 폐기 |
| U-21 | **`RepositoryBar`의 `Browse...`·`Reload`·버전 배지를 오른쪽 끝에 배치** | 아래 RT-59 명세(§5.1) | `RepositoryPanel` 레이아웃(`.repository-panel`) |
| U-14 | **`openPopup` 팝업 크기 1.5배** | 720×480px(기존 480×320). 높이는 부모 높이로 클램프, 클램프를 끄면 고정 480px | `.manual-add-popup` CSS(현재 480px 폭·`max-height: 60vh`) |
| U-15 | **Reload = 전체 초기화** | 아래 §3.5. ⚠ 기존 결정(REQ-015 / RISK §6.1: Reload는 선택 유지)을 **뒤집는 변경** | `reloadRepository`, REQ-015, RISK §6.1 |
| U-16 | **ExportBar: 추출 위치 방식 선택상자** | 아래 §3.6. ⚠ 바로 추출 모드는 기존 `buildPackage`의 `fs.rm(recursive)`와 충돌 — 구현 전 결정 필요 | `FooterActionBar`→`ExportBar`, `buildPackage`, `package:export` 확인창, REQ-012/DR-013 |
| U-17 | **Export 산출물 변경**: JSON 요약 삭제, 배포/삭제 목록을 하나의 txt로 통합·트리 표기 | 아래 §3.7 | `buildPackage`, `DeploySummary`, `verify-phase3.ts`, README, ARCHITECTURE §5 |
| U-10 | **화면 폭 기본 1100px** | 목업 기본값. 실제 앱 창 크기(현재 900×760)와의 관계는 미정 | `src/main/index.ts` |

### 3.1 파일 패턴(제외/포함) 규칙

- 종류는 **입력 형식에서 자동 파생**(사용자가 고르지 않음):

  | 입력 | 종류 | 처리 |
  |---|---|---|
  | `/` 포함 | 경로 | 경로 전체에 글롭 (`src/test/**`) |
  | `a.b.c.**` (식별자만, 끝이 `.**`) | 패키지 표기 | 경로 `**/a/b/c/**`로 변환 |
  | 그 외 | 파일명 | 마지막 조각에 글롭 (`*.png`, `application.*`) |

- `.*`는 패키지 표기로 보지 않는다(`application.*`는 정상 파일명 패턴). 끝에 와일드카드 없는 `com.acme.legacy`는 파일명 → 매치 없음.
- 글롭: `*` = 한 세그먼트, `**` = 하위 전체, 선행 `**/`는 있어도 없어도 매치.
- 조합: **제외가 항상 우선**. 활성 포함 패턴이 하나라도 있으면 그중 하나 이상에 매치되는 파일만 남는다.
- 패키지 표기는 `.java` 한정이 아니다 → 같은 경로의 리소스·`src/test`까지 매치(테스트 제외는 별도 `src/test/**` 제외 패턴).
- **해석 오버레이**(입력창 바로 아래에 겹쳐 뜸, 아래 목록 높이에 영향 없음): 종류 · 변환된 글롭 · 현재 매치 수, 0건이면 경고(패키지처럼 보이면 `.**` 안내). 입력이 비어 있으면 표시하지 않는다(예시는 placeholder와 툴팁이 담당).
- 칩: 제외(−, 붉은 배경)/포함(+, 파란 배경) + 종류 배지 + 매치 수(·N). 팝업은 제외/포함 두 구역.
- 저장 데이터: `{ pattern, mode: 'exclude'|'include', enabled }` (`kind`는 저장하지 않음 → 기존 REQ-019 데이터와 호환, 기존은 `mode: 'exclude'`로 취급).
- 적용 대상: **좌측 "포함된 파일"만**(우측 적용 여부는 미결 M-3).
- 매칭 검증: 19개 케이스(종류 판별 6, 패키지 변환 매치 8, 경로/파일명 5) 직접 실행 통과.

### 3.2 Extract 대상 목록 (U-11)

**모델**: 미선택 변경 파일 목록(왼쪽, 화면 이름 `포함된 파일`)에서 체크하면 그 파일이 **Extract 대상 목록으로 이동**하고, Extract 목록에서 파일명 우측의 **×**를 누르면 **원래 목록으로 복귀**한다. 체크박스 하나가 "체크 상태"이자 "소속 목록"이 된다.

| 출처 | 원래 목록 | × 를 누르면 |
|---|---|---|
| 변경 파일 | 미선택 변경 파일(`포함된 파일`) | 미선택 변경 파일로 복귀(체크 해제 상태) |
| 누락된 의존성 | 파일 추가 팝업의 HEAD 트리 | HEAD 트리로 복귀(다시 붉은색으로 나타남) |
| 수동(직접 검색) 추가 파일 | 없음 | **철회(삭제)** — 원래 목록이 없음(DR-019) |

- 레이아웃: `포함된 파일 | Extract 대상` **2분할**(U-12로 누락된 의존성 패널이 팝업에 흡수되면서 3분할에서 되돌아옴). 폭 슬라이더는 "Extract 패널 폭 비율"(기본 50:50).
- Extract 행: `경로 ×  [출처 배지]` — 출처 배지는 `변경` / `수동`이고, 누락된 의존성 행은 한글 출처 배지 없이 종류 배지 `Impl`/`I`만 붙는다. added 파일은 녹색.
- **활성 파일 패턴에 걸린 항목은 Extract 목록에서 숨기지 않고 흐리게 + 취소선 + "패턴 제외"로 표시**하고 Export 대상에서 뺀다(조용한 누락 방지). 제목에 `(N개 · 패턴 제외 K개)`.
- 미선택 변경 파일 목록은 패턴에 걸린 것을 숨긴다(기존과 동일). 이 목록의 "전체 선택"은 **화면에 보이는 변경 파일만** 이동(패턴으로 숨겨진 것은 남음).
- `모두 되돌리기`(Extract 목록 헤더): 전체를 원래 목록으로, 수동 추가는 철회.
- 접힌 배포 영역 요약: `Extract N개(패턴 제외 K) · 미선택 변경 파일 M개 · 누락된 의존성 K개`.
- **Preview 직후 기본값** 목업 옵션 두 가지: 전체 Extract로 이동(현행 동작 유지) / 전체 미선택. 누락된 의존성은 두 경우 모두 미선택으로 시작(현행과 동일). → 미결 M-14.
- 목업 검증: 12개 시나리오(× 복귀, 체크 이동, 의존성 이동/복귀, 수동 추가/철회, 패턴 제외 dim 4개, 전체 미선택 초기화, 전체 선택, 모두 되돌리기) 헤드리스 Chrome에서 전부 통과.

### 3.3 누락된 의존성 ↔ 파일 추가 팝업 통합 (U-12 → U-20에서 단일 화면으로 변경)

- **U-12**: `MissingDependenciesPane`을 화면에서 제거하고 `+ 파일 추가` 팝업(`AddFilesPopup`)으로 흡수(당시엔 탭 2개).
- **U-20(결정 2026-09-21)**: **탭 구성을 폐기**하고 직접 검색과 누락된 의존성을 **하나의 HEAD 트리 화면**으로 합친다. 누락된 의존성은 트리 안에서 **붉은색 글자 + 배지(`Impl` 구현체 / `I` 인터페이스)** 로 구분하고 트리 구조는 그대로 쓴다(§3.4).
- **채택한 보완(사용자 결정)**: ① **누락된 의존성이 들어 있는 폴더의 모든 조상 폴더는 기본 펼침**(2단계 기본 펼침 규칙과의 합집합) — 붉은 파일이 접힌 폴더에 숨지 않게 함 ② `보이는 항목 모두 추가`는 **누락된 의존성으로 한정** ③ 색만으로 구분하지 않도록 배지 병기.
- **미채택·보류(M-37)**: 트리 상단 `누락된 의존성 N개` 요약, `누락된 의존성만 보기` 토글, 붉은색 대신 주의 색(주황 계열).
- **발견성 보존**: `+ 파일 추가` 버튼의 `누락 N` 배지(REQ-020의 50개 초과 붉은 경고 이월) + 자동 펼침 + 붉은 표시.
- **상태**: 분석 상태(파싱 실패·확인 중·적용 불가)는 트리 위 한 줄 안내로 표시하고 트리는 계속 사용 가능(패널 언마운트 이슈 U1과 동일 원칙).
- 팝업 키 `'manual'`은 유지하되 컴포넌트 이름은 `ManualAddPopup` → **`AddFilesPopup`**으로 변경(내부 키를 `'addFiles'`로 정리할지는 M-18).
- **목업(`component-playground.html`)은 2026-09-21에 U-20 구성으로 갱신**했다(단일 화면, 붉은 글자 + `Impl`/`I` 배지, 조상 폴더 자동 펼침, 경로 세그먼트 기준 깊이·`compactFromDepth: 3`, 누락된 의존성 한정 `보이는 항목 모두 추가 (N)`, 경로 복사 버튼, Export 위치 검증 시뮬레이션, `extract-list.txt` 머리말의 원본 커밋). 헤드리스 Chrome 스크립트 시나리오 49개 통과. 그래도 §5.1 RT-52 명세가 우선한다.

### 3.4 파일 목록 트리 (U-13)

- **적용 대상 5곳**: 포함된 파일(미선택 변경 파일), Extract 대상, 팝업의 HEAD 트리(탐색·검색 결과), Deleted 팝업, 경고(HEAD에 없음) 팝업. 목록마다 독립된 `id`로 펼침 상태를 관리.
- **compact 폴더**: 하위가 폴더 하나뿐이고 파일이 없는 체인은 한 줄로 합친다(`src/main/java/com/acme`, `js/guarantee`, `templates/guarantee`). IDE의 compact middle packages와 같은 방식 — 깊은 Java 패키지 경로에서 깊이를 크게 줄인다.
- **행 표시**: 리프에는 **파일명만** 표시하고 전체 경로는 툴팁(`title`). 폴더 행에 하위 파일 개수. 폴더/리프 정렬은 이름순(폴더 먼저).
- **펼침/접힘**: `▾/▸` 버튼 또는 폴더명 클릭, 기본 전부 펼침, 상태는 로컬(저장 안 함).
- **폴더 단위 동작(미선택 변경 파일·Extract 목록만)**: 미선택 변경 파일 폴더 체크박스 = **화면에 보이는 하위 변경 파일 전체를 Extract로 이동**(패턴에 숨겨진 파일은 제외), Extract 폴더 `×` = **하위 전체를 원래 목록으로 복귀**(수동 추가는 철회). 폴더 × 로 돌아온 항목 중 누락된 의존성은 왼쪽 목록이 아니라 파일 추가 팝업의 HEAD 트리로 복귀한다(붉은색으로 다시 나타남).
- 팝업 내 트리(의존성·검색 결과·삭제·경고)는 폴더 동작 없이 펼침/접힘만.
- **패턴과의 관계**: 패턴에 걸린 Extract 행은 트리 안에서도 흐림+취소선+"패턴 제외" 유지.
- 목업 검증: 10개 시나리오 통과(폴더 행 존재, 체인 병합, 리프 파일명만, 접힘/펼침, 폴더 ×/체크 이동, 팝업 크기 720×480, 팝업 내 트리 2곳).
- **구현 시 주의**: 현재 앱은 300개 초과 시 `react-window` 가상 스크롤을 쓴다. 트리는 **펼쳐진 행을 평탄화한 배열**을 가상화하고 폴더 행도 하나의 행으로 취급해야 하며, 컬럼 실측 폭 계산(`useMeasuredColumnWidth`)은 들여쓰기(깊이×14px)를 포함해야 한다. 폴더 접힘 시 가상 리스트 길이가 바뀐다.

### 3.5 Reload = 전체 초기화 (U-15)

사용자 요구: Reload를 누르면 **선택한 브랜치를 포함한 모든 검색·필터 조건과 선택 사항이 기본값으로** 돌아간다.

| 구분 | 항목 | Reload 후 |
|---|---|---|
| **초기화** | Branch | 기본 브랜치(`pickDefaultBranch`) |
| | 검색 대상 / 검색어 | 메시지 / 빈 값 |
| | 조회 기간 | **오늘-7일 ~ 오늘을 다시 계산**(현재는 앱 시작 시점 값 고정 — "오늘이 갱신되지 않는" 기존 결함이 함께 해소됨) |
| | 최대 개수 / Merge 제외 | 100 / 체크(제외) |
| | 작성자 · 해시 필터 · 메시지 제외 | 빈 값 |
| | 커밋 선택(`selectedHashes`) | 전부 해제 |
| | 분석 결과(요약·배포 파일·Extract·삭제·경고·누락된 의존성·수동 추가) | 폐기 → Preview 다시 필요 |
| | 열려 있는 팝업 | 닫힘 |
| **유지(가정, 미결 M-22)** | 파일 패턴(제외/포함) 이력, Export 경로, 영역 접힘 상태, 분할 비율, 트리 펼침 상태 | 그대로 |

- **재조회는 그대로**: 저장소 재검증, 로컬 브랜치 목록·원격 프로젝트명 재조회 후 첫 페이지 조회. `git fetch`는 여전히 하지 않는다(미결 M-23).
- **충돌하는 기존 결정**: 현재 코드 주석은 "Reload는 같은 저장소를 다시 읽는 것뿐이라 선택을 지울 이유가 없다"(RISK §6.1 케이스 A/B에 해당 안 함)고 결정돼 있고 REQ-015는 "재조회 시 선택 유지"가 기본 방향이다. U-15는 이를 뒤집으므로 REQ-015, RISK §6.1 표, 결정 이력에 **정정 기록**이 필요하다. "검색 조건을 바꿔가며 누적 체크"하는 워크플로우는 Reload를 누르지 않는 한 유지된다.
- **파괴적 동작**: 선택·조건을 한 번에 잃는다. 실수 방지용 확인 대화상자는 요구에 없어 목업에 넣지 않았다(M-24).
- 목업 검증: Reload 후 Branch/모드/검색어/기간/최대 개수/Merge/작성자/해시/메시지 제외가 기본값이 되는지, 선택 0개, 분석 단계 empty, 팝업 닫힘, 파일 패턴·접힘 유지까지 16개 시나리오 통과(그중 2개는 사전조건/중복 확인이라 실질 검증은 14개).

### 3.6 Export 추출 위치 방식 선택 (U-16)

- **배치**: `ExportBar`의 `Export` 버튼 **왼쪽**에 선택상자(`ExportModeSelect`, D3). 줄 구성: `[변경] 경로 ……… [모드 ▼] [Export]`, 아래 줄에 `ExportStatus`.
- **옵션 2개**:
  | 값 | 라벨(목업) | 결과 위치 |
  |---|---|---|
  | `sub` (기본) | `git-deploy-extracted 폴더 생성 후 추출` | `<선택 경로>\git-deploy-extracted` |
  | `direct` | `선택한 경로에 바로 추출` | `<선택 경로>` 그대로 |
- **경로 표시**: `변경` 옆 경로 텍스트는 **실제 생성될 위치**를 보여준다(모드에 따라 `\git-deploy-extracted` 접미사가 붙거나 빠짐).
- **저장**: 선택은 `localStorage`(`gde:exportMode`)에 영속(가정 — 기존 Export 경로 저장 패턴과 동일). 기본값은 기존 동작(`sub`)이라 업데이트 후에도 결과가 안 바뀐다.
- **바로 추출 시 안내**: Export 완료 줄에 "⚠ 선택한 폴더 자체에 파일이 생성됩니다".
- **결정(2026-09-21): M-25 (a)안 채택** — `direct`는 **선택한 폴더가 비어 있을 때만 허용**한다. 비어 있지 않으면 Export 버튼을 비활성화하고 "빈 폴더를 선택하거나 '폴더 생성 후 추출'을 사용하세요"를 표시한다. `sub` 방식은 기존과 같이 덮어쓰기 확인창 후 진행. 병합 덮어쓰기 등 (b)안은 **폐기**(망분리 환경, 내부망 저장소 마운트 사용 사례가 없고 앞으로도 없음 — §0, RISK_ISSUES.md §8.6). 목업은 "선택한 경로가 비어 있지 않음" 시뮬레이션 체크박스로 확인 가능.
- **결정(2026-09-21): 추출 위치가 저장소와 겹치면 Export 불가**(사용자 실수 방지). 처음 요구는 "추출 경로 = 저장소 경로 동일 금지"였고, M-33 결정으로 **저장소 하위 폴더까지 차단**한다(= "저장소 안"). 이유: `sub`는 산출물 폴더가 저장소 안(`<저장소>/git-deploy-extracted`)에 생겨 `git status`에 추적되지 않은 폴더로 나타나 실수로 커밋될 수 있고(현재 기본 동작이 이랬다), `direct`는 저장소(또는 그 하위)에 파일을 쏟게 된다. 두 모드 모두 적용. 상세 규칙·검증 시점·수용 기준은 §5.1 RT-56.
- ⚠ **REQ-012 기본값 폐지**: 현재는 추출 경로 미선택 시 저장소 루트가 기본값(`exportParentDir ?? repoPath`)인데 이 검증과 정면으로 충돌한다. **경로를 명시적으로 고를 때까지 Export를 비활성화**한다(§5.1 RT-56).
- 목업 검증: 8개 시나리오 통과(선택상자가 Export 버튼 왼쪽 같은 줄, 기본값, 경로 표시 전환, 바로 추출/폴더 생성 결과 문구, 이벤트 로그, 상태 덤프, localStorage). 첫 실행에서 3개가 실패했는데 원인은 목업이 아니라 **테스트 코드의 백슬래시 이스케이프 오류**였고, 테스트를 고쳐 재실행해 통과했다.

**⚠ 구현 시 반드시 다뤄야 할 위험 (현재 코드 기준, 목업에는 표현 안 됨)**

1. *(a안으로 해소: `direct`는 빈 폴더만 허용하므로 삭제할 내용이 없다. 단 `direct`에서 `fs.rm`을 호출하지 않도록 분기하고 "비어 있음" 확인은 반드시 Main에서 수행)* **`buildPackage`가 대상 폴더를 통째로 지운다.** `fs.rm(deployDir, { recursive: true, force: true })` 뒤에 다시 만든다. `direct` 모드에서 `deployDir`이 사용자가 고른 폴더 자체가 되면 **그 폴더의 기존 내용이 전부 삭제된다.** `direct`에서는 삭제 없이 파일만 쓰도록 분기하거나, 비어 있을 때만 허용해야 한다(M-25).
2. *(a안으로 대부분 해소: 저장소 루트는 비어 있지 않아 차단됨. 그래도 `direct`는 경로 미선택 시 Export 비활성화 — 이제 `direct`뿐 아니라 두 모드 모두)* **경로 미선택 시 기본값이 저장소 루트다**(`getDeployDir(repoPath, exportParentDir)`의 `exportParentDir ?? repoPath`). `direct` + 미선택이면 **작업 중인 저장소 루트에 그대로 쏟아지고**, 1번과 결합하면 저장소 삭제까지 이어질 수 있다. `direct`는 경로를 명시적으로 고르기 전에는 Export를 비활성화해야 한다.
3. **덮어쓰기 확인창 문구·조건이 `git-deploy-extracted` 전제다**(`package:export` 핸들러: `이미 있는 git-deploy-extracted를 덮어씁니다`, `deployDirHasContent`). `direct`에서는 "선택한 폴더에 이미 파일이 있음"으로 문구와 판정을 바꿔야 한다.
4. *(빈 폴더만 허용하므로 충돌은 없음. 부수 파일은 U-17로 `extract-list.txt` 하나로 축소)* **부수 파일이 루트에 생긴다**: `deploy-files.txt`, `delete-list.txt`, `deploy-summary.json`이 결과 폴더 루트에 써진다. `direct`에서는 사용자의 폴더에 이 세 파일이 섞이고, 같은 이름의 기존 파일을 덮어쓸 수 있다(M-26).
5. `BuildPackageParams`에 모드를 전달할 필드가 필요하다(IPC 검증 RT-12와 함께 화이트리스트 검증).

### 3.7 Export 산출물 변경 (U-17)

**결정(2026-09-21)**
1. `deploy-summary.json` **생성 기능 삭제**.
2. `deploy-files.txt`와 `delete-list.txt`를 **하나의 txt 파일로 통합**하고, 내용에서 두 목록이 구분되도록 **경계선**을 넣는다.
3. 각 목록은 **트리 구조**로 나열한다.

**파일명 결정(2026-09-21)**: `extract-list.txt`. 화면의 "Extract 대상"·결과 폴더 `git-deploy-extracted`와 같은 어휘라 산출물과 화면을 바로 연결해 이해할 수 있고, 없어진 `deploy-files.txt`와 이름이 비슷해 생기는 혼동도 피한다. 삭제 대상 목록도 담기지만 머리말·섹션 제목이 이를 보완한다.
**용도(사용자 확인)**: txt는 **사람이 보는 용도**이며 프로그램이 읽지 않는다.
**머리말(결정)**: 생성 시각, 기준 브랜치명, **원본 커밋 목록(몇 줄)** 을 기재한다. 원본 커밋 목록은 내부망 저장소에 commit할 때 커밋 메시지를 쓰는 데 참고하는 용도(사용자 확인: 실질적으로 도움이 됨). 형식·상한은 가정(M-32).

**형식 예시** (목업이 만드는 실제 출력과 같은 규칙):

```
================================================================
 Extract 목록
 생성 시각   : 2026-09-21 10:52:31 +09:00
 기준 브랜치 : main
 원본 커밋 (3개)
   a8f2d31  2026-09-05  neisii   guarantee UI
   8dd9e91  2026-09-07  taeyang  공통 Repository 구현체 정리
   b61e2ab  2026-09-06  neisii   guarantee html
================================================================

================================================================
 배포 대상 파일 (6개)
================================================================
├── src/
│   ├── main/
│   │   ├── java/com/acme/guarantee/
│   │   │   ├── GuaranteeListController.java
│   │   │   └── GuaranteeService.java
│   │   └── resources/
│   │       └── ...
│   └── test/...
└── docs/...

================================================================
 삭제 대상 파일 (7개)
================================================================
├── config/
│   └── deprecated.properties
└── old.js
```

- **미리보기는 목업 전용**: Export 후 화면에 내용을 보여주는 영역은 형식 시연용이며 구현 대상이 아니다(§1.1 C). 구현 대상은 **파일에 쓰이는 내용**뿐이다.
- 규칙: 머리말 블록(`=` 64자 두 줄 사이에 제목·생성 시각·기준 브랜치·원본 커밋 목록) 다음 두 섹션. 생성 시각은 `YYYY-MM-DD HH:mm:ss ±HH:MM`(현재 `buildPackage`의 `formatIsoWithOffset`과 같은 로컬 시각+오프셋 계산을 사람이 읽기 쉬운 구분자로), 기준 브랜치는 Export에 쓰인 `selectedBranch`. 폴더 먼저·이름순, `├── / └── / │` 커넥터, **단일 자식 폴더 체인은 한 줄로 합침**(화면 트리와 동일 — 가정), 목록이 비면 `  (없음)`, 섹션 제목에 개수, 섹션 경계선은 `=` 64자 두 줄(제목을 감쌈). **활성 파일 패턴에 걸린 항목은 배포 대상 목록에서 제외**(Export되지 않는 것과 일치). LF, UTF-8.
- 목업 검증: 16개 시나리오 통과 + 머리말/파일명 9개 시나리오 통과(경계선 6줄, 머리말 형식·브랜치 반영, 파일명 `extract-list.txt`; 이전 검증 항목: 배포 6개·삭제 7개 개수, 트리 커넥터, 배포→삭제 순서, 패턴 제외 파일 미포함, 체인 병합, JSON/구 파일명 미언급, "(기존)" 문구 삭제, a안 차단/허용).

**영향 범위 (코드 확인 결과)**
| 위치 | 변경 |
|---|---|
| `src/main/package/buildPackage.ts` | `deploy-files.txt`·`delete-list.txt`·`deploy-summary.json` 3개 기록 → `extract-list.txt` 1개. `DeploySummary` 생성 코드 삭제 |
| `src/shared/types.ts` | `DeploySummary` 삭제, `BuildPackageResult.summary` 제거. `BuildPackageParams.selectedCommits`는 **머리말의 원본 커밋 목록에 쓰이므로 유지**하고, 요약에만 쓰이던 `warnings`·`mappingProfileName`은 정리 가능(렌더러 `appStore.ts` `runExport`도 함께) |
| `scripts/verify-phase3.ts` | 세 파일 존재·내용을 검증하는 코드(127~148, 212~231행)를 새 산출물 기준으로 재작성 — RT-01/RT-04 테스트 승격과 함께 |
| README.md(33, 50행), ARCHITECTURE.md §5(160~162행) | `delete-list.txt`, 체크 해제 시 `deploy-files.txt`에서 빠짐, `deploy-summary.json` 생성 서술 갱신 |

**⚠ 남은 위험**
- ~~기계 소비자 호환~~ — 사용자 확인: **txt는 사람이 보는 용도이고 프로그램이 읽지 않으므로 해소됨**(트리 형식 자체는 문제 없음).
- **감사 기록 축소**: JSON에 있던 경고·매핑 프로필은 산출물에서 사라진다. 머리말에는 생성 시각·기준 브랜치·**원본 커밋 목록(몇 줄)** 을 남긴다(사용자 결정).
- 박스 문자(`├──` 등)는 UTF-8이라 구형 Windows 메모장에서 깨질 수 있다. 현재 `buildPackage`는 BOM 없는 UTF-8로 쓰므로, 사람이 Windows에서 열 파일이면 BOM 여부를 구현 시 확인한다(M-31).

---

## 4. 코드 분석 결과 (현재 앱)

### 4.1 버그·안전성 (🔴 높음)

| ID | 위치 | 내용 | 상태 |
|---|---|---|---|
| R1 | `main/git/commits.ts` `listCommitsByHash` | 해시 필터 입력이 검증·`--` 구분자 없이 git 인자로 들어감. `git log --no-walk --output=<file>`이 실제로 파일을 쓰는 것을 임시 저장소에서 확인 | 미수정 |
| R2 | `appStore.ts` `loadCommitsFirstPage`/`loadNextPage` | 요청 순서 가드 없음 → 늦게 도착한 이전 응답이 최신 결과를 덮어씀. `loadNextPage`는 호출 시점 `commits` 스냅샷에 이어붙여 첫 페이지 재조회 후 초기화된 목록이 되살아날 수 있음 | 미수정 |
| R3 | `main/ipc/handlers.ts` | IPC 파라미터 무검증. `buildPackage`가 `join(deployDir, serverPath)`로 씀(`..`), `package:export`의 `fs.rm(recursive)`이 렌더러 경로에 의존 | 미수정 |
| R4 | `appStore.ts` `runAnalysis`/`runPreview`, `CommitListPanel.tsx` Preview 버튼 | **분석 요청 경쟁 상태**: 같은 선택으로 Preview를 연달아 누르면 `selectionMatches`(선택·브랜치·프로필만 비교)가 통과되어 **먼저 보낸 요청의 늦은 응답이 나중 요청의 상태를 덮어쓴다** — 그 사이 Extract에서 뺀 파일이 전부 포함으로 초기화되고 `manuallyAddedPaths`도 비워지며, 먼저 끝난 쪽이 `dependencyAnalyzing`을 꺼서 아직 분석 중인데 완료처럼 보인다. Preview 버튼은 분석 중에도 비활성화되지 않는다(`selectedHashes`가 비었을 때만). 요청 번호가 없다. 현재 코드에서 Reload가 선택을 유지(`keepSelection=true`)하므로 Reload 후 초기화된 분석 결과가 되살아나기도 한다(U-15로 Reload가 선택을 해제하면 가드에 걸려 해소) | 미수정 |
| R5 | `FooterActionBar.tsx` `exportDisabled` | **분석 중 Export 허용**: `stale`이 아니면 `의존성 확인 중`·`계산 중`에도 Export가 활성화되어 **누락된 의존성 알림(빌드 실패를 막는 핵심 안전장치)을 건너뛰고 내보낼 수 있다** | 미수정 |
| U1 | `DeployFilesPanel.tsx` | `isStale`이면 `FileListColumn` 자체를 플레이스홀더로 교체(언마운트) → 제외 패턴 UI·입력 중 문자열·컬럼 로컬 상태 소실 | 목업에서 해결안 확인 |
| U2 | `main.css` `.manual-add-popup` | `max-height: 60vh` vs 백드롭이 `.deploy-files-panel` 안 `absolute` → 세로 SplitPane 최소 140px에서 팝업이 넘쳐 `×` 잘림 | 목업에서 해결안 확인 |

### 4.2 UI/UX 버그 (🟡/🟢, 코드 리딩 기반 — 앱 실행 재현은 미수행)

| ID | 내용 |
|---|---|
| U3 | "최대 N개" 입력: `Number(value) \|\| 1`이라 비우면 1로 스냅, 값 변경마다 재조회 |
| U4 | Search 입력에서 Enter가 동작하지 않음(제외 패턴 입력은 됨 — 일관성) |
| U5 | 팝업에 Esc 닫기·포커스 트랩 없음, 키보드로는 백드롭 뒤 트리거에 도달 |
| U6 | 날짜 입력이 타이핑 중간값에서도 즉시 재조회(디바운스 여부 스토어 확인 필요) |
| U7 | Export 완료 경로 클릭 복사에 피드백 없음, `done` 메시지가 선택 변경 후에도 남는지 미확인 |
| U8 | 행 클릭이 `<span onClick>`이라 키보드 토글 불가, `useEffect(…,[bulkAction])`이 매 렌더 재실행 |

### 4.3 구조 문제 (🟡)

| ID | 내용 |
|---|---|
| S1 | `appStore.ts` 991줄에 커밋 조회·분석 체이닝·Export 파일 계산·업데이트 확인이 모두 있음 |
| S2 | `listCommits` 파라미터 조립이 `loadCommitsFirstPage`와 `loadNextPage`에 복붙(필터 8개) |
| S3 | 디바운스 타이머가 모듈 전역 하나(`searchDebounceTimer`)를 검색어·작성자·해시가 공유 |
| S4 | `FileListColumn`(props 20여 개, 좌측 전용 기능이 optional prop 스위치) · `DeployFilesPanel`(스토어 selector 27개, 플레이스홀더 4벌 복붙) |
| S5 | 세 상태 체크박스(`indeterminate` ref+effect) 중복, `matchesFileName`이 컴포넌트 파일 안에 있고 `main/git/commits.ts`에 같은 이름의 다른 함수 |
| S6 | IPC 채널명 문자열 리터럴이 `handlers.ts`·`preload/index.ts`·`index.d.ts` 세 곳 |
| S7 | `handlers.ts`의 `showOpenDialog`/`showMessageBox` 블록 복붙, 주석이 엉뚱한 핸들러 위에 붙음, `dependencyAnalysis.ts` 332줄 단일 파일 |
| S8 | `main.css` 769줄 단일 파일, 컴포넌트와 1:1 대응 없음 |

### 4.4 정리 항목 (🟢)

- L1 `main/git/types.ts`·`main/mapping/types.ts`는 `shared/types` 재export 껍데기 · L2 `shared/`와 `renderer/lib` 순수 함수 위치 기준 없음 · L3 `scripts/verify-phase*.ts`(약 760줄)가 회귀 테스트로 승격 안 됨 · L4 루트의 `*.html` 3개(약 1,300줄)를 `docs/`로 · L5 untracked `resources/icon 복사본.png`, `.DETAILED_DESIGN.md.swp`(vim 스왑) · L6 렌더러가 `window.api`를 스토어에서 직접 호출(목킹 불가)

### 4.5 기준선

소스 약 4,500줄 · 자동화 테스트 없음(vitest/jest/playwright 미설치) · CI는 `release.yml`뿐(태그 push/수동 실행 시만, **push/PR에는 typecheck·lint 없음**) · typecheck·lint 통과.

---

## 5. 작업 목록

**구현 기준은 이 작업 목록(특히 §5.1 상세 명세)이다. 목업(`component-playground.html`)은 방향 확인용이라 세부 인터랙션은 생략·단순화돼 있으며(§1.1), 목업과 다르게 적힌 명세가 있으면 명세가 우선한다.**

표기: `[ ]` 미착수. 각 단계는 **앞 단계가 끝나야 시작**한다. 동작을 바꾸는 변경(P1)과 구조만 바꾸는 변경(P2~P4)은 **커밋을 섞지 않는다.** `wrangler.toml`은 명시 요청이 없으면 커밋하지 않는다.

### P0 — 안전망

- [x] **RT-00** ~~문서 변경 5개 파일 먼저 커밋~~ → **변경**: 5개 파일의 미커밋 수정(REQ-026 등)을 `git checkout`으로 되돌림(v0.6.0 기준선 유지). 대체 설계는 이 문서(U-계열)에만 기록 · `.DETAILED_DESIGN.md.swp`는 커밋 제외
- [x] **RT-00b** 본 문서·목업(`docs/refactoring/`)과 기존 5개 문서 안내 문구를 먼저 커밋 (P0 시작 전, 동작 변경 없음) — 커밋 `7b0a4cb`·`d52a578`(체크박스 갱신 누락, 2026-09-22 정정)
- [x] **RT-01** vitest 도입, 순수 함수부터 테스트: 글롭 변환·`interpret`(종류 파생)·`matchPattern`·`hiddenByPatterns`·`parseMultiValueFilter`·`selectionMatches`. **§3.1의 19개 케이스를 이식** — `src/renderer/src/lib/filePattern.ts`(신규, component-playground.html의 globToRe/interpret/matchPattern/hiddenByPatterns를 이식, 아직 어디서도 import 안 함 — 배선은 RT-46)·`appStore.ts`의 `parseMultiValueFilter`/`selectionMatches`는 export만 추가(타입은 `SelectionSnapshot`으로 최소화, 동작 불변). 테스트 36개 전부 통과(`npm test`)
- [x] **RT-02 (부분)** Playwright(`_electron`) 도입, 시나리오 ①·③ 완료: ① 커밋 선택→Preview→Export(내보낸 파일까지 검증) ③ 파일 수동 추가 팝업(검색→추가→칩→포함된 파일 반영). **②(파일 패턴 추가/토글/삭제)는 보류** — 지금 UI는 RT-46에서 §3.1 규칙으로 교체될 예정인 REQ-019 구버전(`excludePatternMatch.ts`, `*` 단일 세그먼트 한정)이라 RT-46 완료 후 새 UI 기준으로 작성하기로 사용자와 합의(2026-09-22). `e2e/`(fixture·launchApp 헬퍼 포함) 신규, `playwright.config.ts` 신규, `npm run test:e2e`. `main/ipc/handlers.ts`의 `repository:browse`에 `GDE_E2E_REPO_PATH` 환경변수 우회 추가(설정 안 하면 기존 동작 그대로 — OS 네이티브 다이얼로그를 Playwright가 조작할 수 없어서 필요)
- [x] **RT-03** CI에 `typecheck`·`lint`·`test`를 push/PR 트리거로 추가(`release.yml`과 분리된 워크플로우) — `.github/workflows/ci.yml` 신규(main push + PR 트리거). `test:e2e`(RT-02)는 리눅스 러너에 xvfb가 필요해 범위 밖으로 남김(후속 과제)
- [x] **RT-04** `scripts/verify-phase*.ts`를 테스트로 승격하거나 명확히 폐기 결정 — **승격**(사용자 결정, 2026-09-22: 날짜범위 경계값·merge/rename·CRLF·바이너리 바이트 보존·대소문자 충돌 등 RT-01/02가 안 덮는 핵심 엔진 커버리지라 CI에 자동으로 걸리게 하는 게 목적). `scripts/verify-phase1~3.ts`(762줄, custom assert) 삭제 → vitest `describe/it`으로 재작성: `src/main/git/repository.test.ts`·`commits.test.ts`, `src/main/analysis/analyzeCommits.test.ts`, `src/main/mapping/resolveServerPath.test.ts`·`profileStore.test.ts`, `src/main/package/buildPackage.test.ts`(바이트 동일성·재실행 잔여파일 제거·대소문자 충돌·전체 파이프라인). 세 스크립트가 중복하던 git 픽스처 보일러플레이트는 `src/main/testSupport/gitFixture.ts`로 공용화. `package.json`의 `verify:phase1~3` 스크립트와 더 이상 안 쓰는 `tsx` devDependency 제거. 테스트 63개(RT-01의 36개 + 신규 27개) 전부 통과, `ci.yml`이 그대로 돌린다(설정 변경 불필요)

### P1 — 긴급 버그 (각각 별도 커밋, 동작 변경)

- [x] **RT-10 (R1)** 해시 입력 검증 — **M-5 확정(사용자 결정, 2026-09-22): 16진수만 허용 + 무효 입력은 화면에 표시**. `main/git/commits.ts`에 `partitionHashFilter`(4~64자 16진수만 valid) 신규, `listCommitsByHash`는 valid만 git 인자로 넘기고 invalid는 `ListCommitsResult.invalidHashes`로 보고. **`--` 구분자는 도입하지 않음** — 해시는 revision 인자라 `--` 뒤에 두면 git이 pathspec으로 재해석해 아무 것도 안 걸림(직접 재현 후 되돌림); 16진수 전용 검증 자체가 `-`로 시작하는 입력을 이미 차단해 별도 구분자가 불필요. `BranchSearchBar`가 해시 필터 아래에 무시된 토큰을 표시(`invalidHashFilter` 스토어 필드). 테스트: `--output=<path>`를 해시로 넣어도 파일이 안 생기는 것 확인(재현 방지) + `partitionHashFilter` 단위 테스트 + 유효/무효 혼합 케이스
- [x] **RT-11 (R2)** 커밋 조회 요청 ID 가드 — `renderer/src/lib/requestGuard.ts` 신규(`createRequestGuard`: start/current/isCurrent, RT-17과 공유 예정인 공용 유틸). `loadCommitsFirstPage`는 매번 `start()`로 새 세대 발급 후 응답 시점에 `isCurrent`로 검증(늦게 도착한 이전 조회 결과가 최신을 덮어쓰지 못함), `loadNextPage`는 시작 시점 `current()`를 캡처해 두고 첫 페이지 재조회가 그사이 시작되면(세대 불일치) 응답을 버림(재조회 후 초기화된 목록이 되살아나는 문제 해소) — `commits`는 응답 처리 시점에 `get().commits`를 다시 읽어 이어붙임. `store/commitQueryGuard.test.ts`(window.api 목킹으로 레이스 재현) + `lib/requestGuard.test.ts` 신규
- [x] **RT-12 (R3)** IPC 입력 검증 계층 — `main/ipc/validate.ts` 신규(`IpcValidationError` + 검증 함수 3개), `handlers.ts`에서 트러스트 경계(IPC 진입점)에서 호출: ① `assertNonEmptyAbsolutePath` — `package:export`의 `exportParentDir`이 빈 문자열/상대 경로면 거부(빈 문자열은 `getDeployDir`이 `join('', 'git-deploy-extracted')`로 상대 경로를 만들어 Electron 메인 프로세스 CWD 기준으로 `fs.rm(recursive)`가 실행되는 사고를 막음) ② `assertServerPathsWithinDir` — `files[].serverPath`(Mapping Profile override 결과)가 `join(deployDir, serverPath)`로 deployDir을 벗어나면(`..` 세그먼트) 파일을 하나도 쓰기 전에 거부(zip-slip 패턴). `path.join`은 선행 `/`는 이미 안전하게 접어 넣는다는 것도 회귀 테스트로 고정 ③ `assertManualFileInHeadTree` — `analysis:resolveManualFile`의 `localPath`가 실제 HEAD 트리(`listTrackedFiles`)에 있는지 확인 후 진행. `validate.test.ts`로 단위 테스트(핸들러 자체는 Electron API 의존이라 직접 단위 테스트 어려움 — e2e 2개로 정상 흐름 회귀 확인)
- [x] **RT-13 (U3)** `MaxCountField`: 로컬 문자열, blur/Enter에서 확정, 유효 범위 검증 — `components/MaxCountField.tsx` 신규(값 변경마다 재조회하던 걸 blur/Enter에서만 커밋으로 변경, 비우거나 1 미만이면 이전 값 복원), `lib/maxCount.ts`의 순수 함수 `parseMaxCountInput`으로 파싱/검증 분리(단위 테스트 9개). `BranchSearchBar`의 "최대" 입력을 이걸로 교체(레이아웃 재배치는 RT-49 몫, 이번엔 동작만 변경)
- [x] **RT-14 (U4)** 키워드 등 텍스트 영역에서 **Ctrl/Cmd+Enter로 즉시 조회**(텍스트 영역에서는 Enter가 줄바꿈이므로) + `Search` 버튼(왼쪽 그룹 Branch 옆). 입력 후 300ms 디바운스 자동 조회는 유지 — "키워드" 필드는 아직 없으므로(RT-48에서 도입) 현재 존재하는 두 textarea(작성자·해시 필터)에 적용. `handleImmediateSearchShortcut`가 Ctrl/Cmd+Enter를 감지해 `preventDefault`(줄바꿈 방지) 후 `triggerSearch()`(디바운스 타이머 취소하고 즉시 조회, 기존 함수 재사용) 호출. `Search` 버튼은 이미 Branch와 같은 행에 있어 위치 변경 불필요(재배치는 RT-49 몫). `e2e/keyboard-shortcuts.spec.ts` 신규 — 300ms보다 짧은 250ms 안에 필터링 결과가 반영되는지로 "디바운스를 기다린 게 아니라 즉시 조회됐다"를 검증 + 줄바꿈 미삽입 확인
- [x] **RT-15 (U5)** `Popup` primitive를 먼저 만들고(Esc, 포커스 트랩, 부모 높이 클램프) 기존 `ManualAddPopup`을 이걸로 교체 — U2도 함께 해소. `components/Popup.tsx` 신규(백드롭·박스·헤더·닫기 버튼, Esc·포커스 트랩·열릴 때 포커스 이동·닫히면 트리거로 포커스 복귀 — 트리거는 첫 렌더의 `useState` 지연 초기화로 캡처해야 안전함을 e2e 실패로 확인: effect 안에서 읽으면 포커스 이동 로직과 순서가 꼬일 수 있음). CSS `.manual-add-backdrop`/`.manual-add-popup`/`.manual-add-popup__header` → `.popup-backdrop`/`.popup`/`.popup__header`로 일반화, `max-height: 60vh`(뷰포트 기준, U2) → `max-height: 100%`(부모 실제 높이 기준)로 교체. `ManualAddPopup.tsx`는 이제 `Popup`의 children만 담당(도메인 클래스 `manual-add-popup__*`는 유지). 전체 표준 크기(720×480)는 RT-54(P4) 몫 — 이번엔 기존 480px 폭·중앙 배치 시각은 그대로 두고 동작만 고침. `e2e/popup-behavior.spec.ts` 신규(Esc 닫기 + 포커스 복귀), 기존 `manual-add.spec.ts`의 클래스명 갱신
- [x] **RT-16 (U6·U7·U8)** 날짜 디바운스, Export 복사 피드백·완료 메시지 초기화, 행 키보드 토글 — U6: `setDateRange`가 디바운스 없이 즉시 재조회하던 걸 다른 필터와 같은 300ms 디바운스로 통일(시그니처도 `void`로 맞춤). U7: `lib/useCopyToClipboard.ts` 신규(성공 1.5초 피드백 + `aria-live`, 실패는 계속 표시 — RT-53이 재사용 예정) + `toggleCommit`/`toggleAllCommits`에서 `idleExportState`로 Export 완료 메시지 리셋(선택 변경 후에도 지난 Export 메시지가 남아있던 문제). 피드백 텍스트는 `.status-text--copyable`(ellipsis) 안에 이어붙이지 않고 별도 flex 아이템으로 둬서 긴 경로에 가려지지 않게 함. U8: `FileListColumn`의 행이 `<span onClick>`이라 키보드로 토글 불가 → `<label style="display:contents">`로 checkbox+텍스트를 감싸 grid 레이아웃은 그대로 유지하면서 네이티브 라벨 클릭/키보드(Space) 토글 확보. `useEffect([bulkAction])`이 매 렌더 재실행되던 것도 `[bulkAction.indeterminate]`로 좁힘. `e2e/export-feedback.spec.ts` 신규(복사 피드백·선택 변경 시 리셋·키보드 토글 3개) → e2e 7개·vitest 91개·lint·typecheck 전부 통과
- [x] **RT-17 (R4·R5)** 분석 요청 경쟁 상태 방지 — `analysisGuard`(RT-11 `createRequestGuard` 재사용)를 `runAnalysis()`에 적용, `isCurrent()`(요청 세대 + `selectionMatches` 둘 다)로 판정. **이전(stale) 응답 처리는 `analyzing`/`dependencyAnalyzing`을 건드리지 않음**(끄면 그사이 시작된 새 요청의 진행 표시를 지울 수 있어서) — 대신 선택이 바뀌는 지점(`toggleCommit`/`toggleAllCommits`/`setProfile`/`loadCommitsFirstPage`)이 `analysisGuard.start()`로 즉시 무효화하고 두 플래그를 그 자리에서 바로 끈다. `runAnalysis()` 최상단에 `analyzing || dependencyAnalyzing`이면 즉시 반환하는 이중 방어 추가(Preview 버튼 비활성화와 별개 방어선). Preview 버튼: `analyzing`/`dependencyAnalyzing` 중 비활성 + 툴팁. Export 버튼: 같은 조건으로 비활성 + 상태 문구(우선순위: 분석 중 > 의존성 확인 중 > `Preview를 먼저 실행하세요` — 분석 중엔 `isStale`도 함께 true라 우선순위를 안 두면 방금 누른 Preview를 무시하라는 것처럼 혼란스러움. RT-56 경로 사유는 아직 없어(P4) 그 다음 우선순위는 해당 없음). `lib/visibleMissingDependencies.ts` 신규(이미 Extract 목록에 있는 경로를 누락된 의존성 표시에서 제외 — 수동 추가한 파일이 오른쪽 패널에도 중복 표시되던 문제, RT-52의 배지·팝업 트리도 같은 함수를 쓸 예정) → `DeployFilesPanel`의 `missingItems`에 적용. 테스트: `store/analysisGuard.test.ts`(선택 왕복 후 재요청 시 늦은 응답 무시·무효화된 요청의 의존성 완료가 최신 dependencyAnalyzing을 안 끔·Reload 중 응답이 상태를 못 되살림) + `lib/visibleMissingDependencies.test.ts` → vitest 97개·e2e 7개·lint·typecheck 전부 통과. **수동 추가 파일의 의존성 미분석 한계**는 이미 기존 코드 주석(REQ-013 범위)으로 문서화돼 있어 추가 변경 불필요

### P2 — main / shared 정리 (동작 불변)

- [x] **RT-20 (S6)** `shared/ipc-channels.ts`에 채널명·타입 맵 단일 정의 → preload·handlers·d.ts가 참조 — `IpcChannelMap`(채널별 `params`/`result`) + `IPC_CHANNELS`(채널명 상수, 오타 시 컴파일 에러) 신규. `preload/index.ts`는 제네릭 `invoke()` 래퍼로, `main/ipc/handlers.ts`는 제네릭 `handle()` 래퍼(`ipcMain.handle`을 감쌈)로 각각 채널명·타입을 이 맵에서만 가져오도록 교체 — 두 파일 모두 `../shared/types`의 DTO를 더 이상 직접 import하지 않는다(맵을 거쳐 간접 참조). `preload/index.d.ts`의 `Api` 인터페이스도 `IpcChannelMap` 인덱싱으로 재작성. 동작 불변 확인: `npm test`(97개)·`npm run typecheck`·`npm run lint`·`npm run build`(main/preload/renderer 전부)·`npm run test:e2e`(7개, 실제 IPC 왕복 경유) 전부 통과
- [x] **RT-21 (S7)** `handlers.ts`를 채널 그룹별 파일로 분리, `dialogs.ts` 공용 헬퍼(폴더 선택·확인창), 어긋난 주석 정리 — `main/ipc/handlers.ts`(196줄 단일 파일) 삭제 → `main/ipc/handlers/{app,repository,git,mapping,analysis,package,update}.ts`(채널명 접두사 그대로 그룹 기준)로 분리, `index.ts`가 7개 `register*Handlers()`를 호출(호출부 `main/index.ts`의 `import ... from './ipc/handlers'`는 무변경 — 디렉터리로 바뀐 걸 몰라도 됨). `profilesDir.ts` 신규(`getProfilesDir`, mapping·analysis 핸들러와 `main/index.ts` 공유). RT-20의 `handle()` 래퍼는 `main/ipc/ipcHandle.ts`로 이동(그룹 파일들이 공유). `main/ipc/dialogs.ts` 신규: `showOpenDirectoryDialog()`(`repository:browse`·`package:browseExportDir`이 복붙하던 다이얼로그 호출 통합), `showConfirmDialog()`(`package:export`·`update:confirmAndOpen`이 복붙하던 확인창 호출 통합 — 두 버튼 중 뒤쪽을 선택했을 때만 true, `defaultButton`으로 하이라이트 버튼만 다르게). **어긋난 주석 수정**: "RepositoryPanel 라벨 표시용..." 설명이 실제로는 `getRemoteProjectName` 것인데 `listTrackedFiles` 위에 붙어 있던 것을 `git.ts`에서 제자리로 옮김(S7이 지목한 버그). 동작 불변 확인: `npm test`(97개)·`typecheck`·`lint`·`build`·`test:e2e`(7개) 전부 통과
- [x] **RT-22 (S7)** `dependencyAnalysis.ts` 분할: `projectIndex` · `resolve` · `implementations` · `index` — `main/analysis/dependencyAnalysis.ts`(332줄 단일 파일) 삭제 → `main/analysis/dependencyAnalysis/` 디렉터리로 교체(호출부 `handlers/analysis.ts`의 `from '../../analysis/dependencyAnalysis'`는 무변경). `projectIndex.ts`(§6.2·§6.3 — `detectBasePackage`·`buildProjectIndex`·`pathToFqn`·`JAVA_SUFFIX`), `resolve.ts`(§6.4 — `resolveToPath`), `implementations.ts`(§6.5 — `findImplementors`·`STEREOTYPE_ANNOTATIONS` + 원래 `analyzeDependencies` 안에 인라인이던 최종 구현체 확정 로직을 `isConfirmedImplementor`로 함수화), `index.ts`(BFS 오케스트레이션 + 공개 `analyzeDependencies`). **테스트 안전망 신설**: 이 알고리즘은 분할 전까지 자동 테스트가 전혀 없었다(v0.3.0 릴리스 때 Playwright 수동 확인이 유일한 기록) — `index.test.ts`(신규, `testSupport/gitFixture.ts` 재사용) 5개로 최소 Spring Boot 모양 fixture(인터페이스+확정 구현체+stereotype 없는 가짜 구현체+도달 불가 무관 파일+`applicable:false` 2가지)를 검증해 분할 전후 동작이 같음을 직접 증명. 동작 불변 확인: `npm test`(102개, 신규 5개 포함)·`typecheck`·`lint`·`build`·`test:e2e`(7개) 전부 통과
- [x] **RT-23 (L1·L2)** 껍데기 `types.ts` 제거, `shared/`와 `renderer/lib` 배치 기준 문서화 — **L1**: `main/mapping/types.ts`(전체가 `shared/types`의 `MappingOverride`/`MappingProfile` 재export뿐이던 껍데기) 삭제, 그걸 쓰던 4곳(`mapping/resolveServerPath.ts`·`profileStore.ts`·`resolveServerPath.test.ts`·`package/buildPackage.test.ts`)이 `shared/types`를 직접 import하도록 교체. `main/git/types.ts`는 진짜 main 전용 타입(`GitCommandResult`)만 남기고 `CommitEntry` 재export 줄 제거(쓰던 곳 `git/commits.ts`가 이미 같은 파일에서 하던 `shared/types` import에 합침) — `git/exec.ts`가 쓰는 `GitCommandResult`는 그대로 `./types`에서 가져온다(재export가 아니라 진짜 정의라 껍데기 문제 없음). **L2 배치 기준(확정, 이후 새 유틸 추가 시 적용)**: (1) IPC로 오가는 데이터 모양(DTO)이나 채널 정의 → `shared/types.ts`·`shared/ipc-channels.ts`. (2) Main과 Renderer 양쪽이 실제로 import하는 순수 함수 → `shared/`(예: `dateRange.ts`·`branch.ts`, 이미 이 기준대로 배치돼 있음을 grep으로 확인). (3) 그 외(Renderer 전용 UI 파생 로직 — 필터링·파싱·요청 가드 등, Electron/Node API import 금지) → `renderer/src/lib/`. 현재 배치는 이미 이 기준을 전부 만족해 파일 이동은 없었음(문서화만 신규). 동작 불변 확인: `npm test`(102개)·`typecheck`·`lint`·`build`·`test:e2e`(7개) 전부 통과
- [x] **RT-24** `git/exec.ts`: 사용자 입력이 인자로 가는 모든 호출에서 옵션 인젝션 방지 규약(`--` 사용) 통일 — `git/*.ts` 전체를 감사한 결과 인자는 두 종류로 나뉜다: **pathspec**(파일 경로, 이미 전부 `--` 뒤에 있었음 — lsTree.ts/grep.ts/commits.ts pathspecArgs)과 **revision**(브랜치명·커밋 해시, `--` 뒤에 두면 git이 pathspec으로 재해석해 아무 것도 안 걸림 — RT-10 해시 필터 주석에 이미 재현 확인돼 있음). revision 쪽은 `--`를 못 쓰므로 `git/exec.ts`에 `assertSafeRevisionArg(value, label)`(`-`로 시작하면 `GitArgumentError`) 신설 후 다음 5개 함수의 `branch`/`commitHash`에 적용: `commits.ts`(`listCommits`의 `branch` — **hashFilter처럼 형식 검증이 전혀 없던 새 구멍이었음**, `listCommitsByHash`의 `unique` 해시에도 방어선 중복 적용), `lsTree.ts`(`listTrackedFiles`), `grep.ts`(`grepTree`), `showFile.ts`(`getHeadFileContent`), `diff.ts`(`getCommitFileChanges`의 `commitHash`, `headFileExists`의 `branch` — **`commitHash`는 `analysis:preview` IPC의 `commitHashes`를 검증 없이 그대로 타고 들어오는 R1과 같은 유형의 실제 구멍이었음, 이번에 새로 발견**). 부수로 `grep.ts`의 패턴 인자에 `-e`를 명시(`git grep -F -e <pattern>`) — `-e` 없이 패턴이 `-`로 시작하면 옵션으로 오인되는 것을 실제 저장소로 재현 확인(§0.1) 후 `-e` 추가가 정상 케이스 출력을 전혀 안 바꾸는 것도 재현으로 확인. 진짜 브랜치명·커밋 해시는 git 자체 규칙상 `-`로 시작할 수 없어(`git check-ref-format`, 해시는 16진수) 정상 입력의 동작은 안 바뀜 — 크래프팅된 입력만 git 호출 전에 명시적으로 거부(이전엔 조용히 잘못된 옵션으로 해석되거나 에러). 테스트: `exec.test.ts`(신규, `assertSafeRevisionArg` 단위) + `commits.test.ts`에 branch 주입 방지 테스트 추가 + `diff.test.ts`(신규, 이 파일엔 테스트가 아예 없었음 — commitHash/branch 주입 방지 재현 3건 + 정상 경로 회귀). 동작 불변 확인: `npm test`(108개, 신규 6개 포함)·`typecheck`·`lint`·`build`·`test:e2e`(7개) 전부 통과

### P3 — 스토어 분해 (동작 불변)

- [x] **RT-30 (S6·L6)** `renderer/src/api/`: `window.api` 래퍼(테스트에서 교체 가능) — `renderer/src/api/index.ts` 신규: `export const api`는 안정된 Proxy 객체 하나로 고정하고, 내부적으로 `resolveApi()`(기본은 실제 `window.api`)에 위임 — `window.api`는 모듈 최상단이 아니라 실제 메서드 호출 시점에만 읽는다(appStore.test.ts처럼 `window`를 세팅하지 않고 순수 함수만 테스트하는 파일이 이 모듈을 import해도 안전해야 하기 때문). `setApiForTesting(mockApi)`/`resetApiForTesting()`을 테스트 전용으로 export. `appStore.ts`의 `window.api.*` 17곳을 전부 `api.*`로 교체(동작 변경 없음, `import { api } from '../api'` 한 줄 추가). `analysisGuard.test.ts`·`commitQueryGuard.test.ts`가 쓰던 `vi.stubGlobal('window', {...})`/`vi.unstubAllGlobals()`(전역 자체를 통째로 바꿔치기)를 `setApiForTesting({...} as unknown as Api)`/`resetApiForTesting()`(이 모듈만 교체)로 교체 — 두 파일 다 기존처럼 필요한 메서드만 채운 부분 객체를 넘긴다(동작 동일, 테스트 6개 전부 그대로 통과). 동작 불변 확인: `npm test`(108개)·`typecheck`·`lint`·`build`·`test:e2e`(7개, 실제 Electron `window.api` → Proxy 경로 통과) 전부 통과
- [x] **RT-31 (S1)** slice 분리: `repository` · `commitQuery` · `commits` · `analysis` · `deployFiles` · `export` · `update` — 991줄(현재 기준 1098줄)이던 단일 `appStore.ts`를 `store/slices/{repository,commitQuery,commits,analysis,deployFiles,export,update}Slice.ts` 7개로 분리, `appStore.ts`는 56줄짜리 조립 전용 루트로 축소(`AppState` = 7개 슬라이스 인터페이스 교집합, `create<AppState>()((...a) => ({ ...createXxxSlice(...a), ... }))`). 슬라이스끼리 다른 슬라이스의 액션을 부를 때는 파일을 직접 import하지 않고 zustand 공유 `get()`으로만 부른다(예: repositorySlice/commitQuerySlice가 `get().loadCommitsFirstPage()`를 호출 — 원래 appStore.ts 안 비공개 클로저였던 이 함수가 이제 `commitsSlice`의 공개 액션이 됨, AppState 표면상의 유일한 변경점이나 컴포넌트가 직접 호출한 적은 없어 관찰 가능한 동작은 그대로). 상태가 아니라 순수 값/유틸인 리셋 상수(`emptyDependencyState`→analysisSlice, `emptyManualAddState`→deployFilesSlice, `idleExportState`→exportSlice)와 요청 가드(`analysisGuard`→analysisSlice)는 정의한 슬라이스가 export하고 필요한 슬라이스가 import(commitsSlice가 셋 다 씀) — 이 값들만 슬라이스 파일 간 직접 import이고 전부 한 방향(commitsSlice → analysisSlice/deployFilesSlice/exportSlice, analysisSlice → deployFilesSlice)이라 순환 없음. `selectIsAnalysisStale`은 원래 root에 있었으나 `selectionMatches`와 나란히 analysisSlice로 옮기고 root는 재export만 함 — exportSlice의 `runExport`가 이 함수를 쓰는데, root에 그대로 뒀으면 root↔exportSlice 순환 import가 생겼을 것(`AppState` 타입 참조는 전부 `import type`이라 타입 전용 순환은 무해하지만, 값 순환은 피함). `useAppStore`/`selectIsAnalysisStale`/`DeployFilesFilter`/`parseMultiValueFilter`/`selectionMatches`/`AnalyzedSelection`/`SelectionSnapshot` 등 기존 공개 API는 전부 `./appStore`에서 그대로 재export해 컴포넌트·테스트 import 경로 무변경. 동작 불변 확인: `npm test`(108개)·`typecheck`·`lint`·`build`(67 모듈)·`test:e2e`(7개, 실제 앱에서 Preview→의존성 체이닝→Export까지 크로스 슬라이스 경로 전부 통과) 전부 통과
- [x] **RT-32 (S2·S3)** `services/commitQueryParams.ts`로 파라미터 조립 단일화, `useDebouncedAction` 훅으로 타이머 분리 — **S2**: `commitsSlice.ts`의 `loadCommitsFirstPage`/`loadNextPage`가 복붙하던 `listCommits` 파라미터 조립(필터 8개, `skip`만 다름)을 `services/commitQueryParams.ts`의 `buildListCommitsParams(repoPath, branch, filters, skip, pageSize)`로 단일화, `parseMultiValueFilter`도 이 파일로 함께 이동(파라미터 조립과 나란히). **S3**: `commitQuerySlice.ts`가 모듈 전역 타이머 하나(`searchDebounceTimer`)로 `setSearchTerm`/`setAuthorFilter`/`setHashFilterText`/`setDateRange` 네 필드를 디바운스하던 걸(한 필드 편집이 다른 필드의 대기 중이던 디바운스까지 우연히 취소하는 결합) `renderer/src/lib/useDebouncedAction.ts` 훅으로 옮겼다 — 디바운스는 "언제 조회를 트리거할지"를 정하는 UI 타이밍 문제라 컴포넌트 책임으로 재배치. `BranchSearchBar.tsx`가 네 필드마다 독립된 훅 인스턴스를 하나씩 가져(`useDebouncedAction(triggerSearch, 300)` × 4) 각자 자기 타이머를 갖는다. 스토어의 네 setter는 이제 상태만 즉시 반영하는 순수 setter(타입 시그니처 무변경, 원래도 `void` 반환)이고, 실제 조회는 컴포넌트가 훅의 `run()`으로 일으킨다. **즉시 조회 지점(Search 버튼·Ctrl/Cmd+Enter·searchMode/excludeMerges/maxCount 변경)은 4개 훅 전부의 `cancel()`을 호출**해 예전에 공유 타이머 하나를 `clearTimeout`하던 것과 같은 "대기 중인 디바운스 정리" 효과를 그대로 낸다. 훅 구현 중 `react-hooks/refs` 린트 규칙(렌더 중 ref 쓰기 금지)에 걸려 `actionRef.current = action` 대입을 `useEffect`로 옮겨 수정. 테스트: `services/commitQueryParams.test.ts` 신규(3건 — undefined 변환 규칙, 파싱, `loadCommitsFirstPage`/`loadNextPage`가 `skip` 말고는 완전히 동일한 파라미터를 만든다는 것 직접 검증). 동작 불변 확인: `npm test`(111개, 신규 3개 포함)·`typecheck`·`lint`·`build`·`test:e2e`(7개, `keyboard-shortcuts.spec.ts`가 Ctrl+Enter 즉시 조회 경로를 실제로 재현) 전부 통과
- [x] **RT-33 (S1, P3 몫만 — RT-51에서 이어감)** `services/exportPlan.ts`: Export 대상 파일 계산(Extract 목록 + 패턴 적용, RT-51 이후 기준)을 순수 함수로 — `exportSlice.ts`의 `runExport` 안에 인라인이던 REQ-019/DR-018 판정(`included=true` 중 활성 제외 패턴에 안 걸리는 것만)을 `buildExportFiles(deployFiles, excludePatterns)`로 추출. `ExportableDeployFile`(`DeployPlanFile` + `included`) 타입도 함께 정의. **이번 P3 단계에서는 현재(`included` 불리언 기준) 판정 로직만 순수 함수로 뽑아뒀다** — RT-51(P4)에서 Extract 목록 모델로 바뀌면 이 함수 내부만 "Extract 목록 − 활성 패턴 해당 항목"으로 바뀔 예정이고, `exportSlice`의 호출부 계약(`deployFiles + excludePatterns → files 배열`)은 유지되게 설계해뒀다(§5.1 RT-51 명세 참고). 테스트: `services/exportPlan.test.ts` 신규 4건(included=false 제외, 활성 패턴 매치 제외, 비활성 패턴 무시, 결과 필드 정리). 동작 불변 확인: `npm test`(115개, 신규 4개 포함)·`typecheck`·`lint`·`build`·`test:e2e`(7개, `preview-export.spec.ts`가 실제 Export 흐름으로 재현) 전부 통과
- [x] **RT-34** 파생 훅: `useIncludedFilesView`, `useMissingDependenciesView`, `useAnalysisPhase`(empty/stale/loading/ready/error 한 곳에서 파생) — `DeployFilesPanel.tsx`에 있던 좌/우 파생 계산(상태 Filter→제외 패턴→파일명 검색, 전체 선택 판정, 카운터)을 `lib/useIncludedFilesView.ts`·`lib/useMissingDependenciesView.ts`로 뺐다(두 훅이 `includedSet`을 공유 — RT-17 R4·R5 중복 제거). 둘 다 쓰던 `matchesFileName`(파일명 글롭 매칭, `*` 지원)도 로컬 함수에서 `lib/matchesFileName.ts`로 분리(첫 단위 테스트 4건 추가). `lib/useAnalysisPhase.ts` 신규 — `DeploymentPreviewPanel.tsx`가 갖고 있던 "empty/stale/loading/ready/error" 우선순위 판정(§1 목업 "분석 단계" 5상태)을 한 곳으로 모으고 `DeploymentPreviewPanel`을 이 훅 기반으로 재작성(256→199줄, `DeployFilesPanel` 기준). **`FooterActionBar`/`CommitListPanel`은 의도적으로 이 훅으로 옮기지 않았다** — 옮기면 그 두 컴포넌트가 지금 구독 안 하는 `summary`/`analysisError`까지 구독하게 돼 불필요한 재렌더링이 생기므로, 필요한 원시 필드(`analyzing`/`dependencyAnalyzing`/`isStale`)만 개별 selector로 읽는 기존 방식을 유지했다(동작·구독 범위 완전 무변경). `useMemo` 기반 훅이라 React 렌더 컨텍스트가 필요해 vitest로 직접 단위 테스트할 수 없다(jsdom 미도입, RT-01 방침 유지) — 동작 검증은 `test:e2e`로 대신함. 이걸로 **P3(RT-30~34) 완료**. 동작 불변 확인: `npm test`(119개, `matchesFileName` 신규 4개 포함)·`typecheck`·`lint`·`build`·`test:e2e`(7개) 전부 통과

### P4 — 컴포넌트 재정의 + UI 변경 (§2, §3 반영)

- [x] **RT-40** primitives: `Panel`, `PanelState`, `Chip`, `TriStateCheckbox`, `CollapsibleSection` (+ RT-15의 `Popup`) — 아직 어느 화면에도 배선 안 된 신규 컴포넌트(RT-41~47이 순차 적용, RT-01의 `filePattern.ts`와 같은 "선 구현·후 배선" 패턴)만 우선 완료. `components/Panel.tsx`(`Panel`/`PanelHeader`/`PanelBody`, 새 클래스 `panel-frame`* — 기존 `.panel`은 아직 여러 화면이 단일 div로 쓰고 있어 시맨틱을 안 건드림, RT-41 이후 합침). `components/PanelState.tsx`(5상태) + `lib/panelStateMessage.ts`(순수 메시지 함수, 컴포넌트 파일에 뒀다가 `react-refresh/only-export-components` 린트 에러로 분리 — 컴포넌트 파일은 컴포넌트만 export해야 Fast Refresh가 유지됨). `components/Chip.tsx`(라벨/× 버튼 분리, exclude·include·manual 3변형 — 기존 `status-text--error`/`button--primary`/`status-text--success` 색 재사용, 새 색 안 만듦). `components/TriStateCheckbox.tsx`(S5 — CommitListPanel·FileListColumn이 각자 들고 있던 `checked+indeterminate` ref/effect 중복을 한 곳으로). `components/CollapsibleSection.tsx`(헤더 행은 본문 박스 밖, 본문은 `hidden` 속성으로만 숨김 — unmount 안 함, `section:hide`/`section:show`를 `window` CustomEvent로 발행 — RT-47이 리스너를 붙일 예정). **`TriStateCheckbox`는 즉시 실사용 배선**: `CommitListPanel.tsx`의 "전체 선택" 헤더 체크박스가 중복 ref/effect 대신 이 컴포넌트를 쓰도록 교체(S5 중복 2곳 중 1곳 해소, FileListColumn 쪽은 RT-41이 그 파일 자체를 해체하면서 처리). 관련 §7 미결 사항(M-7·M-8·M-9)은 이미 확정됨, M-38(헤더 통일 후속)의 미결 항목은 RT-40이 아니라 RT-47(실제 적용) 몫이라 이번엔 §5.1 RT-40 명세 원문(`▴ 접기`/`▾ 펼치기` 텍스트 버튼)을 그대로 구현 — 블로킹 없음. 테스트: `components/PanelState.test.ts`(`lib/panelStateMessage.test.ts`로 이동) 3건. 검증: `npm test`(122개)·`typecheck`·`lint`·`build`·`test:e2e`(7개, `TriStateCheckbox`가 실제 렌더링되는 CommitListPanel 경유) 전부 통과. **P4는 P2/P3와 달리 "동작 불변" 검증만으로 완결되지 않는다** — 나머지 4개 primitive는 아직 렌더링되는 곳이 없어 수용 기준(부모 높이 140px 클램프 등) 검증은 RT-41+에서 실제 배선될 때 이어감
- [x] **RT-41 (S4·U1)** `FileListColumn` 해체 → `FilePane`(슬롯) + `FileList` + `FileRow` + 훅 `useMeasuredColumnWidth`(**가상 스크롤의 가로 스크롤 폭용으로만 유지**) · **컬럼 리사이즈 핸들·`Local Path` 헤더 글자·`useColumnResize`·컬럼 폭 `localStorage` 저장은 삭제**(컬럼이 하나뿐이고 행에 파일명만 보임, 2026-09-21) · 좌우 패널은 stale에서도 언마운트하지 않고 `PanelState`만 본문에 삽입 — **범위 확정(RT-42와의 경계)**: §5.1이 RT-41/42를 한 절에 같이 적어뒀지만(`IncludedFilesPane`/`ExtractTargetsPane`/`DeployFilesWorkspace`는 RT-42 몫), RT-41 자체 체크리스트 한 줄은 그 이름들을 언급하지 않아 이번엔 `FileListColumn` 해체(컴포넌트 분리 + 리사이즈 삭제 + PanelState 적용)만 하고 좌/우 패널 이름·"Extract" 모델 전환은 RT-42로 남겨뒀다(RT-51이 실제 상태 모델을 바꾸기 전까지 데이터는 지금 그대로). 신규: `components/FileRow.tsx`(옛 Row/VirtualRow, `FileListItem` 타입 소유) · `components/deployFiles/FileList.tsx`(불릿 헤더 행 + 가상/일반 렌더링 + 빈 메시지 — 헤더 행은 이제 `TriStateCheckbox` 하나뿐, 툴팁 "화면에 보이는 변경 파일을 모두 Extract 대상으로 이동", REQ-020) · `components/FilePane.tsx`(RT-40의 `Panel`/`PanelHeader`/`PanelBody`로 지음, "좌측 전용 prop 없음" — toolbar 조립은 지금은 DeployFilesPanel이 직접 맡는다) · `lib/useMeasuredColumnWidth.ts`(헤더 라벨이 없어져 아이템 텍스트만 측정하도록 단순화, 들여쓰기 반영은 RT-53 몫으로 주석에 남김). 삭제: `deployFiles/FileListColumn.tsx`, `lib/columnWidths.ts`(+ 그걸 "동일 패턴" 예시로 인용하던 4개 파일 주석을 `splitRatio.ts`로 정정). **DeployFilesPanel.tsx 시각적 변화(임시)**: "+ 파일 추가" 버튼과 Filter 드롭다운이 title 줄이 아니라 toolbar 줄로 이동(RT-45가 title 줄 우측 배치를 확정할 예정 — 그 전까지 과도기 배치). Playwright로 실제 렌더링 확인(스크린샷, 커밋 대상 아님) — 레이아웃 깨짐 없음, `PanelState kind="na"`가 "이 저장소에는 적용할 수 없습니다 (포함된 파일 중 Java 파일이 없습니다)"로 정확히 표시됨. 동작 검증: `npm test`(122개)·`typecheck`·`lint`·`build`·`test:e2e`(7개, `manual-add.spec.ts`·`preview-export.spec.ts`가 새 FilePane/FileList 구조를 실제로 경유) 전부 통과
- [x] **RT-42** `IncludedFilesPane` 조립, `DeployFilesWorkspace`에서 로직 제거(누락된 의존성은 RT-52의 팝업 HEAD 트리로 이동) — **범위를 사용자에게 먼저 확인**: §5.1은 우측을 최종 `ExtractTargetsPane`으로 바꾸고 "누락된 의존성"을 RT-52의 `AddFilesPopup`으로 옮기라고 하지만, RT-51(Extract 상태 모델)·RT-52(그 팝업) 둘 다 아직 없어서 그대로 하면 대체 기능 없이 회귀가 된다 — AskUserQuestion으로 "구조 정리만(우측은 지금 이름·내용 그대로 유지)" vs "RT-51/52까지 앞당겨서 같이" vs "RT-51 먼저" 중 **"구조 정리만"을 선택받아 진행**(2026-09-22). 신규: `deployFiles/IncludedFilesPane.tsx`(DeployFilesPanel.tsx에 인라인이던 좌측 조립 — Filter/검색/제외패턴/+파일추가 toolbar + FileList body — 를 그대로 옮김, CommitListPanel 등과 같은 방식으로 스토어를 직접 구독하는 독립 컴포넌트) · `deployFiles/MissingDependenciesPane.tsx`(우측, **이름·동작 전부 그대로** — RT-52 전까지 존치) · `deployFiles/DeployFilesWorkspace.tsx`(조립만 담당, 제목 없음 — `SplitPane`으로 두 Pane을 묶고 `onOpenManualAdd` 콜백만 통과시킴) · `deployFiles/FilePaneCountTitle.tsx`(두 Pane이 공유하던 "선택/전체/필터 전 전체" 제목 문구 컴포넌트화) · `lib/includedPathsSet.ts`(`useIncludedFilesView`의 `includedSet`이 filter/검색어/제외패턴과 무관한 걸 이용해 저렴하게 분리 — `IncludedFilesPane`·`MissingDependenciesPane`·`DeployFilesPanel`(수동 추가 후보) 셋 다 이 값이 필요한데 무거운 필터링 파이프라인 전체를 반복 호출할 필요가 없어짐). `DeployFilesPanel.tsx`는 이제 제목·경고 배너·`ManualAddPopup` 배치만 남은 얇은 껍데기(RT-44가 제목·배너를 마저 정리할 예정). **팝업 위치 검증**: `+ 파일 추가` 트리거는 `IncludedFilesPane`(좌측 셀) 안에 있지만 팝업 자체는 여전히 `DeployFilesPanel`이 렌더링 — `Panel`/`FilePane`/`SplitPane` 전부 `position` 속성이 없어 `.popup-backdrop`의 `position:absolute`가 DOM 중첩 깊이와 무관하게 여전히 `.deploy-files-panel`(가장 가까운 `position:relative` 조상)을 기준으로 좌우 두 Pane 전체 중앙에 뜬다는 걸 Playwright 스크린샷으로 직접 확인(임시 파일, 커밋 안 함). 동작 검증: `npm test`(122개)·`typecheck`·`lint`·`build`·`test:e2e`(7개, `manual-add.spec.ts`가 IncludedFilesPane↔DeployFilesPanel 간 트리거/팝업 분리 구조를 실제로 경유) 전부 통과
- [x] **RT-43** `openPopup`을 `WorkArea`로 이동, `PopupHost` 도입(`'manual'|'patterns'|'deleted'|'warnings'`) — **착수 전 범위 확인(2026-09-22, AskUserQuestion)**: §5.1 명세가 `PreviewSummary`(RT-44)·`FilterPatternBar`의 "보기" 버튼(RT-46) 등 아직 없는 RT를 전제해, "RT-44/46을 앞당겨 함께 진행"을 선택받아 세 RT를 한 번에 구현했다. `components/WorkArea.tsx`(신규) — `openPopup`을 `useState`로 소유(로컬, store에 두지 않음)하고 `lib/workAreaPopupContext.ts`(신규, `WorkAreaPopupContext`/`useWorkAreaPopup`)로 하위 트리에 내려준다(App.tsx가 프롭 스레딩 대신 컨텍스트를 쓴 이유: `PreviewSummary`와 `DeployFilesPanel`이 SplitPane의 서로 다른 셀에 있는 형제라 얕은 프롭 전달이 안 됨). `components/PopupHost.tsx`(신규) — `openPopup` 값에 따라 팝업 컴포넌트 하나만 렌더링(각 팝업 컴포넌트 자신이 스토어를 구독하는 D4+ 컨테이너, PopupHost 자신은 store에 접근하지 않음). CSS 앵커(`position:relative`)를 `.deploy-files-panel`에서 `.work-area`로 이동. **닫힘 조건**: Esc는 기존 `Popup` primitive가 그대로 처리, Preview 재실행은 `analyzing`이 켜지는 시점에, Reload(및 Browse...를 통한 저장소 전환)는 `repository.status`가 `'validating'`이 되는 시점에 닫는다 — `useEffect` 안 `setState`가 `react-hooks/set-state-in-effect` 린트에 걸려 React 공식 "렌더 중 이전 값과 비교해 조정" 패턴으로 구현했다(추가 렌더 방지). RT-47(접힘)이 아직 없어 "접힌 섹션의 팝업 처리"(M-7)는 이번 범위 밖.
- [x] **RT-44 (U-1·U-2)** Delete List 영역 삭제 → `Deleted` 팝업, `DeployFilesHeader` 삭제 → 경고 이전 — **범위 조정(2026-09-22, AskUserQuestion)**: §5.1 명세가 요구하는 "읽기 전용 트리"(RT-53 TreeList, 미착수)와 파싱 실패 안내의 최종 대상지(`AddFilesPopup`, RT-52 미착수)가 아직 없어, ① Deleted/경고 팝업 본문은 **평탄한 목록으로 우선 구현**(RT-53 도입 시 교체 예정) ② `dependencyParseWarnings` 배너는 **지금의 `ManualAddPopup` 상단에 임시로 유지**(RT-52가 `AddFilesPopup`으로 교체할 때 함께 이전)를 선택받았다. `components/PreviewSummary.tsx`(신규, 기존 `DeploymentPreviewPanel.tsx` 대체) — `useAnalysisPhase`로 5단계 표시는 그대로 유지하고 ready 단계에 `Deleted: N ▸`(N=0이면 비활성)·`⚠ HEAD에 없음: N ▸`(N>0일 때만 표시) 버튼 추가. `components/deployFiles/DeletedFilesPopup.tsx`·`WarningsPopup.tsx`(신규) — 각각 `deleteList`/`warnings`를 평탄한 `<ul>`로 표시(M-12: 서버 경로). `DeleteListPanel.tsx` 삭제, `DeployFilesPanel.tsx`의 제목 줄과 `warnings.length` 배너 삭제(경고는 PreviewSummary로 이전). `ManualAddPopup.tsx`를 props 컴포넌트에서 store를 직접 구독하는 D4+ 컨테이너로 전환(RT-43로 PopupHost가 렌더링하게 되면서 DeployFilesPanel이 더 이상 후보/이력을 내려주지 않음) — 상단에 `dependencyParseWarnings` 배너 임시 추가.
- [x] **RT-45 (U-3·U-5)** StatusFilter·좌측 검색 삭제, added 녹색(색맹 대응 마커 결정 M-2 후), `+ 파일 추가` 제목 줄 우측 — M-1(좌측 검색 삭제의 위험, 결정 (b))·M-2(added 녹색+`+`마커 병행)·M-11(좁은 폭 줄바꿈, 카운터 쪽이 줄바꿈)이 전부 이미 결정돼 있어 추가 확인 없이 진행. **삭제**: `deployFilesFilter`/`setDeployFilesFilter`(`DeployFilesFilter` 타입 포함) · `deployFilesSearchTerm`/`setDeployFilesSearchTerm`(REQ-025) 전부 `deployFilesSlice.ts`·`appStore.ts`·`useIncludedFilesView.ts`·`IncludedFilesPane.tsx`에서 제거(우측 "누락된 의존성" 검색은 그대로 유지, 패턴이 적용 안 되므로 영향 없음). **M-1 안전장치 구현**: `lib/filePattern.ts`의 `FilePattern`에 `screenOnly?: boolean` 추가 — true면 화면 필터링(`useIncludedFilesView`)에는 적용되지만 Export 대상 계산(`exportPlan.buildExportFiles`)에서는 제외한다(두 호출부가 각자 `filter(p => !p.screenOnly)`로 걸러내고 넘긴다 — `hiddenByPatterns` 자체는 screenOnly를 모름). `deployFilesSlice.ts`에 `addFilePatterns`의 3번째 인자로 추가, 기존 패턴을 나중에 전환할 수 있는 `togglePatternScreenOnly` 액션 신설. `FilterPatternBar.tsx`에 "화면만" 체크박스(검색 대용), `FilterPatternsPopup.tsx`의 각 칩 옆에 "화면만" 토글 버튼 추가. **M-2**: `FileListItem`에 `status?: DeployFileStatus` 추가(좌측만 채움), `FileRow.tsx`가 added면 녹색(`#67c090`, Chip의 manual 변형과 동일 색 재사용) + `+` 마커(`aria-hidden`)를 함께 렌더링. **제목 줄 우측**: `IncludedFilesPane.tsx`의 `title` prop을 `FilePaneCountTitle` + `+ 파일 추가` 버튼(flex row, `justify-content:space-between`)으로 재구성, 카운터 텍스트가 `flex:1 1 auto`라 좁은 폭에서 버튼은 고정된 채 카운터 쪽 텍스트가 줄바꿈된다(M-11). REQ-020의 3숫자 표기("선택/전체/필터 전 전체")는 §5.1 RT-45 프로즈의 "남은 N개/전체 M개"(2숫자)와 다르지만, 수용 기준에 문구 자체는 없고 REQ-020은 이미 확정된 결정이라 표기는 바꾸지 않았다(버튼 위치만 이동). **e2e 상태 오염 교훈**: 파일 패턴은 저장소 구분 없이 `localStorage`에 전역 저장되는데, e2e의 Electron 인스턴스가 테스트 실행 사이에도 같은 userData를 공유해 한 테스트가 남긴 패턴이 다른 spec 파일로 새어 들어가는 걸 실제로 재현 확인(`work-area-popups.spec.ts`는 이미 매번 칩을 삭제해 깨끗했지만, 새 테스트가 정리 없이 남기자 무관한 기존 테스트 5개가 한꺼번에 실패) — `e2e/included-files-pane.spec.ts`의 패턴을 추가하는 테스트마다 시작·종료 시 `clearAllPatterns` 헬퍼로 정리하도록 고쳐 해결. 테스트: `e2e/included-files-pane.spec.ts`(신규) 4건(Filter·검색 UI 없음 + 버튼 위치, added/modified 색 구분, "화면만" 체크로 추가 시 화면만 숨김, 패턴 팝업에서 "화면만" 토글 시 선택 개수 변화) + `exportPlan.test.ts`에 screenOnly 1건 + `deployFilesSlice.patterns.test.ts`에 screenOnly 관련 2건. 검증: `npm test`(140개)·`typecheck`·`lint`·`build`·`test:e2e`(15개) 전부 통과.
- [x] **RT-46 (U-7)** `FilterPatternBar` + `FilterPatternsPopup`: 제외/포함, 종류 파생, 해석 미리보기, 칩 매치 수. 저장 포맷 마이그레이션(기존 → `mode: 'exclude'`) — RT-01이 미리 만들어 둔 `lib/filePattern.ts`(19개 케이스 테스트 포함, `interpret`/`matchPattern`/`hiddenByPatterns`)를 실제로 배선했다. `lib/filePattern.ts`에 `parsePatternList`(쉼표+줄바꿈 구분, trim, 빈 항목 무시, 입력 내 중복 제거) 추가. `lib/filePatterns.ts`(신규, `excludePatterns.ts`·`excludePatternMatch.ts` 대체·삭제) — 저장 키(`gde:excludePatterns`)는 유지하되 값 형태를 `{pattern, mode, enabled}`로 확장, `mode` 없는 기존 데이터는 로드 시 `'exclude'`로 마이그레이션. `deployFilesSlice.ts`: `excludePatterns`→`filePatterns` 필드 이름 변경, `addExcludePattern`(단일)→`addFilePatterns`(쉼표 다중 입력 + 모드, `{added, activated}` 반환해 피드백 문구 구성) 등 (pattern, mode) 쌍 기준으로 재작성. `useIncludedFilesView.ts`: 제외 전용 `matchesAnyActiveExcludePattern`→제외/포함 모두 다루는 `hiddenByPatterns`로 교체, `patternHiddenCount`(상태 Filter까지만 반영한 숨김 개수) 추가 반환. `components/deployFiles/FilterPatternBar.tsx`(신규) — 모드 선택+쉼표 다중 입력(붙여넣은 줄바꿈은 `onPaste`에서 커서 위치에 쉼표로 변환 삽입)+3초 피드백+해석 오버레이(포커스+입력 중에만, 여러 개면 항목별 한 줄)+"활성 K개" 배지(호버 툴팁)+`· N개 숨김`+"보기"(팝업 트리거). `components/deployFiles/FilterPatternsPopup.tsx`(신규) — 제외/포함 두 구역에 `Chip` 나열(라벨 클릭=토글, ×=삭제 확인창 없음, 등록 0개 되면 자동 닫힘). `IncludedFilesPane.tsx`의 인라인 제외 패턴 입력/칩 UI를 `FilterPatternBar`로 교체. `exportPlan.ts`/`exportSlice.ts`도 `FilePattern[]`/`hiddenByPatterns` 기준으로 갱신. 테스트: `filePattern.test.ts`에 `parsePatternList` 6건 추가, `store/deployFilesSlice.patterns.test.ts`(신규) 9건(다중 추가·중복·모드별 분리·토글·삭제). `e2e/work-area-popups.spec.ts`(신규, RT-43/44/46 공용) 4건 — Deleted 팝업 열기/닫기, HEAD에 없음 경고(DR-009), Reload 시 팝업 닫힘, 패턴 추가→숨김→패턴 팝업에서 토글/삭제. 검증: `npm test`(137개, 신규 15개 포함)·`typecheck`·`lint`·`build`·`test:e2e`(11개, 신규 4개 포함) 전부 통과.
- [x] **RT-47 (U-6)** `CollapsibleSection` 적용 3곳, `section:hide/show` 이벤트, `WorkArea` grid 행 재분배 — **착수 전 M-7·M-8·M-13 확정(2026-09-22, AskUserQuestion)**: 셋 다 §7에 권장안은 있었지만 "결정 대기"로 남아 있어 구현 전에 확정받았다. **M-7**: 미영속(새로고침하면 항상 펼침) + 열려 있는 팝업이 속한 섹션을 접으면 팝업을 닫는다. **M-8**: 접힌 커밋 섹션 헤더에도 Preview 버튼을 남기고, Deleted/경고 개수는 접힌 요약 문구에 포함한다. **M-13**: 목업 값(위 90px/아래 120px, 기존 앱 140px 대신) 채택. **배포 대상 파일 접힌 요약 문구 관련 추가 충돌 발견·해소**: §5.1 명세 원문("Extract N개 · 미선택 변경 파일 M개")은 아직 없는 RT-51(Extract 상태 모델)을 전제해(RT-41/42와 같은 유형의 순서 문제) AskUserQuestion → "지금 모델 기준으로 임시 작성"(현재 `included` 불리언 기준 "포함된 파일 N개(패턴 제외 K) · 누락된 의존성 M개")으로 확정, RT-51은 착수하지 않았다. (RT-51을 이 김에 앞당기는 방안도 검토했으나, RT-51 단독 적용은 "미선택|Extract 2분할" 명세와 RT-52 전까지 존치하기로 한 `MissingDependenciesPane`이 자리를 잃는 새로운 충돌을 낳아 — RT-42가 이미 겪은 것과 같은 유형 — 재확인 후 보류로 최종 결정.)
  - **`CollapsibleSection.tsx`**: `sectionKey`/`owner`(`'local'|'workArea'`, section:hide/show `detail`의 `key`/`owner`) · `headerActions`(접혔을 때만 렌더링, M-8) · `fill`(아래 CSS 버그 참고) prop 추가. `section:hide`/`section:show` CustomEvent의 `detail`을 명세대로 `{ key, name, owner }` 3필드 + `bubbles: true`로 확장(예전엔 `{ title }`뿐이었다).
  - **`SplitPane.tsx`**: `startCollapsed`/`endCollapsed` optional prop 추가(둘 다 기본 `false` — 다른 두 SplitPane 사용처는 안 넘겨 기존 동작 무변경). 어느 한쪽이라도 collapsed면 핸들 트랙 0px(드래그 비활성, 명세 "핸들은 접힌 동안 비활성"), 접힌 쪽 트랙 `auto`(헤더 높이만), 펼쳐진 쪽 `1fr`(남은 공간 전부). 둘 다 collapsed면 `auto auto`(두 헤더가 위에 붙음) — `.split-pane--vertical`에 `align-content: start` 추가해 그 남는 공간을 아래로 보낸다(명세 "둘 다 접힘 → 위에 붙임").
  - **`WorkArea.tsx`**: `children: ReactNode` 하나 대신 `commitWorkspace`/`deployFilesWorkspace` 두 슬롯을 받도록 변경(WorkArea 자신이 이제 세로 `SplitPane`과 그 둘을 감싸는 `CollapsibleSection`을 직접 조립해야 해서). `commitsCollapsed`/`deployCollapsed` state 신설(§5.1 "상태는 WorkArea 소유", M-7 미영속). 세로 SplitPane `defaultRatio` 0.5→**0.45**, `minStartPx`/`minEndPx` 140/140→**90/120**(M-13). `section:hide` `window` 리스너 신설 — `detail.owner === 'workArea'`인 섹션이 접히면 무조건 `setOpenPopup(null)`(M-7 — 정확히 어느 섹션에 어느 팝업이 속하는지 구분하지 않고, WorkArea 산하 두 섹션 중 하나라도 접히면 안전하게 닫는다).
  - **`App.tsx`**: 예전에 여기서 조립하던 세로 `SplitPane`(commitsVsFiles)을 `WorkArea`가 흡수해서, `main-grid` 가로 `SplitPane`(변경 없음)을 `commitWorkspace`로, `<DeployFilesPanel />`을 `deployFilesWorkspace`로 넘기기만 한다.
  - **`BranchSearchBar.tsx`**: 자기 로컬 `collapsed` state(M-7 owner: `'local'`)로 전체를 `CollapsibleSection`(`fill` 없음 — 아래 CSS 버그 참고)으로 감쌌다. 기존 `<section className="panel branch-search-bar">`(3개 row, 변경 없음)는 그대로 본문 안 유일한 안쪽 상자로 남는다(명세 "본문의 테두리는 안쪽 상자가 가진다" — RT-49가 검색 조건/필터 두 그룹 상자로 쪼갤 때까지 과도기). 접힌 요약: `<브랜치> · <메시지|파일명>["<검색어>"] · <시작>~<종료> · Merge 제외|포함 [· 작성자 필터] [· 해시 필터]`(명세의 마지막 `메시지 제외 N`은 RT-48 몫이라 그 상태 자체가 없어 생략).
  - **신규 `CommitWorkspaceHeader.tsx`**: `CommitWorkspaceSummary`(접힌 요약 "N개 선택됨" + ready 단계일 때만 `Deleted N`/`⚠ N` 덧붙임, M-8) · `CommitWorkspacePreviewAction`(M-8의 "접힌 헤더에 Preview 유지" — `CommitListPanel` 안 Preview 버튼과 같은 disabled/title 조건을 별도 인스턴스로 복제, `headerActions`는 접혔을 때만 렌더링되므로 펼친 상태에서 버튼이 중복 표시되지 않는다).
  - **신규 `deployFiles/DeployFilesWorkspaceSummary.tsx`**: 분석 단계가 ready가 아니면 `선택 없음`/`계산 중`/`Preview 필요`/`계산 실패`(analyzing·dependencyAnalyzing 둘 다 "계산 중"으로 묶음), ready면 위에서 확정한 현재-모델 문구.
  - **CSS 버그 발견·수정(Playwright 스크린샷으로 직접 확인 — vitest/typecheck/lint/build/기존 e2e 전부 그린이어도 못 잡는 종류)**: ① `.collapsible-section { height:100% }`을 모든 사용처에 무조건 걸었더니, app-shell의 평범한 flex 자식인 CommitQueryBar 인스턴스가 그 퍼센트를 app-shell 전체 높이(100vh)로 해석해 레이아웃이 깨졌다(체크박스 클릭이 `.app-shell`에 가로채임) — 다른 모든 SplitPane 자식(commit-list-panel/deploy-files-panel 등)이 이미 하던 대로 "grid cell을 채워야 하는 인스턴스만" height:100%가 필요하다는 걸 뒤늦게 확인, `fill` prop(모디파이어 클래스 `collapsible-section--fill`)으로 분리해 WorkArea의 두 사용처에만 걸었다. ② `.collapsible-section__body { display:flex }`를 무조건 걸었더니 author 규칙이 UA 스타일시트의 `[hidden]{display:none}`보다 출처 우선순위가 높아(특정도가 같아도 author가 이김) **접힌 섹션의 본문이 계속 보이는 버그**가 있었다 — `:not([hidden])`으로 펼친 상태에만 `display:flex`를 걸어 해결. 둘 다 자동 테스트로는 안 잡히고 Playwright로 실제 5가지 상태(펼침/각 섹션 단독 접힘×3/둘 다 접힘)를 스크린샷 확인하다 발견했다(임시 스펙 파일, 커밋 대상 아님 — RT-41 이후 관례와 동일).
  - **수용 기준 확인**: 세 헤더가 `CollapsibleSection` 하나만 재사용해 높이·좌측 위치·접기 버튼 우측 위치가 자동으로 동일 · 배포 영역 바깥 테두리 없음(내부 두 FilePane만 테두리, 기존에 이미 만족) · 접기 → 본문 숨김 + 요약 + 이벤트 발행 · 한쪽 접으면 다른 쪽이 남은 높이를 채움(Playwright로 실측 확인) · 펼치면 비율 복원 · 접힌 섹션 안 입력값 유지(`hidden` 속성만 사용, unmount 안 함 — RT-40 그대로) 전부 확인.
  - 검증: `npm test`(140개, 신규 없음 — 이 훅들은 `useMemo`/DOM 기반이라 RT-01/34 방침대로 vitest 대상 아님)·`typecheck`·`lint`·`build`·`test:e2e`(15개, 기존 스펙 그대로) 전부 통과. Playwright 임시 스크린샷 6장으로 펼침/조회조건 접힘/커밋 접힘/배포 접힘/둘 다 접힘/Deleted·경고 개수 포함 접힌 요약까지 육안 확인(임시 파일, 커밋 대상 아님).
- [x] **RT-48 (U-8)** 키워드 통합(메시지/파일명, 포함·제외) — **RT-49와 함께 진행(2026-09-23, AskUserQuestion)**: §5.1 RT-49 필터 그룹이 요구하는 "키워드" 필드 자체가 RT-48의 산출물이라 착수 전 순서 충돌(RT-41/42와 같은 유형)을 먼저 확인, 사용자가 "RT-48을 앞당겨 함께 진행"을 선택해 한 세션에서 구현했다.
  - **M-4 재검증 — 원래 가정 폐기, 실제 구현은 다름**: §0.1 원칙대로 실제 git(2.53)으로 재현 검증하다가, **`-P`(PCRE) 자체는 정상 지원되지만 그 패턴 안에 negative lookahead(제외 조건)를 넣으면 실제로는 일치하지 않는 커밋도 결과에 포함되는 git 쪽 버그를 재현 확인했다**(`\A(?!fix)`처럼 최소화한 패턴으로도 재현 — 같은 저장소에서 `--invert-grep`은 정상 동작하지만, 그건 전체 `--grep` 결과를 통째로 뒤집을 뿐이라 포함 조건과 동시에 AND로 결합할 방법이 없다). 그래서 최종 구현은 원래 가정과 다르다: **포함**은 `-F`(고정 문자열) + `--grep`을 키워드 수만큼 반복(기존 `authors`가 이미 쓰던 OR 관례 재사용) — `-F`라 애초에 정규식으로 해석하지 않으므로 기존 `--grep=<검색어>`(BRE)가 `[skip ci]`를 문자 클래스로 오인하던 결함(재현 확인, DETAILED_DESIGN.md §0.1)도 함께 해소한다. **제외**는 클라이언트(Node.js) 필터로 전환 — git의 `--skip`/`-n`을 그대로 쓰면 클라이언트 필터로 걸러진 "이후" 개수를 다음 페이지 `--skip`에 그대로 넘기게 돼 이미 보여준 커밋이 재등장하는 페이지네이션 버그가 생긴다는 것도 실제로 재현해, `maxCount`(이 조회 전체의 상한)를 한 번에 가져와 걸러낸 뒤 `[skip, skip+limit)`을 직접 슬라이스하는 방식으로 재설계했다(회귀 테스트 `listCommits — 제외 키워드 페이지네이션(중복/누락 방지)`). `\E` 이스케이프는 더 이상 PCRE 패턴을 안 써서 불필요해졌다. `main/git/commits.ts`에 정리.
  - **타입/스토어**: `shared/types.ts`의 `ListCommitsParams.searchTerm` 폐기 → `includeKeywords?`/`excludeKeywords?`(`searchMode`는 유지). `services/commitQueryParams.ts`에 `parseKeywordText`(줄바꿈 구분, `-` 접두는 제외, 쉼표·대괄호·`.`·`*`는 리터럴 — 작성자/해시가 쓰는 `parseMultiValueFilter`와 구분자 규칙이 달라 새로 만듦) 신규, `CommitQueryFilters.searchTerm` → `keywordText`로 교체. `commitQuerySlice.ts`(`setSearchTerm`→`setKeywordText`)·`commitsSlice.ts` 동일하게 교체.
  - **파일명 모드**: 포함 키워드만 OR로 파일명 부분 일치(기존 2단계 구현 재사용), 제외 줄은 항상 무시(§5.1) — 포함이 하나도 없으면 파일명 필터 자체를 안 건다.
  - **선택 커밋이 가려질 때 카운터 표시**: `CommitListPanel.tsx`에 "N개 선택됨 (선택 중 K개는 화면에 안 보임)" 추가 — 로드된(스크롤로 이미 불러온) 페이지 기준 근사치라는 한계를 주석에 남겼다(아직 안 불러온 다음 페이지의 선택도 "안 보임"으로 잡힘).
  - 검증: `npm test`(commits.test.ts에 키워드 메시지모드 6케이스·파일명모드 2케이스·페이지네이션 회귀 1케이스, commitQueryParams.test.ts에 parseKeywordText 6케이스 추가)·`typecheck`·`lint`·`build`·`test:e2e`(신규 `query-filter-group.spec.ts` 4건 — 포함/제외 실제 필터링, 힌트 노출/숨김, 파일명 모드 경고) 전부 통과.
- [x] **RT-51 (U-11)** Extract 대상 목록 — **RT-52와 함께 진행(2026-09-23, AskUserQuestion)**: §5.1 RT-51이 누락된 의존성의 복귀 위치를 "`AddFilesPopup`의 HEAD 트리"(RT-52, 당시 미착수)로 정의하고 "SplitPane은 기존 2분할 그대로"를 요구하는데, 그때까지 별도였던 `MissingDependenciesPane`이 있으면 2분할이 안 되는 순서 문제를 확인(RT-47이 이미 겪고 RT-51 선도를 보류했던 것과 동일) — "RT-51+RT-52를 평탄한 목록으로 함께"를 선택받아 한 세션에서 구현했다(RT-53의 TreeList 전까지는 RT-44가 Deleted/경고 팝업에 쓴 "평탄한 목록 우선 구현 → RT-53이 교체" 패턴 재사용).
  - **상태 모델**: `deployFilesSlice.ts`의 `DeployFileEntry`에 `source: 'changed'|'dependency'|'manual'`(+ `dependency`에만 `kind`) 추가. `included`는 명세대로 "소속 목록"(true=Extract, false=미선택 변경 파일) 의미로 재정의됐지만 **필드 이름·타입은 안 바꿨다** — RT-33이 `exportPlan.buildExportFiles`를 설계할 때 이미 "included=true 중 패턴 미매치만 Export"로 만들어 뒀는데 그게 "Extract 목록 − 활성 패턴 해당 항목"과 정확히 같은 판정이라, 그 함수는 실제로 한 글자도 안 바꿨다(주석만 갱신). `source==='changed'`만 `included:false`로 배열에 남을 수 있고(왼쪽 목록), dependency/manual은 항상 `included:true`이며 "되돌리기"는 배열에서 완전히 제거하는 것으로 표현한다(원래 목록이 없거나(수동) HEAD 트리로 돌아가야 하므로(의존성)).
  - **새 액션**(`deployFilesSlice.ts`): `addDependencyToExtract`(단건, add-only) · `addAllVisibleDependencies`(다건, add-only — 예전 `toggleAllMissingDependencies`의 양방향 토글에서 단방향으로 단순화, AddFilesPopup의 "보이는 항목 모두 추가"가 add-only 버튼이라 토글 개념 자체가 없어짐) · `removeFromExtract`(Extract 행의 × 하나 — 출처별 분기) · `returnAllExtractItems`("모두 되돌리기"). `toggleDependencyIncluded`/`toggleAllMissingDependencies`는 삭제. `addManualFile`은 `source:'manual'` 태그만 추가.
  - **왼쪽 "포함된 파일"(`useIncludedFilesView.ts`)**: `source==='changed' && !included`로 먼저 좁힌 뒤 기존 파일 패턴 필터링 — 체크(`toggleDeployFileIncluded`)하면 다음 렌더에서 이 목록 자체에서 사라지는 방식으로 "Extract 이동"을 표현한다(코드 변경 없이 필터만 바꿔서 얻어짐 — 체크박스·전체선택 로직은 그대로 재사용했는데, 화면에 보이는 게 항상 `!included`뿐이라 자연히 단방향(체크=이동)으로만 동작하게 됐다). "선택 N개"(REQ-020)는 이제 "이미 Extract로 이동한 변경 파일 개수"(필터·화면 표시와 무관한 절대값, 원래 REQ-020 원칙 그대로) — 빈 상태 문구 둘(전부 이동했음 vs 패턴에 다 걸림)을 `totalBeforeFilter`(패턴 적용 전 미선택 개수)로 구분해서 고른다.
  - **오른쪽 `ExtractTargetsPane.tsx`(신규, `MissingDependenciesPane.tsx` 대체)**: `useExtractTargetsView.ts`(신규) — `included===true` 전부(출처 무관)를 모아 활성(비 screenOnly) 패턴 매치 여부(`patternExcluded`)를 같이 계산. `ExtractRow.tsx`/`ExtractList.tsx`(신규) — 체크박스 대신 `×` 버튼(출처별 툴팁: "원래 목록으로 되돌림"/"누락된 의존성 목록(파일 추가 팝업)으로 되돌림"/"수동 추가 철회"), 종류 배지(`kind-badge`, Impl/I — 의존성 출처만, 색은 중립 회색), 출처 배지(변경/수동 — 의존성 출처는 표시 안 함, 사용자 결정 2026-09-21), 패턴 제외 시 흐림+취소선+"패턴 제외" 태그(숨기지 않음, 조용한 누락 방지). 제목 `Extract 대상 (N개 · 패턴 제외 K개)`(K=0이면 생략), 제목 줄 오른쪽 "모두 되돌리기"(0개면 비활성). 경로 복사 버튼(RT-53)은 이번 범위 밖이라 아직 없다.
  - **실측 CSS 버그 발견·수정**: `ExtractRow`를 처음엔 `FileRow`의 `width:max-content`(긴 경로를 안 자르고 가로 스크롤하는 방식)를 그대로 재사용했는데, Extract 행은 오른쪽에 ×·배지가 항상 보여야 하는데 그게 화면 밖으로 밀려나 안 보이는 걸 Playwright 스크린샷(요소 단위 크롭)으로 발견 — `useMeasuredColumnWidth` 의존을 걷어내고 `width:100%` + 파일명 `text-overflow:ellipsis`(전체 경로는 title 툴팁)로 바꿔 해결했다.
- [x] **RT-52 (U-12·U-19·U-20)** `AddFilesPopup`(RT-51과 함께, 위 항목 참고) — **RT-53(TreeList) 전까지는 평탄한 목록**이라 `HeadTreeBrowser`(트리, 기본 펼침 규칙 등)는 아직 없다. `ManualAddPopup.tsx` → `AddFilesPopup.tsx`로 교체(팝업 키도 `'manual'`→`'addFiles'`로 개명, M-18 권장값 그대로). 검색어가 없으면 **발견성 보존을 위해 누락된 의존성만** 보여주고(HEAD 트리 수천~수만 개를 평탄하게 다 나열하면 못 씀 — RT-53이 트리로 바뀌면 전체 탐색 가능), 검색어가 있으면 매칭되는 HEAD 트리 후보 전체를 보여주며 그중 누락된 의존성은 계속 붉은 글자(`status-text--error`와 같은 색 재사용)+`Impl`/`I` 배지로 구분한다 — `lib/addFilesCandidates.ts`(신규, 순수 함수 `buildAddFilesCandidates`/`visibleDependencyPaths`, vitest 6케이스)가 이 분기를 담당. 검색은 `lib/matchesFileName.ts` 재사용(`*` 와일드카드 포함, §5.1 "와일드카드 규칙 재사용"). `보이는 항목 모두 추가 (N)`은 누락된 의존성만 add-only로 추가(일반 파일 미포함). `+ 파일 추가` 버튼에 `누락 N` 배지(50 초과 시 붉은색, REQ-020 이월) — `IncludedFilesPane.tsx`가 팝업이 닫혀 있어도 항상 계산해 보여준다(발견성). 분석 상태 안내 한 줄(파싱 실패/확인 중/적용 불가)은 그대로 유지. `MissingDependenciesPane.tsx`·`lib/useMissingDependenciesView.ts` 삭제, `lib/visibleMissingDependencies.ts`는 계속 재사용. **범위 밖(RT-53 이후)**: `HeadTreeBrowser`(전체 트리 탐색·자동 펼침), 경로 복사 버튼.
  - 검증(RT-51/52 공통): `npm test`(169개, 신규 `addFilesCandidates.test.ts` 6개 + `deployFilesSlice.extract.test.ts` 8개)·`typecheck`·`lint`·`build`·`test:e2e`(20개 — 기존 5개 스펙의 좌측 체크 가정을 전부 Extract 모델 기준으로 다시 씀: `preview-export`·`export-feedback`·`work-area-popups`·`included-files-pane`·`popup-behavior`, `manual-add.spec.ts`→`add-files-popup.spec.ts`로 개명하며 신규 시나리오 1건 추가) 전부 통과. Playwright 임시 스크린샷(Spring Boot 모양 fixture로 실제 누락된 의존성 2건 재현 — 인터페이스 1·구현체 1)으로 빨간 글자·배지·Extract 행·모두 되돌리기까지 육안 확인 후 삭제.
- [x] **RT-53 (U-13)** `TreeList` primitive — **RT-54와 함께 진행(2026-09-23)**: 착수 전 조사에서 AddFilesPopup의 HEAD 트리(들여쓰기+파일명+종류 배지+경로 복사+추가 버튼)가 기존 480px 고정폭 `Popup`엔 비좁다는 걸 확인, RT-15가 "전체 표준 크기(720×480)는 RT-54 몫"이라고 이미 미뤄둔 걸 발견해 AskUserQuestion으로 "RT-54를 먼저(또는 함께) 처리"를 확인받아 함께 진행했다. 착수 전 **M-20도 확정**(AskUserQuestion, 2026-09-23): 펼침 상태는 로컬에만(저장 안 함, 새로고침하면 항상 기본 전부 펼침) · **300개 초과 기본 접힘은 채택하지 않음**(가상 스크롤이 이미 렌더링 비용을 해결해 성능상 이유가 없고 "한눈에 구조 파악" 이점도 이 앱의 목록 크기에선 크지 않다고 판단 — 사용자가 근거를 요구해 재검토 후 원래 권장안을 뒤집은 항목) · 폴더 체크박스에 **indeterminate 추가**(일부만 Extract로 이동된 폴더 표시, `TriStateCheckbox` 재사용).
  - **순수 함수**(`lib/tree.ts`, 신규): `buildTree(items, getPath)`·`compressChains(node, compactFromDepth)`·`flatten(root, isOpen)` — `docs/refactoring/component-playground.html`의 `buildTree`/`treeHtml` 알고리즘을 그대로 이식(이미 목업 10개 시나리오로 검증됨). vitest 12케이스(단일 파일·중첩·같은 이름 다른 폴더·한글 경로·체인 병합·병합 중간에 파일 있으면 끊김·`compactFromDepth` 미만 병합 안 함·폴더 우선 정렬·같은 레벨 이름순·접힌 폴더 flatten 제외·펼침 상태별·depth 반영).
  - **`useTreeExpansion(defaultOpen)`**(`lib/useTreeExpansion.ts`, 신규) — 펼침 상태는 이 훅을 호출한 컴포넌트 로컬에만 있다(M-20). 목록마다(그리고 AddFilesPopup의 탐색/결과 트리처럼 한 컴포넌트 안에서도) 이 훅을 별도로 호출해 서로 독립된 펼침 상태를 갖는다(§5.1 "탐색/결과는 펼침 id를 분리").
  - **`TreeList.tsx`**(신규) — `renderLeaf`/`renderFolder` 슬롯, `expansion` prop(호출부 소유), `compactFromDepth`(기본 1, AddFilesPopup 탐색 트리만 3). 경로 복사 버튼(U-18, `CopyPathButton.tsx` 신규 + `lib/toRepoRelativePath.ts` 신규, `useCopyToClipboard` 재사용)은 `copyable` prop(기본 true)으로 TreeList가 자동으로 붙이거나, Extract처럼 `×`와의 16px 간격·순서 규칙이 있는 곳은 꺼서(`copyable={false}`) `renderLeaf`/`renderFolder` 안에서 직접 배치한다. `rowClassName` prop(선택) — 스타일 목적이 아니라 e2e가 "동시에 떠 있는 여러 TreeList 중 어느 것"을 구체적으로 짚을 수 있게 하는 훅(왼쪽/오른쪽 패널이 구조적으로 동일한 `.tree-row`를 동시에 렌더링하므로) — `IncludedFilesPane`은 `included-row`, `ExtractTargetsPane`은 `extract-row`(기존 이름 유지로 하위 e2e 호환).
  - **6개 트리 인스턴스**(§5.1 "5곳"이지만 AddFilesPopup의 탐색/결과가 펼침 상태가 분리된 별도 인스턴스라 실질 6개, 체크리스트 원문 "6개 목록"과 일치): `IncludedFilesPane`(왼쪽, 폴더 체크박스=`toggleAllDeployFiles`로 하위 변경 파일 이동, indeterminate는 "이 폴더 아래 원래 변경 파일 개수 changedFiles가 화면에 보이는 fileCount보다 많은지"로 판정 — 이미 계산되는 값만으로 별도 순회 없이 구해짐) · `ExtractTargetsPane`(오른쪽, 폴더 `×`=신규 `returnFolderFromExtract` 액션) · `AddFilesPopup`의 탐색 트리(`compactFromDepth:3`, 기본 펼침 = 1단계 ∪ 누락된 의존성 조상 폴더) · 같은 팝업의 결과 트리(검색어 있을 때, `compactFromDepth:1`, 전부 펼침) · `DeletedFilesPopup`·`WarningsPopup`(읽기 전용, `renderFolder` 기본값 그대로).
  - **AddFilesPopup 재구성**: `lib/addFilesCandidates.ts`를 RT-52의 "빈 검색어=누락된 의존성만" 2분기에서 `buildBrowseCandidates`(HEAD 트리 전체, M-36a대로 이미 추가된 경로 제외)·`buildSearchCandidates`(매칭 50개 상한 + truncated 플래그)·`missingDependencyAncestorPaths`(누락된 의존성 경로의 모든 조상 폴더 집합 — compact 병합 후 폴더 노드의 `path`가 항상 이 조상 경로 중 하나와 같다는 걸 이용해, TreeList 내부 트리 구조를 몰라도 기본 펼침 규칙을 맞출 수 있다) 셋으로 재구성. 이제 진짜 HEAD 트리 탐색이 된다(RT-52가 남겨둔 범위 밖 항목 해소).
  - **폴더 인덱터미네이트 계산**: `useIncludedFilesView`가 `changedFiles`(패턴·이동 여부 무관, source==='changed' 전체)를 추가로 반환하도록 확장 — `IncludedFilesPane`의 `renderFolder`가 `changedFiles.filter(prefix 매치).length > info.fileCount`로 "이 폴더 중 일부가 이미 Extract로 이동했거나 패턴에 걸려 안 보인다"를 판정한다.
  - **실측 CSS 버그**: `ExtractRow`(RT-51)의 `width:max-content` 가로 스크롤 방식을 그대로 재사용했다가 Playwright 요소 스크린샷으로 ×/배지가 화면 밖으로 밀려나 안 보이는 걸 재발견 — `TreeList`의 모든 행에 `width:100%` + 이름 `text-overflow:ellipsis`로 통일했다(전체 경로는 행 `title` 툴팁). `FileList.tsx`/`FileRow.tsx`/`lib/useMeasuredColumnWidth.ts`(가로 스크롤 실측 방식 전체)는 더 이상 쓰이지 않아 삭제.
  - **삭제된 죽은 CSS**: `.deploy-files-grid-row`/`.deploy-files-measure-probe`/`.deploy-files-row__label`(grid 전용 `display:contents` 트릭, flex 기반 TreeList엔 불필요)·`.manual-add-popup__results`/`.manual-add-popup__result-path`·`.popup-plain-list`(전부 TreeList로 대체돼 렌더링하는 컴포넌트가 없어짐).
  - 검증: `npm test`(190개, 신규 `tree.test.ts` 12개+`toRepoRelativePath.test.ts` 4개+`addFilesCandidates.test.ts` 재작성 10개)·`typecheck`·`lint`·`build`·`test:e2e`(23개 — 기존 스펙들이 "리프는 전체 경로를 표시"하던 가정이 "파일명만 표시"로 바뀌어 `hasText` 로케이터를 전부 갱신, `popup-plain-list`→`.tree-row--file` 등 마크업 변경 반영, 신규 `tree-list.spec.ts` 3건 — 폴더 ×/체크박스 왕복, indeterminate, 경로 복사) 전부 통과. Playwright 임시 스크린샷(Spring Boot 모양 fixture)으로 720px 폭 팝업·탐색 트리(1~2단계 병합 안 함+누락된 의존성 조상 자동 펼침)·결과 트리(전 구간 병합)·Extract 트리 폴더 압축까지 육안 확인 후 삭제.
- [x] **RT-54 (U-14)** `Popup` primitive 기본 크기 720×480 + 부모 높이 클램프 — RT-53과 함께 진행(위 항목 참고). `.popup` CSS만 변경: `width: 480px` 고정 → `width: min(720px, 94%)`, `height: min(480px, calc(100% - 20px))` 추가(`.popup-backdrop`의 padding 16px×2까지 감안해 20px 여유). `Popup.tsx` 컴포넌트 로직은 무변경(크기는 전적으로 CSS가 결정) — `AddFilesPopup`·`FilterPatternsPopup`·`DeletedFilesPopup`·`WarningsPopup` 전부 이 표준 크기로 자동 통일됐다.
- [x] **RT-55 (U-15)** Reload 전체 초기화 — **착수 전 M-22·M-24 확인(AskUserQuestion, 2026-09-23)**: M-24는 "확인 대화상자 없음"(원래 권장 "있음"을 뒤집음 — 코드베이스에 confirm 패턴이 전혀 없어 새로 설계해야 하는 비용 대비, Reload는 버튼을 직접 눌러야만 일어나는 명시적 동작이라 확인창 불필요로 판단), M-22는 스펙 본문의 "가정"(파일 패턴·Export 경로/방식·접힘·분할 비율·트리 펼침 유지) 그대로 확정.
  - **`commitQuerySlice.resetQuery()`**(신규) — `startDate`/`endDate`를 `getDefaultDateRange()`로 **그 시점에 다시 계산**(모듈 최상단의 `defaultRange`는 앱 시작 시점에 한 번만 계산돼 재사용 불가), `maxCount:100`·`keywordText:''`·`searchMode:'message'`·`authorFilter:''`·`excludeMerges:true`·`hashFilterText:''`·`invalidHashFilter:[]`로 초기화.
  - **`commitsSlice.clearSelection()`**(신규) — `selectedHashes: new Set()`.
  - **`analysisSlice.resetAnalysis()`**(신규) — `analyzing`·`analysisError`·`analyzedSelection`·`summary`·`deleteList`·`warnings`·`emptyDependencyState`·`emptyManualAddState`(deployFiles·headTreeFiles·manuallyAddedPaths 포함) 초기화. `deployFiles` 등은 원래 `deployFilesSlice` 소유지만, `runPreview`의 "선택 없음" 분기·`commitsSlice`의 기존 인라인 초기화도 이미 같은 방식으로 슬라이스 경계를 넘어 직접 `set()`해 왔던 패턴을 그대로 따랐다(§7.2 설계 — "선택/조회가 바뀌면 옛 분석 결과가 남으면 안 된다"는 같은 불변식이라 셋을 분리하지 않음).
  - **`repositorySlice.reloadRepository()`** 수정: 검증 성공 후 `selectedBranch`를 **항상 `pickDefaultBranch(branches)`**로 되돌리도록 변경(기존엔 "현재 Branch가 여전히 존재하면 유지" — Reload가 부분 재조회가 아니라 전체 초기화가 됐으므로 이 조건을 없앴다), 위 세 reset 함수를 호출한 뒤 `loadCommitsFirstPage(true)` → **`loadCommitsFirstPage(false)`**로 변경(스펙의 "`keepSelection` 파라미터 경로를 정리" 지시사항 — Reload가 더 이상 선택을 유지하지 않으므로). 열려 있는 팝업을 닫는 로직은 **별도 구현이 필요 없었다** — `WorkArea.tsx`가 이미 `repository.status==='validating'` 전환을 감지해 팝업을 닫고 있었다(RT-43, `reloadRepository`가 검증 시작 시 제일 먼저 이 상태로 바뀜).
  - 검증 실패 경로(저장소가 사라졌거나 깨짐)는 그대로 `return`이라 위 reset 호출부에 도달하지 않는다 — 수용 기준 "검증 실패 시 초기화하지 않고 오류만 표시"가 코드 구조상 자연히 성립.
  - **vitest**(`store/repositorySlice.reload.test.ts` 신규, 4케이스): 초기화 필드 전부 확인(브랜치가 `dev`→`main`, 조회 조건·선택·분석 결과 전부 초기값) · 기간이 "지금" 기준 재계산 · M-22 유지 필드(`exportParentDir`) 불변 · 검증 실패 시 아무것도 초기화 안 함.
  - **e2e**(`e2e/reload-reset.spec.ts` 신규, 1케이스): 키워드로 목록을 걸러낸 뒤 커밋 선택 → Preview → Reload를 누르면 키워드가 풀려 전체 커밋이 다시 보이고, 체크박스가 전부 해제되고, Extract 결과가 사라지는지 화면까지 확인.
  - 검증: `npm test`(194개, 신규 4개)·`typecheck`·`lint`·`build`·`test:e2e`(24개, 신규 1개) 전부 통과. 기존 e2e `work-area-popups.spec.ts`의 "Reload를 누르면 열려 있던 팝업이 닫힌다"는 이 변경으로 영향받지 않음(팝업 닫힘은 원래도 `WorkArea`가 담당).
- [x] **RT-56 (U-16)** `ExportModeSelect` + `exportMode` 상태(영속) + 표시 경로 파생. **`direct`는 선택 폴더가 비어 있을 때만 허용(a안)**: Main에서 폴더 비어 있음 확인(IPC), 비어 있지 않으면 Export 비활성화·안내, `direct`에서 `fs.rm` 금지, 경로 미선택 시 비활성화. `sub`의 덮어쓰기 확인창은 유지. `BuildPackageParams`에 모드 필드 추가(IPC 검증 RT-12에 화이트리스트). vitest로 `getDeployDir` 모드별 결과·비어 있지 않은 폴더 거부·삭제 금지 회귀 테스트, 임시 폴더 통합 테스트 **추가: 추출 위치가 저장소와 겹치면(같음·저장소 안·저장소를 포함) Export 금지 검증(Main 권위, 저장소 변경·Reload·모드 변경·Export 직전 재검증) + 경로 미선택 시 기본값(저장소 루트) 폐지 — 상세는 §5.1 RT-56.** — **구현 완료(2026-09-23)**. 착수 전 스펙 본문·§7 M-25/M-27/M-33이 이미 "결정 대기" 표시 없이 권장값까지 확정돼 있어(RT-55의 M-22/M-24와 달리 이 RT는 AskUserQuestion 없이 그대로 진행) 별도 확인 없이 구현했다.
  - **판정 함수 분리**: `classifyExportTarget(repoPath, deployDir)`(`src/main/package/classifyExportTarget.ts`) — `path.relative` 기반 순수 함수(INSIDE_REPO/CONTAINS_REPO/OK), fs 접근 없음. `validateExportTarget()`(`src/main/package/validateExportTarget.ts`)이 `fs.realpath`(경로가 없으면 존재하는 가장 가까운 상위까지만 resolve하고 나머지 이어 붙임)+플랫폼별 대소문자 정책(`normalizeForCasePolicy` — Windows/macOS는 소문자로 접고 Linux는 그대로, `process.platform` 기준 근사)을 적용해 넘긴다. 우선순위: ①NO_PATH ②INSIDE_REPO/CONTAINS_REPO ③(direct만) NOT_EMPTY.
  - **IPC**: `package:validateExportTarget` 신설(스펙대로). `package:export` 핸들러가 실행 직전 같은 함수로 재검증해 실패 시 `IpcValidationError`로 거부(렌더러 상태를 신뢰하지 않음). `assertValidExportMode`(`validate.ts`)로 `mode` 화이트리스트 확인(RT-12).
  - **`getDeployDir`**: 3번째 인자로 `mode: ExportMode`를 받도록 변경(`BuildPackageParams.mode` 신규 필수 필드) — `'direct'`면 `exportParentDir` 그대로, `'sub'`면 기존과 동일하게 `<parent>/git-deploy-extracted`. `buildPackage()`는 `mode==='sub'`일 때만 `fs.rm(recursive)` 후 재생성하고, `'direct'`는 절대 `fs.rm`을 호출하지 않고 `fs.mkdir(recursive)`만 한다(비어 있음은 Main이 사전에 보장).
  - **`package:export` 핸들러**: sub 모드의 "이미 내용이 있으면 덮어쓰기 확인창"은 유지하되 `mode==='sub'`일 때만 실행(direct는 validateExportTarget이 이미 빈 폴더를 보장해 확인이 불필요).
  - **렌더러**: `exportSlice.ts`에 `exportMode`(localStorage `gde:exportMode`, 기본 `sub`)·`exportTargetValidation`·`setExportMode`·`revalidateExportTarget`(오래된 응답이 최신 상태를 덮어쓰지 않도록 `requestGuard.ts` 재사용) 추가. `repositorySlice.ts`의 `browseRepository`/`reloadRepository` 끝에서 `revalidateExportTarget()` 호출(검증 시점 ②). `lib/exportPath.ts`에 `loadExportMode`/`saveExportMode`/`formatDeployDirDisplay`(네이티브 다이얼로그가 돌려준 경로의 구분자 스타일을 그대로 따라감) 추가. `FooterActionBar.tsx`(ExportBar)에 `ExportModeSelect.tsx`(신규) 배치 + 검사 우선순위(경로 검증 실패 > RT-17 분석 중 > isStale)를 반영한 상태 메시지, 경로 미선택 시 "추출할 폴더를 선택하세요" 표시(REQ-012 정정 — 저장소 루트 기본값 완전 폐지).
  - **vitest**: `classifyExportTarget.test.ts`(순수 함수, INSIDE_REPO/CONTAINS_REPO/OK + `-old`/`2` 접두사 오판 방지), `validateExportTarget.test.ts`(임시 폴더 통합 테스트 — 동일/끝 구분자/`.`·`..`/심볼릭 링크/하위 폴더 전부 INSIDE_REPO, F가 저장소를 포함하면 CONTAINS_REPO, 형제·접두사만 같은 형제는 통과, direct의 빈 폴더/비어 있지 않음/아직 없는 경로, sub는 비어 있어도 NOT_EMPTY를 반환하지 않음, `normalizeForCasePolicy`는 `process.platform`을 강제로 바꿔가며 Windows/macOS/Linux 세 갈래 모두 결정적으로 확인), `buildPackage.test.ts`에 direct 모드 케이스(무관한 기존 파일이 `fs.rm` 없이 보존됨) 추가. `npm test`(220개, 신규 26개)·`typecheck`·`lint`·`build`·`test:e2e`(24개) 전부 통과.
  - **e2e**: `package:browseExportDir`도 `repository:browse`(`GDE_E2E_REPO_PATH`)와 같은 이유로 `GDE_E2E_EXPORT_DIR` 우회를 추가(REQ-012 정정으로 경로를 반드시 "골라야" 하므로 Playwright도 예외 없음) — `e2e/support/launchApp.ts`(`exportDir` 2번째 인자)·`fixtureRepo.ts`(`createExportDirFixture`). `preview-export.spec.ts`·`export-feedback.spec.ts`가 저장소 루트 기본값에 의존하던 부분을 "변경" 클릭 + 별도 빈 폴더로 교체(기존 저장소 루트 Export는 이제 `INSIDE_REPO`로 막힌다).
- [x] **RT-57 (U-17)** Export 산출물 변경: ① `deploy-summary.json` 생성·`DeploySummary` 삭제 ② `deploy-files.txt`+`delete-list.txt` → `extract-list.txt` 통합(경계선·섹션 제목·개수) ③ `treeText`(폴더 먼저·이름순·커넥터·체인 병합) + 머리말(생성 시각·기준 브랜치) 생성 순수 함수, vitest(빈 목록·루트 파일·체인 병합·정렬·한글 경로·머리말 형식·시각 주입으로 결정적 테스트) ④ `verify-phase3.ts`·README·ARCHITECTURE 갱신 ⑤ `BuildPackageParams`/`runExport` 불필요 필드 정리 — **구현 완료(2026-09-23)**. 착수 전 M-30(체인 병합·서버 경로 기준)·M-31(BOM 없는 UTF-8)·M-32(커밋 머리말 형식)를 AskUserQuestion으로 확정(전부 명세 가정대로 채택). `src/main/package/extractListText.ts` 신규(`treeText`·`buildExtractListText` 순수 함수, component-playground.html의 buildTree/treeText 이식) + `extractListText.test.ts`(vitest 20케이스). `buildPackage.ts`가 `deploy-files.txt`/`delete-list.txt`/`deploy-summary.json` 3종 대신 `extract-list.txt` 하나만 씀. `DeploySummary` 타입 삭제, `BuildPackageParams`에서 `mappingProfileName`·`warnings`(요약 전용 필드) 제거, `BuildPackageResult`는 `{ deployDir }`만 남김 — `exportSlice.ts` 호출부도 맞춰 정리. `verify-phase3.ts`는 P0에서 이미 삭제된 파일이라 갱신 대상 없음(확인만). README.md(3·8번 항목)·ARCHITECTURE.md(§4.4 Package Builder, 파이프라인 다이어그램) 갱신. 검증: `npm test`(238개, 신규 20개)·`typecheck`·`lint`·`build`·`test:e2e`(24개) 전부 통과.
- [x] **RT-59 (U-21)** `RepositoryBar` 배치: `Browse...`·`Reload`·버전 배지를 저장소 바 **오른쪽 끝**에 모은다(상세 §5.1 RT-59) — **구현 완료(2026-09-23)**. 착수 전 M-44(저장소 전체 경로 텍스트 처리)를 AskUserQuestion(ASCII 비교)으로 확정, 목업에도 반영 후 진행
- [x] **RT-49 (U-9·U-10)** `CommitQueryBar` 레이아웃(작성자·해시 우측), 기본 창 크기 결정 — RT-48과 함께 구현(위 항목의 "함께 진행" 경위 참고, 2026-09-23). 착수 전 M-42 세부(a~d)를 전부 "가정대로" 확정, M-13 잔여분(기본 창 폭)도 "가정대로 반영"을 사용자에게 직접 확인받았다.
  - **그룹 분리**: 조회 조건 본문을 `SplitPane`(가로, `gde:splitRatio:queryGroups`, 기본 50:50, 최소 폭 왼쪽 320px/오른쪽 330px)으로 검색 조건 그룹·필터 그룹으로 나눴다 — 본문 컨테이너 자체는 테두리가 없고 두 그룹만 각자 `.panel`(명세 "각 그룹은 자기 테두리 상자"). `SearchConditionGroup.tsx`(신규) — Branch·Search 버튼(1행) + 조회 기간·최대 개수·Merge 제외(2행), 기존 동작 무변경(컴포넌트만 분리). `QueryFilterGroup.tsx`(신규) — 키워드(RT-48, flex 1.5)·작성자(flex 1)·해시 필터(flex 1) 세 텍스트 영역이 한 줄에, 키워드 헤더에 검색 대상 라디오(왼쪽 그룹에서 이동).
  - **`FieldHint.tsx`(신규)** — 값을 입력해 placeholder가 사라지면 포커스 중인 필드 바로 아래에 겹쳐 뜨는 힌트 툴팁. 가로 SplitPane의 `.split-pane--horizontal{overflow-x:auto}`가 CSS 스펙상 `overflow-y`도 강제로 `auto`로 승격시켜(두 축 중 하나만 `auto`고 다른 하나만 `visible`일 수 없다) `position:absolute`로 두면 그 컨테이너 안에 갇혀 잘리는 걸 확인 — `position:fixed` + `getBoundingClientRect()`로 뷰포트 좌표를 직접 계산해 조상 overflow의 영향을 안 받게 했다(포커스 중 window resize·scroll(capture 단계)에 재계산). 아래 목록 레이아웃은 밀지 않되(M-42(d)) 시각적으로는 그 위를 덮을 수 있다 — 의도된 트레이드오프.
  - **M-42 그대로 반영**: (b) 최소 폭 합(650px)보다 창이 좁으면 가로 스크롤 유지(`.split-pane--horizontal` 공용 규칙 재사용, 세로로 안 쌓음) (c) 경계 키보드 조절 없음(`SplitPane` 그대로) (d) 힌트는 필드 아래.
  - **M-13 잔여분 반영**: `src/main/index.ts` 기본 창 폭 900→**1100px**(높이 760 유지).
  - **Playwright 스크린샷으로 발견·수정한 실측 버그 둘**: ① 처음 flex-basis(키워드 200px/작성자 160px/해시 160px, 합 520px)가 1100px 창의 기본 50:50 분할(필터 그룹 실측 약 534px, 안쪽 여백·간격을 빼면 약 490px)에서도 이미 줄바꿈되는 걸 발견했다 — 브라우저의 `flex-wrap` 줄바꿈 판정이 `flex-shrink` 적용 **전** `flex-basis` 합으로 이뤄져 `min-width`만으로는 못 막는다는 걸 실측으로 확인, 140px/110px/110px(합 360px)로 줄여 해결했다(`.query-filter-group__field`/`--keyword`). ② `.commit-query-bar__groups`(SplitPane 래퍼)도 RT-47이 `.collapsible-section`에서 겪은 것과 같은 유형의 버그 — fill이 아닌 컨텍스트(BranchSearchBar는 app-shell의 평범한 flex 자식)에서 `.split-pane`의 기본 `height:100%`가 부정확한(auto) 조상 높이에 걸려 크기가 뒤틀릴 수 있어, `height:auto`로 되돌렸다.
  - 검증: `npm test`(161개, 신규 6개는 RT-48의 `parseKeywordText`)·`typecheck`·`lint`·`build`·`test:e2e`(19개, 신규 `query-filter-group.spec.ts` 4건은 RT-48/49 공용) 전부 통과. Playwright 임시 스크린샷(기본 상태·키워드 포커스+힌트·파일명 모드 경고·좁은 창 가로 스크롤)으로 실제 렌더링을 육안 확인한 뒤 삭제(RT-41 이후 관례 — 커밋 대상 아님).
  - **후속 수정 둘(M-45, RT-50 이후 2026-09-23, 사용자가 직접 발견해 요청)**: (1) 세 필드 사이 간격이 달라 보이던 버그 — 작성자/해시가 `<label>`이라 전역 `label{align-items:center}`가 새어(`gap` 값 자체는 처음부터 12px로 동일) 그 둘만 내용이 중앙 정렬·축소됐던 것, `.query-filter-group__field{align-items:stretch}` 명시로 수정. (2) 검색 조건(왼쪽)·필터(오른쪽) 패널 높이 불일치 — `input[type=date]` 브라우저 기본 폭(~158px)×2 때문에 "조회 기간" 행이 줄바꿈됐던 것. 비율만 옮기는 방향과 오른쪽만 줄이는 방향을 차례로 실측해봤으나 각각 78px·45px가 부족해 불가능함을 확인(AskUserQuestion으로 매번 확인 후 다음 방향 시도) → 날짜 입력창(158→140px, 122px 이하에서는 일자가 잘림을 스크린샷으로 확인)과 오른쪽 필드 폭(110→68px, 키워드는 헤더 라디오 때문에 150px 유지)을 함께 줄이고 `defaultRatio`를 0.5→0.67로 옮겨 해결 — 기본 창에서 양쪽 다 줄바꿈 없이 77px vs 79px(2.2px 차이, 줄바꿈이 아예 없는 넓은 창에서도 나는 반올림 오차와 동일)로 수렴했다. M-42(a)의 "기본 비율 50:50" 결정을 대체한다 — 상세는 §7 M-45. 검증: `npm test`(238개)·`typecheck`·`lint`·`build`·`test:e2e`(24개) 전부 통과, Playwright 임시 스크린샷(날짜 값 잘림 여부·좌우 높이)으로 육안 확인 후 삭제.
- [x] **RT-50 (S8)** `main.css` 분할(컴포넌트별 CSS), `WorkArea` 채움 규칙(`.fill`)을 공용 규칙으로 — **구현 완료(2026-09-23)**. 착수 전 M-38(6)("간격·타이포 토큰화"가 RT-50 범위인지)이 유일한 결정 대기 항목이라 AskUserQuestion으로 확인 — **RT-50 스펙 그대로만**(CSS 분할 + `.fill`/`.fill-scroll`) 진행하기로 확정, 토큰화는 M-38의 나머지 미결 항목과 함께 후속으로 남겼다. `assets/main.css`(1265줄)를 `assets/components/`(`fill.css` + 컴포넌트/컴포넌트-묶음별 16개 — repositoryPanel·footerActionBar·commitQueryBar·commitListPanel·previewSummary·workArea·splitPane·deployFilesPanel·filePane·filterPattern·popup·addFilesPopup·panel·chip·collapsibleSection·treeList, 전역 primitive는 `shell.css`)로 분할, `main.css`는 `@import`만 남았다(`fill.css`를 가장 먼저 import해 컴포넌트별 규칙이 같은 속성을 재정의(`.commit-query-bar__groups{height:auto}` 등)할 때 뒤에서 이기게 했다). `.fill{height:100%;min-height:0}`·`.fill-scroll{flex:1;min-height:0}` 신설 후 기존에 컴포넌트마다 따로 적던 동일 패턴(`.work-area`·`.vertical-main-split`·`.split-pane`·`.commit-list-panel`+`__body`·`.deployment-preview-panel`·`.deploy-files-panel`+`__split`·`.file-pane`·`.file-list__scroll`+`__body`·`.panel-frame__body`·`.collapsible-section--fill`·`.add-files-popup__tree`)를 유틸리티 클래스로 교체(SplitPane.tsx는 모든 인스턴스에 `fill`을 기본으로 얹고, Panel.tsx의 PanelBody는 `fill-scroll`을 기본으로 얹어 FilePane 등 모든 소비자에 자동 전파) — 계산되는 최종 스타일은 교체 전과 동일(같은 속성·같은 값을 다른 selector로 옮겼을 뿐이라 커스케이드 순서만 맞으면 결과가 같다). 부수적으로 더 이상 어느 컴포넌트도 참조하지 않던 죽은 규칙(`.file-list-column__search`, RT-41 이후 leftover) 삭제. 검증: `npm test`(238개)·`typecheck`·`lint`·`build`(vite가 `@import` 체인을 문제없이 단일 CSS로 번들)·`test:e2e`(24개, 기존 스펙 그대로 통과) 전부 통과. RT-50 자체 수용 기준(작업 영역 높이를 줄여도 자식이 밀려나지 않고 목록 내부에서만 스크롤)은 임시 Playwright 스크립트로 창을 900×420까지 줄여 헤더 4곳(저장소 바·조회 조건·커밋 목록 헤더·footer)이 전부 보이고 `.commit-list-panel__body`가 `.commit-list-panel` 경계를 넘지 않는 것을 스크린샷+bounding box로 확인 후 삭제(RT-41 이후 관례 — 커밋 대상 아님). **이걸로 P4(RT-40~50) 완료, P5(RT-60~63)로 넘어간다.**

### P5 — 문서·정리

- [x] **RT-60** 문서 동기화(§6) — REQUIREDMENT / UI_UX_SPEC / DETAILED_DESIGN / RISK_ISSUES(§7.5 와이어프레임) / ARCHITECTURE / HANDOFF — **완료(2026-09-25)**. 사용자 요청("RT-60 문서 동기화 진행해")으로 착수, §6 체크리스트를 기준 삼되 이후 결정(특히 REQ-025는 §6이 "폐기/축소"로 적어뒀지만 실제로는 B안으로 부활한 것 등)으로 덮어써진 부분은 최신 M-x 로그·실제 코드와 대조해 바로잡으며 진행. REQUIREDMENT.md(REQ-003/009~026 다수 정정, REQ-026 신규, §8/§9 와이어프레임 재작성), UI_UX_SPEC.md(§1·§2.3·§2.5~2.8·§3·§4·§5 재작성 — 옛 DeployFilesPanel/FileListColumn 구조를 IncludedFilesPane/ExtractTargetsPane/TreeList/팝업 시스템으로), DETAILED_DESIGN.md(§2·§4.3·§8·§9·§17 정정 + §18 신규, §12/§13/§16은 "역사적 기록" 배너 추가), RISK_ISSUES.md(결정 이력 #62~69 추가, §7.5는 REQUIREDMENT.md §8로 이관, §8 백로그 5건 중 3건 해소·2건 부분 해소로 갱신), ARCHITECTURE.md(§3 IPC 계층 구조화 반영, §4.1/4.6/4.8 정정, §4.9 신설, §2.2 모듈 배치 기준 추가), README.md(파일 추출 기준 8·11번 정정, 12번 신규), PRD.md(REQ-010/011 정정) — PRD.md/README.md는 §6 표엔 있었지만 "현행 기준: v0.6.0" 배너가 없던 문서라 배너는 추가하지 않고 본문 내용만 갱신. DOCUMENT_CHECKLIST.md·PHASE_PLAN.md는 §6 결정대로 변경 없음. 각 문서 상단 배너를 "v0.6.0"→"v0.7.0"으로 갱신. HANDOFF.md는 동결하지 않음(RT-61/62가 아직 남아 P5 전체가 끝나지 않음 — §6의 "전부 끝나면 동결"은 이 문서(REFACTORING_TASKS.md) 자체에 해당하는 조항이라, RT-61/62까지 마친 뒤에 적용한다)
- [x] **RT-61 (L4)** 루트의 `*.html` 3개(ambiguity-explainer, core-scenario-diagram, ui-wireframe)를 `docs/`로 이동 (이 문서와 목업은 `docs/refactoring/`으로 이동 완료) — **완료(2026-09-25)**. `git mv`로 이동(세 파일 다 다른 파일을 상대 경로로 참조하지 않는 독립 HTML이라 내부 링크 깨짐 없음), ARCHITECTURE.md(기준 문서 표기 2곳)·UI_UX_SPEC.md(§0 시각 자료 참조 1곳)의 경로만 `docs/` 접두사로 갱신
- [ ] **RT-62 (L5)** untracked 파일 정리(~~`resources/icon 복사본.png`~~ 삭제 완료 — 앱 아이콘 교체 작업 중 2026-09-24, 아래 참고, `.gitignore`에 vim 스왑 추가는 아직)
- [x] **RT-63** 릴리스: P3까지는 v0.6.0과 동작 동일 → 리팩토링 완료 후 별도 버전(예: v0.7.0) 결정(M-6) — **v0.7.0으로 릴리스(2026-09-24)**. 사용자 요청("버전 갱신하고 릴리즈 올리자")으로 RT-60·RT-61·RT-62(vim 스왑) 완료 전에 먼저 진행하기로 확정 — 셋 다 문서·저장소 정리용이라 배포되는 앱 동작에는 영향이 없어, "P5 순서대로"보다 "지금 릴리스"를 우선했다. 이번 릴리스에 담긴 것: M-45~M-58(REQ-016 폐기, B안 검색 부활, 패턴 팝업 이동, 여러 UI 조정, `.DS_Store` 버그 수정, "전체 선택" 위치 이동) + 새 앱 아이콘(goraeng 캐릭터, nearest-neighbor 업스케일 후 LANCZOS 다운샘플로 계단현상 없이 생성). `npm version 0.7.0 --no-git-tag-version`으로 `package.json`/`package-lock.json` 갱신, 태그 전 `typecheck`·`lint`·`npm test`(235개)·`npm run build`·`npx playwright test`(전체 23개) 전부 통과 재확인

### 5.1 P4 작업 상세 명세

표기: **동작**(사용자에게 보이는 규칙), **상태·데이터**, **수용 기준**(테스트로 확인할 것). "결정 대기"는 §7 미결 사항 번호. 결정 근거는 §3(U-#).

#### RT-40 / RT-15 / RT-54 — primitives

- **Panel / PanelHeader / PanelBody**: 테두리 + 헤더 + 스크롤 본문. 본문은 `min-height: 0`, 넘치면 **본문 내부만** 스크롤.
- **PanelState** `kind`: `empty`("커밋을 선택하세요") · `loading`("계산 중...") · `stale`("선택이 변경되었습니다 — Preview를 눌러 계산하세요") · `error`("계산 실패: <메시지>") · `na`("이 저장소에는 적용할 수 없습니다 (<사유>)"). **패널 본문 슬롯에만** 들어가며 패널 자체를 교체·언마운트하지 않는다.
- **Chip**: `[라벨 버튼][× 버튼]` 두 버튼 분리(HTML 중첩 금지). 상태 `on`/`off`(off = 취소선+흐림), 변형 `exclude`(붉은 배경)·`include`(파랑)·`manual`(녹색), 배지·보조 텍스트 슬롯, 툴팁 슬롯.
- **TriStateCheckbox**: `checked` + `indeterminate`(DOM 속성 설정). 커밋 목록·미선택 변경 파일 목록이 공용.
- **CollapsibleSection**: props `title`, `summary`, `collapsed`, `onToggle`. **구조 규칙(사용자 결정 2026-09-21): 제목·접기 버튼이 있는 헤더 행은 접히는 본문 박스의 밖(위)에 놓는다** — 헤더 행 = 접히지 않는 얇은 스트립, 본문 = 그 아래에서 접히는 영역. 헤더를 본문 박스 안에 감싸면(조회 조건이 그랬음) 접기 버튼이 그 영역의 일부처럼 보이고 커밋·배포 영역과 모양이 달라진다. 헤더 우측 끝에 `▴ 접기`/`▾ 펼치기` 버튼(`aria-expanded`), 접힌 상태에서는 헤더 스트립만 남고 요약이 보임(테두리 상자 없음). **본문은 unmount하지 않고 숨긴다**(입력 중인 값 보존). 숨김/표시 때 `section:hide`/`section:show` 발행.
- **Popup** (RT-15·54): 기본 크기 **720×480px**, 폭 `min(720px, 94%)`, 높이 `min(480px, 부모 높이 − 20px)`(부모 = `PopupHost` 앵커). 반투명 백드롭. 닫기: 헤더 `×`, 백드롭 클릭, **Esc**. 열릴 때 포커스 이동(첫 입력 또는 첫 버튼), 열려 있는 동안 **포커스 트랩**, 닫히면 트리거로 포커스 복귀. 내용이 넘치면 팝업 내부만 스크롤. 부모가 낮아지면(세로 분할 최소 높이) 헤더·`×`가 잘리지 않도록 클램프.
- **수용 기준**: 부모 높이 140px에서도 팝업 `×`가 보임 · Esc/백드롭/`×`로 닫힘 · Tab이 팝업 밖으로 나가지 않음 · 접힌 섹션의 입력값이 펼쳐도 유지 · `PanelState` 전환에서 패널 DOM이 유지됨.

#### RT-17 — 분석 요청 경쟁 상태 방지 (R4·R5, P1)

(P1 작업이지만 P4 UI 명세와 맞물려 여기에 함께 기술.)

- **요청 번호 가드**: Preview(및 뒤따르는 HEAD 트리 조회·의존성 분석) 한 번을 하나의 분석 요청으로 보고 단조 증가하는 `analysisRequestId`를 붙인다. 시작 시 `id = ++counter; latest = id`. **모든 단계의 응답·실패 처리에서 `id === latest`이고 `selectionMatches`일 때만 상태를 반영**하고, 그렇지 않으면 결과를 버린다. `analyzing`·`dependencyAnalyzing` 플래그도 **최신 요청만 켜고 끈다**(이전 요청이 끝나며 플래그를 끄는 일이 없어야 함). 커밋 조회의 요청 번호 가드(RT-11)와 같은 유틸을 공유한다.
- **Preview 버튼**: **현재 선택에 대한 분석이 진행 중(`analyzing` 또는 `dependencyAnalyzing`)이면 비활성화**하고 툴팁 "분석 중입니다 — 완료 후 다시 실행할 수 있습니다". 분석 중 커밋 선택을 바꾸면 그 요청은 무효(stale)가 되어 버튼이 다시 활성화되고, 새 Preview는 이전 요청을 무효화한다. `runPreview()`도 같은 조건이면 무시(이중 방어).
- **Export**: **`analyzing`(Preview 계산 중)과 `dependencyAnalyzing`(의존성 확인 중) 동안 Export 비활성화**(사용자 결정 2026-09-21, 확인창 대안은 채택하지 않음). ExportBar 상태 줄에 "Preview 계산 중입니다 — 완료 후 Export할 수 있습니다." / "의존성 확인 중입니다 — 완료 후 Export할 수 있습니다." 표시. 의존성 분석이 **실패하거나 적용 불가**로 끝나면 분석 종료로 보고 Export를 다시 활성화한다. 표시 우선순위는 RT-56의 경로 사유(미선택 → 저장소와 겹침 → 비어 있지 않음) **다음**이다 — 자동으로 풀리는 일시적 사유를 마지막에 두어 사용자가 조치할 수 있는 사유를 먼저 보이게 한다.
- **Reload**(U-15): 진행 중인 분석 요청을 **무효화**(최신 번호를 새로 발급하거나 `latest = null`)해 나중에 도착하는 응답이 초기화된 상태를 되살리지 못하게 한다.
- **분석 중에도 허용되는 조작**: 패턴 추가·토글·삭제, 파일 이동(체크·×), 파일 추가 팝업 열기와 수동 추가, 접기/펼치기. 이들은 분석 결과를 쓰지 않으므로 충돌하지 않는다. 팝업의 HEAD 트리는 "의존성 확인 중" 안내 한 줄과 함께 사용할 수 있고, 분석이 끝나면 붉은 표시와 기본 펼침이 그때 계산된다(RT-52).
- **누락된 의존성 중복 제거(RT-52와 연결)**: 분석 결과를 반영할 때와 화면 표시를 계산할 때 **이미 Extract 목록(변경 파일·수동 추가)에 있는 경로는 누락된 의존성에서 제외**한다. 배지 `누락 N`, `보이는 항목 모두 추가 (N)`, 팝업 트리의 붉은 표시가 **같은 집합**에서 계산돼야 한다. 순수 함수 `visibleMissingDependencies(missing, extractPaths)`.
- **알려진 한계(명세에 명시)**: 의존성 분석의 입력은 **Preview 시점의 변경 파일 목록**이다. 분석 중이거나 이후에 **수동 추가한 파일의 의존성은 분석하지 않으며**, Extract에서 뺀 파일의 의존성 추천도 다시 계산하지 않는다(REQ-013은 Preview 결과 기준의 일회성 분석). 필요해지면 별도 요구로 논의.
- **수용 기준(vitest, `window.api` 목킹)**: 같은 선택으로 Preview 2회 → 첫 응답이 늦게 도착해도 무시되고 Extract 상태·`manuallyAddedPaths`가 유지됨 · 이전 요청이 끝나도 `dependencyAnalyzing`이 꺼지지 않음 · 분석 중 Preview 버튼 비활성, 선택을 바꾸면 다시 활성 · **분석·의존성 확인 중 Export 비활성 + 안내 문구, 실패·적용 불가 시 활성화** · Reload 중 도착한 응답이 상태를 되살리지 못함 · 이미 Extract에 있는 경로는 누락된 의존성 개수·표시에서 제외.

#### RT-43 — `PopupHost` / `openPopup`

- **소유자**: `WorkArea`(`PreviewSummary`와 `DeployFilesWorkspace`의 공통 부모). 값: `'manual'`(→ `AddFilesPopup`) · `'patterns'` · `'deleted'` · `'warnings'` · `null`. **하나의 값이므로 동시에 두 팝업이 열릴 수 없다**(키보드로도).
- 열기 액션은 트리거 컴포넌트가 이벤트로 올리고 `WorkArea`가 처리. 다른 팝업이 열려 있으면 다른 트리거는 백드롭이 가려 도달 불가(키보드도 트랩으로 차단).
- **닫힘 조건**: 팝업 닫기 동작, **Preview 재실행**, **Reload**, 열려 있는 팝업이 속한 섹션을 접을 때(결정 대기 M-7).
- 앵커: `WorkArea`가 `position: relative`, 팝업은 그 영역의 정중앙.
- **수용 기준**: `'manual'` 상태에서 `[보기]`가 동작하지 않음 · Esc로 닫힘 · Reload 시 닫힘.

#### RT-41 / RT-42 — `FilePane`, `IncludedFilesPane`, `DeployFilesWorkspace`

- **FilePane**: 슬롯 `title`, `toolbar`, `body`. 좌측 전용 prop 없음. 안에 `TreeList`/`FileList`를 담는다.
- **DeployFilesWorkspace**: 조립만 담당(제목 없음). 좌 `IncludedFilesPane` | 우 `ExtractTargetsPane`, `SplitPane` 2분할(기본 50:50, 최소 폭 각 260px, 드래그 리사이즈, 비율 `localStorage` 영속).
- **stale 등 분석 상태**에서도 두 패널과 그 안의 입력값(패턴 입력 중 문자열)은 **언마운트하지 않고** 본문에만 `PanelState`를 넣는다(U1).
- **컬럼 리사이즈 핸들과 헤더 글자 `Local Path` 삭제(사용자 결정 2026-09-21)**: Server Path 열이 없어진 뒤 컬럼이 하나뿐이고 트리 리프에는 파일명이 보이므로 핸들·`Local Path` 글자는 의미가 없다. **헤더 행은 "전체 선택" 체크박스만 남긴다**(텍스트 라벨 없이 툴팁 "화면에 보이는 변경 파일을 모두 Extract 대상으로 이동", REQ-020). `useColumnResize`·컬럼 폭 저장 키는 삭제하고 남아 있는 옛 `localStorage` 값은 무시한다. 다만 **컬럼 실측 폭 계산(`useMeasuredColumnWidth`)은 유지** — 300개 초과 가상 스크롤 행은 스크롤 영역 폭에 기여하지 않아 가로 스크롤 폭을 미리 재야 한다(들여쓰기 깊이×14px 포함). 가로 스크롤 자체를 없애고 말줄임으로 바꾸는 안은 별도 논의(이전 결정 "텍스트를 자르지 않는다"를 뒤집음). (구) 파일 목록 컬럼 실측 폭·리사이즈 핸들(현재 `FileListColumn`의 기능)
- **수용 기준**: stale로 바뀌어도 `FilterPatternBar` 입력 중 값·펼침 상태 유지 · 미선택 변경 파일/Extract 두 패널의 세로 스크롤이 서로 독립.

#### RT-44 — Delete List 영역·`DeployFilesHeader` 삭제, `PreviewSummary` 재구성

- **삭제**: `DeleteListPanel`, `DeployFilesPanel`의 제목 줄·`warning-banner` 2개. `Deploy Files (HEAD Latest Version)` 제목은 없애고 "HEAD 최신 버전 기준" 안내는 미선택 변경 파일 패널 제목 툴팁으로("선택한 커밋이 아니라 기준 Branch의 HEAD 최신 버전 파일을 추출합니다(DR-003)"). 상시 표기 여부는 결정 대기.
- **PreviewSummary**: 분석 결과가 있을 때 `Files: N`, `Added: N`, `Modified: N` 표시 + 버튼 두 개.
  - `Deleted: N ▸` — 클릭 시 `'deleted'` 팝업. **N=0이면 비활성.**
  - `⚠ HEAD에 없음: N ▸` — **N>0일 때만 표시**(경고 색), 클릭 시 `'warnings'` 팝업. (기존 "N개 파일이 HEAD에 없어 제외되었습니다" 배너 대체, DR-009.)
  - `empty`/`stale`/`loading`/`error` 단계에서는 상태 문구만 보이고 버튼은 없다. ("Extract: N" 줄은 추가하지 않음 — 중복.)
- **`'deleted'` 팝업**: 제목 `삭제된 파일 (N개)`, 본문은 **읽기 전용 트리**(RT-53), 각 파일은 서버 경로(결정 대기 M-12), 하단 설명: "`extract-list.txt`의 삭제 대상 섹션에 기록되는 경로입니다."
- **`'warnings'` 팝업**: 제목 `HEAD에 없어 제외된 파일 (N개)`, 읽기 전용 트리, 하단 설명: "선택한 커밋에서 변경됐지만 기준 Branch의 HEAD에는 존재하지 않아 배포 대상에서 제외된 파일입니다(DR-009)."
- 파싱 실패 안내(REQ-013)는 `AddFilesPopup` 상단 분석 상태 안내 줄(RT-52).
- **수용 기준**: 삭제 0건이면 `Deleted` 버튼 비활성 · 경고 0건이면 경고 버튼 없음 · stale에서 두 버튼 없음 · 두 팝업 내용이 트리로 표시.

#### RT-45 — 미선택 변경 파일 목록(포함된 파일) 정리

- **삭제**: 상태 Filter(`all|added|modified`) UI와 `deployFilesFilter` 상태·`setDeployFilesFilter`, 좌측 파일명 검색 입력과 `deployFilesSearchTerm`(REQ-025 폐기; 팝업의 검색 입력은 유지 — 결정 대기 M-1).
- `added` 파일은 **글자색 녹색**, `modified`는 기본색. 색만으로 구분하지 않도록 마커 병행 여부는 결정 대기 M-2. 수동 추가 파일은 status가 항상 added(DR-019)이므로 녹색.
- **제목**: `포함된 파일 (남은 N개/전체 M개)`. 제목 줄 **오른쪽 끝에 `+ 파일 추가` 버튼**(`AddFileButton`, 같은 줄), 그 안에 `누락 N` 배지(RT-52). 좁은 폭 줄바꿈 정책은 결정 대기 M-11.
- **수용 기준**: 좌측에 Filter·검색 UI가 없음 · added/modified 색 구분 · `+ 파일 추가`가 제목과 같은 줄 우측.

#### RT-51 — Extract 대상 목록

- **모델**: 변경 파일(왼쪽 `포함된 파일`)의 행을 체크하면 그 파일이 **Extract 대상 목록으로 이동**하고 미선택 변경 파일 목록에서 사라진다. Extract 목록에서 파일명 우측 `×`를 누르면 **원래 출처 목록으로 복귀**(체크 해제 상태). 출처는 세 가지:
  | 출처 | 복귀 위치 | `×` 툴팁 |
  |---|---|---|
  | 변경 파일(`변경`) | 미선택 변경 파일(`포함된 파일`) | "원래 목록으로 되돌림" |
  | 누락된 의존성(종류 배지 `Impl`/`I`) | `AddFilesPopup`의 HEAD 트리 | "누락된 의존성 목록(파일 추가 팝업)으로 되돌림" |
  | 수동 추가(`수동`) | 없음 → **철회(삭제)** | "수동 추가 철회" |
- **초기 상태**(Preview 직후): 변경 파일은 **전체 Extract로 이동**(현행 기본 동작 유지 — 결정 대기 M-14), 누락된 의존성은 미선택, 수동 추가 없음.
- **미선택 변경 파일 목록**: 컬럼 헤더 체크박스 = **화면에 보이는 변경 파일을 전부 Extract로 이동**(패턴에 숨겨진 파일은 제외). 빈 상태 문구: 0개 → "미선택 변경 파일이 없습니다 — 전부 Extract 대상으로 이동했습니다", 파일은 있으나 패턴에 모두 숨김 → "패턴에 걸려 모든 변경 파일이 숨겨졌습니다".
- **Extract 목록**: 행 = `파일명 [Impl|I] [복사] ×  [출처 배지]` (+ 패턴 제외 태그). **출처가 누락된 의존성인 행에는 파일명 바로 뒤에 종류 배지(`Impl` 구현체 / `I` 인터페이스)만 붙이고, `의존성`·`구현체`·`인터페이스` 한글 출처 배지·병기는 표시하지 않는다**(사용자 결정 2026-09-21; 접근성용 툴팁·`aria-label`에는 종류 이름을 유지)(파일 추가 팝업 HEAD 트리와 같은 표기, 색은 붉은색이 아니라 중립 회색 — 이미 추가된 항목이라 주의를 끌 필요가 없음). `[복사]`(경로 복사, RT-53)와 `×`(되돌리기)의 **배치·모양 구분 규칙은 RT-53 명세**를 따른다. 제목 `Extract 대상 (N개 · 패턴 제외 K개)`(K=0이면 생략), 제목 줄 오른쪽 `모두 되돌리기`(0개면 비활성; 전체를 원래 목록으로, 수동은 철회). 빈 상태: "Extract 대상이 없습니다 — 왼쪽 목록에서 체크하세요". added는 녹색.
- **활성 파일 패턴에 걸린 Extract 항목**: 숨기지 않고 **흐림 + 취소선 + `패턴 제외` 태그**로 표시하고 Export 대상에서 뺀다(조용한 누락 방지). 툴팁 "활성 파일 패턴에 걸려 Export되지 않음".
- **상태 모델**: `deployFiles[].included`(불리언)를 "소속 목록" 의미로 재정의하거나 `extractIds: Set<string>` 별도 보관(구현 시 선택). `[Preview]` 재실행 시 수동 추가·의존성 이동은 초기화(REQ-013/DR-019와 동일 생명주기).
- **Export 대상 계산**(`services/exportPlan`, RT-33): `Extract 목록 − 활성 패턴 해당 항목`.
- **수용 기준**: 체크→이동·×→복귀 왕복에서 개수 보존 · 의존성 ×가 파일 추가 팝업 HEAD 트리(붉은색)로 복귀 · 수동 × 철회 · 패턴 활성화 시 Extract 행이 흐려지고 Export 계산에서 제외 · `모두 되돌리기` 후 Extract 0.

#### RT-52 — `AddFilesPopup` (파일 추가 + 누락된 의존성, 단일 HEAD 트리 화면)

- **구성(위 → 아래, 탭 없음)**: ① 툴바: 검색 입력 + `보이는 항목 모두 추가 (N)` 버튼 ② 분석 상태 안내 한 줄(해당할 때만) ③ **HEAD 트리** ④ 수동 추가 칩 이력.
- **분석 상태 안내(기존 동작 이전)**: 파싱 실패(`⚠ N개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다`, REQ-013) · 의존성 확인 중("의존성 확인 중...") · 적용 불가("이 저장소에는 적용할 수 없습니다 (<사유>)")를 한 줄로 표시한다. **트리는 계속 사용 가능**하고 이 경우 붉은 표시만 없다. Preview 결과가 없거나 `headTreeFiles`를 받지 못한 경우는 트리 자리에 `PanelState`("Preview 후 사용할 수 있습니다" / "HEAD 파일 목록을 불러오지 못했습니다").
- **HEAD 트리**: 선택된 Branch의 HEAD 파일 전체(`git ls-tree -r`, Preview 때 받아 둔 `headTreeFiles`). 이미 변경 파일 목록(전체)·Extract·수동 추가에 있는 경로는 트리에서 제외하고 폴더 개수는 **추가 가능한 파일 수**를 센다(결정 대기 M-36).
  - **누락된 의존성 표시(U-20)**: **붉은색 글자** + 파일명 오른쪽 **배지 `Impl`(구현체) / `I`(인터페이스)**(툴팁 "구현체"/"인터페이스"). 색만으로 구분하지 않는다.
  - **탐색 모드(검색어 없음) 기본 펼침**: **경로 세그먼트 기준 1단계 폴더 펼침**(`src`=1, `main`=2 → 2단계까지 보이고 2단계 폴더는 접힘; compact 병합은 3단계부터, RT-53) **∪ 누락된 의존성이 하나라도 들어 있는 폴더의 모든 조상 폴더**(사용자 채택). 예: `src/main/java/com/acme/repo/FooImpl.java`가 누락된 의존성이면 `src`·`main`·`java/com/acme/repo`가 처음부터 펼쳐져 붉은 파일이 보인다. compact로 합쳐진 체인도 그 아래에 누락된 의존성이 있으면 펼친 상태. **사용자가 직접 접거나 펼친 상태가 우선**하며, Preview를 다시 실행해 결과가 바뀌면 기본 펼침을 다시 계산한다.
  - **결과 모드(검색어 있음)**: 부분 일치(대소문자 무관, 와일드카드 규칙 재사용)에 맞는 경로만 결과 트리로 **전부 펼쳐** 표시(최대 50개, 초과 시 "상위 50개만 표시합니다 — 검색어를 더 구체적으로 입력하세요"). 붉은색·배지는 유지. 검색어를 지우면 탐색 모드로 돌아가며 탐색 모드의 펼침 상태는 유지(탐색/결과는 펼침 `id`를 분리).
  - **행 동작**: 파일 행마다 `추가`(→ Extract로 이동). 폴더 행에는 추가 버튼을 두지 않는다(대량 추가 실수 방지 — M-36). 경로 복사 버튼(U-18) 제공.
- **`보이는 항목 모두 추가 (N)` (누락된 의존성 한정, 채택)**: 대상은 **누락된 의존성뿐**이다(일반 파일은 절대 포함하지 않음). "보이는" = 현재 검색어 필터를 통과한, 아직 추가하지 않은 누락된 의존성 **전부**(접힌 폴더 안에 있어도 포함 — 접힘은 표시 상태일 뿐). N은 그 개수를 표시해 접힌 폴더 안 항목까지 추가되는 놀람을 줄인다. 0이면 비활성. 툴팁 "화면에 보이는 누락된 의존성을 모두 Extract 대상에 추가".
- **`+ 파일 추가` 버튼 배지**: `누락 N`(N>0이고 분석 완료일 때만, **50 초과면 붉은색 + 툴팁 "50개를 초과했습니다"** — REQ-020 이월). 탭 제거로 탭 배지는 없다.
- 추가하면 즉시 Extract 대상으로 들어가고 트리에서 사라진다. Extract 목록의 `×`로 되돌린 누락된 의존성은 **트리에 다시 붉은색으로** 나타난다. 팝업은 열린 채 목록만 갱신.
- **중복 제거·한계(RT-17)**: 이미 Extract(변경 파일·수동 추가)에 있는 경로는 누락된 의존성 표시·개수(`누락 N`, `보이는 항목 모두 추가 (N)`)에서 제외한다. 수동 추가한 파일의 의존성은 분석하지 않는다(알려진 한계).
- **성능**: HEAD 파일이 수천~수만 개일 수 있으므로 트리 구성은 Branch·Preview 결과당 **한 번만 계산(메모이즈)**, 화면에는 **펼쳐진 행만 평탄화해 가상 스크롤**(300행 초과 시, RT-53). 검색은 문자열 필터로 결과 트리만 새로 만든다. "누락된 의존성의 조상 폴더" 집합도 Preview 결과당 한 번 계산.
- 추가한 수동 파일은 칩 이력(`파일명 ×`, 클릭 시 철회)으로 팝업 하단에 유지.
- **수용 기준**: 팝업에 탭이 없고 하나의 HEAD 트리만 있음 · 누락된 의존성 파일이 붉은 글자 + `Impl`/`I` 배지로 표시 · **기본 펼침에 누락된 의존성의 모든 조상 폴더가 포함**(2단계 밖 깊은 폴더 안의 누락 파일도 처음부터 보임) · 경로 세그먼트 기준 1단계(`src`)가 펼쳐져 2단계(`main`)까지 보이고 `main`은 접힘(누락된 의존성이 그 아래에 없을 때) · `보이는 항목 모두 추가 (N)`가 **누락된 의존성만** 추가(일반 파일 미추가)하고 검색 필터를 적용, 접힌 폴더 안 항목 포함, N 표시, 0이면 비활성 · 추가한 파일이 트리에서 사라지고 Extract에 나타남 · Extract ×로 복귀하면 다시 붉은색으로 나타남 · 분석 상태별 안내 한 줄과 트리 사용 가능 여부 · 검색어 입력 시 결과 트리 전부 펼침 + 붉은색 유지, 지우면 탐색 트리(펼침 상태 포함) 복귀 · 이미 변경 파일·Extract에 있는 파일은 트리에 없음 · 버튼 배지 `누락 N`과 50 초과 붉은색 · HEAD 파일 10,000개에서도 열기·펼치기가 지연 없이 동작.

#### RT-53 — `TreeList` (모든 파일 목록의 트리 표시)

- **적용 5곳**: 미선택 변경 파일, Extract, 팝업의 HEAD 트리(탐색·검색 결과), `'deleted'` 팝업, `'warnings'` 팝업. 목록마다 고유 `id`로 펼침 상태 관리.
- **트리 규칙**: 폴더 먼저, 이름순(`localeCompare`). **compact**: 하위가 폴더 하나뿐이고 자기 파일이 없는 체인은 한 줄로 합침(`src/main/java/com/acme`). 리프는 **파일명만** 표시하고 전체 경로는 툴팁. 폴더 행: `▾/▸` 토글 + 이름 + 하위 파일 개수. 들여쓰기 깊이당 14px, 리프는 +18px.
- **펼침**: 기본은 전부 펼침. **`defaultExpandDepth` prop(기본 `Infinity`)** 으로 목록별 기본 펼침 깊이를 지정할 수 있다(깊이는 **경로 세그먼트 기준**: `src`=1, `main`=2. 탐색 트리는 `compactFromDepth: 3`으로 1~2단계 폴더를 병합하지 않고, 다른 목록은 기본값 1로 전 구간 compact) — 직접 검색 탭의 탐색 트리는 **`1`(폴더 1단계 펼침 → 항목은 2단계까지 보임)**, 결과 트리·나머지 목록은 `Infinity`. 사용자가 직접 토글한 상태는 기본 깊이보다 우선하며 목록 `id`별로 유지. `▾/▸` 또는 폴더명 클릭으로 토글, 상태는 로컬(저장 안 함, 결정 대기 M-20). 다른 조작(이동·복귀)으로 목록이 바뀌어도 남은 폴더의 펼침 상태 유지.
- **폴더 단위 동작(미선택 변경 파일·Extract만)**: 미선택 변경 파일 폴더 체크박스 = **화면에 보이는 하위 변경 파일 전체를 Extract로 이동**(패턴 숨김분 제외) · Extract 폴더 `×` = 하위 전체를 원래 목록으로 복귀(의존성은 파일 추가 팝업의 HEAD 트리로, 수동은 철회). 팝업 내 트리(의존성·검색·삭제·경고)는 폴더 동작 없이 펼침/접힘만.
- **순수 함수**: `buildTree(items)`, `compressChains(node)`, `flatten(root, openState)` — 입력·출력 모두 순수, vitest 대상(단일 파일, 루트 파일, 체인 병합, 폴더 먼저 정렬, 같은 이름의 다른 폴더, 한글 경로, 접힌 폴더 flatten).
- **가상 스크롤**: 현재 300개 초과 시 `react-window`. 트리는 `flatten`한 **펼쳐진 행 배열**을 가상화(폴더 행도 한 행). 접힘/펼침 시 길이가 바뀜.
- **경로 복사 버튼 (U-18)**
  - **대상**: 5개 목록 모두의 **파일 행과 폴더 행**. `TreeList`의 행 컴포넌트에서 한 번만 구현(`copyable` prop 기본 true, 복사 값 `getCopyPath(item)` 기본 `item.p`).
  - **복사 값**: **저장소 루트 기준 상대경로**, 구분자 `/`(git 형식). 폴더 행은 **화면에 보이는(compact 병합된) 폴더의 전체 경로**(`src/main/java/com/acme`, 끝 구분자 없음). 삭제 목록은 그 행에 **표시되는 경로와 동일한 값**(삭제 대상은 서버 경로, 현재 Mapping은 항등이라 로컬 경로와 같다 — 결정 대기 M-35). 순수 함수 `toRepoRelativePath(p)`: 이미 상대경로인 값은 그대로 두고 구분자를 `/`로 정규화.
  - **표시**: 상시 노출하지 않고 **행에 마우스를 올리거나 키보드 포커스가 있을 때만** 보이는 작은 아이콘 버튼(자리는 미리 확보해 나타날 때 레이아웃이 밀리지 않게 `visibility`로 처리). 대상 크기 최소 20×20px. 툴팁 "경로 복사(저장소 기준 상대경로)", `aria-label="경로 복사: <경로>"`. 행 전체 툴팁(전체 경로)은 유지.
  - **배치**: 파일명 **바로 오른쪽**(간격 4px). **Extract 행**에서는 `×`(되돌리기)가 오른쪽에 항상 보이므로, 복사 버튼과 `×` 사이를 **16px 이상** 띄우고 **모양·색을 확실히 구분**(복사=회색 중립 아이콘, `×`=붉은색). `×`는 확인창 없이 즉시 되돌리는 동작이라 오조작 방지가 핵심. 미선택 변경 파일 행은 체크박스가 왼쪽에 있어 충돌 없음, 폴더 행은 폴더 체크박스/`×`와 같은 규칙.
  - **동작**: 클릭 시 `navigator.clipboard.writeText(경로)`. **리프 행은 `<label>`이라 클릭이 체크 토글로 번질 수 있으므로 반드시 이벤트 전파를 막고 기본 동작을 취소**한다(체크 이동·폴더 펼침/접힘·`×` 되돌리기가 일어나면 안 됨).
  - **피드백**: 성공 → 아이콘이 `✓`로 바뀌고 약 1.5초 후 복원, 툴팁 "복사됨", 보조기술용 `aria-live="polite"` 영역에 "경로를 복사했습니다". **실패 → "복사하지 못했습니다"를 붉은 아이콘·툴팁으로 표시(조용히 무시 금지).** (Export 경로 복사에도 같은 피드백을 적용 — RT-16 U7과 동일 컴포넌트/훅 `useCopyToClipboard` 재사용.)
  - **키보드**: 복사 버튼은 포커스 가능, Enter/Space로 실행.
  - **범위 밖**: "목록 전체 복사", 선택한 여러 행 복사는 이번 범위가 아니다(별도 요구로 논의).
- **수용 기준**: 8개 경로 → 예상 폴더 구조 · 체인이 한 줄로 합쳐짐 · 폴더 체크/× 왕복 후 개수 보존 · 접은 폴더의 행이 flatten에서 빠짐 · **경로 복사: 5개 목록의 리프·폴더 행 모두에 버튼이 있음 · 클립보드 값이 기대 경로(`navigator.clipboard` 목킹, 폴더는 compact 병합 경로) · 복사 클릭이 체크 이동·폴더 접힘·`×` 되돌리기를 일으키지 않음 · 성공(`✓`, 1.5초 후 복원)/실패(오류 표시) 피드백 · Extract 행에서 복사 버튼과 `×`의 간격 ≥ 16px이고 접근성 이름이 서로 다름 · 키보드(Enter/Space) 동작 · 복사 값이 `toRepoRelativePath` 단위 테스트(백슬래시 정규화, 이미 상대경로) 통과.**

#### RT-46 — 파일 패턴 (`FilterPatternBar` + `'patterns'` 팝업)

- **입력 줄**: `패턴: [제외|포함 ▼] [입력창] [+추가]`. **한 번에 여러 패턴 입력(2026-09-21)**: 구분자는 **쉼표(`,`)** 이고 줄바꿈도 구분자로 취급한다(경로·파일명에 쉼표가 없다는 사용자 확인 — 공백은 패턴 안에서 허용). 예: `*.png, *.md, target/**, com.acme.legacy.**`. 각 항목은 앞뒤 공백을 제거하고 **종류를 개별로 자동 판별**하며, 빈 항목(`, ,,`)은 무시하고, **같은 입력 안의 중복은 한 번만** 처리한다. **모드(`제외|포함`)는 입력한 전체에 동일하게 적용**(섞으려면 두 번 입력). 입력창은 한 줄 그대로 두고, **붙여 넣은 여러 줄은 줄바꿈을 쉼표로 바꿔** 넣는다(한 줄 입력창이 줄바꿈을 지우는 문제 방지). Enter와 `[+추가]`는 **입력한 전체를 한 번에 추가**. placeholder `*.png, src/test/**, com.acme.legacy.**`, 툴팁에 "여러 개는 쉼표(,)로 구분" 명시.
- **둘째 줄**: 요약 배지 **`활성 K개`**(K = 활성 상태인 패턴 수; 제외·포함·비활성 개수는 표시하지 않음, 사용자 결정 2026-09-21), **커서를 올리면 툴팁으로 활성 상태인 패턴 목록**을 보여준다 — 첫 줄 `활성 패턴 K개`, 이어서 한 줄에 하나씩 제외는 `− 패턴`, 포함은 `+ 패턴`(비활성 패턴은 나열하지 않음), K=0이면 `활성 패턴 없음`. 배지는 도움말 커서(`cursor: help`)를 쓰고 패턴 추가·토글·삭제 때 즉시 갱신된다. 팝업 제목도 같은 표기(`파일 패턴 (활성 K개)`, 같은 툴팁). `[보기]`(등록 0개면 비활성), 미선택 변경 파일 중 패턴에 숨겨진 파일이 있으면 `· N개 숨김`.
- **해석 오버레이(입력창 바로 아래에 겹쳐 뜨는 작은 안내, 입력에 따라 실시간, 2026-09-21 변경)**: 이전의 "셋째 줄"을 없애고 오버레이로 바꿔 **레이아웃(아래 목록 높이)에 영향을 주지 않는다**(입력을 시작할 때마다 목록이 밀리는 문제 방지). **입력창에 포커스가 있고 입력이 있을 때만 표시**하며 포커스를 잃거나 입력을 비우면 사라진다(`role="status"`, `aria-live="polite"`). **입력이 비어 있을 때의 예시 문구는 삭제**(placeholder `*.png · src/test/** · com.acme.legacy.**`와 중복) — 종류 설명은 입력창 툴팁("파일명: `*.png` · 경로: `src/test/**` · 패키지: `com.acme.legacy.**`(경로로 변환)")이 담당. 입력이 **하나**면 `해석: [종류 배지] <변환된 글롭> · 현재 N개 파일 매치`(N=0이면 경고), **여러 개**면 첫 줄 `N개 패턴 (모두 제외|포함로 추가)` 아래에 항목마다 한 줄씩 `• <입력> → [종류 배지] <변환된 글롭> · 현재 N개 파일 매치`(매치 0건 항목에는 경고; 오버레이는 최대 높이 이후 스크롤, 긴 줄은 줄바꿈)로 표시하며, 패키지처럼 보이는 파일명 패턴이면 "패키지라면 끝에 `.**`를 붙이세요".
- **추가 규칙**: 앞뒤 공백 제거, 빈 입력·빈 항목 무시, **같은 (모드, 패턴)이 이미 있으면 새로 만들지 않고 활성화**. 추가 직후 입력 옆에 **피드백**을 약 3초간 표시(`aria-live="polite"`): `N개 추가됨`, 기존 항목이 있으면 `N개 추가됨 · M개는 이미 있어 활성화`.
- **팝업**(`'patterns'`): 제목 `파일 패턴 (요약)`, **제외 구역**("매치되는 파일을 뺌 (항상 우선)")과 **포함 구역**("활성 포함 패턴이 있으면 그중 하나 이상에 매치되는 파일만 남김")으로 칩 나열, 없으면 "없음". 칩: `− 패턴 [종류 배지] ·N`(제외) / `+ …`(포함), 라벨 클릭 = 활성 토글, `×` = 삭제(확인창 없음, REQ-024). 툴팁: 모드·종류·변환 글롭·현재 매치 수·클릭 동작. 하단 설명: 패키지 표기 `a.b.c.**`는 경로 `**/a/b/c/**`로 변환되어 `.java` 한정이 아님. 칩이 많으면 팝업 내부 스크롤. 등록이 0개가 되면 팝업 자동 닫기.
- **매칭·조합**: §3.1 규칙 그대로(종류 자동 파생, 제외 우선, 활성 포함 패턴이 있으면 그중 하나 이상에 매치, 글롭 `*`/`**`/선행 `**/`).
- **적용 범위**: 미선택 변경 파일 목록(매치 시 숨김) + Extract 목록(매치 시 흐림·Export 제외). 매치 수(·N)는 현재 분석의 **전체 변경 파일 기준**.
- **저장**: `localStorage`(기존 키 호환), `{ pattern, mode, enabled }`. 기존 데이터에 `mode`가 없으면 `'exclude'`로 마이그레이션.
- **수용 기준**: §3.1의 19개 케이스 유닛 테스트 · 입력 중 미리보기가 즉시 갱신 · **쉼표로 구분한 여러 패턴이 한 번에 추가되고 모드가 전체에 적용됨, 같은 입력 안 중복·기존 항목은 새로 만들지 않고 활성화(피드백 문구 확인), 빈 항목만 있으면 아무것도 추가되지 않음, 붙여 넣은 여러 줄이 쉼표로 변환됨** · 중복 추가 시 항목 수 불변 · 제외 우선(같은 파일이 제외·포함 모두에 매치되면 제외).

#### RT-47 — 접기/펼치기 3곳 + `WorkArea` 레이아웃

- **대상**: `CommitQueryBar`(자기 로컬 상태), `CommitWorkspace`·`DeployFilesWorkspace`(상태는 `WorkArea` 소유). **세 영역 모두 같은 구조**: 헤더 스트립(밖) + 접히는 본문. 본문의 테두리는 안쪽 상자가 가진다 — 조회 조건은 검색 조건·필터 두 그룹 상자, 커밋은 목록·요약 두 상자, 배포 대상 파일은 미선택 변경 파일·Extract 두 패널. **영역 전체를 감싸는 바깥 테두리는 두지 않는다**(배포 영역의 이중 테두리 제거). 세 헤더 스트립의 높이·좌측 시작 위치·접기 버튼의 우측 위치는 동일해야 한다.
- **접힌 요약(헤더 한 줄, 넘치면 말줄임)**:
  - 조회 조건: `<브랜치> · <메시지|파일명>["<검색어>"] · <시작>~<종료> · Merge 제외|포함 [· 작성자 필터] [· 해시 필터] [· 메시지 제외 N]`
  - 커밋: `N개 선택됨`
  - 배포 대상 파일: `Extract N개[(패턴 제외 K)] · 미선택 변경 파일 M개 · 누락된 의존성 K개`, 분석 상태에 따라 `선택 없음`/`Preview 필요`/`계산 중`/`계산 실패`.
- **레이아웃 규칙**: `WorkArea`는 grid(행: `CommitWorkspace | 핸들 | DeployFilesWorkspace`). 둘 다 펼침 → 비율(기본 45:55, 최소 위 90px·아래 120px — 현재 앱은 140px, 결정 대기 M-13). 한쪽 접힘 → 접힌 쪽은 헤더 높이(auto), **나머지가 남은 높이 전부** 흡수, 세로 핸들은 접힌 동안 비활성(높이 0). 둘 다 접힘 → 위에 붙임. 자식은 항상 자기 트랙 높이의 100%를 채우고 넘치는 내용은 각 목록 내부에서만 스크롤.
- **이벤트**: 숨김·표시 때 해당 섹션에서 `section:hide`/`section:show`(`detail: { key, name, owner }`, bubbles) 발행. 소비자는 아직 없음(확장 지점).
- **결정 대기**: 접힘 영속(M-7), 접혔을 때 `Preview` 버튼·`Deleted`/경고 개수 노출(M-8).
- **수용 기준**: **세 영역의 헤더가 어떤 테두리 상자 안에도 있지 않고 접히는 본문의 형제일 것 · 세 헤더 높이·좌측 위치·접기 버튼 우측 위치 동일 · 배포 영역에 바깥 테두리 없음(패널 1겹) · 접으면 헤더 스트립만 남음** · 접기 → 본문 숨김 + 요약 표시 + 이벤트 발행 · 한쪽 접으면 다른 쪽이 남은 높이를 채움 · 펼치면 기존 비율 복원 · 접힌 섹션 안의 입력값 유지.

#### RT-48 — 키워드 검색 통합 (`CommitQueryBar`, A안 간단형, U-8)

- **입력**: `CommitQueryBar` 오른쪽 그룹의 **텍스트 영역 하나**(`키워드`, 작성자·해시와 같은 높이). **한 줄에 키워드 하나**(줄바꿈으로 구분). 각 줄의 앞뒤 공백을 제거하고 **빈 줄은 무시**한다. **쉼표는 구분자가 아니다** — 키워드 안의 쉼표·공백·대괄호(`[skip ci]`)는 글자 그대로다.
- **제외**: 줄이 `-`로 시작하면 제외 키워드(`-` 뒤 공백은 제거, `-`만 있는 줄은 무시). 그 외는 포함 키워드. (`\-` 이스케이프·따옴표 규칙은 두지 않는다 — 간단형. `-`로 시작하는 포함 키워드는 지원하지 않음.)
- **일치**: **글자 그대로의 대소문자 무시 부분 일치**(정규식·`*` 와일드카드 아님). **포함 키워드는 하나라도 일치하면 포함(OR)**, **제외 키워드는 하나라도 일치하면 제외(OR)**, 포함과 제외를 함께 쓰면 AND. 제외만 입력하면 그 조건에 해당하는 커밋만 빠진다.
- ~~**검색 대상(메시지 | 파일명)**: 키워드 필드의 **헤더**에 라디오로 둔다(왼쪽 그룹에서 이동). 파일명 모드에서는 키워드가 HEAD 트리 파일명 부분 일치이고 **제외(`-`) 줄은 무시**하며 필드 아래에 "파일명 검색에서는 제외(-) 줄을 쓸 수 없습니다 — 무시됩니다"를 표시(레이아웃을 밀지 않는 작은 안내).~~ **M-49 정정(2026-09-24)**: 검색 대상 라디오·파일명 모드 전부 삭제 — 키워드는 항상 커밋 메시지 대상(REQ-016 폐기). 해석 오버레이는 만들지 않는다(placeholder·툴팁이 대신함).
- **안내**: placeholder "한 줄에 하나 / 앞에 - 를 붙이면 제외 / 예) guarantee / -Revert"를 유지하고, **입력을 시작하면 힌트 툴팁**(RT-49)에 "한 줄에 하나 · 앞에 -를 붙이면 제외 · 글자 그대로 검색(대소문자 무시, *·정규식 아님)"을 표시한다. **파일 패턴 입력(`*` 글롭)과 문법이 다르므로 파일 패턴 입력의 안내에는 "`*`는 와일드카드"를 명시**(RT-46).
- **다른 조건과의 관계**: 기존 조건(Branch·기간·Merge 제외·작성자)과 AND. **해시 필터가 있으면 다른 모든 조건과 함께 무시**(REQ-023).
- **git 구현(간단형 가정, M-4)**: 키워드를 정규식으로 해석하지 않도록 **`-P` 패턴 하나**에 모든 키워드를 `\Q…\E`로 감싸 넣는다: `(?s)\A(?=.*(?:\Qinc1\E|\Qinc2\E))(?!.*(?:\Qex1\E|\Qex2\E))`(포함이 없으면 앞 조건 생략), 대소문자 무시 `-i`. 키워드에 `\E`가 있으면 `\E\\E\Q`로 분리해 이스케이프. **현재 코드의 `--grep=<검색어>`는 기본 정규식(BRE)이라 `[skip ci]`가 거의 모든 커밋에 일치하는 결함이 있다**(임시 저장소에서 확인: 6개 중 5개) — 이 작업이 그 결함을 함께 해소한다. `-P`는 git 빌드에 PCRE가 있어야 하므로 내부망 개발 PC의 git에서 동작을 확인하고, 불가 시 대체(포함은 `-F`, 제외는 클라이언트 필터 + 페이지네이션 한계)를 정한다. `--author`도 정규식이지만 이번 범위 밖(별도 결함으로 기록).
- **IPC**: `ListCommitsParams.searchTerm`(단일) → `includeKeywords?: string[]`·`excludeKeywords?: string[]`(`searchMode`는 유지). `setSearchTerm`·`searchTerm` 스토어 상태를 키워드 원문(`keywordText`) 하나로 통합, 메시지 제외 상태·입력은 폐지.
- **화면 표시**: 선택된 커밋이 필터로 목록에서 빠져 있을 수 있으므로 카운터가 `N개 선택됨` + `(선택 중 K개는 화면에 안 보임)`을 보인다. git 쪽 필터는 숨겨진 개수를 알 수 없으므로 "숨김 M개"는 표시하지 않는다.
- **접힌 요약**: `메시지 "guarantee, payment" · 제외 1`처럼 포함 키워드(`, `로 연결)와 제외 개수.
- **수용 기준(vitest·통합)**: 줄바꿈 구분·빈 줄 무시·앞뒤 공백 제거 · `-` 접두 제외·`-`만 있는 줄 무시 · 쉼표·대괄호·`.`·`*`가 리터럴(`a.b`가 `axb`에 일치하지 않음, `[skip ci]`가 정확히 그 문구만) · 포함 OR·제외 OR·AND 결합 · 제외만 입력 · 파일명 모드에서 제외 무시 + 안내 · 대소문자 무시 · 해시 필터가 있으면 무시 · `\E`가 든 키워드의 이스케이프 · 임시 저장소로 `git log` 결과 검증 · 선택 커밋이 가려질 때 카운터 표시.

#### RT-49 — `CommitQueryBar` 레이아웃

- 섹션 헤더(제목 "조회 조건" + 접기 버튼, 접히는 본문 밖) 아래 본문을 **검색 조건 그룹 | 경계 | 필터 그룹**으로 나눈다. **각 그룹은 자기 테두리 상자**이고(본문 컨테이너 자체는 테두리 없음), 두 그룹 사이 **경계를 마우스로 드래그해 폭 비율을 조절**한다 — `SplitPane`(RT-42의 포함된 파일 ↔ Extract 대상과 동일 컴포넌트·동작). 기본 비율 ~~**50:50**~~ **0.67**(M-45 정정, 2026-09-23 — 날짜 입력창 폭 때문에 50:50이면 왼쪽 그룹이 줄바꿈돼 오른쪽보다 높아짐), 최소 폭 **왼쪽 320px / 오른쪽 330px**(두 최소 폭의 합보다 창이 좁으면 0.5로 수렴, 그때는 가로 스크롤 — 결정 대기 M-42), 비율은 `localStorage`(`gde:splitRatio:queryGroups`)에 저장하고 **Reload는 초기화하지 않는다**(레이아웃 설정). 핸들은 `col-resize` 커서, 툴팁 "드래그해서 검색 조건 ↔ 필터 폭 비율 조절".
  - **검색 조건 그룹(왼쪽)**: (1) Branch · `Search` 버튼(즉시 조회), (2) 조회 기간 · 최대 개수 · Merge 제외. 기본 폭(50%)에서 두 줄에 들어가고, 좁히면 줄바꿈될 수 있다.
  - **필터 그룹(오른쪽, `QueryFilterGroup`)**: **키워드 · 작성자 · 해시 필터** 텍스트 영역 세 개를 같은 줄에 나란히(키워드가 작성자의 왼쪽). **각 텍스트 영역은 정확히 2줄이 한 번에 보이는 높이**(`rows=2`, 그룹이 커져도 늘어나지 않음)이고 3줄부터는 영역 안에서 스크롤한다. 필드 헤더(라벨 줄) 높이는 통일한다. (이전 명세: 키워드 헤더에만 검색 대상 라디오를 두고 그만큼 더 넓게 뒀으나 — **M-49 정정(2026-09-24): 검색 대상 라디오 삭제(REQ-016 폐기)** — 키워드 헤더는 이제 "키워드" 글자뿐이라 세 필드가 완전히 같은 폭 규칙(68px, M-45)을 공유한다.) **세 필드 모두 줄바꿈으로 구분(한 줄에 하나)**.
  - **placeholder는 유지하고, 입력을 시작하면 힌트 툴팁을 표시**(사용자 결정 2026-09-21): 값이 비어 있을 때는 placeholder("한 줄에 하나" 등)가 보이고, **값을 입력하기 시작해 placeholder가 사라지면 포커스가 있는 동안 그 필드 바로 아래에 힌트 툴팁**이 겹쳐 뜬다(아래 목록 레이아웃을 밀지 않음, 포커스를 잃거나 값을 지우면 사라짐, `aria-describedby`로 연결). 문구 — 키워드: "한 줄에 하나 · 앞에 `-`를 붙이면 제외 · 글자 그대로 검색(대소문자 무시, `*`·정규식 아님)"(파일명 모드에서 `-` 줄이 있으면 같은 툴팁 안에 경고 한 줄 추가), 작성자: "한 줄에 하나 · 이름 일부 일치(대소문자 무시) · 이름에 공백이 있어도 됨", 해시: "한 줄에 하나 · 입력하면 다른 모든 조건 무시 · 해시가 정확히 일치하는 커밋만(축약 해시 가능)". (마우스를 올려야만 보이는 `title` 툴팁은 쓰지 않는다 — 입력 중에는 보이지 않으므로.)
- **MaxCountField**: 입력 중 문자열은 로컬 유지, **blur/Enter에서만 확정**(비우면 이전 값 복원, 1 미만 거부), 값 변경마다 재조회하지 않음(U3).
- 기본 화면 폭 1100px 여부는 결정 대기 M-13.
- **수용 기준**: **검색 조건·필터 두 그룹이 각각 테두리 상자이고 사이 경계를 드래그로 조절(최소 폭 유지, 비율 저장·복원, 접었다 펼쳐도 유지)** · **키워드·작성자·해시 세 텍스트 영역이 같은 줄에서 왼쪽→오른쪽 순서로 나란히, 높이 동일, 정확히 2줄이 스크롤 없이 보이고 3줄부터 스크롤** · ~~키워드 헤더에 검색 대상 라디오~~(M-49 정정, 2026-09-24: 삭제) · **비어 있으면 placeholder만, 입력을 시작하면 포커스 중인 필드 아래에 힌트 툴팁(레이아웃 불변, 포커스 해제·값 삭제 시 사라짐)** · 폭 축소 시 아래로 줄바꿈 · 최대 개수를 지워도 1로 튀지 않음 · `Search` 버튼과 Ctrl/Cmd+Enter로 즉시 조회.

#### RT-55 — Reload 전체 초기화

- **Reload 누르면**: 저장소 재검증 → Branch 목록·원격 프로젝트명 재조회 → 아래를 **모두 기본값으로** → 첫 페이지 재조회.
- **초기화**: Branch(기본 브랜치), ~~검색 대상(메시지),~~(M-49 정정, 2026-09-24: 검색 대상 자체가 없어짐) 검색어(빈), **조회 기간(오늘-7일 ~ 오늘 재계산)**, 최대 개수(100), Merge 제외(체크), 작성자·해시·메시지 제외(빈), **커밋 선택(전부 해제)**, 분석 결과(요약·변경 파일·Extract·삭제·경고·누락된 의존성·수동 추가 → 폐기, Preview 다시 필요), 열려 있는 팝업(닫힘).
- **유지(가정, 결정 대기 M-22)**: 파일 패턴 이력, Export 경로·방식, 접힘 상태, 분할 비율, 트리 펼침.
- 확인 대화상자 여부는 결정 대기 M-24. `git fetch`는 하지 않음(M-23).
- **수용 기준(vitest)**: Reload 후 위 초기화 필드가 모두 초기값 · 유지 필드가 변하지 않음 · 저장소가 없거나 검증 실패 시 초기화하지 않고 오류만 표시 · 기간이 "현재 시각" 기준으로 재계산됨.

#### RT-56 — ExportBar: 추출 위치 방식

- **줄 구성**: `[변경] <실제 생성 경로> ……… [방식 ▼] [Export]`, 아래 줄에 상태 텍스트. 선택상자는 `Export` 버튼 **왼쪽**.
- **옵션**: `git-deploy-extracted 폴더 생성 후 추출`(`sub`, 기본값) / `선택한 경로에 바로 추출`(`direct`). 선택은 `localStorage`(`gde:exportMode`)에 영속.
- **경로 표시**: `sub` → `<선택 경로>\git-deploy-extracted`, `direct` → `<선택 경로>` (**실제로 파일이 생길 위치**).
- **`direct` 규칙(a안)**: 선택 폴더가 **비어 있을 때만** 허용. 비어 있지 않거나 경로 미선택(=저장소 루트 기본값)이면 `Export` 비활성화 + "선택한 폴더가 비어 있지 않아 바로 추출할 수 없습니다. 빈 폴더를 선택하거나 '폴더 생성 후 추출'을 사용하세요." 표시. **`fs.rm`을 호출하지 않는다.** 폴더 비어 있음은 **Main이 확인**(경로·모드 변경 시 IPC로 재확인, Export 직전에도 재확인).
- **경로 검증: 추출 위치가 저장소와 겹치면 금지(두 모드 공통, 결정 2026-09-21)**
  - **판정 대상은 "최종 산출물 폴더" F**: `sub` = `<선택 경로>/git-deploy-extracted`, `direct` = `<선택 경로>`. 저장소 경로를 R이라 한다. 아래 중 하나면 Export 불가.
    1. **F가 R과 같거나 R의 하위(저장소 안)** — 사용자 요구(동일 금지) + M-33 결정(하위 폴더까지 차단). `<선택 경로>`가 `R` 자체이거나 `R` 하위인 경우가 여기에 걸린다(`sub`에서는 `<R>/git-deploy-extracted`가 되므로).
    2. **R이 F의 하위(F가 저장소를 포함)** — *이번에 추가한 방어*: `sub` 모드는 F를 `fs.rm(recursive)`로 통째로 지우므로, F가 저장소를 포함하면(예: 저장소가 `<선택 경로>/git-deploy-extracted/proj`) **저장소가 삭제된다.** `direct`에서는 F가 저장소를 포함하면 어차피 비어 있지 않아 a안이 막지만 규칙을 동일하게 적용한다.
    - 그 외(저장소의 형제 폴더, 저장소를 포함하는 상위 폴더 중 F가 저장소를 포함하지 않는 경우)는 통과. 예: R=`D:\work\proj`, `sub` + 선택 `D:\work` → F=`D:\work\git-deploy-extracted`(형제) 통과.
  - **비교(Main이 수행, 권위)**: R과 F를 `fs.realpath`로 정규화(심볼릭 링크·정션·`.`/`..`·끝 구분자 해소, 경로가 없으면 존재하는 가장 가까운 상위를 realpath한 뒤 나머지를 이어 붙임) → **플랫폼별 대소문자 정책**(Windows·macOS 무시, Linux 구분) → `path.relative(R, F)`로 판정: 결과가 `''`이면 같음, `..`로 시작하지 않고 절대경로가 아니면 F가 R의 하위. 반대로 `path.relative(F, R)`이 같은 조건이면 R이 F의 하위. **문자열 접두사 비교(`startsWith`)는 쓰지 않는다**(`D:\work\proj-old`가 `D:\work\proj`의 하위로 오판되는 함정).
  - **검증 시점**: ① 추출 경로 선택 직후 ② **저장소 변경(Browse)·Reload 직후**(추출 경로는 전역 저장이라 새 저장소와 겹칠 수 있음) ③ 모드 변경 시 ④ **Export 실행 직전 Main에서 재검증**(UI 상태를 신뢰하지 않음).
  - **분석 중 차단(R5, RT-17)**: 위 세 사유 다음으로 `ANALYZING` — Preview 계산 중 또는 의존성 확인 중이면 Export를 비활성화하고 "Preview 계산 중입니다 — 완료 후 Export할 수 있습니다." / "의존성 확인 중입니다 — 완료 후 Export할 수 있습니다."를 표시한다(일시적 사유라 우선순위 마지막, 분석이 실패·적용 불가로 끝나면 해제).
  - **표시**: ExportBar 상태 줄에 붉은 글씨 + Export 비활성화. 문구는 코드별: `INSIDE_REPO` "추출 위치가 저장소와 같거나 저장소 안에 있습니다. 저장소 밖의 다른 폴더를 선택하세요." / `CONTAINS_REPO` "선택한 위치가 저장소를 포함하고 있어 추출할 수 없습니다. 다른 폴더를 선택하세요." 검사 우선순위 ① 경로 미선택 ② 저장소와 겹침 ③ (`direct`) 폴더가 비어 있지 않음 — **먼저 걸린 사유 하나만** 표시.
  - **⚠ 기본값 폐지(REQ-012 정정)**: 현재는 미선택 시 저장소 루트가 기본값(`getDeployDir`의 `exportParentDir ?? repoPath`)인데 이 규칙과 충돌한다. **경로를 명시적으로 고를 때까지 Export를 비활성화**하고 경로 표시 자리에 "추출할 폴더를 선택하세요"를 보인다. 이미 저장된 경로가 있으면 그대로 쓰되 검증을 통과해야 한다.
  - **IPC**: `package:validateExportTarget({ repoPath, exportParentDir, mode })` → `{ ok: true } | { ok: false, code: 'NO_PATH' | 'INSIDE_REPO' | 'CONTAINS_REPO' | 'NOT_EMPTY', message }`. `package:export`도 내부에서 같은 함수를 호출해 실패 시 실행을 거부(RT-12 IPC 검증에 포함). 판정 함수 `classifyExportTarget(R, F)`는 순수 함수로 분리해 vitest.
- **`sub` 규칙**: 기존과 같이 대상 폴더에 내용이 있으면 덮어쓰기 확인창(`이미 있는 git-deploy-extracted를 덮어씁니다, 계속할까요?`) 후 진행.
- **완료 표시**: `Export 완료: <경로>`(클릭하면 경로 복사 — 복사 피드백은 RT-16).
- 병합 덮어쓰기(b안)는 폐기(§0). `direct`는 항상 빈 폴더 전용이다.
- **수용 기준(임시 폴더 통합 테스트)**: `direct` + 비어 있지 않은 폴더 → Export 거부, 기존 파일 보존 · `direct` + 빈 폴더 → 파일이 그 폴더 바로 아래 생성 · `sub` → `git-deploy-extracted` 하위 생성 · 경로 미선택 → 두 모드 모두 비활성 · **`INSIDE_REPO` 거부: 저장소와 정확히 같음 / 끝 구분자 / `.`·`..` 포함 / 심볼릭 링크 경유 / Windows에서 대소문자만 다름 / 저장소 하위 폴더(`<저장소>/out`, `<저장소>/a/b`) / `sub`에서 선택 경로가 저장소(→ `<저장소>/git-deploy-extracted`)** · **`CONTAINS_REPO` 거부: 저장소가 `<선택 경로>/git-deploy-extracted/proj`인 경우(`sub`) — 저장소 파일이 삭제되지 않음(`fs.rm` 미호출) 확인** · **통과: 저장소의 형제 폴더, 접두사만 같은 형제(`<저장소>-old`, `<저장소>2`), 저장소를 포함하지 않는 상위 폴더(`sub`)** · 저장소를 바꿨을 때 저장된 추출 경로가 새 저장소와 같아지면 즉시 차단 · 검증 통과 후 경로가 바뀌어도 Export 직전 재검증에서 거부.

#### RT-57 — `extract-list.txt` 형식

- **한 파일**로 생성: `<결과 폴더>/extract-list.txt` (`deploy-files.txt`·`delete-list.txt`·`deploy-summary.json`은 더 이상 생성하지 않음). 사람이 읽는 용도(프로그램이 읽지 않음). LF, BOM 없는 UTF-8(M-31, 2026-09-23 확정).
- **구조**:
  1. 머리말 블록: `=` 64자 / ` Extract 목록` / ` 생성 시각   : YYYY-MM-DD HH:mm:ss ±HH:MM` / ` 기준 브랜치 : <브랜치>` / ` 원본 커밋 (N개)` + 커밋 행들 / `=` 64자 / 빈 줄
     - **커밋 행(M-32, 2026-09-23 확정)**: 3칸 들여쓰기 + `<해시 7자리>  <YYYY-MM-DD>  <작성자>  <제목 한 줄>`, 작성자 열은 가장 긴 이름에 맞춰 정렬. **선택한 커밋 전체**가 대상이며 순서는 커밋 목록의 표시 순서(최신순).
     - **상한**: 기본 **10줄**. 초과하면 10줄 뒤에 `   … 외 K개` 한 줄. 커밋이 0개(해시 필터 등으로 비는 경우는 없음)면 `원본 커밋 (0개)`만 표시.
     - 제목은 개행 없는 첫 줄(git `%s`), 길이 자르지 않음.
  2. `=`64 / ` 배포 대상 파일 (N개)` / `=`64 / **트리** / 빈 줄
  3. `=`64 / ` 삭제 대상 파일 (M개)` / `=`64 / **트리**
- **트리**: `├── `·`└── `·`│   `·`    ` 커넥터, 폴더는 `이름/`, 폴더 먼저·이름순, 단일 자식 폴더 체인은 한 줄로 합침(화면과 동일), 목록이 비면 `  (없음)`.
- **내용**: 배포 대상 = Extract 목록 − 활성 패턴 해당 항목(서버 경로, M-30 2026-09-23 확정). 삭제 대상 = 삭제 서버 경로.
- **코드**: `treeText(paths)`·`buildExtractListText({ branch, generatedAt, commits, files, deleted })` 순수 함수(시각 주입 → 결정적 테스트). `DeploySummary` 타입·`deploy-summary.json` 생성 코드 삭제, `BuildPackageParams`에서 요약 전용 필드 정리, `verify-phase3.ts`·README(33, 50행)·ARCHITECTURE §5(160~162행) 갱신.
- **수용 기준(vitest)**: 빈 목록 → `  (없음)` · 루트 파일 · 체인 병합 · 정렬(폴더 먼저) · 한글 경로 · 머리말 형식(고정 시각) · **커밋 행 형식·정렬·10줄 상한과 `… 외 K개`(0·1·10·11·25개 경계)** · 배포/삭제 개수가 제목과 일치 · 패턴 제외 항목이 배포 목록에 없음.

#### RT-59 — `RepositoryBar` 버튼·버전 배지 오른쪽 끝 배치 (U-21)

- **배치(사용자 결정 2026-09-21)**: 저장소 바의 **왼쪽**에는 `RepoLabel`(`<remote 이름> (<폴더명>) / <브랜치>`)만 두고, **`Browse...` · `Reload` · 버전 배지를 하나의 그룹(`RepoBarRight`)으로 묶어 오른쪽 끝에 정렬**한다(`margin-left: auto`, 그룹 내부는 줄바꿈 없음). 그룹 내부 순서는 현재 순서 그대로 `Browse...` → `Reload` → 버전 배지(마지막이 가장 오른쪽). 사용자 메시지에서 "버전, Reload, Browse..."로 나열했는데 순서 지정인지 단순 나열인지 불분명해 현행 순서를 유지했다(M-39).
- **저장소 전체 경로 텍스트(M-44, 결정 2026-09-23)**: 기존 `.repository-panel__path`(결정 이력 #38, ellipsis+`title` 툴팁)는 **삭제하지 않고 그대로 유지** — `RepoLabel`과 `RepoBarRight` 사이에서 `flex:1`로 남은 공간을 채운다(현재 코드와 동일한 위치·스타일). `RepoBarRight`만 새로 묶어 오른쪽 끝 정렬을 적용하는 것이지, 경로 텍스트의 위치·표시 여부는 이번 변경 대상이 아니다.
- **폭이 좁아질 때**: 그룹은 라벨 아래 줄로 내려갈 수 있으나 **오른쪽 정렬을 유지**한다(목업 동작). 경로 라벨 말줄임 처리는 구현 시 결정.
- **동작은 그대로**: `Browse...`(저장소 선택), `Reload`(전체 초기화, U-15), 버전 배지(REQ-017 새 릴리스 강조·클릭 시 확인창).
- **수용 기준**: 버전 배지의 오른쪽 끝이 바 안쪽 오른쪽 끝과 일치(≤2px) · 좌→우 순서 `라벨 < Browse... < Reload < 버전` · 세 요소가 같은 줄 · 라벨은 왼쪽 유지 · Reload 등 기존 동작 불변.
- **구현 완료(2026-09-23)**: `RepositoryPanel.tsx`에 `.repository-panel__right`(신규 래퍼 div) 추가 — 기존 `.repository-panel__actions`(Browse.../Reload)와 버전 배지 버튼을 이 안에 함께 넣었다(이전엔 배지가 별도 형제 요소라 좁은 폭에서 각자 wrap되면 그룹 정렬이 깨질 수 있었음). CSS `.repository-panel__right{display:flex;align-items:center;gap:12px;margin-left:auto;flex-wrap:nowrap}` — 부모 `.repository-panel`의 `flex-wrap:wrap`이 이 그룹 전체를 한 덩어리로 다음 줄에 내려도 `margin-left:auto`가 그 줄에서도 오른쪽 정렬을 유지시킨다. `.repository-panel__path`(M-44 결정대로 그대로 유지)는 래퍼 밖, 라벨과 우측 그룹 사이에서 기존처럼 `flex:1`로 남는 공간을 채운다. 검증: `npm test`(238개)·`typecheck`·`lint`·`build`·`test:e2e`(24개, 전부 기존 스펙 그대로 통과 — 버튼은 role/name으로 찾아 class 구조 변경의 영향 없음) 전부 통과. Playwright 임시 스크린샷(1100px 넓은 폭 — 라벨/경로/버튼그룹 한 줄, 560px 좁은 폭 — 버튼그룹이 라벨·경로 아래 줄로 내려가되 오른쪽 정렬 유지)으로 수용 기준을 육안 확인 후 삭제(RT-41 이후 관례 — 커밋 대상 아님).

#### RT-50 — CSS 분할과 채움 규칙

- `main.css`(769줄)를 컴포넌트별 CSS로 분할, `.fill`(높이 100% + `min-height: 0`)·`.fill-scroll`(flex 1 + 내부 스크롤)를 **공용 규칙**으로 정의. `WorkArea` 직속 자식과 패널 → `FilePane` → 목록까지 높이 100% 체인이 끊기지 않을 것.
- **수용 기준**: 작업 영역 높이를 줄여도 자식이 밀려나지 않고 목록 내부에서만 스크롤.

---

## 6. 문서 동기화 대상

> **문서 관리 원칙(확정)**: 기존 정식 문서는 구현 전까지 **v0.6.0 현행 기준**으로 그대로 둔다(기준선은 git 태그 `v0.6.0`). 계획·스펙은 이 문서가 단일 원천이다. 이전에 5개 문서(REQUIREDMENT REQ-026, DETAILED_DESIGN §18, UI_UX_SPEC §2.6, RISK_ISSUES §8.4/결정 #62, HANDOFF)에 추가했던 미커밋 수정은 **폐기(git checkout)** 했다 — REQ-026의 "인라인 요약 + 팝업" 설계는 U-7(패턴 제외/포함)·§3.1로 대체됨.
> **완료 후 처리**: 각 P단계 구현이 끝날 때마다 해당 스펙을 정식 문서로 병합(RT-60)하고, 전부 끝나면 이 문서 상단에 "완료 — 이력 문서, 현행은 정식 문서"를 표시한 채 동결한다(수정 금지). 목업은 역할 종료 후 동결 또는 삭제.


> **P1(RT-10~17) 몫 추가(2026-09-22, P1 구현 완료 시점에 추가 — 아래 표는 원래 P4 관점으로만 작성돼 있었다)**: 이 표는 처음 작성될 때(2026-09-21) P4 UI 변경 관점으로만 채워졌고, P1의 동작 변경 6건이 남기는 문서 반영 항목이 빠져 있었다. RT-60에서 놓치지 않도록 각 문서 행에 P1 항목을 추가했다(아래 굵게 표시).

| 문서 | 반영할 내용 |
|---|---|
| REQUIREDMENT.md | **REQ-009/010(Deploy Package 구조: JSON 삭제, txt 통합) 정정(U-17)** · **REQ-012(Export 경로 선택)에 추출 위치 방식 추가·저장소와 겹치는 위치(같음·하위·포함) 금지 검증·기본값(저장소 루트) 폐지(U-16)** · **REQ-015 정정(Reload는 선택 유지 → 전체 초기화, U-15)** · **REQ-026 신규 편입 "파일 패턴(제외+포함) 관리"**(v0.6.0 REQUIREDMENT에는 아직 없음 — 활성 K개 요약+툴팁, 종류 파생, 패키지 표기, 조합 규칙) · REQ-025(포함된 파일 검색 와일드카드) 폐기/축소 · REQ-022(키워드/작성자/해시 필터)에 줄바꿈 구분·`-` 제외·hint 반영(§3.1, RT-48) · REQ-022에 메시지 제외 · REQ-011(배포 파일 개별 선택 → Extract 목록 이동 모델)·REQ-019/024 표현 갱신 · Delete List 표시 방식(U-1)·경고 위치(U-2) · **REQ-023에 해시 검증 규칙 추가(RT-10, M-5 확정: 16진수 4~64자만 허용, 무효 입력은 화면에 표시)** |
| UI_UX_SPEC.md | §2.6 Filter 행 삭제, 제외 패턴 입력 행 → `FilterPatternBar`, 헤더/경고 이전, 접기/펼치기, 팝업 4종, §4 인터랙션 표, §3 상태(`deployFilesFilter` 제거, `collapsed`, `openPopup` 소유자 이동) · **90/345행(RT-13) 정정: "최대 개수" 입력은 더 이상 변경 시 즉시 재조회하지 않음 — 로컬 문자열 유지, blur/Enter에서만 커밋** · **89/345행(RT-16 U6) 정정: 조회 기간(날짜)도 다른 검색 필드와 같은 300ms 디바운스로 통일(예전엔 즉시 재조회)** · **201행 인근(RT-15) 추가: 팝업이 공용 `Popup` 컴포넌트 기반으로 바뀌어 Esc 닫기·포커스 트랩·포커스 복귀 지원, 높이는 뷰포트가 아니라 부모 컨테이너 기준 클램프** · **Export 완료 메시지(RT-16 U7) 추가: 클릭 복사 시 성공(1.5초 "✓ 복사됨")/실패 피드백, 커밋 선택 변경 시 메시지 초기화** |
| DETAILED_DESIGN.md | §18 신규 작성(v0.6.0에는 §18 없음 — 패턴 관리·`FilterPatternBar`·팝업 4종) · 매칭 규칙 §3.1 · **요청 ID 가드(RT-11 R2 커밋 조회 + RT-17 R4·R5 분석 요청 — `lib/requestGuard.ts`의 `createRequestGuard`를 둘이 공유, stale 응답은 상태 플래그를 건드리지 않고 선택이 바뀌는 지점에서 즉시 무효화하는 설계 근거 포함)** · **IPC 입력 검증 계층(RT-12 R3, `main/ipc/validate.ts`) 신설 근거·검증 3종** |
| RISK_ISSUES.md | §7.5 와이어프레임 재작성, §8.3/§8.4 확정 표시(§8.4는 팝업 안이 아니라 U-7 오버레이/툴팁 방식으로 결정), 결정 이력 #62~ 추가(v0.6.0 마지막 번호 #61) · **P1(RT-10~17) 6건도 결정 이력에 편입(해시 검증 규칙 M-5 확정 경위, `path.join`이 선행 `/`를 루트로 점프시키지 않는다는 재현 확인, Popup 포커스 캡처 타이밍 버그와 수정 등 재사용 가치 있는 세부는 REFACTORING_TASKS.md 해당 RT 항목에 이미 기록돼 있으니 요약만)** |
| ARCHITECTURE.md · HANDOFF.md | 새 모듈 구조(§2 트리, 스토어 slice, `api/`·`services/`), 이 문서 포인터. **HANDOFF는 리팩토링 착수 시점에 "현재 P단계 + 이 문서 링크"를 먼저 추가**(새 세션이 §8 백로그만 보고 착수하지 않도록) · **ARCHITECTURE.md에 `main/ipc/validate.ts`(RT-12) IPC 검증 계층 추가 반영** · **ARCHITECTURE.md에 `shared/ipc-channels.ts`(RT-20) — IPC 채널명·params/result 타입 단일 정의, preload/handlers/d.ts가 이걸 통해서만 채널을 참조 — 반영** · **ARCHITECTURE.md에 `main/ipc/handlers/`(RT-21) 채널 그룹별 분리 구조·`main/ipc/dialogs.ts` 공용 다이얼로그 헬퍼 반영** · **ARCHITECTURE.md §6(§4.4 언급 포함)·README.md 75행에 `dependencyAnalysis.ts` 단일 파일 참조를 `dependencyAnalysis/{projectIndex,resolve,implementations,index}.ts`(RT-22)로 갱신** · **ARCHITECTURE.md에 `shared/` vs `renderer/src/lib/` 배치 기준(RT-23, L2) 신규 반영 — 모듈 구조 절 어딘가에 고정 규칙으로 명문화** |
| README.md | 3번 항목 `delete-list.txt`·8번 항목 `deploy-files.txt` → `extract-list.txt`로 정정(U-17), Reload·Export 경로 설명 갱신(U-15/U-16) |
| PRD.md | 47·85·86행의 `deploy-files.txt`/`delete-list.txt`/`deploy-summary.json` 언급을 `extract-list.txt`로 정정(REQ-009/010/011) |
| DOCUMENT_CHECKLIST.md · PHASE_PLAN.md | 변경 없음(초기 기획·진행 이력) |

---

## 7. 미결 사항

| ID | 질문 | 권장 |
|---|---|---|
| M-1 | ~~좌측 검색 삭제(U-5)의 위험: 검색은 화면만 걸러내지만 **패턴은 Export 대상까지 바꾼다.** 찾으려고 포함 패턴을 쓰고 끄기를 잊으면 조용한 배포 누락. (a) 그대로 삭제 + 포함 필터 ON 강조 / (b) 패턴 칩에 "화면만"(Export 미반영) 옵션 / (c) 검색 유지~~ **재정정(M-46, 2026-09-24): (b)→(c)로 최종 변경** — (b)로 RT-45 때 구현했던 "화면만" 옵션이 실사용 중 사용자에게 그 자체로 이해하기 어려웠다(왜 화면과 Export가 다르게 동작하는 패턴이 필요한지 직관적이지 않음). 결국 원래 기각했던 (c) 검색 유지로 선회 — 검색은 항상 화면 전용(Export 무관)이라는 게 그 자체로 명확해서 별도 설명이 필요 없다 | (b)→(c)로 최종 변경(M-46) |
| M-2 | added 녹색만으로 구분하면 색각 이상·흑백 캡처에서 안 보임 → `+` 마커 병행 여부 | 병행 |
| M-3 | 파일 패턴을 "누락된 의존성"·의존성 분석 스캔(§8.1)에도 적용할지 | 스캔 범위 적용은 별도 REQ로 |
| M-4 | ~~키워드 git 구현(간단형 가정: `-P` 패턴 하나 + `\Q…\E`)~~ — **재검증 결과 가정 폐기, 실제 구현은 다름(RT-48, 2026-09-23)**: `-P`는 지원되지만 그 패턴 안에 negative lookahead(제외)를 넣으면 실제로는 불일치하는 커밋도 git이 결과에 포함시키는 버그를 재현(`\A(?!fix)`로도 재현, `--invert-grep`은 정상이지만 포함과 AND 결합 불가) — **포함은 `-F` + 반복 `--grep`(OR), 제외는 클라이언트 필터(+ 페이지네이션 재설계: maxCount 전체를 한 번에 가져와 `[skip,skip+limit)` 슬라이스)로 최종 확정**. `\E` 이스케이프는 PCRE 패턴을 더 이상 안 써서 불필요해짐 | (해소, 원래 가정과 다르게 구현) |
| M-5 | 해시 검증(R1): 16진수만 허용? 축약 해시·`HEAD~1` 같은 rev 표기 지원? 잘못된 입력은 무시 vs 표시 | 16진수만, 무효 입력은 표시 |
| M-6 | 릴리스 전략(리팩토링 완료 후 v0.7.0?) | 별도 버전 |
| M-7 | ~~접힘 상태 영속(localStorage) 여부, 팝업이 열린 채 접을 때 팝업 처리~~ — **결정(RT-47, 2026-09-22): 미영속(새로고침하면 항상 펼침) + 접을 때 팝업 닫기**(WorkArea의 `section:hide` 리스너가 `owner==='workArea'`인 섹션이 접히면 무조건 닫음) | (결정됨) |
| M-8 | ~~접혔을 때 `Preview` 버튼·`Deleted`/경고 개수 노출~~ — **결정(RT-47, 2026-09-22): 접힌 커밋 섹션 헤더에 Preview 버튼 유지(`headerActions`), Deleted/경고 개수는 접힌 요약 문구에 포함** | (결정됨) |
| M-9 | ~~패턴 요약 표기(H1)~~ — **결정: `활성 K개` + 호버 툴팁에 활성 패턴 목록**(RT-46). 이전 후보 `제외 N · 포함 M (K개 비활성)`·`활성 K개: 앞의 2개…`는 폐기 | (결정됨) |
| M-10 | ~~메시지 제외 필드 위치~~ — 메시지 제외 입력 폐지(키워드 필드의 `-` 줄로 통합, M-40) | (해소) |
| M-11 | 좁은 폭에서 "포함된 파일" 제목 줄(카운터+`+ 파일 추가`) 줄바꿈 처리 | 카운터를 둘째 줄로 |
| M-12 | `삭제 목록` 팝업의 표시 경로(서버 경로만 vs 로컬 경로 병기), stale 때 `Deleted` 버튼 처리 | 서버 경로, stale 시 숨김 |
| M-14 | ~~Extract 도입 후 미선택 변경 파일 목록의 의미와 이름~~ — **결정(RT-51, 2026-09-23)**: §5.1 RT-51 명세 원문이 이미 "왼쪽 `포함된 파일`"(화면 이름은 그대로, 의미만 "미선택 변경 파일"로 재해석)이라고 못박아 둬서 그대로 따랐다 — 이름 변경("제외된 파일" 계열)은 채택하지 않음. ~~기본값도 명세대로 전체 Extract 유지~~ — **기본값 재정정(2026-09-23, 사용자 요청)**: "전체 Extract"→**"전체 미선택"**으로 뒤집음. 사용자가 직접 체크하기 전까지 Extract 대상을 임의로 채우지 않는다는 원칙(Preview는 분석만, 선택은 사람이). `analysisSlice.ts`의 `runPreview` 결과 매핑을 `included:true`→`included:false`로 변경. 이에 따라 Preview 직후 왼쪽 "포함된 파일"이 비어있지 않고 오른쪽 "Extract 대상"이 비어있는 게 기본 상태가 됨 — e2e 7개 파일(`preview-export`·`export-feedback`·`included-files-pane`·`reload-reset`·`tree-list`·`work-area-popups`·`add-files-popup`)이 이 기본값을 전제하고 있어 전부 "먼저 체크해서 Extract로 옮기는" 단계를 추가해 갱신. **부수 발견**: 체크 직후 해당 행이 DOM에서 사라지는 체크박스에 Playwright `.check()`을 쓰면(클릭 후 "checked 상태 확인" 단계가 사라진 요소를 계속 기다려) 타임아웃난다 — `.click()`으로 교체해 해결(상태 확인을 안 하므로 안전) | 이름 유지("포함된 파일"), **기본 전체 미선택(2026-09-23 재정정)** |
| M-15 | ~~3분할 폭 문제~~ — U-12로 3분할이 사라져 **해소됨** | — |
| M-16 | 미선택 변경 파일 목록 체크의 실행 취소 방식: 지금은 되돌리기가 × 뿐. 이동 직후 토스트/실행 취소, 드래그 앤 드롭 필요 여부 | 불필요 |
| M-17 | 활성 패턴에 걸린 Extract 항목의 노출 방식(흐림+"패턴 제외") 확정, Extract 목록에 포함 패턴 모드가 적용될 때의 표시 | 현행 유지 |
| M-18 | ~~팝업 키 `'manual'` → `'addFiles'` 개명 여부(내부 이름만)~~ — **결정(RT-52, 2026-09-23): 권장값대로 개명**(`workAreaPopupContext.ts`의 `OpenPopup` 타입·`PopupHost`/`DeployFilesPanel` 호출부) | (결정됨) |
| M-19 | 누락된 의존성 발견성: **채택된 보완**(붉은 표시 + `Impl`/`I` 배지 + 조상 폴더 자동 펼침 + 버튼 배지)으로 충분한지. 추가 알림(Preview 직후 팝업 자동 열기, `PreviewSummary`에 `⚠ 누락된 의존성 N ▸` 버튼)이 더 필요한지 | 실사용 후 판단 |
| M-20 | ~~트리 펼침 상태 저장 여부, 300개 초과 기본 접힘 여부, 폴더 체크박스 indeterminate 필요 여부~~ — **결정(RT-53, 2026-09-23, 사용자 확인)**: 펼침 상태는 **로컬에만(저장 안 함), 기본 전부 펼침**. **300개 초과여도 추가 규칙 없이 항상 전부 펼침**(가상 스크롤이 이미 렌더링 비용을 해결해 성능상 접을 이유가 없고, 이 앱의 목록들은 300개를 넘는 경우가 드물어 "한눈에 구조 파악" 이점도 크지 않다고 판단 — 원래 권장안이었던 "300개 초과 시 기본 접힘"은 **폐기**). 폴더 체크박스에 **indeterminate 추가**(일부만 Extract로 이동된 폴더 표시, `TriStateCheckbox` 재사용) | 로컬·전부 펼침(예외 없음), indeterminate 추가 |
| M-21 | ~~리프에 파일명만 표시하면 서로 다른 폴더의 같은 이름 파일 구분이 어렵다~~ — **경로 복사 버튼(U-18) + 기존 전체 경로 툴팁으로 해소**(경로 병기 옵션은 불필요로 판정) | (해소) |
| M-22 | ~~Reload 초기화 범위: 파일 패턴 이력·Export 경로·접힘·분할 비율·트리 펼침을 유지하는 가정이 맞는지~~ — **결정(RT-55, 2026-09-23, 사용자 확인)**: 스펙 본문의 가정대로 **유지 확정**(파일 패턴 이력·Export 경로/방식·접힘 상태·분할 비율·트리 펼침 — 전부 store 밖 localStorage 또는 컴포넌트 로컬 상태라 `reloadRepository`가 애초에 손댈 수 없는 값들이라 구현상 자연히 유지된다) | 파일 패턴·Export 경로 유지(결정됨) |
| M-23 | Reload가 `git fetch`도 수행할지(현재는 로컬 재조회만이라 새 원격 커밋이 안 보임) | 별도 요구로 분리 |
| M-24 | ~~선택/분석 결과가 있을 때 Reload 확인 대화상자 여부~~ — **결정(RT-55, 2026-09-23, 사용자 확인)**: **없음**으로 확정(원래 권장이었던 "있음"을 뒤집음) — 현재 코드베이스엔 confirm 대화상자 패턴이 전혀 없어 새로 설계해야 했는데, 그 비용 대비 Reload는 버튼을 직접 눌러야만 발생하는 명시적 동작이라 확인창 없이 바로 초기화하는 쪽으로 결정 | 없음(결정됨, 원래 권장 "있음"에서 변경) |
| M-25 | ~~`direct`에서 선택 폴더에 기존 파일이 있을 때 정책~~ — **(a)안(빈 폴더만 허용) 최종 확정·구현 대상**. (b) 병합 덮어쓰기는 **폐기**(사용자 확인: 내부망 저장소는 완전히 분리된 네트워크라 마운트/직접 덮어쓰기 사례가 없고 앞으로도 없음). (c) 통째 삭제는 금지 | (결정됨) |
| M-26 | ~~txt 소비자 확인~~ — **사용자 확인으로 종결**: txt는 사람이 보는 용도, 프로그램적 사용 없음. JSON 삭제, `deploy-files.txt`+`delete-list.txt` → 단일 txt(경계선 구분, 트리 표기) | (종결) |
| M-27 | ~~선택상자 라벨 문구·순서, 기본값 유지(`sub`) 및 모드 저장 여부(전역 저장 vs 세션)~~ — **구현 완료(RT-56, 2026-09-23)**: 권장값 그대로 — 기본 `sub`, `localStorage`(`gde:exportMode`)에 전역 저장(저장소별 구분 없음, `exportParentDir`과 동일 패턴) | 기본 `sub`, 전역 저장(결정됨) |
| M-28 | ~~통합 txt 파일명~~ — **`extract-list.txt` 채택**(의견 제시 후 사용자 제안 수용) | (결정됨) |
| M-29 | ~~감사 정보 머리말~~ — **결정: 생성 시각·기준 브랜치명·원본 커밋 목록(몇 줄)을 머리말에 기재**. 경고·매핑 프로필은 남기지 않음 | (결정됨) |
| M-30 | ~~텍스트 트리에서 단일 자식 폴더 체인 합침 여부(화면과 동일하게 합침 가정 vs 파일 시스템 그대로 펼침), 경로를 서버 경로 기준으로 쓸지(가정)~~ — **결정(RT-57, 2026-09-23, 사용자 확인)**: 가정대로 확정 — **화면 TreeList와 동일하게 단일 자식 폴더 체인을 한 줄로 합침**(`RT-53`의 `compressChains` 재사용), 경로는 **서버(원격 저장소) 상대경로만** 사용(로컬 경로 병기 없음) | (결정됨) |
| M-31 | ~~`extract-list.txt` 인코딩: BOM 없는 UTF-8이면 구형 Windows 메모장에서 박스 문자·한글이 깨질 수 있음 → BOM 추가 여부. 생성 시각의 시간대 표기(로컬+오프셋 가정) 확인~~ — **결정(RT-57, 2026-09-23, 사용자 확인)**: **BOM 없는 UTF-8**로 확정(리포 내 다른 텍스트 산출물과 통일, 최신 에디터 호환 우선). 생성 시각 표기는 명세 원문(§5.1 RT-57) 가정대로 **로컬 시각 + 오프셋**(`YYYY-MM-DD HH:mm:ss ±HH:MM`) 확정 | (결정됨) |
| M-32 | ~~머리말 원본 커밋 목록의 세부(가정): 행 형식(`해시7 날짜 작성자 제목`), 대상(선택한 커밋 전체), 상한 10줄 + `… 외 K개`, 작성자 포함 여부, 해시 자릿수~~ — **결정(RT-57, 2026-09-23, 사용자 확인)**: 명세 가정 그대로 확정 — 3칸 들여쓰기 `<해시7자리>  <YYYY-MM-DD>  <작성자>  <제목>`(작성자 열은 최장 이름에 맞춰 정렬), 대상은 선택한 커밋 전체(표시 순서=최신순), 상한 10줄 초과 시 `   … 외 K개` | (결정됨) |
| M-33 | ~~저장소 경로 검증의 범위~~ — **결정: 저장소 하위 폴더까지 차단**(= 저장소 안). 함께 확인: 저장소를 포함하는 상위 폴더는 `sub`에서 산출물이 저장소 옆에 생기면 허용하되, **산출물 폴더가 저장소를 포함하면(`fs.rm`으로 저장소가 삭제될 수 있음) 차단**(CONTAINS_REPO, 제가 추가한 방어 — 이견 있으면 알려달라) | (결정됨) |
| M-34 | 복사 경로 구분자: 기본 `/`(git 형식, 내부망 저장소 경로와 동일 구조). Windows 사용자가 `\` 형식을 원할 가능성 → 후속으로 설정 제공 여부 | `/` 고정 |
| M-35 | 삭제 목록 행의 복사 값: 표시되는 경로(서버 경로)와 동일. Mapping이 항등이 아니게 되면 로컬 경로를 복사할지 서버 경로를 복사할지 | 표시 경로와 동일 |
| M-36 | 파일 추가 팝업 HEAD 트리(U-19·U-20)의 세부: (a) 이미 포함된 파일(변경 파일·Extract)을 **숨길지**(가정) vs 비활성 행+배지로 **보여줄지**, (b) 폴더 행에 **폴더 전체 추가**를 둘지(가정: 없음 — 대량 추가 실수 방지), (c) ~~"2단계"의 기준~~ — **경로 세그먼트 기준으로 확정**(`src`=1, `main`=2; 사용자 확인) | 가정대로 |
| M-37 | 누락된 의존성 화면 통합(U-20)에서 **채택되지 않은 제안**: (a) 트리 상단 `누락된 의존성 N개` 요약, (b) `누락된 의존성만 보기` 토글, (c) 붉은색 대신 주의 색(주황 계열; 빨강이 삭제·오류 의미와 겹침). 현재 명세는 사용자 제안대로 붉은색 + 배지 | 붉은색 유지, (a)(b)는 필요 시 후속 |
| M-38 | 영역 헤더 통일(디자인 통일성) 후속 제안 중 **미결정 항목**: (1) 접기 토글을 아이콘 전용으로 바꿀지(현재 `▴ 접기` 글자 병기), (2) 접힘 애니메이션 없음(가정), (3) 헤더 전체 클릭 토글 금지(가정), (4) `Preview`를 커밋 헤더 액션으로 옮겨 접혀도 보이게 할지(M-8과 연결), (5) `RepositoryBar`·`ExportBar`도 같은 헤더 스트립 문법으로 통일할지, ~~(6) 간격·타이포 토큰화(RT-50)~~ — **RT-50 범위 아님으로 확정(2026-09-23, AskUserQuestion)**: RT-50은 스펙 원문대로 CSS 컴포넌트별 분할 + `.fill`/`.fill-scroll` 공용화만 했다, 토큰화는 (1)~(5)와 함께 미결로 남는다. 확정된 것은 위 "헤더는 본문 밖" 구조 규칙 하나 | (1)~(5) 후속 결정 |
| M-39 | `RepositoryBar` 오른쪽 그룹의 내부 순서: 현재 `Browse...` → `Reload` → 버전 배지. 요청 메시지의 나열 순서(버전, Reload, Browse...)가 실제 배치 순서를 뜻하는지 확인 | 현행 순서 유지 |
| M-40 | ~~키워드 입력 통합 방식~~ — **A안 간단형 채택(2026-09-21)**. 키워드는 작성자 왼쪽에 같은 높이의 텍스트 영역으로 배치, 줄바꿈 구분, `-` 접두 제외, 글자 그대로 일치(정규식·`*` 없음), 포함·제외 모두 OR. 이스케이프(`\-`)·따옴표·해석 오버레이·쉼표 구분은 두지 않음. B안·현행 분리 방식은 폐기 | (결정됨) |
| M-41 | **작성자·해시 필터를 줄바꿈 구분만으로 통일(사용자 결정)**의 부작용: REQ-023은 메신저 등에서 복사한 **쉼표·공백 구분 해시 목록을 붙여 넣는** 용도였는데, 줄바꿈만 구분자로 쓰면 `a8f2d31, 8dd9e91`이 **하나의 잘못된 해시**로 처리돼 조회 0건이 된다. 권장: **해시는 줄바꿈 + 쉼표 + 공백을 모두 구분자로 허용**(해시에는 그런 문자가 없으므로 안전), 안내 문구는 "한 줄에 하나" 유지. 작성자는 이름에 공백이 있을 수 있어 줄바꿈만(요구대로). `parseMultiValueFilter`·REQ-022/023 정정 필요. 파일 패턴 입력(쉼표 구분)은 이번 통일 대상이 아님 | 해시만 관대하게 |
| M-42 | ~~조회 조건 두 그룹(경계 조절)의 세부(가정)~~ — **결정(RT-49, 2026-09-23, 사용자 확인): 가정대로 전부 채택** — (a) ~~기본 비율 50:50~~·최소 폭 320/330px (b) 가로 스크롤 유지(세로로 안 쌓음) (c) 경계 키보드 조절 없음 (d) 힌트 툴팁은 필드 아래(포커스 유지 중 아래 커밋 영역을 일시적으로 가릴 수 있음). **(a) 후속 변경(M-45, 2026-09-23): 기본 비율 50:50 → 0.67로 정정**(왼쪽·오른쪽 그룹 높이를 맞추려고 — 최소 폭 320/330px는 그대로) | (결정됨, (a)는 M-45로 대체) |
| M-43 | ~~의존성 확인 중 Export 정책~~ — **(a) Export 비활성화 + 표시 채택**(RT-17). (b) 확인창 허용은 채택하지 않음. 분석이 매우 오래 걸리는 저장소가 있으면 재검토(타임아웃·취소 필요 여부) | (결정됨) |
| M-44 | RT-59 착수 중 새로 발견(명세·U-21 표·목업 어디에도 기존 항목으로 없었음): 저장소 전체 경로 텍스트(`.repository-panel__path`, 결정 이력 #38에서 추가된 ellipsis+툴팁)를 RT-59에서 어떻게 할지 — 목업(RT-59 초기 버전)의 `RepoLabel`에는 이 표시가 없어 삭제/이동/유지 셋 다 가능했다. **결정(2026-09-23, 사용자 확인, ASCII 비교 후): 그대로 유지** — `RepoLabel`과 `RepoBarRight`(오른쪽 그룹) 사이에서 기존처럼 `flex:1`로 남은 공간을 채운다. 목업에 `RepoPath` 요소로 반영 완료 | 그대로 유지(라벨↔우측 그룹 사이) |
| M-45 | RT-50 이후 사용자가 직접 발견(계획에 없던 후속 요청, 2026-09-23): (1) `QueryFilterGroup` 세 필드(키워드/작성자/해시) 사이 간격이 달라 보임 — 원인은 작성자/해시가 `<label>`이라 전역 `label{align-items:center}`(shell.css)가 새서 그 둘만 내용이 중앙 정렬·축소된 것(RT-49 구현 당시 실수, `gap` 값 자체는 이미 12px로 동일했음). (2) 왼쪽(검색 조건)·오른쪽(필터) 패널 높이가 다름 — 원인은 `input[type=date]` 브라우저 기본 폭(~158px)×2 때문에 "조회 기간" 행이 줄바꿈된 것. **결정 과정**: 처음 "SplitPane 비율만 조정"을 시도했으나 실측 결과 오른쪽 최소 폭(minEndPx 330px) 제약상 78px가 항상 부족해 불가능함을 확인 → "오른쪽 텍스트영역 폭 줄이기"로 방향 전환했으나 그래도 45px 부족(오른쪽 floor에 막힘) → 최종 **"날짜 입력창도 같이 줄임"으로 확정**(AskUserQuestion 3회) | (해소) — (1) `.query-filter-group__field{align-items:stretch}` 명시. (2) `input[type=date]{max-width:140px}`(122px 이하에서 일자가 잘리는 걸 스크린샷으로 확인해 140으로 확정) + `.query-filter-group__field` flex-basis/min-width 110→68px(키워드는 150px 유지 — 라디오 두 개 때문에 그 밑에선 헤더 자체가 줄바꿈됨) + `.query-filter-group__fields` gap 12→8px + SplitPane `defaultRatio` 0.5→0.67(M-42(a) 대체). 기본 창(1100px)에서 양쪽 다 줄바꿈 없이 높이 77px vs 79px(2.2px 차이, 넓은 창에서 줄바꿈 없을 때와 동일한 반올림 오차)로 수렴 |
| M-13 | ~~트랙 최소 높이(목업 90/120px vs 앱 140px) 통일값~~ — 결정(RT-47, 2026-09-22): 목업 값 채택(위 90px/아래 120px). ~~기본 창 크기(1100px) 반영 여부~~ — **결정(RT-49, 2026-09-23, 사용자 확인): 반영함**(`src/main/index.ts` 900→1100px, 높이 760은 유지). **재정정(2026-09-23, 사용자 요청): 1100→1200px**(목업 `#optW` 슬라이더 min/max/기본값·`#stage` 초기 폭, 실제 앱 `src/main/index.ts` `width` 모두 1200으로 갱신, 높이 760은 그대로) | (전부 결정됨, 화면 폭은 1200px로 재정정) |
| M-47 | **RT-50/M-45/M-46 이후 사용자가 "현재 구현 기준 요구사항"으로 제시한 3건 중 하나(2026-09-23)**: 처음엔 "파일 추가 팝업 초기 화면엔 트리가 안 보인다"는 관찰이었으나, 실측(Playwright로 실제 앱 확인)해보니 **Preview를 먼저 실행하면 트리가 바로 보여서(U-19 그대로 정상 동작) 버그가 아니었다** — 사용자가 Preview 실행 전에 팝업을 열어봤을 가능성이 크다고 스스로 정정(`AddFilesPopup.tsx`의 `headTreeFiles.length===0` 분기가 "Preview 후 사용할 수 있습니다" 안내만 보여주는 걸 검색어 유무로 착각). 그 결과로 나온 새 요구사항: **"+ 파일 추가" 버튼을 Preview 실행 전엔 아예 클릭 못 하게** — 안내 문구를 보여주는 대신 버튼 자체를 비활성화 | 해소 — `IncludedFilesPane.tsx`에 `headTreeFiles` 구독 추가, 버튼에 `disabled={headTreeFiles.length===0}` + 비활성 시 안내하는 `title`. 목업(`btnAdd`)도 `st.phase`가 `ready`/`depLoading`/`depNa`가 아니면 같은 방식으로 비활성 처리해 동기화 |
| M-48 | "최대 [N]개" 입력창(`MaxCountField`, `SearchConditionGroup`)의 폭이 브라우저 기본값(153px)이라 숫자 3~4자리 입력엔 과하게 넓다는 사용자 지적(2026-09-23) | 해소 — 1/3인 51px로 축소(`MaxCountField.tsx`에 `className="max-count-field"` 추가, `commitQueryBar.css`에 `width:51px`) |
| M-49 | **REQ-016(파일명으로 커밋 검색) 폐기 결정(2026-09-24, 사용자 요청)** — 키워드 필드의 "메시지"/"파일명" 검색 대상 라디오를 없애고, 키워드는 항상 커밋 메시지만 대상으로 한다(제외는 `-` 접두, 여러 조건은 줄바꿈 — 기존 메시지 모드 동작 그대로). 이 요청을 처리하는 과정에서 무관한 사전 결함을 하나 더 발견·수정: `repositorySlice.reload.test.ts`의 "기간이 '지금' 기준으로 다시 계산된다" 테스트가 기준값을 `toISOString()`(UTC)으로 계산하는데 실제 로직(`getDefaultDateRange`)은 로컬 시간 기준이라, KST 자정~오전 9시 사이엔 날짜가 하루 어긋나 실패했다(2026-09-24 자정 직후 재현) — 테스트가 같은 함수로 기준값을 잡도록 수정 | 해소 — 제거 범위: `shared/types.ts`(`CommitSearchMode` 타입·`ListCommitsParams.searchMode` 필드), `main/git/commits.ts`(파일명 모드 git 분기 전체, `matchesFileName`, `listTrackedFiles` import), `main/git/commits.test.ts`(파일명 모드 describe 블록), `services/commitQueryParams.ts`/`.test.ts`, `store/slices/commitQuerySlice.ts`(state·액션·리셋), `store/slices/commitsSlice.ts`(파라미터 조립 2곳), `store/repositorySlice.reload.test.ts`, `components/QueryFilterGroup.tsx`(라디오 UI, 파일명 모드 전용 경고, 키워드 필드를 다른 두 필드와 같은 `<label>` 구조로 통일), `components/BranchSearchBar.tsx`(`buildKeywordSummary`가 이제 모드 라벨 없이 키워드 없으면 요약에서 통째로 빠짐, 작성자/해시 필터와 동일한 방식), `commitQueryBar.css`(`.query-filter-group__mode-radios`·`--keyword` 변형 삭제, 세 필드가 이제 완전히 동일한 폭 규칙 공유), `e2e/query-filter-group.spec.ts`(파일명 모드 테스트 삭제). REQUIREDMENT.md REQ-016은 "문서 관리 원칙"에 따라 지금 안 건드리고 RT-60(문서 정식 병합) 때 삭제 반영 — REQ-022/023의 "검색(메시지/파일명)" 언급도 그때 같이 정리. 검증: `npm test`(236개, 파일명 모드 테스트 2건 삭제로 238→236)·`typecheck`·`lint`·`build`·`test:e2e`(23개, 파일명 모드 테스트 1건 삭제로 24→23) 전부 통과 |
| M-50 | "포함된 파일" 툴바의 패턴 입력창(`FilterPatternBar`)이 `flex:1`이라 353px까지 늘어나 있다는 사용자 지적(2026-09-24) — 200px로 고정해달라는 요청 | 해소 — `filterPattern.css`의 `.filter-pattern-bar__row input[type='text']`를 `flex:1;min-width:160px` → `flex:0 0 200px;min-width:200px`로 변경(더 이상 안 늘어나고 정확히 200px) |
| M-51 | M-50(200px 고정) 직후 사용자가 "패턴 입력란을 파일 패턴 팝업으로 옮길까?"로 제안(2026-09-24) — 툴바가 좁아서(200px 고정) 패턴 입력이 비좁다는 문제의식. 옮기면 팝업에서 추가한 게 "포함된 파일" 목록에 즉시 반영되는지 사용자가 확인 질문 → zustand 스토어 구독 구조상(툴바·팝업·`useIncludedFilesView` 모두 같은 `filePatterns` state를 구독) 인라인이든 팝업이든 같은 리액트 트리라 즉시 반영됨을 근거로 답변 → 순서도로 시각화 요청에 답한 뒤 "승인" | 해소 — 패턴 추가 입력(모드 선택·텍스트 입력·`+추가` 버튼·붙여넣기 처리·해석 오버레이·피드백 메시지·`PatternPreviewLine`)을 `FilterPatternBar.tsx`에서 `FilterPatternsPopup.tsx`로 전부 이동, 제외/포함 칩 구역 위에 렌더링. `FilterPatternBar.tsx`는 요약("패턴: 활성 N개")과 팝업 여는 "보기+추가" 버튼만 남은 얇은 툴바로 축소 — 이 버튼이 이제 패턴 추가의 유일한 진입점이라 `filePatterns.length===0`이어도 더는 비활성화하지 않는다. `FilterPatternsPopup.tsx`의 "패턴이 0개면 자동으로 닫는다" `useEffect`도 삭제(0개에서 추가를 시작하는 화면이 됐으므로). `filterPattern.css` — `.filter-pattern-bar__row`/입력 스타일 삭제, `.filter-patterns-popup__add-row`(`flex:1`, `min-width:200px` — 720px 폭 팝업 안이라 툴바 때보다 넓게 씀) 추가. e2e — `included-files-pane.spec.ts`의 `clearAllPatterns` 헬퍼(버튼 이름 "보기"→"보기+추가", 자동 닫힘 의존 제거하고 직접 닫기 추가), `work-area-popups.spec.ts`의 패턴 테스트(팝업 먼저 열고 그 안에서 입력·추가, 마지막 기대값을 "자동으로 닫힘"에서 "계속 열린 채 양쪽 구역 모두 '없음'"으로 변경). 검증: `npm run typecheck`·`lint` 클린, `npm test`(233개 그대로, 카운트 변화 없음), `npx playwright test`(전체 23개) 전부 통과, 추가로 임시 스크린샷 4장으로 툴바→팝업 열기→입력→추가 흐름과 뒤 툴바의 "활성 N개" 실시간 갱신을 육안 확인 후 삭제 | **해소(2026-09-24)** |
| M-52 | M-51(패턴 입력을 팝업으로 이동) 직후 사용자 요청(2026-09-24): "포함된 파일" 검색란 가로 길이를 절반으로 줄이고, 패턴 요약("패턴: 활성 N개")·"보기+추가" 버튼을 검색란 오른쪽 같은 줄에 배치 | 해소 — `IncludedFilesPane.tsx`의 toolbar를 `<div className="included-toolbar-row">`로 감싸 검색창과 `FilterPatternBar`를 한 줄에 배치. `filterPattern.css` — `.included-toolbar-row`(`display:flex;align-items:center;gap:8px`) 신설, `.included-search-bar`를 `width:100%`→`width:50%`로 축소, `.filter-pattern-bar`를 자기 줄을 독점하던 `flex-direction:column;width:100%`에서 `flex:1;justify-content:flex-end`(남는 오른쪽 공간을 채우고 내용을 오른쪽 끝에 붙임)로 변경. 검증: `typecheck`·`lint` 클린, `npm test`(233개)·`npx playwright test`(전체 23개) 전부 통과, 임시 Playwright 스크린샷+`boundingBox()` 실측(검색창 285px/전체 570px = 정확히 절반, 패턴 요약이 오른쪽에 바로 붙어 있음)으로 확인 후 삭제 | **해소(2026-09-24)** |
| M-53 | 사용자 버그 보고(2026-09-24): "선택한 경로에 바로 추출"(`direct` 모드)에서 실제로는 비어 있는 `/Users/.../Downloads/git-deploy-extracted` 폴더를 선택했는데도 NOT_EMPTY 오류가 계속 뜸 — GDE를 켠 채로 폴더 내용을 지워서 stale 상태를 보는 게 아니냐는 의심. 실측(`ls -la`)해보니 진짜 원인은 macOS Finder가 그 폴더를 열람하면서 남긴 `.DS_Store`였다 — `deployDirHasContent`(`buildPackage.ts`)가 `fs.readdir` 결과 엔트리 개수만 보고 판단해서, 점 파일도 그대로 "내용물"로 셌다 | 해소 — `buildPackage.ts`에 `IGNORED_METADATA_FILES`(`.DS_Store`·`Thumbs.db`·`desktop.ini`) 세트를 추가하고 `deployDirHasContent`가 이 파일들을 제외한 엔트리가 하나라도 있을 때만 true를 반환하도록 변경(`entries.length > 0` → `entries.some(e => !IGNORED_METADATA_FILES.has(e))`). 이 함수는 `direct` 모드의 NOT_EMPTY 판정(`validateExportTarget.ts`)과 `sub` 모드의 덮어쓰기 확인 팝업(`ipc/handlers/package.ts`) 둘 다에서 쓰여 양쪽 다 같이 고쳐진다. 실사용 재현: `/Users/.../Downloads/git-deploy-extracted`에 실제로 `.DS_Store`가 남아 있음을 확인 후 삭제해 즉시 해결됨을 검증. `validateExportTarget.test.ts`에 2건 추가(메타데이터 파일만 있으면 통과, 메타데이터+실제 파일이 같이 있으면 여전히 NOT_EMPTY). 검증: `typecheck`·`lint` 클린, `npm test`(235개, +2)·`npx playwright test`(전체 23개) 전부 통과 | **해소(2026-09-24)** |
| M-54 | 사용자 요청(2026-09-24): "Extract 대상" 패널의 "모두 되돌리기" 버튼을 제목 텍스트("Extract 대상 (N개)") 우측 끝에 배치 — 좌측 "포함된 파일" 패널이 "+ 파일 추가"를 이미 같은 방식(제목 줄 우측, RT-45/U-3)으로 두고 있어 좌우 패턴을 맞추는 요청 | 해소 — `ExtractTargetsPane.tsx`의 `title`을 프래그먼트로 바꿔 카운터 텍스트 옆에 버튼을 같이 넣고(`FilePane`의 `.file-pane__title`이 이미 `display:flex;justify-content:space-between`이라 별도 레이아웃 작업 없이 우측 정렬됨), 본문 상단에 버튼만 담겨 있던 `.file-list__header-row` div는 제거(내용이 비게 되므로). `filePane.css`에 `.file-pane__title-action{flex-shrink:0}` 신설(`.add-file-button`과 같은 역할이지만 "파일 추가"라는 이름이 되돌리기 버튼엔 안 맞아 별도 클래스로 뺐다) — 헤더 행 재사용 코멘트도 갱신(취소선 정정, 이제 IncludedFilesPane의 "전체 선택"만 그 클래스를 씀). 검증: `typecheck`·`lint` 클린, `npm test`(235개)·`npx playwright test`(전체 23개) 전부 통과, 임시 스크린샷으로 "Extract 대상 (1개)" 오른쪽 끝에 버튼이 붙은 걸 육안 확인 후 삭제 | **해소(2026-09-24)** |
| M-55 | 사용자 요청(2026-09-24): 패턴 요약 텍스트를 "활성 N개"(포함/제외 합산)에서 "포함 N개/제외 N개"로 나눠 표기, 팝업 여는 "보기+추가" 버튼 텍스트를 "설정"으로 변경 | 해소 — `FilterPatternBar.tsx`에서 `activePatterns`를 `mode`로 한 번 더 나눠 `activeIncludeCount`/`activeExcludeCount`를 계산, 배지 텍스트를 `포함 {N}개/제외 {N}개`로 변경. 버튼 라벨을 `보기+추가`→`설정`으로 변경(툴팁 텍스트는 요청 범위 밖이라 그대로 둠). `e2e/work-area-popups.spec.ts`·`e2e/included-files-pane.spec.ts`의 버튼 셀렉터(`getByRole('button', { name: '보기+추가' })`)를 `'설정'`으로 갱신, `FilterPatternsPopup.tsx` 코멘트의 버튼 이름 언급도 갱신. 검증: `typecheck`·`lint` 클린, `npm test`(235개)·`npx playwright test`(전체 23개) 전부 통과, 임시 스크린샷으로 "패턴: 포함 1개/제외 1개 [설정]" 표기 확인 후 삭제 | **해소(2026-09-24)** |
| M-56 | 사용자 요청(2026-09-24): "포함된 파일" 파일명 검색란 placeholder 문구를 바꾸고 싶다며 제안을 요청. 기존 문구 `파일명 검색... (* 와일드카드 가능, 화면에만 적용)`는 285px 폭(M-52로 절반 축소된 뒤)에서도 잘리진 않지만 다소 길고 설명체였음. 4가지 안(정보 유지+간결화/구체적 예시로 대체/최소화/직접 입력)을 제시하고 AskUserQuestion으로 선택받음 — **"구체적 예시로 대체"** 채택 | 해소 — `IncludedFilesPane.tsx`의 검색 입력 placeholder를 `파일명 검색... (* 와일드카드 가능, 화면에만 적용)` → `파일명 검색 (예: *.java)`로 변경("화면에만 적용" 설명은 생략됐지만, 이 정보는 검증란 아님 — 필요시 별도 요청으로 재검토). 참고 대상 텍스트를 참조하는 e2e 셀렉터는 없었음(`getByLabel('포함된 파일 검색')`만 사용). 검증: `typecheck`·`lint` 클린, `npm test`(235개)·`npx playwright test`(전체 23개) 전부 통과 | **해소(2026-09-24)** |
| M-57 | 사용자 요청(2026-09-24): "문서 업데이트할 것 남아있는지 확인" — 점검해보니 `REFACTORING_TASKS.md`·`HANDOFF.md`는 M-45~M-56 전부 빠짐없이 반영돼 있었지만, `docs/refactoring/component-playground.html`(목업)이 M-46(B안 검색 부활)부터는 동기화가 끊겨 있었다(이번 세션에서 M-13/M-14 재정정·M-47만 반영되고 그 이후 M-50~M-52·M-55·M-56은 누락). AskUserQuestion으로 "지금 갱신"/"동결(정책대로 방치)" 중 선택받음 — **"지금 갱신"** 채택 | 해소 — 목업에 M-46(B안 검색)·M-50~M-52(패턴 입력을 팝업으로 이동 + 검색·패턴 요약 한 줄 배치)·M-55(포함/제외 분리 표기·"설정" 버튼명)·M-56(검색 placeholder)을 전부 반영: `st.includedSearchTerm` 신설(+ `matchesFileName()` 유틸을 `lib/matchesFileName.ts`와 동일 규칙으로 이식), `view()`가 패턴 필터(숨김 배지용)와 검색 필터(화면 표시용)를 분리된 두 단계로 계산하도록 변경, `leftPane()`의 인라인 패턴 입력 줄을 검색창(50%)+패턴 요약(오른쪽 끝) 한 줄로 교체, 패턴 추가 입력 전체(모드 선택·입력창·해석 오버레이·+추가·피드백)를 `popupHtml()`의 `'patterns'` 케이스 안으로 이동, 패턴이 0개가 돼도 팝업을 자동으로 닫던 로직 제거, `summaryText()`를 포함/제외 분리 표기로 변경, 검색 placeholder를 `파일명 검색 (예: *.java)`로, "보기" 버튼을 "설정"으로(좌측 인라인 버튼·사이드바 디버그 컨트롤 버튼 둘 다), `setOpen('patterns')`에 패턴 입력창 자동 포커스 추가(실제 앱의 `autoFocus` 재현), `dump()`의 상태 패널 라벨을 `FilterPatternBar [L]`→`FilterPatternsPopup [L]`로, Preview 재실행/Reload 두 초기화 지점에 `includedSearchTerm` 리셋 추가. 검증: 로컬에 캐시돼 있던 Playwright Chromium 브라우저 리비전이 오래돼(`npx playwright install chromium`으로 갱신 필요) 목업 자체는 실제 앱 코드가 아니라 typecheck/lint/test 대상이 아니므로, 임시 스크립트로 headless Chromium을 직접 띄워 3가지 상태(검색+패턴 요약 한 줄 배치, 패턴 추가 입력이 팝업 안에 있음, 검색으로 좁혀진 목록과 빈 결과 안내)를 스크린샷으로 육안 확인 후 스크립트·스크린샷 삭제 | **해소(2026-09-24)** |
| M-58 | 사용자 질문 연쇄(2026-09-24): "+ 파일 추가를 전체 선택 체크박스 행으로 옮기면 어떨까?"에 대해선 타이틀 줄 우측 대칭(M-54와의 일관성)·배지 발견성을 근거로 현행 유지를 추천해 그대로 뒀다. 이어서 "조회 조건↔커밋 간격이 커밋↔배포 대상 파일 간격보다 커 보이는 게 착시냐"는 질문 — Playwright로 실측(`.collapsible-section` 3개의 bounding box)해 두 간격이 정확히 8px로 동일함을 확인, 후자에만 있는 SplitPane 핸들의 2px 수평선이 기준점 역할을 해 대비 착시를 일으킨다고 답변. 이어서 "그 수평선을 지우면 상하 리사이즈 기능에 영향 있냐" — `SplitPane.tsx` 코드 확인 결과 드래그 이벤트는 `.split-pane__handle`(8px 히트 영역)에 걸려 있고 `.split-pane__handle-bar`(2px 선)는 순수 장식용 자식 `<div>`라 영향 없음을 확인, 다만 3곳(가로 2·세로 1)이 공유하는 컴포넌트라 지우면 전부 같이 사라진다고 답변 — 수평선은 유지하기로 결론. 그다음 실제 요청: "전체 선택 체크박스를 파일명 검색 왼쪽으로 옮기고, 원래 있던 행은 삭제하면 사용성에 나쁜 영향이 있냐" — sticky는 애초에 toolbar가 스크롤 영역 밖이라 영향 없지만, 트리 행 체크박스와의 열 정렬 단서·구분선(`border-bottom`)을 잃는다고 답변, "구분선만 옮겨 유지" 절충안을 제안했으나 사용자가 그림으로 그려달라고 요청 → ASCII 다이어그램 3장(AS-IS/구분선까지 삭제/구분선만 이동)으로 시각화 → "그렇게 구현하자" 승인 | 해소 — `IncludedFilesPane.tsx`: "전체 선택" `TriStateCheckbox`를 `.file-list__header-row`(파일 목록 스크롤 영역 맨 위, sticky)에서 `toolbar`(`.included-toolbar-row`) 맨 왼쪽으로 이동, 이제 빈 `.file-list__header-row` div 자체를 제거. 새 구분선 CSS를 추가할 필요는 없었다 — `panel-frame__header`(`panel.css`)가 title+toolbar 전체 아래에 이미 갖고 있던 `border-bottom`이, 체크박스가 그 toolbar 안으로 들어오면서 자동으로 "검색 줄 바로 아래"가 된다. `filePane.css`에서 `.file-list__header-row` 규칙(sticky·z-index·background·padding-bottom·자체 border-bottom) 전체 삭제, 그 자리에 이동 경위만 남기는 코멘트로 교체. `filterPattern.css`의 `.included-toolbar-row` 코멘트에 M-58 갱신. 목업(`component-playground.html`)도 동일하게 반영: `bodyFor('left')`의 `FileListHeaderRow`(`#chkAll`) 블록 삭제, `leftPane()`의 `toolbarRow` 맨 앞에 `#chkAll` 체크박스 추가(`.files`의 기존 `border-top`이 이미 정확히 그 자리에 있어 마찬가지로 새 구분선이 필요 없었다). e2e/유닛 테스트 중 이 체크박스를 클래스·위치로 셀렉팅하는 테스트는 없어 갱신 불필요. 검증: `typecheck`·`lint`·`npm test`(235개)·`npx playwright test`(전체 23개) 전부 통과, 실제 앱 스크린샷으로 체크박스가 검색창 왼쪽에, 구분선이 그 줄 바로 아래로 온 것을 확인, 목업도 headless Chromium 스크린샷으로 동일하게 확인 후 임시 파일 삭제 | **해소(2026-09-24)** |
| M-46 | **RT-50/M-45 이후 사용자와의 Q&A(2026-09-23)에서 나온, 아직 결정 안 된 UX 이슈**: "화면만"(screenOnly, M-1) 체크박스의 의도가 사용자에게 바로 안 와닿음 — 라벨이 축약형이라 툴팁 없인 뜻을 알기 어렵고, 추가 시점(FilterPatternBar)·사후 전환(FilterPatternsPopup) 두 곳에 중복 노출됨. 제안한 3안: **(A) 라벨 문구를 명확하게 바꾸고 중복 노출 제거(툴바 체크박스는 없애고 팝업에서만 관리)** / (B) U-5에서 지운 파일명 검색을 Export와 완전 무관한 별도 UI로 되살려 패턴에서 "화면 전용" 역할 자체를 떼어냄(U-5 재검토, 범위 큼) / (C) 현행 유지(이미 툴팁으로 설명됨). 사용자가 A/B/C 중 고르지 않고 "왜 애초에 양쪽 패널을 다 거르게 됐는지"로 화제 전환 → 답변(오른쪽 효과는 RT-51 Extract 모델 도입으로 필연적으로 생김, 왼쪽 효과는 REQ-019(v0.4.0)부터 있던 원래 동작, 그 위에 U-5가 "검색 대체" 역할을 얹으면서 혼란 발생) 후 "결론만 말하자면..." 정리 시도 → 그 정리에 두 가지 사실 오류(AddFilesPopup으로 추가한 파일이 왼쪽 목록에 들어간다는 것, Extract 대상엔 "추출될 파일만" 있다는 것)가 있어 코드 근거(`deployFilesSlice.ts` `addManualFile`/`addDependencyToExtract`가 `included:true`로 바로 Extract에 넣음, §3.2 "패턴 제외" dim 표시)로 정정함. 사용자가 "그럼 기존 요구사항을 정정해야겠다"고 했다가, §0.1 용어 정의(왼쪽="변경 파일"만, 수동 추가는 명시적으로 "변경 파일이 아님")가 2026-09-21 최초 작성 이후 실제로는 한 번도 안 틀렸다는 걸 재확인하고 보류. **다음 대화에서 B안(검색 부활)으로 방향을 정하고 세부 설계까지 확정**했다(검색은 왼쪽 "포함된 파일"에만·오른쪽엔 안 만듦, 매칭은 기존 `lib/matchesFileName.ts` 재사용, `screenOnly` 필드는 완전히 제거) — 구현 착수 전에 사용자가 "아, 내가 선택지를 잘못 이해했다"며 완전히 다른 화제(현재 구현 기준 요구사항 3건, M-47·M-14·M-13)로 전환해 한동안 보류돼 있었으나, **2026-09-24 "B안 구현 승인"으로 확정 설계 그대로 구현 완료했다.** 제거 범위: `lib/filePattern.ts`(`FilePattern.screenOnly` 필드)·`lib/filePatterns.ts`(마이그레이션에서 무시)·`services/exportPlan.ts`·`lib/useIncludedFilesView.ts`·`lib/useExtractTargetsView.ts`(전부 `filter(p => !p.screenOnly)` 삭제, 그냥 `filePatterns` 직접 사용)·`store/slices/deployFilesSlice.ts`(`addFilePatterns`에서 `screenOnly` 매개변수 삭제, `togglePatternScreenOnly` 액션 삭제)·`FilterPatternBar.tsx`("화면만" 체크박스 삭제)·`FilterPatternsPopup.tsx`(칩별 "화면만" 토글 버튼 삭제, 감싸던 `<span>` wrapper도 걷어내고 `Chip`을 바로 반환)·`filterPattern.css`(`.filter-pattern-bar__screen-only`·`.filter-patterns-popup__screen-only-toggle*` 삭제). 새로 추가: `deployFilesSlice.ts`에 `includedSearchTerm`/`setIncludedSearchTerm`(생명주기는 `headTreeFiles`와 동일 — `emptyManualAddState`에 편입돼 Preview 재실행·Reload 때 함께 초기화), `useIncludedFilesView`가 `searchTerm` 파라미터를 받아 패턴 필터링 뒤에 `matchesFileName` 한 번 더 체이닝, `IncludedFilesPane.tsx` 툴바에 검색 입력창(패턴 입력 줄 바로 위, 자기 줄 전체 차지) + 빈 상태 문구 분기(검색어 있으면 "검색어와 일치하는 파일이 없습니다" 우선). e2e — `included-files-pane.spec.ts`의 옛 "화면만" 테스트 2건을 검색 기능 테스트 2건(화면만 걸러내고 Extract엔 무관함, `*` 와일드카드 + 빈 결과 안내 문구)으로 교체, 첫 번째 테스트 이름도 "Filter·검색 UI가 없고"에서 "상태 Filter UI가 없고"로 정정(검색 UI는 이제 있으므로). 검증: `npm test`(233개, screenOnly 테스트 3건 삭제로 236→233)·`typecheck`·`lint`·`build`·`test:e2e`(23개, 화면만 2건→검색 2건 교체라 개수 동일) 전부 통과 | **해소(2026-09-24) — B안 구현 완료** |

---

## 8. 검증 계획

1. **P0 이후 모든 PR**: `npm run typecheck` · `npm run lint` · `npm test`(RT-01) · Playwright 3개 시나리오(RT-02).
2. **동작 불변 단계(P2~P4 구조 변경분)**: 변경 전후 Export 결과물(복사된 파일 바이트, 그리고 U-17 이전까지는 `deploy-files.txt`·`deploy-summary.json`, 이후에는 `extract-list.txt`)을 동일 fixture 저장소로 diff.
3. **UI 변경분(P4의 U-1~U-10)**: 목업과 실제 앱을 같은 상태로 두고 스크린샷 비교(헤드리스 Chrome 스크린샷 방식은 목업 작업 중 사용).
4. **패턴 매칭**: §3.1의 19개 케이스를 유닛 테스트로 고정. 신규 케이스는 여기에 추가.
5. **R1**: `--output=`을 해시 필터에 넣었을 때 파일이 생성되지 않음을 자동 테스트로 확인.
