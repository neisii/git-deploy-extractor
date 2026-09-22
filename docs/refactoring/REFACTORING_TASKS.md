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
| U-5 | **포함된 파일의 검색(파일명) 삭제** | 파일 패턴(제외/포함)으로 대체. **우측 "누락된 의존성" 검색은 유지**(패턴이 그쪽엔 적용되지 않으므로). ⚠ 미결 M-1 참고 | REQ-025 폐기, `deployFilesSearchTerm` |
| U-6 | **세 영역 접기/펼치기** | `CommitQueryBar`·`CommitWorkspace`·`DeployFilesWorkspace` 우측 상단 버튼. 접힌 헤더에 한 줄 요약. `section:hide`/`section:show` 이벤트 발행 | RISK §8.3 |
| U-7 | **파일 패턴: 제외 + 포함** | 아래 §3.1 | REQ-019/024, REQ-026 재정의 |
| U-8 | **키워드 검색 통합(A안, 간단형)** | 검색 대상(메시지/파일명)+Search 입력과 메시지 제외 입력을 **하나의 텍스트 영역**으로 통합. 한 줄에 하나, **앞에 `-`를 붙이면 제외**, 글자 그대로(대소문자 무시) 부분 일치(정규식·`*` 없음), 포함 OR·제외 OR. 검색 대상 선택은 키워드 필드 헤더에 둠. 메시지 제외 입력은 폐지. 상세 RT-48 | REQ-003·REQ-016·REQ-022 정정 |
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
- [ ] **RT-24** `git/exec.ts`: 사용자 입력이 인자로 가는 모든 호출에서 옵션 인젝션 방지 규약(`--` 사용) 통일

### P3 — 스토어 분해 (동작 불변)

- [ ] **RT-30 (S6·L6)** `renderer/src/api/`: `window.api` 래퍼(테스트에서 교체 가능)
- [ ] **RT-31 (S1)** slice 분리: `repository` · `commitQuery` · `commits` · `analysis` · `deployFiles` · `export` · `update`
- [ ] **RT-32 (S2·S3)** `services/commitQueryParams.ts`로 파라미터 조립 단일화, `useDebouncedAction` 훅으로 타이머 분리
- [ ] **RT-33 (S1)** `services/exportPlan.ts`: Export 대상 파일 계산(Extract 목록 + 패턴 적용, RT-51 이후 기준)을 순수 함수로
- [ ] **RT-34** 파생 훅: `useIncludedFilesView`, `useMissingDependenciesView`, `useAnalysisPhase`(empty/stale/loading/ready/error 한 곳에서 파생)

### P4 — 컴포넌트 재정의 + UI 변경 (§2, §3 반영)

- [ ] **RT-40** primitives: `Panel`, `PanelState`, `Chip`, `TriStateCheckbox`, `CollapsibleSection` (+ RT-15의 `Popup`)
- [ ] **RT-41 (S4·U1)** `FileListColumn` 해체 → `FilePane`(슬롯) + `FileList` + `FileRow` + 훅 `useMeasuredColumnWidth`(**가상 스크롤의 가로 스크롤 폭용으로만 유지**) · **컬럼 리사이즈 핸들·`Local Path` 헤더 글자·`useColumnResize`·컬럼 폭 `localStorage` 저장은 삭제**(컬럼이 하나뿐이고 행에 파일명만 보임, 2026-09-21) · 좌우 패널은 stale에서도 언마운트하지 않고 `PanelState`만 본문에 삽입
- [ ] **RT-42** `IncludedFilesPane` 조립, `DeployFilesWorkspace`에서 로직 제거(누락된 의존성은 RT-52의 팝업 HEAD 트리로 이동)
- [ ] **RT-43** `openPopup`을 `WorkArea`로 이동, `PopupHost` 도입(`'manual'|'patterns'|'deleted'|'warnings'`)
- [ ] **RT-44 (U-1·U-2)** Delete List 영역 삭제 → `Deleted` 팝업, `DeployFilesHeader` 삭제 → 경고 이전
- [ ] **RT-45 (U-3·U-5)** StatusFilter·좌측 검색 삭제, added 녹색(색맹 대응 마커 결정 M-2 후), `+ 파일 추가` 제목 줄 우측
- [ ] **RT-46 (U-7)** `FilterPatternBar` + `FilterPatternsPopup`: 제외/포함, 종류 파생, 해석 미리보기, 칩 매치 수. 저장 포맷 마이그레이션(기존 → `mode: 'exclude'`)
- [ ] **RT-47 (U-6)** `CollapsibleSection` 적용 3곳, `section:hide/show` 이벤트, `WorkArea` grid 행 재분배
- [ ] **RT-48 (U-8)** 메시지 제외: 구현 방식 결정(M-4) 후 `listCommits`·`MultiValueField` 반영
- [ ] **RT-51 (U-11)** Extract 대상 목록: ① `SplitPane`은 기존 2분할 그대로(미선택 변경 파일 | Extract) ② 상태 모델 변경 — `deployFiles[].included` 불리언을 "소속 목록" 의미로 재정의하고 마이그레이션(수동 추가·의존성 추가 경로 포함) ③ `ExtractTargetsPane`/`ExtractRow`/`RemoveButton`, `useExtractTargetsView` ④ Export 대상 계산(`RT-33 exportPlan`)이 Extract 목록 + 활성 패턴 기준이 되도록 변경
- [ ] **RT-52 (U-12·U-19·U-20)** `AddFilesPopup` 단일 화면(탭 없음): 툴바(검색 입력 + `보이는 항목 모두 추가 (N)` — 누락된 의존성 한정) · 분석 상태 안내 한 줄 · `HeadTreeBrowser`(HEAD 전체 트리, 기본 펼침 = 경로 세그먼트 1단계 ∪ 누락된 의존성 조상 폴더, 누락된 의존성은 붉은색+`Impl`/`I` 배지) · 수동 추가 칩. `+ 파일 추가` 버튼 배지(50 초과 경고 이월). `MissingDependenciesTab`·`HeadTreeSearchTab`·`MissingDependenciesPane` 및 해당 스토어 selector 정리, REQ-013/020 문서 갱신. 상세 §5.1 RT-52
- [ ] **RT-53 (U-13)** `TreeList` primitive(경로 배열 → 트리, compact 병합, 펼침 상태, `renderLeaf`/`renderFolder` 슬롯) + `useTreeExpansion` 훅. 6개 목록에 적용, 폴더 단위 이동/복귀(미선택 변경 파일·Extract), 평탄화 가상 스크롤과 실측 폭에 들여쓰기 반영. 순수 함수(`buildTree`, `compress`, `flatten`)는 vitest로 테스트(단일 파일·루트 파일·체인 병합·정렬) **+ (U-18) 리프·폴더 행 경로 복사 버튼(상세 명세 §5.1 RT-53).**
- [ ] **RT-54 (U-14)** `Popup` primitive 기본 크기 720×480 + 부모 높이 클램프(RT-15와 함께)
- [ ] **RT-55 (U-15)** Reload 전체 초기화: 스토어에 `commitQuery.reset()`(기본 기간 재계산 포함), `commits.clearSelection()`, `analysis.reset()`을 두고 `reloadRepository`가 이를 호출한 뒤 재조회. `keepSelection` 파라미터 경로(현재 Reload가 `true`)를 정리하고, REQ-015/RISK §6.1/DETAILED_DESIGN §8을 정정. vitest로 "Reload 후 모든 필드가 초기값" 회귀 테스트
- [ ] **RT-56 (U-16)** `ExportModeSelect` + `exportMode` 상태(영속) + 표시 경로 파생. **`direct`는 선택 폴더가 비어 있을 때만 허용(a안)**: Main에서 폴더 비어 있음 확인(IPC), 비어 있지 않으면 Export 비활성화·안내, `direct`에서 `fs.rm` 금지, 경로 미선택 시 비활성화. `sub`의 덮어쓰기 확인창은 유지. `BuildPackageParams`에 모드 필드 추가(IPC 검증 RT-12에 화이트리스트). vitest로 `getDeployDir` 모드별 결과·비어 있지 않은 폴더 거부·삭제 금지 회귀 테스트, 임시 폴더 통합 테스트 **추가: 추출 위치가 저장소와 겹치면(같음·저장소 안·저장소를 포함) Export 금지 검증(Main 권위, 저장소 변경·Reload·모드 변경·Export 직전 재검증) + 경로 미선택 시 기본값(저장소 루트) 폐지 — 상세는 §5.1 RT-56.**
- [ ] **RT-57 (U-17)** Export 산출물 변경: ① `deploy-summary.json` 생성·`DeploySummary` 삭제 ② `deploy-files.txt`+`delete-list.txt` → `extract-list.txt` 통합(경계선·섹션 제목·개수) ③ `treeText`(폴더 먼저·이름순·커넥터·체인 병합) + 머리말(생성 시각·기준 브랜치) 생성 순수 함수, vitest(빈 목록·루트 파일·체인 병합·정렬·한글 경로·머리말 형식·시각 주입으로 결정적 테스트) ④ `verify-phase3.ts`·README·ARCHITECTURE 갱신 ⑤ `BuildPackageParams`/`runExport` 불필요 필드 정리
- [ ] **RT-59 (U-21)** `RepositoryBar` 배치: `Browse...`·`Reload`·버전 배지를 저장소 바 **오른쪽 끝**에 모은다(상세 §5.1 RT-59)
- [ ] **RT-49 (U-9·U-10)** `CommitQueryBar` 레이아웃(작성자·해시 우측), 기본 창 크기 결정
- [ ] **RT-50 (S8)** `main.css` 분할(컴포넌트별 CSS), `WorkArea` 채움 규칙(`.fill`)을 공용 규칙으로

### P5 — 문서·정리

- [ ] **RT-60** 문서 동기화(§6) — REQUIREDMENT / UI_UX_SPEC / DETAILED_DESIGN / RISK_ISSUES(§7.5 와이어프레임) / ARCHITECTURE / HANDOFF
- [ ] **RT-61 (L4)** 루트의 `*.html` 3개(ambiguity-explainer, core-scenario-diagram, ui-wireframe)를 `docs/`로 이동 (이 문서와 목업은 `docs/refactoring/`으로 이동 완료)
- [ ] **RT-62 (L5)** untracked 파일 정리(`resources/icon 복사본.png`, `.gitignore`에 vim 스왑 추가)
- [ ] **RT-63** 릴리스: P3까지는 v0.6.0과 동작 동일 → 리팩토링 완료 후 별도 버전(예: v0.7.0) 결정(M-6)

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
- **검색 대상(메시지 | 파일명)**: 키워드 필드의 **헤더**에 라디오로 둔다(왼쪽 그룹에서 이동). 파일명 모드에서는 키워드가 HEAD 트리 파일명 부분 일치이고 **제외(`-`) 줄은 무시**하며 필드 아래에 "파일명 검색에서는 제외(-) 줄을 쓸 수 없습니다 — 무시됩니다"를 표시(레이아웃을 밀지 않는 작은 안내). 해석 오버레이는 만들지 않는다(placeholder·툴팁이 대신함).
- **안내**: placeholder "한 줄에 하나 / 앞에 - 를 붙이면 제외 / 예) guarantee / -Revert"를 유지하고, **입력을 시작하면 힌트 툴팁**(RT-49)에 "한 줄에 하나 · 앞에 -를 붙이면 제외 · 글자 그대로 검색(대소문자 무시, *·정규식 아님)"을 표시한다. **파일 패턴 입력(`*` 글롭)과 문법이 다르므로 파일 패턴 입력의 안내에는 "`*`는 와일드카드"를 명시**(RT-46).
- **다른 조건과의 관계**: 기존 조건(Branch·기간·Merge 제외·작성자)과 AND. **해시 필터가 있으면 다른 모든 조건과 함께 무시**(REQ-023).
- **git 구현(간단형 가정, M-4)**: 키워드를 정규식으로 해석하지 않도록 **`-P` 패턴 하나**에 모든 키워드를 `\Q…\E`로 감싸 넣는다: `(?s)\A(?=.*(?:\Qinc1\E|\Qinc2\E))(?!.*(?:\Qex1\E|\Qex2\E))`(포함이 없으면 앞 조건 생략), 대소문자 무시 `-i`. 키워드에 `\E`가 있으면 `\E\\E\Q`로 분리해 이스케이프. **현재 코드의 `--grep=<검색어>`는 기본 정규식(BRE)이라 `[skip ci]`가 거의 모든 커밋에 일치하는 결함이 있다**(임시 저장소에서 확인: 6개 중 5개) — 이 작업이 그 결함을 함께 해소한다. `-P`는 git 빌드에 PCRE가 있어야 하므로 내부망 개발 PC의 git에서 동작을 확인하고, 불가 시 대체(포함은 `-F`, 제외는 클라이언트 필터 + 페이지네이션 한계)를 정한다. `--author`도 정규식이지만 이번 범위 밖(별도 결함으로 기록).
- **IPC**: `ListCommitsParams.searchTerm`(단일) → `includeKeywords?: string[]`·`excludeKeywords?: string[]`(`searchMode`는 유지). `setSearchTerm`·`searchTerm` 스토어 상태를 키워드 원문(`keywordText`) 하나로 통합, 메시지 제외 상태·입력은 폐지.
- **화면 표시**: 선택된 커밋이 필터로 목록에서 빠져 있을 수 있으므로 카운터가 `N개 선택됨` + `(선택 중 K개는 화면에 안 보임)`을 보인다. git 쪽 필터는 숨겨진 개수를 알 수 없으므로 "숨김 M개"는 표시하지 않는다.
- **접힌 요약**: `메시지 "guarantee, payment" · 제외 1`처럼 포함 키워드(`, `로 연결)와 제외 개수.
- **수용 기준(vitest·통합)**: 줄바꿈 구분·빈 줄 무시·앞뒤 공백 제거 · `-` 접두 제외·`-`만 있는 줄 무시 · 쉼표·대괄호·`.`·`*`가 리터럴(`a.b`가 `axb`에 일치하지 않음, `[skip ci]`가 정확히 그 문구만) · 포함 OR·제외 OR·AND 결합 · 제외만 입력 · 파일명 모드에서 제외 무시 + 안내 · 대소문자 무시 · 해시 필터가 있으면 무시 · `\E`가 든 키워드의 이스케이프 · 임시 저장소로 `git log` 결과 검증 · 선택 커밋이 가려질 때 카운터 표시.

#### RT-49 — `CommitQueryBar` 레이아웃

- 섹션 헤더(제목 "조회 조건" + 접기 버튼, 접히는 본문 밖) 아래 본문을 **검색 조건 그룹 | 경계 | 필터 그룹**으로 나눈다. **각 그룹은 자기 테두리 상자**이고(본문 컨테이너 자체는 테두리 없음), 두 그룹 사이 **경계를 마우스로 드래그해 폭 비율을 조절**한다 — `SplitPane`(RT-42의 포함된 파일 ↔ Extract 대상과 동일 컴포넌트·동작). 기본 비율 **50:50**, 최소 폭 **왼쪽 320px / 오른쪽 330px**(두 최소 폭의 합보다 창이 좁으면 0.5로 수렴, 그때는 가로 스크롤 — 결정 대기 M-42), 비율은 `localStorage`(`gde:splitRatio:queryGroups`)에 저장하고 **Reload는 초기화하지 않는다**(레이아웃 설정). 핸들은 `col-resize` 커서, 툴팁 "드래그해서 검색 조건 ↔ 필터 폭 비율 조절".
  - **검색 조건 그룹(왼쪽)**: (1) Branch · `Search` 버튼(즉시 조회), (2) 조회 기간 · 최대 개수 · Merge 제외. 기본 폭(50%)에서 두 줄에 들어가고, 좁히면 줄바꿈될 수 있다.
  - **필터 그룹(오른쪽, `QueryFilterGroup`)**: **키워드 · 작성자 · 해시 필터** 텍스트 영역 세 개를 같은 줄에 나란히(키워드가 작성자의 왼쪽). **각 텍스트 영역은 정확히 2줄이 한 번에 보이는 높이**(`rows=2`, 그룹이 커져도 늘어나지 않음)이고 3줄부터는 영역 안에서 스크롤한다. 필드 헤더(라벨 줄) 높이는 통일하고 키워드 헤더에만 검색 대상 라디오(`메시지 | 파일명`)를 둔다. 키워드는 헤더가 한 줄에 들어가도록 다른 두 필드보다 넓다(flex 1.5 : 1 : 1, 필드 최소 폭 100px). **세 필드 모두 줄바꿈으로 구분(한 줄에 하나)**.
  - **placeholder는 유지하고, 입력을 시작하면 힌트 툴팁을 표시**(사용자 결정 2026-09-21): 값이 비어 있을 때는 placeholder("한 줄에 하나" 등)가 보이고, **값을 입력하기 시작해 placeholder가 사라지면 포커스가 있는 동안 그 필드 바로 아래에 힌트 툴팁**이 겹쳐 뜬다(아래 목록 레이아웃을 밀지 않음, 포커스를 잃거나 값을 지우면 사라짐, `aria-describedby`로 연결). 문구 — 키워드: "한 줄에 하나 · 앞에 `-`를 붙이면 제외 · 글자 그대로 검색(대소문자 무시, `*`·정규식 아님)"(파일명 모드에서 `-` 줄이 있으면 같은 툴팁 안에 경고 한 줄 추가), 작성자: "한 줄에 하나 · 이름 일부 일치(대소문자 무시) · 이름에 공백이 있어도 됨", 해시: "한 줄에 하나 · 입력하면 다른 모든 조건 무시 · 해시가 정확히 일치하는 커밋만(축약 해시 가능)". (마우스를 올려야만 보이는 `title` 툴팁은 쓰지 않는다 — 입력 중에는 보이지 않으므로.)
- **MaxCountField**: 입력 중 문자열은 로컬 유지, **blur/Enter에서만 확정**(비우면 이전 값 복원, 1 미만 거부), 값 변경마다 재조회하지 않음(U3).
- 기본 화면 폭 1100px 여부는 결정 대기 M-13.
- **수용 기준**: **검색 조건·필터 두 그룹이 각각 테두리 상자이고 사이 경계를 드래그로 조절(최소 폭 유지, 비율 저장·복원, 접었다 펼쳐도 유지)** · **키워드·작성자·해시 세 텍스트 영역이 같은 줄에서 왼쪽→오른쪽 순서로 나란히, 높이 동일, 정확히 2줄이 스크롤 없이 보이고 3줄부터 스크롤** · 키워드 헤더에 검색 대상 라디오 · **비어 있으면 placeholder만, 입력을 시작하면 포커스 중인 필드 아래에 힌트 툴팁(레이아웃 불변, 포커스 해제·값 삭제 시 사라짐)** · 폭 축소 시 아래로 줄바꿈 · 최대 개수를 지워도 1로 튀지 않음 · `Search` 버튼과 Ctrl/Cmd+Enter로 즉시 조회.

#### RT-55 — Reload 전체 초기화

- **Reload 누르면**: 저장소 재검증 → Branch 목록·원격 프로젝트명 재조회 → 아래를 **모두 기본값으로** → 첫 페이지 재조회.
- **초기화**: Branch(기본 브랜치), 검색 대상(메시지), 검색어(빈), **조회 기간(오늘-7일 ~ 오늘 재계산)**, 최대 개수(100), Merge 제외(체크), 작성자·해시·메시지 제외(빈), **커밋 선택(전부 해제)**, 분석 결과(요약·변경 파일·Extract·삭제·경고·누락된 의존성·수동 추가 → 폐기, Preview 다시 필요), 열려 있는 팝업(닫힘).
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

- **한 파일**로 생성: `<결과 폴더>/extract-list.txt` (`deploy-files.txt`·`delete-list.txt`·`deploy-summary.json`은 더 이상 생성하지 않음). 사람이 읽는 용도(프로그램이 읽지 않음). LF, UTF-8(BOM 여부는 결정 대기 M-31).
- **구조**:
  1. 머리말 블록: `=` 64자 / ` Extract 목록` / ` 생성 시각   : YYYY-MM-DD HH:mm:ss ±HH:MM` / ` 기준 브랜치 : <브랜치>` / ` 원본 커밋 (N개)` + 커밋 행들 / `=` 64자 / 빈 줄
     - **커밋 행(가정, M-32)**: 3칸 들여쓰기 + `<해시 7자리>  <YYYY-MM-DD>  <작성자>  <제목 한 줄>`, 작성자 열은 가장 긴 이름에 맞춰 정렬. **선택한 커밋 전체**가 대상이며 순서는 커밋 목록의 표시 순서(최신순).
     - **상한**: 기본 **10줄**. 초과하면 10줄 뒤에 `   … 외 K개` 한 줄. 커밋이 0개(해시 필터 등으로 비는 경우는 없음)면 `원본 커밋 (0개)`만 표시.
     - 제목은 개행 없는 첫 줄(git `%s`), 길이 자르지 않음.
  2. `=`64 / ` 배포 대상 파일 (N개)` / `=`64 / **트리** / 빈 줄
  3. `=`64 / ` 삭제 대상 파일 (M개)` / `=`64 / **트리**
- **트리**: `├── `·`└── `·`│   `·`    ` 커넥터, 폴더는 `이름/`, 폴더 먼저·이름순, 단일 자식 폴더 체인은 한 줄로 합침(화면과 동일), 목록이 비면 `  (없음)`.
- **내용**: 배포 대상 = Extract 목록 − 활성 패턴 해당 항목(서버 경로, 결정 대기 M-30). 삭제 대상 = 삭제 서버 경로.
- **코드**: `treeText(paths)`·`buildExtractListText({ branch, generatedAt, commits, files, deleted })` 순수 함수(시각 주입 → 결정적 테스트). `DeploySummary` 타입·`deploy-summary.json` 생성 코드 삭제, `BuildPackageParams`에서 요약 전용 필드 정리, `verify-phase3.ts`·README(33, 50행)·ARCHITECTURE §5(160~162행) 갱신.
- **수용 기준(vitest)**: 빈 목록 → `  (없음)` · 루트 파일 · 체인 병합 · 정렬(폴더 먼저) · 한글 경로 · 머리말 형식(고정 시각) · **커밋 행 형식·정렬·10줄 상한과 `… 외 K개`(0·1·10·11·25개 경계)** · 배포/삭제 개수가 제목과 일치 · 패턴 제외 항목이 배포 목록에 없음.

#### RT-59 — `RepositoryBar` 버튼·버전 배지 오른쪽 끝 배치 (U-21)

- **배치(사용자 결정 2026-09-21)**: 저장소 바의 **왼쪽**에는 `RepoLabel`(`<remote 이름> (<폴더명>) / <브랜치>`)만 두고, **`Browse...` · `Reload` · 버전 배지를 하나의 그룹(`RepoBarRight`)으로 묶어 오른쪽 끝에 정렬**한다(`margin-left: auto`, 그룹 내부는 줄바꿈 없음). 그룹 내부 순서는 현재 순서 그대로 `Browse...` → `Reload` → 버전 배지(마지막이 가장 오른쪽). 사용자 메시지에서 "버전, Reload, Browse..."로 나열했는데 순서 지정인지 단순 나열인지 불분명해 현행 순서를 유지했다(M-39).
- **폭이 좁아질 때**: 그룹은 라벨 아래 줄로 내려갈 수 있으나 **오른쪽 정렬을 유지**한다(목업 동작). 경로 라벨 말줄임 처리는 구현 시 결정.
- **동작은 그대로**: `Browse...`(저장소 선택), `Reload`(전체 초기화, U-15), 버전 배지(REQ-017 새 릴리스 강조·클릭 시 확인창).
- **수용 기준**: 버전 배지의 오른쪽 끝이 바 안쪽 오른쪽 끝과 일치(≤2px) · 좌→우 순서 `라벨 < Browse... < Reload < 버전` · 세 요소가 같은 줄 · 라벨은 왼쪽 유지 · Reload 등 기존 동작 불변.

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
| ARCHITECTURE.md · HANDOFF.md | 새 모듈 구조(§2 트리, 스토어 slice, `api/`·`services/`), 이 문서 포인터. **HANDOFF는 리팩토링 착수 시점에 "현재 P단계 + 이 문서 링크"를 먼저 추가**(새 세션이 §8 백로그만 보고 착수하지 않도록) · **ARCHITECTURE.md에 `main/ipc/validate.ts`(RT-12) IPC 검증 계층 추가 반영** |
| README.md | 3번 항목 `delete-list.txt`·8번 항목 `deploy-files.txt` → `extract-list.txt`로 정정(U-17), Reload·Export 경로 설명 갱신(U-15/U-16) |
| PRD.md | 47·85·86행의 `deploy-files.txt`/`delete-list.txt`/`deploy-summary.json` 언급을 `extract-list.txt`로 정정(REQ-009/010/011) |
| DOCUMENT_CHECKLIST.md · PHASE_PLAN.md | 변경 없음(초기 기획·진행 이력) |

---

## 7. 미결 사항

| ID | 질문 | 권장 |
|---|---|---|
| M-1 | 좌측 검색 삭제(U-5)의 위험: 검색은 화면만 걸러내지만 **패턴은 Export 대상까지 바꾼다.** 찾으려고 포함 패턴을 쓰고 끄기를 잊으면 조용한 배포 누락. (a) 그대로 삭제 + 포함 필터 ON 강조 / (b) 패턴 칩에 "화면만"(Export 미반영) 옵션 / (c) 검색 유지 | (b) |
| M-2 | added 녹색만으로 구분하면 색각 이상·흑백 캡처에서 안 보임 → `+` 마커 병행 여부 | 병행 |
| M-3 | 파일 패턴을 "누락된 의존성"·의존성 분석 스캔(§8.1)에도 적용할지 | 스캔 범위 적용은 별도 REQ로 |
| M-4 | 키워드 git 구현(간단형 가정: **`-P` 패턴 하나 + `\Q…\E`**, RT-48). 확인 필요: (1) 내부망 개발 PC의 git이 `-P`를 지원하는지, (2) 미지원 시 대체(포함 `-F` + 제외 클라이언트 필터, 페이지네이션 한계), (3) 키워드 내 `\E` 이스케이프 | `-P` 단일 경로, 미지원 시 대체 |
| M-5 | 해시 검증(R1): 16진수만 허용? 축약 해시·`HEAD~1` 같은 rev 표기 지원? 잘못된 입력은 무시 vs 표시 | 16진수만, 무효 입력은 표시 |
| M-6 | 릴리스 전략(리팩토링 완료 후 v0.7.0?) | 별도 버전 |
| M-7 | 접힘 상태 영속(localStorage) 여부, 팝업이 열린 채 접을 때 팝업 처리 | 미영속, 접을 때 팝업 닫기 |
| M-8 | 접혔을 때 `Preview` 버튼·`Deleted`/경고 개수 노출(현재 접으면 함께 숨겨짐) | 접힌 헤더에 Preview 유지, 경고 개수는 요약에 |
| M-9 | ~~패턴 요약 표기(H1)~~ — **결정: `활성 K개` + 호버 툴팁에 활성 패턴 목록**(RT-46). 이전 후보 `제외 N · 포함 M (K개 비활성)`·`활성 K개: 앞의 2개…`는 폐기 | (결정됨) |
| M-10 | ~~메시지 제외 필드 위치~~ — 메시지 제외 입력 폐지(키워드 필드의 `-` 줄로 통합, M-40) | (해소) |
| M-11 | 좁은 폭에서 "포함된 파일" 제목 줄(카운터+`+ 파일 추가`) 줄바꿈 처리 | 카운터를 둘째 줄로 |
| M-12 | `삭제 목록` 팝업의 표시 경로(서버 경로만 vs 로컬 경로 병기), stale 때 `Deleted` 버튼 처리 | 서버 경로, stale 시 숨김 |
| M-14 | Extract 도입 후 **미선택 변경 파일 목록의 의미와 이름**: 기본값이 "전체 Extract"면 시작 시 이 목록이 비어 "포함된 파일"이라는 이름이 어색하고, "전체 미선택"으로 바꾸면 체크를 잊었을 때 아무것도 Export되지 않음. 기본값·목록 이름("미선택 변경 파일"/"제외된 파일" 등) 결정 | 기본 전체 Extract 유지, 이름은 "제외된 파일" 계열 검토 |
| M-15 | ~~3분할 폭 문제~~ — U-12로 3분할이 사라져 **해소됨** | — |
| M-16 | 미선택 변경 파일 목록 체크의 실행 취소 방식: 지금은 되돌리기가 × 뿐. 이동 직후 토스트/실행 취소, 드래그 앤 드롭 필요 여부 | 불필요 |
| M-17 | 활성 패턴에 걸린 Extract 항목의 노출 방식(흐림+"패턴 제외") 확정, Extract 목록에 포함 패턴 모드가 적용될 때의 표시 | 현행 유지 |
| M-18 | 팝업 키 `'manual'` → `'addFiles'` 개명 여부(내부 이름만). (탭 제거로 "탭 상태 초기화" 항목은 해소됨) | 개명 |
| M-19 | 누락된 의존성 발견성: **채택된 보완**(붉은 표시 + `Impl`/`I` 배지 + 조상 폴더 자동 펼침 + 버튼 배지)으로 충분한지. 추가 알림(Preview 직후 팝업 자동 열기, `PreviewSummary`에 `⚠ 누락된 의존성 N ▸` 버튼)이 더 필요한지 | 실사용 후 판단 |
| M-20 | 트리 펼침 상태 저장 여부(현재 로컬·기본 전부 펼침), 파일 수가 많을 때(300개 초과) 기본 접힘 여부, 폴더 체크박스의 indeterminate 표시(일부만 이동된 폴더) 필요 여부 | 로컬·전부 펼침 유지, indeterminate는 미선택 변경 파일 목록에 불필요 |
| M-21 | ~~리프에 파일명만 표시하면 서로 다른 폴더의 같은 이름 파일 구분이 어렵다~~ — **경로 복사 버튼(U-18) + 기존 전체 경로 툴팁으로 해소**(경로 병기 옵션은 불필요로 판정) | (해소) |
| M-22 | Reload 초기화 범위: 파일 패턴 이력·Export 경로·접힘·분할 비율·트리 펼침을 유지하는 가정이 맞는지(특히 **파일 패턴**은 "필터링 조건"에 포함돼 초기화 대상일 수도 있음 — 영속 설정이라 유지로 가정) | 파일 패턴·Export 경로 유지 |
| M-23 | Reload가 `git fetch`도 수행할지(현재는 로컬 재조회만이라 새 원격 커밋이 안 보임) | 별도 요구로 분리 |
| M-24 | 선택/분석 결과가 있을 때 Reload 확인 대화상자 여부 | 있음(파괴적 동작) |
| M-25 | ~~`direct`에서 선택 폴더에 기존 파일이 있을 때 정책~~ — **(a)안(빈 폴더만 허용) 최종 확정·구현 대상**. (b) 병합 덮어쓰기는 **폐기**(사용자 확인: 내부망 저장소는 완전히 분리된 네트워크라 마운트/직접 덮어쓰기 사례가 없고 앞으로도 없음). (c) 통째 삭제는 금지 | (결정됨) |
| M-26 | ~~txt 소비자 확인~~ — **사용자 확인으로 종결**: txt는 사람이 보는 용도, 프로그램적 사용 없음. JSON 삭제, `deploy-files.txt`+`delete-list.txt` → 단일 txt(경계선 구분, 트리 표기) | (종결) |
| M-27 | 선택상자 라벨 문구·순서, 기본값 유지(`sub`) 및 모드 저장 여부(전역 저장 vs 세션) | 기본 `sub`, 전역 저장 |
| M-28 | ~~통합 txt 파일명~~ — **`extract-list.txt` 채택**(의견 제시 후 사용자 제안 수용) | (결정됨) |
| M-29 | ~~감사 정보 머리말~~ — **결정: 생성 시각·기준 브랜치명·원본 커밋 목록(몇 줄)을 머리말에 기재**. 경고·매핑 프로필은 남기지 않음 | (결정됨) |
| M-30 | 텍스트 트리에서 단일 자식 폴더 체인 합침 여부(화면과 동일하게 합침 가정 vs 파일 시스템 그대로 펼침), 경로를 서버 경로 기준으로 쓸지(가정) | 화면과 동일하게 합침 |
| M-31 | `extract-list.txt` 인코딩: BOM 없는 UTF-8이면 구형 Windows 메모장에서 박스 문자·한글이 깨질 수 있음 → BOM 추가 여부. 생성 시각의 시간대 표기(로컬+오프셋 가정) 확인 | UTF-8 BOM 검토 |
| M-32 | 머리말 원본 커밋 목록의 세부(가정): 행 형식(`해시7 날짜 작성자 제목`), 대상(선택한 커밋 전체), 상한 10줄 + `… 외 K개`, 작성자 포함 여부, 해시 자릿수 | 가정대로 |
| M-33 | ~~저장소 경로 검증의 범위~~ — **결정: 저장소 하위 폴더까지 차단**(= 저장소 안). 함께 확인: 저장소를 포함하는 상위 폴더는 `sub`에서 산출물이 저장소 옆에 생기면 허용하되, **산출물 폴더가 저장소를 포함하면(`fs.rm`으로 저장소가 삭제될 수 있음) 차단**(CONTAINS_REPO, 제가 추가한 방어 — 이견 있으면 알려달라) | (결정됨) |
| M-34 | 복사 경로 구분자: 기본 `/`(git 형식, 내부망 저장소 경로와 동일 구조). Windows 사용자가 `\` 형식을 원할 가능성 → 후속으로 설정 제공 여부 | `/` 고정 |
| M-35 | 삭제 목록 행의 복사 값: 표시되는 경로(서버 경로)와 동일. Mapping이 항등이 아니게 되면 로컬 경로를 복사할지 서버 경로를 복사할지 | 표시 경로와 동일 |
| M-36 | 파일 추가 팝업 HEAD 트리(U-19·U-20)의 세부: (a) 이미 포함된 파일(변경 파일·Extract)을 **숨길지**(가정) vs 비활성 행+배지로 **보여줄지**, (b) 폴더 행에 **폴더 전체 추가**를 둘지(가정: 없음 — 대량 추가 실수 방지), (c) ~~"2단계"의 기준~~ — **경로 세그먼트 기준으로 확정**(`src`=1, `main`=2; 사용자 확인) | 가정대로 |
| M-37 | 누락된 의존성 화면 통합(U-20)에서 **채택되지 않은 제안**: (a) 트리 상단 `누락된 의존성 N개` 요약, (b) `누락된 의존성만 보기` 토글, (c) 붉은색 대신 주의 색(주황 계열; 빨강이 삭제·오류 의미와 겹침). 현재 명세는 사용자 제안대로 붉은색 + 배지 | 붉은색 유지, (a)(b)는 필요 시 후속 |
| M-38 | 영역 헤더 통일(디자인 통일성) 후속 제안 중 **미결정 항목**: (1) 접기 토글을 아이콘 전용으로 바꿀지(현재 `▴ 접기` 글자 병기), (2) 접힘 애니메이션 없음(가정), (3) 헤더 전체 클릭 토글 금지(가정), (4) `Preview`를 커밋 헤더 액션으로 옮겨 접혀도 보이게 할지(M-8과 연결), (5) `RepositoryBar`·`ExportBar`도 같은 헤더 스트립 문법으로 통일할지, (6) 간격·타이포 토큰화(RT-50). 확정된 것은 위 "헤더는 본문 밖" 구조 규칙 하나 | (1)~(6) 후속 결정 |
| M-39 | `RepositoryBar` 오른쪽 그룹의 내부 순서: 현재 `Browse...` → `Reload` → 버전 배지. 요청 메시지의 나열 순서(버전, Reload, Browse...)가 실제 배치 순서를 뜻하는지 확인 | 현행 순서 유지 |
| M-40 | ~~키워드 입력 통합 방식~~ — **A안 간단형 채택(2026-09-21)**. 키워드는 작성자 왼쪽에 같은 높이의 텍스트 영역으로 배치, 줄바꿈 구분, `-` 접두 제외, 글자 그대로 일치(정규식·`*` 없음), 포함·제외 모두 OR. 이스케이프(`\-`)·따옴표·해석 오버레이·쉼표 구분은 두지 않음. B안·현행 분리 방식은 폐기 | (결정됨) |
| M-41 | **작성자·해시 필터를 줄바꿈 구분만으로 통일(사용자 결정)**의 부작용: REQ-023은 메신저 등에서 복사한 **쉼표·공백 구분 해시 목록을 붙여 넣는** 용도였는데, 줄바꿈만 구분자로 쓰면 `a8f2d31, 8dd9e91`이 **하나의 잘못된 해시**로 처리돼 조회 0건이 된다. 권장: **해시는 줄바꿈 + 쉼표 + 공백을 모두 구분자로 허용**(해시에는 그런 문자가 없으므로 안전), 안내 문구는 "한 줄에 하나" 유지. 작성자는 이름에 공백이 있을 수 있어 줄바꿈만(요구대로). `parseMultiValueFilter`·REQ-022/023 정정 필요. 파일 패턴 입력(쉼표 구분)은 이번 통일 대상이 아님 | 해시만 관대하게 |
| M-42 | 조회 조건 두 그룹(경계 조절)의 세부(가정): (a) 기본 비율 50:50, 최소 폭 320/330px, (b) 창이 두 최소 폭의 합보다 좁을 때 **가로 스크롤**(현재 SplitPane 동작)인지 세로로 쌓을지, (c) 경계를 키보드로도 조절할지(현재 SplitPane은 마우스만), (d) 힌트 툴팁을 입력 필드 **아래**에 띄우는 것(아래 커밋 영역을 일시적으로 가림) vs 위 | 가정대로, (b)는 가로 스크롤 유지 |
| M-43 | ~~의존성 확인 중 Export 정책~~ — **(a) Export 비활성화 + 표시 채택**(RT-17). (b) 확인창 허용은 채택하지 않음. 분석이 매우 오래 걸리는 저장소가 있으면 재검토(타임아웃·취소 필요 여부) | (결정됨) |
| M-13 | 트랙 최소 높이(목업 90/120px vs 앱 140px) 통일값, 기본 창 크기(1100px) 반영 여부 | 140px 유지 |

---

## 8. 검증 계획

1. **P0 이후 모든 PR**: `npm run typecheck` · `npm run lint` · `npm test`(RT-01) · Playwright 3개 시나리오(RT-02).
2. **동작 불변 단계(P2~P4 구조 변경분)**: 변경 전후 Export 결과물(복사된 파일 바이트, 그리고 U-17 이전까지는 `deploy-files.txt`·`deploy-summary.json`, 이후에는 `extract-list.txt`)을 동일 fixture 저장소로 diff.
3. **UI 변경분(P4의 U-1~U-10)**: 목업과 실제 앱을 같은 상태로 두고 스크린샷 비교(헤드리스 Chrome 스크린샷 방식은 목업 작업 중 사용).
4. **패턴 매칭**: §3.1의 19개 케이스를 유닛 테스트로 고정. 신규 케이스는 여기에 추가.
5. **R1**: `--output=`을 해시 필터에 넣었을 때 파일이 생성되지 않음을 자동 테스트로 확인.
