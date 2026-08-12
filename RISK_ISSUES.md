# Git Deploy Extractor 리스크/오픈이슈 문서

> Version: 0.1
> Status: Draft
> 기준 문서: DETAILED_DESIGN.md, UI_UX_SPEC.md

이미 다른 문서에서 등급이 매겨진 리스크는 요약 인용만 하고, 이 문서에서 처음 다루는 항목만 새로 작성한다.

---

# 1. 성능 리스크

| 리스크 | 영향 | 발생 가능성 | 완화 방안 | 상태 |
|---|---|---|---|---|
| `--skip` 페이지네이션 비용 | `maxCount`를 기본값(100)보다 크게 늘리면 뒷페이지로 갈수록 이론상 느려짐 | 낮음(기본값 상태에선 `--skip` 자체를 안 씀) | 실측 후 필요 시 커서 방식(`git log <lastHash>..<branch>`)으로 교체 | 설계완료 · 실측 필요 (DETAILED_DESIGN.md §5) |
| Deploy Files 목록 렌더링 | 파일 수가 많으면(대규모 리팩터링 커밋 등) 체크박스 목록 렌더링이 느려짐 | 낮음(커밋 조회 기본 범위가 7일/100개로 좁혀져 있어 흔치 않음) | 300개 초과 시 react-window 가상 스크롤 적용 | **해결됨** (UI_UX_SPEC.md §2.6, 2026-08-04) |

---

# 2. 정확성 리스크

| 리스크 | 영향 | 발생 가능성 | 완화 방안 | 상태 |
|---|---|---|---|---|
| Merge Commit "첫 번째 부모 기준" 처리 | 배포 대상 변경사항이 두 번째 부모 쪽에만 있는 경우 누락 가능 | 미검증 | 실제 병합 커밋 사례로 검증 | 재검토 필요 (DETAILED_DESIGN.md §3.3) |
| Mapping Rule override 간 target 경로 충돌 | 서로 다른 두 override가 같은 target을 가리키면 배포 패키지에서 파일이 덮어써짐 | 낮음(수작업으로 짧은 표를 직접 작성하므로) | 자동 검증 없음, 리뷰 시 육안 확인 | 알려진 한계 (DETAILED_DESIGN.md §1.2) |
| Rename 감지 threshold | ~~50% 정확도 오탐 가능성~~ | — | — | **해소됨** — DR-008을 "Rename 감지 안 함"으로 재정정하면서 threshold 개념 자체가 없어짐(2026-08-04) |

## 2.1 메타 리스크: 정확성 검증 수단의 부재

위 두 항목(Merge, Mapping override)은 공통적으로 **조용히 실패한다** — 에러 없이 "성공"으로 완료되지만 결과가 틀릴 수 있다. 이 도구의 핵심 목적이 "정확하게 추출"인데, 실수가 나도 그 자리에서 알아챌 방법이 없다는 게 더 근본적인 문제다. 망분리 환경 특성상 실수가 발견되는 시점(내부망 반영 후)과 실수가 발생한 시점(외부망 추출 시) 사이에 시간·공간 간극이 커서 원인 추적이 어렵다.

**완화 방향 후보** (설계만, 이번 문서에서 구현하지 않음):

| 후보 | 방식 |
|---|---|
| 교차검증 | Export 시 `deploy-summary.json`의 파일 수를 `git diff --stat` 결과와 비교, 불일치 시 경고 |
| 확인 배지 | Merge Commit이 선택되면 Preview 화면에 "이 커밋은 병합 커밋입니다" 배지 표시 |

---

# 3. 플랫폼 차이 리스크

| 리스크 | 상태 |
|---|---|
| 경로 대소문자 구분 (Windows NTFS 비구분 vs 내부망 서버 구분) | 설계완료 · 구현 전 (DETAILED_DESIGN.md §4.1) |
| 줄바꿈 보존 (CRLF/LF, binary 쓰기 모드) | 설계완료 · 구현 전 (DETAILED_DESIGN.md §4.2) |
| Windows 경로 길이 제한(260자) | **검토 후 제외** — 이미 git에 커밋되어 존재하는 파일이라면 원 작성자 환경에서 이미 생성 가능했던 경로이므로, 이 도구의 복사 단계에서 새롭게 문제가 될 이유가 없다고 판단(2026-08-04) |

---

# 4. 결정 이력 로그

REQUIREDMENT.md 작성 이후 발견·확정된 결정을 시간순으로 정리한다. "이전 결정"이 비어있으면 REQUIREDMENT.md 원본에 없던 내용을 새로 채운 것이다.

| # | 계기 | 이전 결정 | 최종 결정 | 근거 문서 |
|---|---|---|---|---|
| 1 | Java 파일이 컴파일된 `.class`로 오해될 여지 | (없음) | `.java` 원본 소스, 경로 그대로 유지 → DR-011 신설 | REQUIREDMENT.md |
| 2 | WEB-INF/classes 구조가 실제 프로젝트와 다름 | DR-011만 존재 | Spring 표준 구조 전제, WEB-INF 제거, resources도 경로 유지 → DR-012 신설 | REQUIREDMENT.md |
| 3 | 패키지 예시가 특정 기업명을 연상시킴 | `kr/s2b/sell` | `com/example/sell`로 전면 교체 | REQUIREDMENT.md 등 |
| 4 | Mapping Rule 설계 시 미확인 요구를 앞서 구현 | glob 패턴 + `{rest}` 캡처 템플릿 엔진 | 정확한 경로 1:1 override 테이블로 단순화(과설계 정정) | DETAILED_DESIGN.md §1 |
| 5 | Rename 시 이전 파일명 처리 미명시 | (없음) | 이전 경로를 delete-list.txt/`oldPath`로 추적(← #12에서 폐기됨) | DETAILED_DESIGN.md §2 (구버전) |
| 6 | `diff-tree -m` 옵션의 실제 동작 재검증 | "첫 부모 기준"으로 오해 | `<commit>^1 <commit>` 두 트리 직접 비교로 정정 | DETAILED_DESIGN.md §3.3 |
| 7 | UI 와이어프레임 컴포넌트화 중 모호함 3건 발견 | 타이틀바/Branch 중복, 체크박스 표시 전용 가정, Build=파일복사 전체 | 타이틀바 읽기전용화 / 체크박스 인터랙티브+전체선택(REQ-011 신설) / `[Build]` 버튼 제거(Export가 흡수) | UI_UX_SPEC.md §0 |
| 8 | 개발환경(Windows 11 + IntelliJ System-Dependent) 확인 | (없음) | 경로 대소문자 항상 구분, 소스 파일 binary 쓰기 모드 확정 | DETAILED_DESIGN.md §4 |
| 9 | Commit 목록이 Branch 전체 이력을 무제한 조회 | (없음) | 기본 시작일=오늘-7일/종료일=오늘/최대 100개, 기본 Branch는 main 우선 자동 선택 | REQUIREDMENT.md §REQ-002·003 |
| 10 | `--since`/`--until`에 시간 미명시 시 경계 커밋 누락 재현 확인 | (없음) | `T00:00:00`/`T23:59:59` 항상 명시 | DETAILED_DESIGN.md §3.2 |
| 11 | "Rename을 자동 판단하지 말고 사용자가 직접 보게 하자"는 제안 | #5의 Rename 추적 로직 전체(threshold, `oldPath`, `#` 주석) | **Rename 감지 자체를 제거.** Delete+Add로만 처리, 최종 파일명 기준 처리는 DR-007+REQ-007 조합으로 자연히 성립 | REQUIREDMENT.md DR-008, DETAILED_DESIGN.md 전반 |
| 12 | Deploy Files 목록 크기 리스크 논의 | (없음) | 300개 초과 시 가상 스크롤 | UI_UX_SPEC.md §2.6 |
| 13 | 구현 중 Branch 드롭다운에 원격 추적 브랜치(`origin/main` 등)가 섞여 나오는 것을 발견 | `refs/heads/`·`refs/remotes/` 둘 다 조회(REQUIREDMENT.md 원 설계) | `refs/heads/`만 조회. 원격 추적 브랜치는 fetch 시점 스냅샷이라 stale할 수 있는데 "로컬 기준"으로 착각할 위험이 있어 선택지에서 제외 | DETAILED_DESIGN.md §3.2 |
| 14 | Mapping Profile 변경 시 재계산 캐싱의 실효성 논의 | Commit 분석 결과 캐시 재사용, Mapping만 재계산(원 설계) | 캐싱 계획 폐기, 매번 전체 재계산(← #16에서 "자동 재계산 자체가 없음"으로 다시 정정됨) | UI_UX_SPEC.md §4 |
| 15 | Commit 목록 스크롤 왕복 재조회 방지 방식 재검토 | Main Process가 조회 결과를 메모리 캐시(원 설계) | Main 캐시 계획 폐기. Renderer가 로드된 commits를 누적 보관해 이미 로드한 페이지는 재스크롤해도 IPC 자체가 발생하지 않음 — 같은 목표를 더 단순한 방식으로 이미 달성하고 있어 별도 캐시 불필요 | DETAILED_DESIGN.md §3.4 |
| 16 | Export 직전 레이스 컨디션 발견 — 디바운스 대기 중(선택은 바뀌었는데 화면·`deployFiles`는 옛 계산 결과인 구간)에 `[Export]`를 누르면 방금 바뀐 선택 일부가 반영 안 된 채로 조용히 나갈 수 있음 | 커밋 체크박스/Mapping Profile 변경 시 디바운스 후 자동 재계산(#14의 "매번 전체 재계산") | 자동 재계산을 완전히 제거하고 `[Preview]`를 유일한 계산 트리거로 확정. `analyzedSelection`(마지막 Preview 계산 입력)과 현재 선택을 비교해 `isStale`을 파생 계산하고, `isStale`이면 `[Export]`를 비활성화 | UI_UX_SPEC.md §2.5, §2.8, §4 |
| 17 | Commit 목록에서 개별 체크박스만 있고 전체 선택이 없어 Deploy Files 패널(전체선택 있음)과 UX가 불일치, 작성자/일시 정보도 없어 커밋 식별이 hash+message만으로는 부족하다는 사용자 피드백 | hash + message만 표시, 전체 선택 없음 | `DeployFilesPanel`의 전체선택 패턴과 동일하게 `toggleAllCommits()` 추가, 행 표시를 `hash → author → date → message`로 확장. `[Preview]` 버튼도 이 전체선택 체크박스와 수평 정렬되도록 CommitListPanel 헤더로 이동(기존엔 FooterActionBar에 있었음) | UI_UX_SPEC.md §2.2, §2.4 |
| 18 | 화면 우측 하단에 제작자 정보를 상시 노출하고 싶다는 사용자 요청 | (없음) | 문자열 링크안으로 검토했으나 사용자가 자작 캐릭터 이미지(원본 `.gif` 확장자, 실제로는 PNG 데이터)로 교체 요청. `src/renderer/src/assets/goraeng.png`로 확장자를 내용에 맞게 정정해 배치, `position: fixed`로 다른 패널 레이아웃에 영향 없이 50×50 그대로 표시, 클릭 시 `https://github.com/neisii`를 시스템 브라우저로 오픈 | UI_UX_SPEC.md §2.9 |
| 19 | #18 작업 중 Playwright 재현 테스트로 FooterActionBar의 "Export 완료: {경로}" 메시지가 긴 절대 경로에서 여러 줄로 줄바꿈되어 패널·뷰포트 아래로 넘쳐 잘리는 기존 버그를 발견(이미지 추가와 무관하게 원래부터 있던 문제) | 텍스트 줄바꿈 허용, 넘치는 부분이 잘려서 안 보임 | 메시지를 한 줄로 고정하고 ellipsis로 자름 + 전체 경로는 `title` 툴팁 + 클릭 시 클립보드 복사(`navigator.clipboard.writeText`)로 보완. 우측 하단 고정 이미지(#18)와 겹치지 않도록 `footer-action-bar`에 `padding-right: 60px` 추가 | UI_UX_SPEC.md §2.8 |
| 20 | Export 산출물 디렉터리명 "deploy"가 "이 도구가 배포까지 한다"는 오해를 줄 수 있다는 사용자 피드백 — 사용자가 직접 디렉터리명을 입력하는 UI도 검토했으나, 경로 조작·Windows 예약어 등 새 검증 리스크만 늘고 실행마다/사람마다 산출물 폴더명이 달라지면 오히려 "표준 산출물"이라는 예측 가능성이 떨어진다고 판단해 기각 | `deploy/` | `git-deploy-extracted/`로 고정 명칭 변경(설정 UI 없음). `deploy-files.txt`/`deploy-summary.json`/`delete-list.txt` 등 하위 파일명은 그대로 유지 | REQUIREDMENT.md §9, ARCHITECTURE.md §4.4, DETAILED_DESIGN.md §2, `src/main/package/buildPackage.ts` |
| 21 | 사용자가 "Deploy Files 헤더와 목록 폭이 다르다"고 제보 — 원인 분석 결과 헤더 행과 각 데이터 행이 서로 별도의 CSS Grid 컨테이너라 `max-content`가 행마다 독립적으로 계산되는 구조적 버그였음. JS 측정(canvas) vs 공유 grid(`display:contents`) 두 수정안을 비교했는데, 후자는 react-window 가상 스크롤 행(absolute 포지셔닝)에 적용이 불가능해 300개 초과 시에만 정렬 방식이 달라지는 사이드 이펙트가 생겨 기각 | 헤더-행이 각자 `max-content`로 독립 계산(버그) | JS(`canvas.measureText` + `getComputedStyle`)로 필터링된 전체 행+헤더 라벨 중 최대 폭을 실측해 모든 행에 동일하게 주입. 파일명 텍스트 클릭으로도 체크 토글되도록 함께 변경(체크박스만 클릭 가능하던 것에서 확장) | UI_UX_SPEC.md §2.6 |
| 22 | CommitListPanel:DeploymentPreviewPanel 50:50 분할이 불필요하게 넓다는 사용자 피드백 — CommitListPanel은 hash/author/date/message 4개 컬럼을 담아야 하지만 DeploymentPreviewPanel은 짧은 집계 숫자 4줄뿐이라는 내용 성격 차이가 근거. 이걸 "간격"류 순수 시각 디자인(§6, 문서 범위 밖)으로 볼지 화면 공간 배분을 바꾸는 "기능적 레이아웃 결정"으로 볼지 논의 후, 후자로 확정해 문서화 대상에 포함 | MainGrid `grid-template-columns: 1fr 1fr`(50:50) | `minmax(320px, 4fr) minmax(180px, 1fr)`(≈80:20)로 변경. 각 최소 폭 아래로는 안 줄어들고, 그 합보다 창이 좁아지면 `overflow-x: auto`로 가로 스크롤이 떠서 우측이 잘려 보이지 않게 함 | UI_UX_SPEC.md §1 |
| 23 | #22와 같은 논의를 세로 방향에도 적용 — DeployFilesPanel이 MainGrid보다 최소 높이가 낮게 잡혀 있어(flex-basis 160px/min-height 120px vs 240px/200px) 여러 파일을 보여줘야 하는 영역인데 상대적으로 적은 공간이 배정돼 있었다. #22와 같은 "기능적 레이아웃 결정"으로 판단해 §2.4/§2.6에 나눠 적지 않고 §1(MainGrid 관련 노트가 모여 있는 곳)에 한 곳에만 적기로 함 — 두 영역 관계가 특정 컴포넌트 하나의 속성이 아니라 형제 요소 간 공간 배분이라 한 곳에 모아야 나중에 한쪽만 갱신되는 걸 막을 수 있음 | DeployFilesPanel flex-basis 160px/min-height 120px | MainGrid와 동일한 240px/200px로 통일. §2.6에는 본문 대신 "§1 참고" 한 줄만 추가 | UI_UX_SPEC.md §1, §2.6 |
| 24 | §7.1(사용자정의 Export 경로) 구현 — 실사용 중 나온 요구 5건 중 권장 순서 1번째로 구현. §7.1 초안의 확정 설계를 그대로 따랐고, 구현 중 새로 결정한 것은 두 가지: (a) 덮어쓰기 확인은 Renderer에 커스텀 모달을 새로 만들지 않고 `dialog.showMessageBox`(Main Process 네이티브 모달)로 처리 — `repository:browse`가 이미 네이티브 다이얼로그를 쓰고 있어 패턴 일관성 유지 + 새 UI 컴포넌트 불필요. (b) 확인 팝업에서 사용자가 취소하면 `package:export` IPC가 `null`을 반환 — `repository:browse`가 취소 시 `null`을 반환하는 기존 패턴을 그대로 재사용, Renderer는 이를 에러가 아니라 `exportStatus: 'idle'`로 처리 | (없음, §7.1은 미구현 초안이었음) | REQ-012·DR-013 신설, `getDeployDir`/`deployDirHasContent`를 `buildPackage.ts`에서 분리 export, `package:browseExportDir` IPC 신설. Server Path 열도 §7.1 파생 결정대로 이번에 함께 삭제(§7.2까지 미루지 않기로 사용자 확인) | REQUIREDMENT.md REQ-012/DR-013, DETAILED_DESIGN.md §4.3, UI_UX_SPEC.md §2.6/§2.8/§3/§4 |
| 25 | §7.2(의존성 완결성 검사)+§7.4(드래그 리사이즈) 구현 — 권장 순서 2번째 묶음. 구현 중 새로 결정/발견한 것: (a) Java 파싱 라이브러리로 `java-parser`(chevrotain 기반) 선정 — 실제 프로덕션 도구(prettier-java)가 쓰는 라이브러리라는 점과 재현 테스트로 실사용 문법 파싱을 확인한 뒤 채택. 전이 의존성(lodash) npm audit 경고는 공격 표면이 없다고 판단해 감수(DETAILED_DESIGN.md §6.1 참고). (b) `@SpringBootApplication` 탐색·구현체 탐색 둘 다 "`git grep`으로 후보를 싸게 좁히고 실제 파싱으로 확정"하는 2단계 전략을 재현 테스트로 검증 후 채택(§0.1) — `git ls-tree`/`git grep`이 디렉터리 접두사 pathspec을 재귀적으로 매칭하고, `git grep`이 매치 없으면 exit 1을 반환하는 것도 실측으로 확인. (c) 의존성 검사는 `[Preview]`에 자동 체이닝(별도 버튼 없음 — TO-BE 와이어프레임과 일치), 실패해도 나머지 Preview 결과는 안전. (d) 우측 "누락된 의존성" 항목은 추가해도 목록에서 사라지지 않고 체크 상태로 남는다(좌측 `included`와 동일한 표시 방식) — 최초 설계 논의에서는 "체크=즉시 추가 후 사라짐"도 검토했으나 좌측과의 상호작용 일관성을 위해 채택하지 않음. (e) `SplitPane` 공용 컴포넌트를 만들어 MainGrid(기존 80:20 고정값을 초기값으로 계승)와 DeployFilesPanel 좌우 분할(50:50 신규 결정, 최소폭 260px씩) 두 곳에 재사용 | (없음, §7.2/§7.4는 미구현 초안이었음) | REQ-013·REQ-014·DR-014 신설, `src/main/analysis/java/parseJavaFile.ts`·`dependencyAnalysis.ts`·`src/main/git/lsTree.ts`·`grep.ts` 신설, `analysis:dependencies` IPC 신설, `DeployFilesPanel`을 `FileListColumn`+`SplitPane` 조합으로 재구성, Spring 예제 fixture 저장소(2커밋 — 공통 구현체/컨트롤러 분리)로 원래 사고 시나리오를 그대로 재현해 검증 | REQUIREDMENT.md REQ-013/REQ-014/DR-014, DETAILED_DESIGN.md §6/§7/§8, UI_UX_SPEC.md §1/§2.6/§3/§4/§5, README.md 파일 추출 기준 10번 |
| 26 | #25 직후 사용자 피드백 — "포함된 파일"/"누락된 의존성" 목록의 스크롤을 개별적으로 하고 싶다. 원인은 `DeployFilesPanel` 바깥 div 하나가 `.panel`(테두리+`overflow:auto`)이라 제목과 좌우 목록이 시각적으로 한 박스에 뭉쳐 있었던 것 — MainGrid(CommitListPanel/DeploymentPreviewPanel이 각자 독립 `.panel`이고 감싸는 `SplitPane`은 제목·테두리 없는 순수 wrapper)와 다른 패턴이었다. 구현 전 ASCII 와이어프레임으로 "MainGrid와 같은 패턴으로 맞춘다"는 이해를 먼저 확인받고 진행 | `DeployFilesPanel` 바깥 div가 `.panel`, `FileListColumn`은 `.panel` 아님(테두리 없음), Stale 메시지도 부모 전체를 대체 | 바깥 div에서 `.panel` 클래스 제거(제목 전용, `main-grid`처럼 세로 flex 크기만 담당), `FileListColumn`에 `.panel` 클래스 추가(자기 테두리+자기 스크롤 컨테이너). Stale·로딩·비적용 상태도 좌/우 각자의 박스 안에서 개별 표시하도록 변경(MainGrid의 각 패널이 자기 상태를 스스로 보여주는 것과 동일 패턴) | UI_UX_SPEC.md §2.6, `src/renderer/src/components/DeployFilesPanel.tsx`, `deployFiles/FileListColumn.tsx` |
| 27 | #26 직후 사용자 피드백 2건 — (1) MainGrid 전체↔DeployFilesPanel 전체 사이 경계에도 드래그 리사이즈를 추가하고 싶다(§7.4가 원래 정의한 "정확히 2곳"에 세 번째 경계선 추가). 구현 전 ASCII로 "MainGrid는 이미 제목 없는 독립 패널 2개 구조라 SplitPane을 세로로도 지원하도록 확장하면 된다"는 이해를 먼저 확인받고 진행. (2) 좌우/상하 구분선이 너무 굵어서 얇게 하고, 그만큼 확보되는 공간으로 실제 데이터를 더 보여달라. 구현 중 재현 테스트로 버그 2건을 발견: (a) 세로 SplitPane 안에 가로 SplitPane이 중첩되면서 `.split-pane--horizontal .split-pane__handle-bar`류 후손 선택자가 자신을 감싸는 세로 인스턴스의 규칙까지 같이 매치해, 소스 순서상 나중에 나온 세로 규칙이 방향과 무관하게 모든 막대를 덮어써버림 — 실제로 가로 막대가 두꺼운 가로줄로 잘못 렌더링되는 걸 확인. (b) 새 세로 분할의 최소 높이를 처음 200px/200px로 잡았더니, 앱 기본 창 크기(900×760)에서 실제 사용 가능한 높이가 391px뿐이라 `minmax` 요구 합(408px)이 이를 초과해 드래그 가능 범위가 0으로 붕괴(항상 정확히 50:50 고정)하는 걸 재현 테스트로 발견 | `SplitPane`은 가로(좌우)만 지원, prop 이름 `left`/`right`/`minLeftPx`/`minRightPx`. 핸들: 그리드 트랙 6px + `gap` 8px씩(영역 사이 낭비 22px) | `SplitPane`에 `direction: 'horizontal'\|'vertical'` 추가, prop을 방향 중립 이름(`start`/`end`/`minStartPx`/`minEndPx`)으로 정정. App.tsx에 세 번째 `SplitPane`(세로, `commitsVsFiles` 저장 키)을 추가해 그 `start`에 기존 MainGrid(가로)를 그대로 중첩. 핸들 그리드 트랙은 8px 유지하되 `gap:0`, 트랙 안에 2px 두께 막대만 중앙에 그려 영역 사이 낭비를 22px→8px로 축소. CSS 버그(a)는 `>` 자식 결합자로 "가장 가까운 SplitPane"만 스코프해서 수정, 버그(b)는 최소 높이를 140px/140px로 낮춰 기본 창 크기에서도 실제로 드래그 가능한 여유(103px)를 확보 | REQUIREDMENT.md REQ-014, DETAILED_DESIGN.md §7, UI_UX_SPEC.md §1, `src/renderer/src/components/SplitPane.tsx`, `App.tsx`, `assets/main.css` |
| 28 | 사용자 피드백 — "조회 기간"/"최대 개수"가 Search 버튼 바로 옆이 아니라 다음 줄에 나왔으면 좋겠다. REQUIREDMENT.md §8 원본 와이어프레임은 처음부터 2줄(Branch+Search / 조회기간+최대)로 그려져 있었지만, 구현은 네 그룹을 `flex-wrap` 컨테이너 하나에 다 넣어서 창이 넓으면 한 줄에 다 붙어버리는 상태였다 — 실제로 재현해보니 REQUIREDMENT.md가 항상 의도했던 모습이 창 폭에 따라 우연히만 재현되고 있었을 뿐 | `.branch-search-bar` 전체가 `flex-wrap` 한 그룹, 네 요소(Branch/Search/버튼/조회기간/최대)가 이 안에서 창 폭에 따라 자유롭게 줄바꿈 | `branch-search-bar__row`로 두 줄을 명시적으로 분리(바깥은 세로 flex, 줄 내부만 flex-wrap 유지) — 창 폭과 무관하게 항상 2줄 | UI_UX_SPEC.md §2.3, `src/renderer/src/components/BranchSearchBar.tsx` |
| 29 | 사용자 피드백 — 커밋 목록 영역과 분석 요약 영역 높이가 항상 꽉 찼으면 좋겠다. 재현해보니 `.commit-list-panel`/`.deployment-preview-panel`에 `height:100%`가 없어서, 커밋이 몇 줄 없을 때(이 fixture는 2개) 두 패널이 자기 콘텐츠 높이로만 줄어들고 `SplitPane`(§7.4)이 실제 배정한 높이와의 차이만큼 빈 배경이 남아 있었다 — `.file-list-column`(§7.2)은 이미 `height:100%`를 쓰고 있어 같은 문제가 없었는데, MainGrid 두 패널만 §7.4 도입 시점에 이 규칙이 누락됐던 것 | `.commit-list-panel`/`.deployment-preview-panel`에 `height:100%` 없음 → SplitPane 셀보다 짧게 렌더링 | 두 클래스에 `height:100%` 추가(`.file-list-column`과 동일 규칙). `getBoundingClientRect()` 실측으로 SplitPane 셀 높이와 정확히 일치함을 재현 테스트로 확인 | UI_UX_SPEC.md §2.4/§2.5, `src/renderer/src/assets/main.css` |
| 30 | §6.1(체크한 커밋 유지)+§7.3(파일명 커밋 검색) 구현 — 권장 순서 3번째(마지막) 묶음. 세션 시작 시점에 §6.1의 A~E 미결정 사항을 확정: A(Repository 전환 시 초기화)·D(카운터 UI 추가 안 함)·E(included 상태 유지 안 함)는 이미 문서에 강하게 기울어 있던 방향 그대로 확정. **B(Branch 전환)**와 **C(레이스 컨디션 가드)**는 실제로 트레이드오프가 있어 사용자에게 직접 확인: B는 "지운다"(다른 Branch 커밋이 한 Export에 섞이는 위험 방지), C는 "같이 고친다"(REQ-015로 검색 반복 워크플로우가 늘면서 이 레이스가 실제로 노출될 가능성도 커진다고 판단). 구현 중 재현 테스트로 발견한 함정: `git log ... --`처럼 `--` 뒤에 pathspec을 하나도 안 주면 "필터 없음"으로 해석되어 전체 커밋이 반환된다 — 파일명 매치가 0건일 때 이 경로를 타지 않도록 git 호출 자체를 건너뛰게 처리. Playwright로 원래 사고 시나리오를 재현: 메시지 검색("guarantee")은 "다른 팀이 공통 구현체를 수정한 커밋"(메시지에 키워드 없음)을 놓치지만, 파일명 검색은 정확히 찾아내고, 두 검색 모드를 오가며 누적 체크한 선택이 Export까지 그대로 반영됨을 확인 | (없음, §6.1/§7.3은 미구현 초안이었음) | REQ-015·REQ-016·DR-015 신설, `loadCommitsFirstPage(keepSelection)` 도입(모든 재조회 호출자가 명시적으로 유지/초기화 선택), `selectionMatches()` 공용 비교 함수로 `runAnalysis()` 레이스 가드 + `selectIsAnalysisStale` 통합, `src/main/git/commits.ts`에 `searchMode` 분기(파일명 검색은 `listTrackedFiles` + pathspec 2단계), BranchSearchBar에 메시지/파일명 라디오 토글 추가 | REQUIREDMENT.md REQ-015/REQ-016/DR-015, DETAILED_DESIGN.md §8/§9, UI_UX_SPEC.md §2.3/§3/§4 |
| 31 | #30에서 §6.1 케이스 D를 "추가하지 않는다"로 확정할 때 AskUserQuestion 없이 "문서에 이미 있던 방향"이라는 근거만으로 임의 판단했는데, 사용자가 직후 세션에서 "케이스 D는 있어야 할 듯"이라고 직접 뒤집음 — 문서의 서술 방향과 사용자의 실제 선호가 항상 일치하지는 않는다는 사례. 구현 중 발견: 카운터를 헤더에 추가하고 보니, CommitListPanel이 로딩/빈 목록(검색 결과 0건)/에러 상태에서 패널 전체를 다른 문구로 대체(early return)하는 기존 구조 때문에 정작 "검색 결과가 0건이라 화면에 아무 체크 표시도 안 보이는" 바로 그 상황에서 카운터도 함께 사라져버리는 걸 재현 테스트(Playwright)로 확인 — 케이스 D가 막으려던 위험을 카운터 자신이 재현하고 있었음 | 케이스 D "추가하지 않는다"(#30) | **추가한다로 재확정.** CommitListPanel 헤더에 "N개 선택됨"(`selectedHashes.size`, 항상 전체 개수 표시) 카운터 추가. 부수적으로 헤더 렌더링 구조를 "상태별 전체 대체"에서 "헤더는 항상 렌더링 + `.commit-list-panel__body`만 상태별로 교체"로 변경 — DeployFilesPanel의 좌우 `FileListColumn`이 각자 자기 상태를 자기 박스 안에서 보여주는 것(#26)과 같은 패턴으로 통일. Playwright로 "커밋 선택 → 검색으로 목록 0건 → 카운터는 여전히 정확한 개수 표시" 시나리오를 재현해 검증 | RISK_ISSUES.md §6.1 케이스 D, UI_UX_SPEC.md §2.4, `src/renderer/src/components/CommitListPanel.tsx`, `assets/main.css` |
| 32 | 패키징 용량 절감 요청 — Electron→NeutralinoJS 전환을 먼저 검토했으나(비교 분석만, 코드 변경 없음), 이 앱이 git shell-out(`execFile`)/`java-parser` 등 Node.js API에 깊이 의존하는 구조라 전환 시 (a) 보안 관례(`execFile`만 사용, exec 금지)를 깨거나 (b) Node 확장 바이너리를 다시 번들해 절감 효과 대부분을 잃는 두 선택지뿐이라는 결론 — 전환 대신 Electron을 유지한 채 mac 빌드(261MB .app)를 실측 분해해 절감 지점을 특정: `app.asar`(우리 코드)는 5.6MB로 무시할 수준, Electron Framework 바이너리 166MB는 프레임워크 유지 시 고정 비용, 로케일(`.lproj`) 220개 언어가 45MB(17%)로 가장 큰 단일 절감 지점이었음 | (없음, 첫 패키징 최적화 시도) | **로케일을 `ko`/`en`만 남기고 자동 삭제**(`build/afterPack.js`, electron-builder `afterPack` 훅 — mac `.lproj`/win `locales/*.pak` 둘 다 처리). **Intel Mac(x64) 미지원 확정** — universal 바이너리는 용량이 거의 2배가 되어 절감 목적과 반대 방향이라 `mac.target.arch: [arm64]`로 명시적으로 고정(CI가 이미 arm64 러너라 결과물은 그대로지만, 로컬에서 Intel Mac으로 빌드해도 실수로 x64가 섞이지 않게 함). 로컬 재빌드 후 실제 앱 실행(스크린샷)으로 한국어 UI가 로케일 축소 이후에도 정상 렌더링됨을 확인. 실측: mac `.app` 261MB→218MB(-16%), dmg 106MB→95MB(-10%). **Windows `locales/*.pak` 경로도 이후 GitHub Actions `workflow_dispatch`로 검증 완료**(2026-08-09) — `[afterPack] win: removed 52 unused .pak locale files (kept en/ko)` 로그 확인, `setup.exe` 90MB→83MB(-8%, mac보다 절감 폭이 작은 건 Windows 배포판의 로케일 세트가 원래 더 가벼워서로 추정) | REQUIREDMENT.md §10, README.md Build 섹션, `electron-builder.yml`, `build/afterPack.js`, `eslint.config.mjs`(build/ 제외 추가) |
| 33 | 사용자 요청 — "필터 건 상태에서 전체 선택 시 현재 목록에 표시되는 파일 기준으로 전체 체크하도록" 개선 요청을 계기로 코드를 읽어보니, 개선이 아니라 **이미 있던 버그**였음을 발견: `DeployFilesPanel.tsx`의 화면 표시 목록(`includedItems`/`missingItems`)은 상태 Filter+검색어를 둘 다 반영해 계산하는데, 실제 토글 액션인 `appStore.ts`의 `toggleAllDeployFiles()`(좌측 "전체 선택")는 상태 Filter만 다시 계산하고 검색어를 무시했고, `addAllMissingDependencies()`(우측 "전체 추가")는 Filter/검색 둘 다 무시하고 항상 전체를 대상으로 했음 — 화면 표시용 필터 로직과 토글 대상 계산용 필터 로직이 두 곳(컴포넌트/store)에 중복 구현되어 서로 어긋난 게 원인. UI_UX_SPEC.md는 애초에 "필터에 표시된 행 기준"이라고 의도를 적어뒀었지만 실제 구현이 그 의도에 못 미쳤던 것 | (없음, 기존 버그 발견) | 필터 로직을 store에서 다시 계산하지 않고, 컴포넌트가 이미 계산한 화면 표시 목록의 경로를 액션 함수 파라미터로 그대로 넘겨 단일 진실 공급원으로 통일하기로 결정(구현은 미착수, 사용자 승인 대기) | UI_UX_SPEC.md §2.6/§4, DETAILED_DESIGN.md §9 |
| 34 | 사용자 요청 — GitHub Release 확인 후 업데이트 알림 기능 설계. 초안은 상단 배너 방식이었으나, 논의 중 사용자가 "버전 텍스트 자체에 강조색"으로 방향을 바꿈 — 배너의 "닫기 버튼 필요 여부"라는 미정 사항이 이 변경으로 자연히 해소됨(배너가 아니라 상시 표시되는 배지라 닫을 대상이 없음). 설계 확정 과정에서 결정한 것: (a) Renderer CSP(`default-src 'self'`)가 외부 fetch를 막아 Main process에서 GitHub API 호출 후 IPC로 결과만 전달(git/dialog와 동일한 기존 아키텍처, CSP 완화 안 함). (b) 캐시는 Renderer `localStorage`(하루 1회, 기존 split 비율 등과 동일 패턴) — Main은 상태를 갖지 않는 stateless 모듈. (c) 버전 "건너뛰기" 기능은 미지원. (d) 클릭 시 뜨는 "GitHub 저장소를 여시겠습니까?" 확인창은 기존 `package:export`의 덮어쓰기 확인창과 동일한 `dialog.showMessageBox` 네이티브 패턴 재사용(새 커스텀 모달 컴포넌트 없음) — 이 확인창은 재확인(강제 캐시 무시 호출)의 네트워크 응답을 **기다리지 않고 즉시** 뜬다("긴급 패치를 바로 인지해야 한다"는 사용자 요구로, 클릭이 확인창 표시와 강제 재확인 두 가지를 동시에 독립적으로 트리거하도록 확정). (e) 재확인 진행 중에는 기존 배지 색/툴팁을 유지한 채 옆에 로딩 스피너만 추가 — 실패해도 직전 상태를 그대로 유지하고 에러를 노출하지 않는다(REQ-010과 공존) | (없음, 신규 기능 설계) | REQ-017·DR-016 신설(구현은 미착수, 사용자 승인 대기) | REQUIREDMENT.md REQ-017/DR-016, DETAILED_DESIGN.md §10, UI_UX_SPEC.md §2.2/§3/§4, ARCHITECTURE.md §4.7 |
| 35 | 사용자 요청으로 #33/#34 결정 사항을 엣지케이스·코너케이스·트레이드오프 관점에서 3회 자기 반성-개선 후 재검토(2026-08-12, 구현 착수 전). 발견해 반영한 것: (a) 버전 비교는 "다르다"가 아니라 "원격이 로컬보다 엄격히 크다"여야 함을 명시 — 그렇지 않으면 "버전은 올렸지만 아직 태그 전"인 상태(이 프로젝트에서 실제로 여러 번 있었던 순서)에서 오탐 배지가 뜬다. (b) 로컬/원격 버전 문자열 둘 다 `vX.Y.Z` 정규식으로 방어적으로 검증 후 실패 시 조용히 "확인 실패"로 처리 — 형식 불일치로 크래시하지 않는다. (c) 연속 클릭 가드 누락 발견 — 이미 확인 진행 중이거나 확인창이 열려 있으면 추가 네트워크 호출/확인창을 만들지 않도록 명시(Electron 모달 중첩 동작이 검증 안 된 상태에서 굳이 시험할 이유 없음). (d) `updateInfo`를 컴포넌트 마운트 후 비동기로 채우면 첫 렌더링에 배지가 "평시"로 반짝이는 문제 발견 — 스토어 생성 시점에 localStorage로 동기 초기화하도록 명시(splitRatio/columnWidths와 동일 패턴). (e) **모순 발견**: 상태 스키마에 `releaseUrl`(GitHub API의 특정 태그 딥링크)을 정의해놓고 실제 클릭 동작은 항상 고정된 릴리스 인덱스 URL만 열도록 확정해 이 필드가 어디서도 안 쓰이는 죽은 데이터였음 — 필드 제거. (f) 5초 타임아웃이 있어 스피너가 무한정 도는 상황이 구조적으로 불가능함을 명시(Renderer 쪽 별도 타임아웃 불필요함을 근거와 함께 문서화). (g) 사내 공유 IP 환경에서 GitHub 비인증 API 시간당 60회 제한에 여러 사용자가 동시에 걸릴 수 있다는 점을 "알려진 제약"으로 명시 문서화(고치지 않음 — 인증 토큰 내장은 과설계로 판단) | #34의 미완성 초안(위 (a)~(g) 전부 문서에 암묵적이거나 누락) | 위 7가지를 REQUIREDMENT.md DR-016·DETAILED_DESIGN.md §10·UI_UX_SPEC.md §3/§4에 반영. 여전히 구현은 미착수, 사용자 승인 대기 | REQUIREDMENT.md DR-016, DETAILED_DESIGN.md §10.1~10.6, UI_UX_SPEC.md §3/§4 |
| 36 | #33/#34/#35 구현 완료(2026-08-12). 필터 무시 버그(#33)는 `toggleAllDeployFiles`/`addAllMissingDependencies` 시그니처를 `(visibleLocalPaths: string[])`로 바꿔 `DeployFilesPanel.tsx`가 이미 계산한 화면 표시 목록(`includedItems`/`missingItems`)을 그대로 넘기는 방식으로 고쳤다 — Playwright로 재현: 검색어로 목록을 좁힌 뒤 전체 선택을 눌러도 검색에 안 걸린 파일은 그대로 유지되고 검색된 파일만 토글됨을 확인. 업데이트 알림(#34/#35)은 설계 문서 그대로 구현했고, 구현 중 두 가지를 단순화했다: (a) 버전 비교(hasUpdate 판정)를 Renderer가 아니라 Main의 `checkForUpdate()`에서 끝내서 반환 — `app.getVersion()`이 이미 Main에 있어 Renderer에 따로 노출할 이유가 없었음(§10.5가 이미 "구현 시점에 더 단순한 쪽으로" 열어둔 부분). (b) 배지가 캐시 신선 시(하루 이내 재실행)에도 항상 버전 텍스트를 보여줘야 해서, 별도 `app:getVersion` IPC를 추가로 신설(설계엔 없던 채널이지만 REQ-017 자체 요구를 만족시키기 위한 구현 디테일). Playwright로 실제 GitHub API 호출까지 포함해 검증: 배지가 `v0.2.1`/"최신 버전입니다"로 정확히 표시됨(이 버전이 실제 최신 릴리스이므로), 클릭 시 확인창이 재확인 응답을 기다리지 않고 즉시 뜨는 것과 "네" 응답 시 정확한 고정 URL로 `shell.openExternal` 호출됨을 확인, Main IPC를 몽키패치해 `hasUpdate:true`를 강제로 반환시켜 강조 배지(`#d4ff00` 배경)와 정확한 툴팁 문구가 렌더링되는 것도 스크린샷으로 확인 | (없음, #33/#34/#35는 설계만 완료된 상태였음) | 구현 완료. `src/main/update/checkForUpdate.ts` 신설, `update:check`/`update:confirmAndOpen`/`app:getVersion` IPC 3개 신설, `src/renderer/src/lib/updateCheckCache.ts` 신설(localStorage lazy init), `RepositoryPanel.tsx`에 배지 UI 추가 | REQUIREDMENT.md REQ-017/DR-016, DETAILED_DESIGN.md §10, ARCHITECTURE.md §4.7, UI_UX_SPEC.md §2.2/§2.6/§3/§4, `src/main/update/checkForUpdate.ts`, `src/main/ipc/handlers.ts`, `src/renderer/src/store/appStore.ts`, `src/renderer/src/components/RepositoryPanel.tsx`, `src/renderer/src/components/DeployFilesPanel.tsx` |
| 37 | TitleBar("Git Deploy Extractor — {폴더명} / {브랜치}")가 창 제목과 중복 아니냐는 사용자 질문에서 시작해, 대안 5개를 순서대로 검토·기각한 뒤 최종 설계에 도달(2026-08-12). 기각한 대안과 근거: (1) TitleBar 행 자체 삭제 — 결정 이력 #7에서 이미 "중복 컨트롤은 없애되 요약 뷰는 유지"로 답이 났던 문제 재현, 게다가 RepositoryPanel은 전체 경로만 보여주고 폴더명 축약형은 TitleBar에만 있어 유일한 정보였음. (2) 저장소/브랜치를 OS 창 제목(`win.setTitle()`)으로 이전 — mac 네이티브 풀스크린은 진입 시 타이틀바가 사라지고, 재현 테스트로 확인(steady-state 풀스크린 스크린샷에 OS 타이틀 텍스트 전혀 없음), 커서를 올려 나타나는 화면 상단 바는 창 타이틀이 아니라 macOS 전역 메뉴바(빌드 시점 고정 `CFBundleName` — v0.1.1 dev 모드 "Electron" 표시 이슈 때 이미 같은 사실을 실측한 바 있음)라 동적 텍스트를 애초에 못 받음. (3)/(4) 창 폭 또는 최대화 여부에 따른 조건부 표시 — 둘 다 원래 문제(중복)를 안 고치고, 최대화↔여유공간 상관관계가 약하고(작은 화면 최대화 vs 큰 화면 비최대화), mac은 zoom/풀스크린이 서로 다른 이벤트라 "최대화" 자체가 모호하고, 최초로 main→renderer push IPC가 필요해 인프라 비용 대비 실익이 안 맞음. (5) RepositoryPanel의 경로 텍스트와 Browse 버튼 사이에 인라인으로 이전 — 브랜치 중복은 그대로 남고, 폴더명이 경로 텍스트 끝부분과 같은 행에서 또 한 번 중복되며, 이미 꽉 찬 행(경로+Browse+Reload+버전배지)에 더 얹으면 BranchSearchBar가 이미 겪은 "한 행에 너무 많음" 문제(결정 이력 #28) 재현 위험. 이 과정에서 사용자가 지적한 사실 하나: TitleBar의 `repoLabel`이 "진짜 프로젝트 이름"이 아니라 `basename(repository.path)`일 뿐이라 로컬 클론 폴더명을 임의로 바꾸면 실제 프로젝트와 다르게 보일 수 있음 — 코드 확인으로 사실 관계 정정(사용자 최초 예상은 "다른 메커니즘으로 진짜 이름을 유지한다"였으나 실제로는 그런 메커니즘이 전혀 없었음). 이걸 "git remote origin URL에서 진짜 이름 유도" 신규 기능으로 발전시켰고, 소스 후보로 Gradle `settings.gradle`의 `rootProject.name`도 논의됐으나 기각(빌드 도구 종속으로 일반성 상실, 실행 가능한 스크립트라 정적 파싱 불안정, 워킹트리 읽기라 "선택된 Branch가 아니라 로컬에 실제 체크아웃된 Branch를 읽는" 위험 — §4.2 원칙과 충돌). remote와 폴더명이 다를 때 표시 방식도 "완전 대체" vs "둘 다 표시" 중 후자로 확정, 색상 구분은 새 토큰 없이 기존 `--ev-c-text-2`(보조정보 색) 재사용으로 확정 | (없음, TitleBar는 v0.1.1 이후 변경 없음 — 결정 이력 #23 마지막 언급 참고) | **최종 구현**: "Git Deploy Extractor —" 접두어 제거. `getRemoteProjectName()`(`git remote get-url origin`, HTTPS/SSH scp-like 3개 URL 형식 재현 테스트로 파싱 검증) 신설, 실패 시 `null`(절대 throw 안 함). 표시 규칙: remote≠폴더명이면 `remote (폴더명)`(폴더명은 `--ev-c-text-2`), remote=폴더명이면 `remote`만, remote 없으면 `폴더명`만. Playwright로 세 케이스 전부(다른 이름/이름 없음/같은 이름) fixture 저장소로 재현 검증, 색상도 computed style로 확인 | REQUIREDMENT.md REQ-018/DR-017, DETAILED_DESIGN.md §11, ARCHITECTURE.md §4.1, UI_UX_SPEC.md §2.1/§3, `src/main/git/repository.ts`, `src/main/ipc/handlers.ts`, `src/renderer/src/store/appStore.ts`, `src/renderer/src/components/TitleBar.tsx`, `src/renderer/src/assets/main.css` |
| 38 | #37 구현 직후, 사용자가 전체 대화를 되짚어보고 "원래 질문(행 삭제)에서 범위가 벗어난 것 같다"고 지적 — 요구사항 구체화 과정을 표로 요약해 설명하자, 사용자가 "현재 구현에서 조금만 수정하면 되겠다"며 범위를 좁힌 최종안 제시: TitleBar를 별도 행으로 유지하는 대신, 그 표시값(라벨+브랜치) 전부를 RepositoryPanel의 저장소 경로 텍스트 **왼쪽**으로 옮겨 한 행으로 합친다(#37이 기각했던 "인라인 배치" 대안(5)과 유사하지만, 경로 텍스트 **오른쪽·Browse 사이**가 아니라 **왼쪽**이라는 점이 다름 — 이 위치 차이 때문에 (5)의 "폴더명 이중 중복" 우려는 일부만 남고(원격 이름 자체는 새 정보), 브랜치 중복 우려는 그대로 남는다는 점을 재반박으로 짚었으나, 사용자가 이를 감수하고 진행 확정). 구현 중 실제로 드러난 문제: `.repository-panel__path`에 truncation 처리(`overflow`/`text-overflow`/`white-space`)가 원래 없었음(형제 요소 `footer-action-bar__export-path`엔 있었는데 — 결정 이력 #19) — 라벨이 왼쪽에 붙어 행이 붐빌 걸 대비해 사용자가 먼저 "text overflow 처리 + hover 시 title로 전체 경로"를 명시적으로 요구해 이 잠재 버그를 같이 고침 | #37의 "별도 TitleBar 행 유지" 최종 설계(및 그 근거였던 인라인 배치 대안(5) 기각) | **최종 구현**: `TitleBar.tsx` 삭제, `App.tsx`에서 `<TitleBar />` 제거. `RepositoryPanel.tsx`가 `RepoLabel`(§37 로직 그대로) + 브랜치를 `.repository-panel__title`(`flex:0 0 auto`)로 경로 텍스트 왼쪽에 렌더링. `.repository-panel__path`에 `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` + `title={repository.path}` 추가. `.title-bar`/`.title-bar__local-name` CSS 삭제, `.repository-panel__title`/`.repository-panel__title-local`로 대체. Playwright로 최종 배치(라벨+경로 한 행, TitleBar 요소 DOM에 없음)와 경로 텍스트 computed style 재현 검증 | REQUIREDMENT.md REQ-018/DR-017, DETAILED_DESIGN.md §11, UI_UX_SPEC.md §1/§2.2, ARCHITECTURE.md §4.1, `src/renderer/src/components/RepositoryPanel.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/assets/main.css` |
| 39 | 사용자 요청 — 기존 기능 + 이번 세션 구현 3건(필터 버그 수정 #33/#36, 업데이트 알림 REQ-017, RepositoryPanel 라벨 REQ-018) 전체 UI/UX 회귀 검증(2026-08-12). Spring Boot 예제 fixture(base 커밋: `@SpringBootApplication`+인터페이스+구현체, controller 커밋, config 파일 추가 커밋, 문서 수정 커밋 — 4개)로 Playwright 자동화 25개 항목 검증, 전부 통과. 검증 중 "실패"로 보였다가 조사 끝에 fixture 실수로 판명된 것 2건(둘 다 REQ-013 기존 기능이 설계대로 정확히 동작한 사례): (a) `docs tweak` 커밋이 `.java` 파일 끝에 `#`(셸 스타일) 주석을 추가해 문법이 깨졌는데, 앱은 파싱 실패를 예외 없이 감지해 그 파일만 건너뛰는 기존 동작(DETAILED_DESIGN.md §6.6 "파싱 실패 처리")대로 정확히 반응했음 — `//` Java 주석으로 고쳐 재검증. (b) `Application.java`를 `com.example.sell.app` 서브패키지에 둬서, 실제 Spring Boot 컴포넌트 스캔 관례(자기 패키지+하위만 스캔)와 동일하게 형제 패키지(`interfaces.receipt.*`)가 base package 스캔 범위 밖으로 계산됨(DETAILED_DESIGN.md §6.2 "그 패키지를 기준 패키지로 삼는다"가 정확히 이 좁은 스코프를 의미했던 것) — `Application.java`를 최상위 패키지로 옮기자 인터페이스+구현체 둘 다 정확히 감지됨. 이 두 사례로 REQ-013 의존성 완결성 검사가 (1) 파싱 실패에 안전하게 저하되고 (2) base package 스코프가 "그 클래스의 정확한 패키지"(형제/조상 패키지 아님)라는 걸 재확인 — 이 스코프 규칙이 실제 fixture 작성자에게도 헷갈릴 수 있어 DETAILED_DESIGN.md §6.2에 명시적 주의 문구 추가 | (없음, 순수 검증) | 코드 변경 없음(전부 통과, 회귀 없음). DETAILED_DESIGN.md §6.2에 base package 스코프 관련 주의 문구만 추가 | DETAILED_DESIGN.md §6.2, HANDOFF.md |

---

# 5. 미조사 잠재 리스크

아래는 시나리오와 영향만 가볍게 기록한다. 지금 결정하지 않고 후속 조사 대상으로만 남긴다.

| 리스크 | 시나리오 | 영향 | 상태 |
|---|---|---|---|
| git 미설치 PC | 배포 대상 PC에 git이 없거나 PATH에 없는 상태로 앱 실행 | Repository 선택 단계부터 모든 기능 불가 | 후속 조사 필요 |
| Mapping Profile JSON 파손 | 사용자가 프로필 JSON을 직접 열어 수정하다 문법 오류 발생 | 해당 프로필 로드 실패, 어떤 사용자 경험으로 안내할지 미정 | 후속 조사 필요 |
| 대용량 단일 파일 포함 | 바이너리·대용량 리소스 파일이 배포 대상에 포함됨 | 복사 성능/메모리 사용량 영향 미측정 | 후속 조사 필요 |

---

# 6. 보류된 결정 사항

요구사항 구체화 단계에서 선택지와 트레이드오프까지 도출했지만, 아직 최종 결정은 내리지 않고 미룬 항목. 결정되면 §4 결정 이력 로그로 옮긴다. (2026-08-07 기준: 유일한 항목이었던 §6.1이 구현 완료로 확정되어 현재 이 섹션에 보류 중인 항목은 없다 — 섹션 구조는 향후 새 보류 항목을 위해 유지한다.)

## 6.1 "체크한 커밋 유지" 요구사항 — 재조회 시 선택 유지 범위

**구현 완료 (2026-08-07)** — REQUIREDMENT.md REQ-015/DR-015, DETAILED_DESIGN.md §8.1/§8.2, UI_UX_SPEC.md §2.3/§3/§4, 결정 이력 #30 참고. 아래 A~E는 이 세션 시작 시점에 전부 확정했다(A/D/E는 이미 문서에 있던 방향 그대로, B/C는 사용자에게 직접 확인).

**배경**: 커밋 메시지 키워드 검색만으로는 관련 커밋을 놓칠 수 있어(실제 사례: "보증" 키워드로 검색해 체크·추출했으나, 다른 팀이 공통 구현체를 변경한 커밋은 메시지에 그 키워드가 없어 누락되어 내부망 빌드 실패), 검색 조건을 바꿔가며 여러 번 검색해서 관련 커밋을 계속 찾아 누적 체크하는 워크플로우가 필요함. 기본 방향(재조회 시 `selectedHashes` 유지, 나머지 계산 상태는 초기화)은 확정. 아래는 이 기본 방향을 다듬는 과정에서 나온 선택지.

**범위 재조정(2026-08-07)**: 위 실제 사고 사례의 핵심 원인(Java/Spring 코드 의존성 누락)은 §7.2(의존성 완결성 검사)로 더 직접적으로 해결된다 — §7.2는 커밋 검색 없이 누락된 파일을 HEAD 기준으로 바로 추가하므로, 애초에 "여러 번 검색해서 커밋을 누적 체크"할 필요가 없다. 다만 §7.2는 Java/Spring 전용이라 HTML/JS/설정/SQL 등 **비-Java 파일**은 못 잡는다 — 그런 파일을 다른 팀이 변경한 커밋을 찾는 용도로는 이 기능(및 §7.3 파일명 검색)이 여전히 필요하다고 판단해 유지하기로 함.

| # | 케이스 | 트레이드오프 | 최종 결정 |
|---|---|---|---|
| A | Repository 전환(Browse) 시 이전 저장소의 hash가 남음 | "모든 재조회 경로에서 유지" 원칙을 예외 없이 적용하면 다른 저장소의 커밋 hash로 git 명령을 시도해 에러/오동작 발생 | **지운다.** `browseRepository()`에서는 지금처럼 `selectedHashes`를 지우는 예외 처리(변경 없음) |
| B | Branch 전환 시 이전 Branch의 hash가 남음 | 유지하면 서로 다른 Branch의 커밋이 한 Export에 섞일 수 있음(최종 내용은 항상 현재 선택된 Branch의 HEAD 기준으로 해석되므로 의도와 다르게 해석될 위험) / 지우면 "검색 조건 바꿔도 유지"라는 원칙에 Branch만 예외가 생김 | **지운다.** 사용자 확인 완료(2026-08-07) — Repository 전환과 같은 논리 |
| C | Preview 계산 중 재검색 시 레이스 컨디션 — `runAnalysis()` 완료 시점에 `selectedHashes`가 호출 시점과 같은지 검사하지 않고 무조건 덮어씀(`appStore.ts`) | 고치지 않으면 드물게 `isStale` 판정이 잘못될 수 있음 / 고치려면 완료 시점 스냅샷 비교 가드 한 줄 추가(비용 작음) | **같이 고친다.** 사용자 확인 완료(2026-08-07) — REQ-015로 검색 반복 워크플로우가 늘면서 이 레이스가 노출될 가능성도 커진다고 판단 |
| D | 화면에 체크 표시가 하나도 안 보이는데 Export가 활성화될 수 있음(이전 검색에서 남은 선택) | 사용자가 잊으면 의도치 않은 파일이 섞여 나갈 인지 리스크 / 안내 UI(예: "N개 선택됨" 카운터) 추가는 이번 요구사항 범위를 넘음 | **정정(2026-08-07, 사용자 요청)**: 최초엔 "추가하지 않는다"로 확정했으나("문서에 이미 있던 방향"이라고 판단했지만 AskUserQuestion 없이 임의 판단), 사용자가 직접 "있어야 할 듯"이라고 뒤집어 **추가한다**로 재확정. CommitListPanel 헤더에 "N개 선택됨" 카운터 구현 완료 — 결정 이력 #31 참고 |
| E | Preview 재계산 시 개별 파일 제외(`included` 체크 해제) 상태가 초기화됨 | 이번 기능이 만든 문제가 아니라 기존에도 있던 동작이지만, "검색 여러 번 반복" 워크플로우가 더 자주 노출시킴 / 고치려면 파일 경로 기준으로 이전 제외 상태를 이어받는 로직이 필요(범위가 커짐) | **수정하지 않는다.** 문서에 이미 있던 방향 그대로 확정 — 알려진 한계로만 문서화 |

---

# 7. 차기 기능 요구사항 초안 (§7.1~§7.4 구현 완료, §7.5는 설계 문서로 유지)

§6과 달리 아래는 선택지 논의까지 끝내고 **최종 결정까지 마친** 신규 기능 초안이다. §7.1(REQ-012/DR-013), §7.2+§7.4(REQ-013/REQ-014/DR-014), §7.3(REQ-016/DR-015 — §6.1의 REQ-015와 한 세션에서 같이 구현)까지 5건 전부 REQUIREDMENT.md에 정식 편입되고 구현까지 완료됐다(결정 이력 #24·#25·#30 참고). §7.5(전체 TO-BE 와이어프레임)는 §7.1~7.4가 전부 끝나면서 실제 화면 모습으로 완전히 실현됐다 — 별도로 구현할 코드가 있는 섹션이 아니라 그 자체가 지금의 실제 UI를 미리 그려둔 설계 문서였으므로, "미구현" 상태가 아니라 "이미 실현된 설계도"로 남긴다.

**권장 구현 순서** (§6.1 포함, 총 5건을 3개 세션으로 묶음 — 전부 완료):

1. **§7.1(사용자정의 Export 경로) 단독 — 구현 완료(2026-08-07)** — 가장 독립적이고 범위가 작다. §7.2의 좌측 패널 설계("Server Path 열 삭제")가 §7.1의 "Mapping Profile UI 숨김" 결정을 전제로 하므로, 먼저 끝내두면 §7.2에서 이 부분을 다시 고민할 필요가 없다. **실제로는 Server Path 열 삭제 자체도 §7.2까지 미루지 않고 이번 §7.1 구현에 포함시켰다**(사용자 확인, 결정 이력 #24) — §7.2에서는 이 컬럼을 좌우 분할 레이아웃에 맞게 재배치만 하면 된다.
2. **§7.2(의존성 완결성 검사) + §7.4(드래그 리사이즈) 묶음 — 구현 완료(2026-08-07)** — §7.4의 경계선 중 하나("포함된 파일 ↔ 누락된 의존성")는 §7.2의 좌우 분할 레이아웃이 먼저 있어야 물리적으로 존재하므로 순서상 묶인다. 둘 다 DeployFilesPanel을 건드리는 작업이라 같은 세션에서 이어서 처리했다(MainGrid 쪽 드래그 리사이즈도 같이 처리). 원래 사고(Repository 구현체 누락)를 가장 직접적으로 막는 핵심 기능이라 가장 무거웠지만 중요도도 제일 높았다. 결정 이력 #25 참고.
3. **§6.1(체크한 커밋 유지) + §7.3(파일명 커밋 검색) 묶음 — 구현 완료(2026-08-07)** — "범위 재조정" 이후 이 둘은 "§7.2가 못 잡는 비-Java 파일 탐색"이라는 같은 목적으로 묶여있다(하나만 있으면 반쪽짜리). §6.1의 A~E는 세션 시작 시점에 전부 확정했다(A/D/E는 문서에 있던 방향 그대로, B/C는 사용자 확인). 결정 이력 #30 참고.

1·2번 사이, 2·3번 사이는 기술적 의존 관계가 있어 순서가 중요했고, 3번은 앞의 두 그룹과 기술적으로 독립이었지만 원래 사고를 막는 임팩트 순으로 이 순서를 따랐다.

## 7.1 사용자정의 Export 경로

**구현 완료 (2026-08-07)** — REQUIREDMENT.md REQ-012/DR-013, DETAILED_DESIGN.md §4.3, UI_UX_SPEC.md §2.6/§2.8/§3/§4, 결정 이력 #24 참고. 아래는 구현 시점의 원 설계 초안이며, 실제 구현이 이 설계와 달라진 지점은 #24에 기록했다(대체로 그대로 구현됨).

**배경**: 지금은 항상 저장소 루트 바로 안에 고정 이름(`git-deploy-extracted`)으로 생성된다(`src/main/package/buildPackage.ts:55`). 사용자가 원하는 위치로 Export 결과물을 보내고 싶다는 요구.

**#20(결정 이력 로그)과의 관계**: #20은 "디렉터리 **이름**을 자유 텍스트로 입력하게 하는 것"을 경로 조작·Windows 예약어 리스크로 기각했다. 이번 요구사항은 **이름이 아니라 부모 디렉터리 위치**를 OS 네이티브 폴더 선택 다이얼로그(RepositoryPanel의 `Browse...`와 동일한 방식)로 고르는 것이라 자유 텍스트 입력이 없다 — #20이 우려한 위험이 그대로 재발하지 않는다.

**확정된 설계**:
1. 사용자는 **부모 디렉터리만** 선택한다(네이티브 폴더 다이얼로그). 하위 폴더 이름은 지금처럼 `git-deploy-extracted`로 고정 — #20의 "이름은 고정이어야 예측 가능한 표준 산출물" 결정과 일관성 유지.
2. 선택한 경로는 **저장**한다 — `DeployFilesPanel` 컬럼 폭이 쓰는 것과 같은 `localStorage` 전역 저장 패턴(저장소별 구분 없음)을 재사용. 커스텀 경로를 한 번도 안 고르면 저장소 루트가 기본값.
3. **안전장치**: Export 시 대상 폴더(`<선택한 부모 경로>/git-deploy-extracted`)에 이미 내용이 있으면, `buildPackage.ts`가 지금처럼 무조건 `rm -rf` 후 재생성하기 전에 확인 팝업("이미 있는 git-deploy-extracted를 덮어씁니다, 계속할까요?")을 띄운다. 취소하면 Export 중단.
   - 이 안전장치가 필요한 이유(논의 과정): 경로를 저장(2번)하더라도, 사용자가 여러 저장소를 같은 부모 경로로 반복 Export하면 이전 결과물이 조용히 덮어써질 수 있다 — "경로를 기억한다"는 결정만으로는 이 위험이 없어지지 않고, 명시적 확인이 필요하다고 판단.
4. **UI**: Mapping Profile 드롭다운은 화면에서 숨긴다 — 현재 "default" 하나뿐이고 사용자가 커스텀 프로필을 만들거나 편집할 UI가 없어 사실상 무의미하기 때문(내부 로직은 `selectedProfile: 'default'`를 그대로 계산에 넘김, 동작 변경 없음). FooterActionBar 레이아웃: `[경로 변경 버튼] [현재 선택된 경로 값] ... [Export 버튼]`(변경 버튼이 경로 값의 왼쪽). Export 버튼은 다른 버튼과 시각적으로 구분되도록 더 진한 배경색을 준다.
5. **파생 결정**: Mapping Profile을 숨기면서 `default` 프로필의 `overrides`가 항상 빈 배열(코드로 확인 — `profileStore.ts:35`)이라는 게 재확인됐다 — 즉 Server Path가 사실상 항상 Local Path와 같아진다. 그래서 DeployFilesPanel의 **Server Path 열도 함께 삭제**하기로 함(최종 레이아웃은 §7.2에서 다룸).

## 7.2 의존성 완결성 검사 (Java/Spring)

**구현 완료 (2026-08-07)** — REQUIREDMENT.md REQ-013/DR-014, DETAILED_DESIGN.md §6, UI_UX_SPEC.md §2.6/§3/§4/§5, 결정 이력 #25 참고. Spring 예제 fixture 저장소(공통 구현체 커밋과 컨트롤러 커밋을 분리)로 원래 사고 시나리오를 그대로 재현해 검증했다. 아래는 구현 시점의 원 설계 초안이며, 실제 구현이 이 설계와 달라진 지점은 #25에 기록했다(대체로 그대로 구현됨).

**배경**: §6.1과 같은 배경(키워드 검색만으로 관련 커밋을 놓쳐 내부망 빌드가 실패한 실제 사례) — 참고.

**확정된 설계**:
1. **범위**: (A) 선택된 파일들의 의존성이 추출 목록에 다 포함됐는지 자동으로 경고하는 기능만 한다. (B) 의존성 그래프를 시각적으로 그려서 탐색하는 기능은 과설계로 판단해 이번 범위에서 명시적으로 제외 — 필요해지면 별도 요구사항으로 재논의.
2. **대상**: Java/Spring **단일 모듈**(멀티모듈 미지원) — 이 프로젝트가 이미 전제하는 "Spring 표준 구조"(DR-011/012)와 일관.
3. **의존성 판정 기준**: 텍스트 참조(import)와 Spring DI 기반 참조(생성자/필드로 주입되는 인터페이스 → 그 인터페이스를 `implements`하면서 `@Component`/`@Repository`/`@Service` 등 stereotype 애노테이션이 붙은 클래스) **둘 다** 추적한다. IntelliJ의 "Java classes" 다이어그램(얕은 직접 관계만) vs "Spring Beans Dependencies" 다이어그램(빈 단위 전체 관계) 비교로 확인 — 얕은 관계만으론 "인터페이스는 쓰는데 구현체를 못 찾는" 실제 사고 케이스를 못 잡는다.
4. **Base package 감지(우리 코드 vs 외부 라이브러리 판별)**: `@SpringBootApplication` 애노테이션이 붙은 클래스의 패키지를 기준으로 삼는다. **하드코딩 절대 금지**(결정 이력 #3에서 이미 겪은 실수 반복 방지 — 특정 회사 패키지명을 코드에 박아넣지 않는다). 그 클래스를 못 찾으면 폴백 없이 기능을 비활성화한다(단순화 우선).
5. **재귀**: 깊이 제한 없이 완전 전이적 폐쇄(transitive closure)까지 추적한다 — False Negative 방지가 최우선이라는 원칙에 따름.
6. **모호성 처리**: 같은 인터페이스를 구현하는 클래스가 여러 개 있으면(런타임에 `@Qualifier`/`@Primary`로 선택되는 경우 등) 정적 분석으로 하나를 확정하려 하지 않고 **전부 후보로 제안**한다 — 최종 판단은 사용자.
7. **정확도 원칙**: False Negative(진짜 필요한데 못 찾음) 방지가 최우선, False Positive(불필요한데 제안됨)는 사용자가 걸러내면 되는 참고용으로 허용한다.
8. **UI(갱신 — 아래가 최종본)**: `DeployFilesPanel`을 좌우 분할 구조로 재구성한다 — 한 목록 안에서 글자색으로 구분하는 최초 안은 폐기하고, 완전히 분리된 두 패널로 바꿨다.
   - **배치**: MainGrid의 CommitListPanel/DeploymentPreviewPanel과 같은 좌우 배치 개념을 재사용하되, 비율은 **50:50**(둘 다 "파일 목록"으로 비중이 비슷해서 MainGrid의 80:20 근거가 그대로 적용되진 않음).
   - **좌측 "포함된 파일"**: 지금의 파일 목록(Local Path만 — Server Path 열은 §7.1의 5번 결정에 따라 삭제). 기존 상태 Filter(All/Added/Modified) 드롭다운은 **유지**(제거 검토했으나, 파일명 검색과는 다른 축이라 존치하기로 함).
   - **우측 "누락된 의존성"**: 이번 기능이 새로 제안하는 목록. 개별 체크와 "전체 추가" 버튼 모두 제공(파일이 많으면 일일이 체크하기 번거로우므로).
   - **파일명 검색**: 좌우 각각 독립적인 파일명 검색 필드를 갖는다(LIKE 방식 부분 일치, 정규식은 범위 밖 — 우선순위 낮음).
   - **가로 스크롤**: 두 영역 모두 내용이 길면 잘리지 않고 가로 스크롤이 기본값(기존 Local/Server Path 컬럼의 "최소 폭, 잘리지 않음" 철학과 동일).
   - **"전체 선택"/가상 스크롤(300개) 임계값**: 좌우 각각 독립적으로 계산·적용된다(하나의 공용 목록이 아니라 두 개의 독립된 목록이므로).

**구현 시 참고**:
- 이 기능은 커밋 diff와 무관하게 HEAD 기준 파일을 포함시키는 새로운 경로라, 구현되면 README.md의 "파일 추출 기준" 섹션(현재는 "Added/Modified만, HEAD 존재 확인 후 포함"만 서술)도 함께 갱신해야 한다.
- Java 파싱 도구는 현재 스택(TypeScript/Node)에 없어 새로 선정이 필요하다 — 이건 요구사항이 아니라 구현 설계 단계에서 다룰 사항이다.
- Server Path 열 삭제로 인해, RISK #21에서 만든 "Local Path/Server Path 두 컬럼의 실측 폭 계산·리사이즈"(`--local-col-natural`/`--server-col-natural`, 측정용 프로브 엘리먼트) 메커니즘이 컬럼 하나짜리 목록엔 그대로 안 맞는다 — 두 컬럼용으로 만든 코드를 한 컬럼(좌)+한 컬럼(우, 새 목록)에 맞게 정리해야 한다. 로직 자체(실측 기반 폭 계산)는 재사용 가능하고, 컬럼 개수만 줄어드는 것.

## 7.3 파일명으로 커밋 검색

**구현 완료 (2026-08-07)** — REQUIREDMENT.md REQ-016, DETAILED_DESIGN.md §8.3, UI_UX_SPEC.md §2.3/§3/§4, 결정 이력 #30 참고. 아래 확정된 설계 그대로 구현됐다. 구현 중 재현 테스트로 새로 발견한 것은 결정 이력 #30/DETAILED_DESIGN.md §8.3 참고(`git log ... --`에 pathspec을 하나도 안 주면 "필터 없음"으로 해석되는 함정).

**배경**: §6.1과 같은 배경. §7.2(의존성 완결성 검사)가 Java/Spring 코드 의존성 누락은 더 직접적으로 해결하지만 Java/Spring 전용이라, HTML/JS/설정/SQL 등 **비-Java 파일**을 다른 팀이 변경한 커밋을 찾는 용도로는 이 기능이 필요하다(§6.1의 "범위 재조정" 참고).

**확정된 설계**:
1. **모드**: 기존 메시지 검색과 **별도 모드(토글)**로 동작한다 — 두 검색이 동시에 켜지지 않고, 사용자가 "메시지"/"파일명" 중 하나를 선택해서 검색한다. (§6.1의 "검색 조건을 바꿔가며 여러 번 검색" 워크플로우와 맞물려 순차적으로 전환하며 쓰는 용도.)
2. **매칭 대상**: **현재 선택된 Branch의 HEAD 트리에 존재하는 파일명만** 대상으로 한다 — 과거에 삭제된 파일명은 검색 대상에서 제외된다.
3. **매칭 기준**: 파일 경로의 마지막 조각(파일명)에 대한 **부분 일치**(substring). 디렉터리 경로는 매칭 대상이 아니다. 정규식은 범위 밖(§7.2의 파일명 검색 필드와 동일하게 우선순위 낮음).
4. **구현 방식(2단계 git 명령)**:
   1. `git ls-tree -r <branch> --name-only`로 HEAD 트리 전체 파일 경로 목록을 조회한다.
   2. 그중 파일명이 검색어와 부분 일치하는 경로만 클라이언트 측에서 필터링한다.
   3. 필터링된 경로들을 `git log --name-status -- <path1> <path2> ...`의 pathspec으로 넘겨, 그 파일들을 건드린 커밋만 조회한다(기존 조회 기간/Branch/최대 개수 필터는 그대로 적용).
   - 기존 메시지 검색(`git log --grep=<검색어> -i`, `src/main/git/commits.ts:40-41`)과는 완전히 다른 경로라 별도 함수로 구현해야 한다.

## 7.4 좌우 분할 영역 드래그 리사이즈

**구현 완료 (2026-08-07)** — REQUIREDMENT.md REQ-014, DETAILED_DESIGN.md §7, UI_UX_SPEC.md §1/§4, 결정 이력 #25 참고. 공용 `SplitPane` 컴포넌트로 아래 2번(적용 대상 2곳)을 그대로 구현했다.

**추가 확장 (2026-08-07, 결정 이력 #27)**: 아래 1번의 "정확히 2개 경계선"은 이후 사용자 요청으로 MainGrid 전체↔DeployFilesPanel 전체를 나누는 **세 번째(세로) 경계선**이 추가되며 깨졌다 — `SplitPane`이 가로뿐 아니라 세로(`direction: 'vertical'`)도 지원하도록 확장됐다. 핸들 두께도 이 시점에 6px+gap 8px(영역 사이 낭비 22px)에서 시각적으로 2px, 클릭 판정은 8px(낭비 8px)로 얇아졌다. 아래 1~4번은 최초 구현 시점(가로 2곳)의 기록으로 그대로 두고, 세로 확장·핸들 두께 변경의 세부 내용은 #27과 DETAILED_DESIGN.md §7을 참고한다.

**배경**: 위 항목들을 반영한 TO-BE UI를 ASCII로 시각화해서 검토하는 과정에서 나온 제안 — 좌우로 나뉜 두 영역의 고정 비율이 답답하게 느껴질 수 있어, 사용자가 드래그로 비율을 직접 조절할 수 있게 하자는 것.

**#22(결정 이력 로그)와의 관계**: #22는 MainGrid의 CommitListPanel:DeploymentPreviewPanel 비율을 80:20 **고정값**으로 확정한 결정이었다. 이번 결정은 그 고정값을 사용자가 드래그로 바꿀 수 있는 형태로 대체한다 — 80:20은 이제 "초기 기본값"으로만 남는다.

**확정된 설계**:
1. **적용 대상**: 정확히 2개 경계선 — (a) MainGrid의 CommitListPanel↔DeploymentPreviewPanel, (b) §7.2 DeployFilesPanel의 포함된 파일↔누락된 의존성.
2. **인터랙션**: 마우스 드래그로 좌우 비율을 조절하는 스플릿 페인(split pane) 방식 — RISK #21의 컬럼 리사이즈(`handleResizeStart`)와는 성격이 다르다(컬럼 하나의 최소 폭이 아니라, 두 영역이 전체 폭을 나눠 갖는 비율 자체를 조절). 다만 mousedown/mousemove/mouseup 드래그 이벤트 처리 패턴은 재사용 가능.
3. **영속성**: 조절한 비율은 `localStorage`에 저장해서 앱 재실행 후에도 유지한다 — 컬럼 폭 저장과 같은 패턴(전역, 저장소별 구분 없음).
4. **최소 폭 유지**: 각 영역의 최소 폭(MainGrid는 기존 320px/180px, §7.2 분할은 구현 시 결정)은 드래그해도 그 아래로는 안 줄어들게 하고, #22의 `overflow-x: auto` 안전망(최소 폭 합보다 창이 좁아지면 가로 스크롤)도 그대로 유지한다.

## 7.5 전체 TO-BE 와이어프레임

**실현 완료 (2026-08-07), 2026-08-12 재작성** — §7.1~7.4가 전부 구현되면서 아래 그림이 실제 화면 모습이 됐다. 이 섹션 자체는 구현 대상이 아니라 그 결과를 미리 그려본 설계 문서였으므로 "구현 완료" 대신 "실현 완료"로 표기한다. 최초 작성(2026-08-07) 이후 REQ-015~018(선택 유지 카운터, 파일명 검색, 업데이트 알림, RepositoryPanel 라벨)이 추가로 구현되면서 그림이 낡아, 실제 화면(QA 검증 스크린샷, 결정 이력 #39) 기준으로 다시 그렸다 — 아래는 "지금 실제로 이렇게 생겼다"는 스냅샷이며, REQUIREDMENT.md §8의 AS-IS 원본과는 달리 이 섹션은 구현이 바뀔 때마다 같이 갱신하는 게 원칙이다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ deep-backend (shallow-backend) / main   D:\workspace\shallow-backend        [Browse...] [Reload]   [v0.2.1]  │  ← REQ-018: 별도 TitleBar 행 없음,
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤     경로 왼쪽에 라벨(remote 이름 우선,
│ Branch : main ▼     검색 대상 : (●메시지 ○파일명)     Search : [ guarantee        ] [Search]                 │     폴더명 다르면 괄호로 부가정보,
│ 조회 기간 : [ 2026-08-05 ] ~ [ 2026-08-12 ]          최대 [ 100 ] 개                                          │     흐린 색). 버전 배지 새 릴리스
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤     있으면 형광 배경(REQ-017)
│ ☑ 전체 선택  2개 선택됨                        [Preview] │⋮│ Deployment Preview                              │  ← §6.1 케이스 D: 선택 카운터
│──────────────────────────────────────────────────────── │⋮│───────────────────────────────────────────────── │  (검색 조건 안 걸린 총 선택 수)
│ □ a8f2d31  neisii   2026-08-05   guarantee UI            │⋮│ Files      : 18                                 │
│ ☑ b61e2ab  neisii   2026-08-06   guarantee html          │⋮│ Added      : 3                                  │
│ ☑ 8dd9e91  taeyang  2026-08-07   공통 Repository 구현체 정리│⋮│ Modified   : 15                                │
│ □ 5e0f712  neisii   2026-08-08   payment bug              │⋮│ Deleted    : 1                                  │
│ □ 66a3112  minsu    2026-08-09   refactoring               │⋮│                                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  ← §7.4 확장(결정 #27): 위 MainGrid
│                                    ⋮ (세로 드래그 리사이즈, gde:splitRatio:commitsVsFiles) ⋮                    │     전체와 아래 DeployFilesPanel
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤     전체 사이도 드래그 조절 가능
│ Deploy Files (HEAD Latest Version)                                                                             │
├────────────────────────────────────────────────────┬─┬─────────────────────────────────────────────────────┤
│ 포함된 파일        ☑ 전체 선택   Filter: All ▼      │⋮│ 누락된 의존성                          [전체 추가]    │  ← §7.2: 좌우 분할(50:50)
│ 검색(파일명): [                    ]                │⋮│ 검색(파일명): [                    ]                  │     §7.4: 드래그로 비율 조절
│──────────────────────────────────────────────────── │⋮│──────────────────────────────────────────────────── │
│ ☑ .../GuaranteeListController.java                  │⋮│ □ .../GuaranteeListExternalRepository.java  (구현체) │
│ ☑ .../static/js/guarantee/list.js                   │⋮│ □ .../GuaranteeListQueryRepository.java  (인터페이스)│
│ ☑ .../templates/guarantee/list.html                 │⋮│                                                       │
│  ※ Local Path만 표시, Server Path 열 삭제(§7.1-5)   │⋮│  ※ 커밋 이력엔 없지만 정적 분석상 의존하는 클래스     │
│  ※ 내용 길면 가로 스크롤(양쪽 다)                    │⋮│  ※ 전체선택/전체추가는 이 검색·Filter에 걸린 행만    │
│                                                      │⋮│    대상(결정 이력 #33/#36 버그 수정)                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Delete List                                                                                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ old.js                                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [변경]  D:\deploy-output                                                             [ Export ] (진한 색)     │  ← Mapping Profile 드롭다운 삭제(§7.1)
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                          🐱 ← Credit(고정)
```

**변경 없는 요소**: Delete List, Credit.

**최초 작성(2026-08-07) 이후 달라진 점 요약**: (1) TitleBar가 별도 행에서 RepositoryPanel 왼쪽 라벨로 흡수(REQ-018) — "Git Deploy Extractor —" 접두어 삭제, remote 이름 우선 표시. (2) 우측 상단에 버전 배지 신설(REQ-017). (3) 커밋 목록 헤더에 "N개 선택됨" 카운터 추가(§6.1 케이스 D). (4) MainGrid 전체와 DeployFilesPanel 전체 사이에 세로 드래그 리사이즈 경계선 추가(결정 이력 #27, 최초 그림은 §7.4를 "정확히 2곳"으로 그렸었음). (5) 좌우 전체선택/전체추가가 검색·Filter에 걸린 행만 대상으로 하도록 수정(결정 이력 #33/#36 버그 수정, 최초 그림엔 이 제약이 없었음).
