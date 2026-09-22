# 새 세션 구현 지시 프롬프트

> 이 파일은 문서가 아니라, 추가 기능 개발을 맡을 새 세션에게 그대로 붙여넣을 시작 메시지다.

---

```
Git Deploy Extractor에 새 기능을 추가합니다. 이 저장소(neisii/git-deploy-extractor)는
이미 구현 완료 후 v0.6.0으로 릴리스된 상태입니다 — 처음부터 만드는 게 아니라
기존 앱을 확장하는 작업입니다.

**⚠ 리팩토링이 진행 중입니다(2026-09-21 계획 수립, P0·P1 구현 완료 — 2026-09-22).**
v0.6.0 대비 변경이 커서 계획·명세를 `docs/refactoring/`에 분리해 뒀습니다. **다음
착수 지점은 P2(RT-20~24, main/shared 구조 정리 — 동작 불변)입니다.** 이번 작업이 새
기능이 아니라 이 리팩토링의 일부(`RT-xx`)라면 아래 "리팩토링 작업 규칙"을 따르고,
새 기능이라면 그 계획과 겹치는지부터 확인하세요.

- `docs/refactoring/REFACTORING_TASKS.md` — 단일 원천. §0 제품 사용 맥락(폐쇄망 배포
  흐름) · §0.1 용어 · §3 확정 UI 변경 U-1~U-22 · §4 코드 분석(버그 R1~R5 등) · §5 작업
  목록 P0~P5와 §5.1 상세 명세(수용 기준 포함) · §6 문서 동기화 대상 · §7 미결 사항(M-x) ·
  §8 검증 계획.
- `docs/refactoring/component-playground.html` — 목표 UI 목업(브라우저로 열기, 실제
  앱과 연결 안 됨). 방향 확인용이라 세부 인터랙션은 생략돼 있고, **목업과 명세가
  다르면 명세가 우선**합니다. 목업 전용 요소는 §1.1(구현 대상 아님).
- 루트 문서(REQUIREDMENT 등)는 구현·병합 전까지 **v0.6.0 현행 기준** 그대로입니다.
  아래 §8 백로그의 §8.4(제외 패턴 UI) 등은 이 계획에서 이미 다른 방식으로 결정됐으니
  §8만 보고 새로 논의·구현하지 마세요.

리팩토링 작업 규칙:
- 착수 순서는 P0(안전망: vitest·Playwright·CI) → P1(긴급 버그) → P2/P3(동작 불변 정리) → P4(UI
  변경) → P5(문서). P0 없이 P2 이후를 시작하지 마세요. P1은 항목별 별도 커밋,
  P2/P3는 동작 불변(테스트로 증명)입니다.
- 작업할 RT의 §5.1 명세와 수용 기준을 읽고, 관련 §7 미결 사항(M-x)이 **미확정이면
  구현 전에 사용자에게 먼저 확정**받으세요(AskUserQuestion 등). 임의 판단 금지.
- 명세에 없는 기능·표시를 임의로 추가하지 마세요(과거 미요청 항목이 삭제된 전례 있음).
- P단계 구현이 끝나면 해당 스펙을 정식 문서로 병합하고(RT-60, §6 표) 계획 문서에서
  반영 완료로 표시하세요. 두 곳이 동시에 현행이 되지 않게 합니다.
- 사용자는 한국어로 대화합니다. 커밋은 사용자가 요청할 때만 하고, `wrangler.toml`은
  명시 요청 없이 절대 스테이징하지 마세요. `.DETAILED_DESIGN.md.swp`,
  `resources/icon 복사본.png`는 커밋 대상이 아닙니다(RT-62에서 정리).

현재 상태:
- PHASE_PLAN.md의 Phase 0~5(스캐폴딩 → Repository 접근 → Commit 분석/Mapping
  엔진 → Package Builder → UI 연결 → 개별/전체 파일 선택)가 전부 구현·검증 완료.
- 이후 다수의 UI 개선/버그 수정, 라이선싱(MIT + 이미지 자산 예외), 버전
  관리(v0.1.0 → v0.1.1 → v0.2.0 → v0.2.1 → v0.3.0 → v0.4.0 → v0.5.0 → v0.6.0)까지 마치고 GitHub Release로 배포됨.
- Phase 6(리스크 항목 실측 검증)만 의도적으로 후순위로 남아있음 — MVP 출시를
  막는 조건이 아니라서 미룬 것이지, 잊혀진 게 아닙니다. PHASE_PLAN.md §2.6 참고.
- **실사용 중 나온 개선 아이디어 5건(§7.1 Export 경로, §7.2 의존성 완결성 검사,
  §7.4 드래그 리사이즈, §6.1 체크한 커밋 유지, §7.3 파일명 커밋 검색)이 전부
  2026-08-07에 구현 완료됐습니다** — REQUIREDMENT.md REQ-012~016/DR-013~015로
  정식 편입 완료(RISK_ISSUES.md 결정 이력 #24·#25·#30 참고). RISK_ISSUES.md
  §6(보류된 결정 사항)·§7(차기 기능 요구사항 초안)에는 더 이상 미구현 항목이
  없습니다 — §6.1은 A~E까지 전부 확정, §7.1~7.4는 전부 구현 완료, §7.5(TO-BE
  와이어프레임)는 실제 화면으로 실현됨. **정정(2026-09-18)**: 다만 **§8(차기
  기능 백로그, 미확정)에 아이디어 목록으로만 던져지고 아직 선택지 논의도
  안 끝난 항목 5건이 새로 있습니다** — §6·§7과 달리 이 항목들은 구현 착수
  전 AskUserQuestion 등으로 세부 사항(예: 설정 파일 vs 설정 화면, 인라인
  접기/펼치기 vs 팝업)을 반드시 먼저 확정해야 합니다. **이번 작업이 완전히
  새로운 기능 요구라면 §8부터 확인하고, §8에도 없다면 이 백로그에서 시작점을
  찾을 수 없는 것이니 REQUIREDMENT.md §0.2(과설계 방지) 원칙대로 사용자에게
  요구사항을 새로 확인하세요.**
- §7.1/§7.2/§7.4 구현 직후(같은 날짜) 사용자가 UI를 직접 써보고 준 후속
  피드백 5건이 더 반영됐습니다(결정 이력 #26~#29) — DeployFilesPanel을
  "제목만 가진 얇은 부모 + 독립 스크롤 박스 2개"로 재구성, `SplitPane`이
  세로(상하) 방향도 지원하도록 확장해 MainGrid 전체↔DeployFilesPanel 전체
  사이에도 드래그 리사이즈 추가(§7.4가 원래 정의한 "정확히 2곳"이 3곳으로
  늘어남), 드래그 핸들을 얇게(2px) 정리, BranchSearchBar 2줄 레이아웃 고정,
  CommitListPanel/DeploymentPreviewPanel이 SplitPane 셀 높이를 항상 꽉
  채우도록 수정. 전부 REQ-013/014·DR-014 범위 안의 다듬기라 새 REQ/DR은
  없지만, DETAILED_DESIGN.md §7과 UI_UX_SPEC.md §1/§2.4/§2.5/§2.6/§2.3은
  이 후속 피드백까지 반영된 **최종 상태**로 갱신돼 있습니다 — §7.4 관련
  작업을 이어간다면 RISK_ISSUES.md §7.4 초안 원문보다 이 최종 상태를
  기준으로 삼으세요.
- §6.1+§7.3(마지막 묶음)은 세션 시작 시점에 §6.1의 A~E를 전부 확정하고
  진행했습니다(A/D/E는 문서에 있던 방향 그대로, B/C는 사용자에게 직접
  확인) — 결정 이력 #30 참고. 같은 세션에서 `runAnalysis()`의 레이스
  컨디션(§6.1 케이스 C)도 같이 고쳤습니다.
- 바로 다음 세션에서 사용자가 케이스 D("N개 선택됨" 카운터를 추가하지
  않는다는 결정)를 직접 뒤집었습니다 — AskUserQuestion 없이 "문서에 이미
  있던 방향"이라는 근거만으로 임의 판단했던 게 실제 사용자 선호와 달랐던
  사례입니다. CommitListPanel 헤더에 카운터를 추가했고, 그 과정에서
  로딩/빈 목록/에러 상태에 패널 전체를 대체하던 구조가 카운터까지 함께
  지워버리는 걸 발견해 헤더는 항상 렌더링하도록 구조도 같이 고쳤습니다 —
  결정 이력 #31 참고.
- v0.2.1 이후, 실사용 중 나온 아이디어 3건이 추가로 구현 완료돼 v0.3.0으로
  릴리스됐습니다(2026-08-12): (1) DeployFilesPanel 좌/우 전체선택·전체추가가 필터/검색을
  무시하던 버그 수정(RISK_ISSUES.md 결정 이력 #33/#36) — `toggleAllDeployFiles`/
  `addAllMissingDependencies`가 이제 화면 표시 목록의 경로를 파라미터로
  받는다. (2) GitHub Release 업데이트 알림(REQ-017/DR-016, 결정 이력
  #34~#36) — RepositoryPanel 우측 버전 배지가 새 릴리스를 강조색으로
  안내하고 클릭 시 확인 후 릴리스 페이지를 연다. (3) 저장소/브랜치 요약
  라벨 신설(REQ-018/DR-017, 결정 이력 #37/#38) — 로컬 폴더명 대신
  `git remote origin` URL에서 유도한 "진짜" 프로젝트 이름을 우선 표시
  (다르면 `이름 (폴더명)`, 폴더명은 흐린 색). 이 항목은 원래 별도 컴포넌트
  `TitleBar`("Git Deploy Extractor — 폴더명 / 브랜치") 개선으로 시작했으나,
  최종적으로 **`TitleBar` 자체를 없애고** 그 표시값을 `RepositoryPanel`의
  저장소 경로 텍스트 **왼쪽**에 합쳤습니다(`TitleBar.tsx` 삭제됨) — 경로
  텍스트에는 이번에 `ellipsis` truncation + hover `title` 툴팁도 새로
  추가됐습니다(이전엔 없던 잠재 버그였음, 결정 이력 #38). "타이틀바를
  어디에 어떻게 보여줄까"를 두고 대안 6개(행 삭제, OS 창 제목 이전, 창
  폭/최대화 조건부 표시, RepositoryPanel 인라인 배치 2종)를 순서대로
  검토·기각한 뒤 나온 결과입니다 — 각 대안이 왜 기각됐는지(특히 mac
  풀스크린에서 창 타이틀바 자체가 사라지고 커서 호버로 나타나는 건 창
  타이틀이 아니라 메뉴바라는 점, 재현 테스트로 확인)가 결정 이력 #37/#38에
  자세히 남아있으니, 이 UI를 다시 건드릴 일이 있으면 먼저 그 기록을
  읽어보세요 — 이미 기각된 방향으로 되돌리는 실수를 피할 수 있습니다.
  세 기능 다 Playwright(업데이트 알림은 실제 GitHub API 호출 포함)로
  검증 완료 후 v0.3.0으로 릴리스됐습니다.
- 위 3건 구현 직후, 기존 기능 + 신규 3건 전체를 아우르는 UI/UX 회귀
  검증을 한 번 더 돌렸습니다(2026-08-12, 결정 이력 #39) — Spring Boot
  예제 fixture로 Playwright 25개 항목(저장소 선택/라벨, 커밋 검색 2모드,
  선택+카운터, Preview+의존성 완결성 검사, 필터/전체선택 버그 수정,
  SplitPane, Export, 업데이트 배지, Credit 링크) 전부 통과, 코드 변경
  없음. 검증 중 REQ-013(의존성 완결성 검사)의 base package 스코프 규칙
  ("`@SpringBootApplication` 클래스의 정확히 그 패키지만, 형제/조상
  패키지는 스캔 대상 아님")이 fixture 작성자에게 헷갈리기 쉽다는 게
  드러나 DETAILED_DESIGN.md §6.2에 주의 문구를 추가했습니다 — 이 기능
  관련 fixture를 새로 만들 때 참고하세요.
- v0.3.0 릴리스 이후, DeployFilesPanel(포함된 파일/누락된 의존성) 관련
  개선 6건이 추가로 구현 완료돼 v0.4.0으로 릴리스됐습니다(2026-08-20,
  결정 이력 #40~#46): (1) 배포
  대상 파일 제외 패턴(REQ-019, DR-018) — "포함된 파일"에만, `.gitignore`
  스타일 `*` 매칭(단일 세그먼트만, `**`/`!`/트레일링 슬래시 디렉터리
  매치는 백로그 — RISK_ISSUES.md 결정 이력 #43), 전역 `localStorage`
  영속. (2) 좌우 헤더에 "선택 N개/전체 N개(필터 전 전체 N개)" 세 숫자
  카운터(REQ-020) — "선택"은 Filter/검색과 무관한 절대값으로 설계했다가
  자기 반성 검토(#42)에서 "화면 필터로 좁히면 실제 체크된 파일이 카운터
  에서 누락되는" §6.1 케이스 D와 같은 유형의 설계 결함을 스스로 발견해
  고친 결과입니다 — 다음에 이런 카운터를 또 만들 때 참고하세요. 우측만
  50개 초과 시 "전체" 부분에 경고 색+툴팁. (3) DeployFilesPanel 가상
  스크롤 300개 초과 시 중첩 가로 스크롤 버그 수정 — react-window의
  `List`가 `style` prop을 자기 루트에 마지막 spread한다는 걸 소스로
  확인해(§0.1) `overflowX:'hidden'`만 추가하는 걸로 끝남, CSS 선택자
  우회 불필요. (4) "전체 선택" 체크박스를 패널 헤더에서 `Local Path`
  컬럼 헤더 행(각 행 체크박스와 동일 위치)으로 이동, 누락된 의존성의
  "전체 추가"(단방향 버튼)도 좌측과 동일한 "전체 선택"(양방향 체크박스)
  로 교체 — `BulkAction` 판별 유니온이 단일 변형만 남아 `BulkSelectAction`
  으로 단순화됨. (5) Credit(우측 하단 캐릭터 아이콘) 클릭 대상을 제작자
  프로필에서 이 저장소 페이지로 변경. 전부 Playwright로 실제 앱 기준
  검증 완료(Export 결과물 직접 열어 제외 패턴이 실제로 반영되는 것까지
  확인). RISK_ISSUES.md §7.5 와이어프레임도 이 상태 기준으로 다시 그려져
  있습니다.
- v0.4.0 릴리스 이후, README 안내 정비 1건과 신규 기능 1건이 추가로 구현
  완료돼 v0.5.0으로 릴리스됐습니다(2026-08-23, 결정 이력 #47~#50): (1)
  Windows SmartScreen/macOS Gatekeeper가 서명 인증서 미보유로 뜨는 정상
  경고임을 안내하는 문구를 README에 추가하면서, `## Build`를 `## Install`
  (방법 1: Releases 다운로드 + 우회 안내, 방법 2: clone 후 직접 빌드)로
  재구성하고 목차도 신설(결정 이력 #47 — CI/로컬 빌드가 서명 상태는
  동일하다는 점, MOTW/quarantine이 워크플로우가 아니라 다운로드 시점에
  붙는다는 점까지 근거로 확인됨). (2) **REQ-021 배포 대상 파일 수동
  추가**(DR-019) — 팀원이 GDE로 추출한 파일을 배포했는데 참조하는 다른
  클래스가 이전 배포 회차에서 리비전 싱크 문제로 누락돼 있던 실사용
  사고가 계기입니다. REQ-013(의존성 완결성 검사)의 import/DI 참조
  그래프로는 "이번 Export와 코드 참조 관계가 아예 없는 파일"을 원리적으로
  못 잡는다는 게 핵심 결론이라(결정 이력 #48 — 참조 그래프를 더
  정교화하는 방향과 "내부망 마지막 반영 리비전" 추적 방향 둘 다 검토 후
  기각), 알고리즘 탐지 대신 사용자가 HEAD 트리에서 파일을 직접 검색해
  추가하는 기능으로 귀결됐습니다. UI는 두 번 크게 정정됐습니다 — 처음엔
  "포함된 파일" 목록을 안 가리는 위치까지만 확장되는 flyout 팝업이었으나
  (목록 상단까지 거리를 실측해 max-height를 clamp), 사용자가 "목록을
  가려도 상관없다"고 제약 자체를 철회하면서 좌우 두 컬럼을 감싸는 부모
  중앙에 뜨는 고정 크기(480px) 모달로 단순화됐습니다(결정 이력 #49 —
  이 과정에서 "우측 패널에 그려주기"/"탭 구조" 대안도 논의됐으나 각각
  cross-panel 부작용과 전례 없는 UI 패턴 비용을 근거로 기각). 목록이
  가려지는 대신 팝업 안 "수동 추가 이력" 칩에 강조색(REQ-017 버전 배지와
  동일)을 써서 뭘 추가했는지 확인할 수 있게 했습니다. 생명주기는 REQ-013
  의존성 후보와 동일하게 `[Preview]` 재실행 시 초기화됩니다(정확성보다
  기존 패턴 일관성·구현 단순성을 우선한 의도적 트레이드오프). 실사용 중
  발견된 후속 버그(검색 결과 hover 시 title 툴팁이 간헐적으로 안 뜸)도
  같은 세션에서 수정 완료(결정 이력 #50 — 원인은 `title`이 42px 행 중
  19px 텍스트 줄에만 붙어 있어 hover 판정 영역이 좁았던 것, `<li>` 전체로
  이동해 해결). 전부 Playwright fixture로 검증 완료.
- v0.5.0 릴리스 이후, 커밋 이력 필터링 확장 3건 + 제외 패턴 삭제 + 파일명
  검색 와일드카드가 추가로 구현 완료돼 v0.6.0으로 릴리스됐습니다
  (2026-09-14, 결정 이력 #51~#59): (1) **REQ-022 커밋 이력 필터링
  조건 추가** — 작성자(`--author -i`)/Merge 커밋 제외(`--no-merges`) 두
  조건을 기존 검색과 AND 결합. 이후 사용자 요청으로 Merge 제외 기본값을
  `false`→`true`로 정정(배포 대상 파일 추출 목적상 Merge 커밋은 대개
  노이즈라는 판단), 작성자 필터도 REQ-023과 같은 여러 줄 붙여넣기로
  확장돼 여러 작성자 중 하나라도 일치하면 포함(OR — git이 `--author`를
  여러 번 주면 기본으로 OR 처리하는 동작을 그대로 활용, 새 로직 불필요).
  (2) **REQ-023 해시로 커밋 필터링** — 붙여넣은 해시 목록과 정확히
  일치하는 커밋만 조회하는 배타적 필터(값이 있으면 branch/기간/검색어/
  작성자/Merge 제외를 전부 무시). `git log --no-walk`로 조상까지 안
  훑고 지정한 커밋 자체만 가져오며, 일부 해시가 잘못돼 실패하면
  `cat-file -e`로 하나씩 검증해 유효한 것만 재시도(오타 하나로 전체가
  실패하지 않도록). (3) **REQ-024 제외 패턴 삭제** — REQ-019 제외 패턴
  칩에 `×` 버튼을 추가해 토글과 별개로 이력에서 완전히 삭제. 칩 자체가
  `<button>`이라 그 안에 삭제 버튼을 중첩할 수 없어(HTML 제약) span
  래퍼+토글 버튼+삭제 버튼 구조로 재구성. (4) **REQ-025 포함된 파일
  검색 와일드카드** — `*.html`, `*.java`처럼 확장자·패턴에 무관하게
  `*`로 파일명 전체를 매치(REQ-019와 같은 글롭 문법 재사용, 다만
  대소문자는 항상 무관하게 비교 — REQ-019는 Export에 영향을 주는 영속
  규칙이라 대소문자 구분이지만 이건 일시적 검색이라 다름). `*` 없는
  입력은 기존 부분 일치 그대로 하위 호환. 좌(포함된 파일)/우(누락된
  의존성) 검색 필드가 매칭 함수를 공유해 우측에도 자동 적용됨(REQ-016
  커밋 파일명 검색에는 아직 미적용 — 의도적 범위 제한). 이 과정에서
  UI 다듬기 2건도 함께 반영: 작성자/해시 필터를 한 행에 좌우 반반
  배치(DeployFilesPanel 50:50과 같은 감각이지만 드래그 리사이즈
  `SplitPane`까지는 안 씀, `flex: 1 1 320px`로 충분), 두 필드의 설명
  문구를 라벨에서 `placeholder`로 이동. 전부 로컬 fixture 저장소·독립
  스크립트로 매칭 로직을 직접 검증(작성자 OR, 해시 유효성 폴백,
  와일드카드 12+9케이스).
- v0.2.0 릴리스 직후, `.github/workflows/release.yml`로 macOS/Windows 빌드를
  자동화했습니다 — `v*` 태그를 push하면 두 OS를 각각 빌드해 해당 태그의
  GitHub Release에 dmg/setup.exe를 자동 첨부합니다. Actions 화면에서
  `workflow_dispatch`로 태그 없이 수동 실행도 가능(수동 실행 시엔 Release
  첨부 없이 workflow artifact로만 결과 확인 — `github.ref`가 브랜치라 첨부할
  태그가 없기 때문). 구현 중 실제 CI 실행으로 발견한 문제 둘: (1) `build:mac`이
  `build:win`과 달리 typecheck를 건너뛰던 기존 불일치를 발견해 통일. (2)
  electron-builder가 CI 환경변수를 감지하면 `repository` 필드를 보고 빌드 후
  GitHub Release에 자동 업로드(implicit publish)를 시도하는데 `GH_TOKEN`이
  없어 두 OS 모두 실패 — 업로드는 워크플로우의 별도 스텝이 담당하므로
  `build:win`/`build:mac`에 `--publish never`를 추가해 해결(electron-builder.yml에
  `publish: never`를 넣는 시도는 실패함 — 그 키는 CLI 옵션과 달리 publish
  provider 설정이라 "never"를 존재하지 않는 provider로 오인함). v0.2.1은 이
  파이프라인이 실제 태그 push로도 끝까지 동작하는지 검증하려고 만든
  릴리스이며, 그 자체는 앱 기능 변경이 없습니다.
- v0.6.0 릴리스 직후(2026-09-14), `release.yml`의 액션 4개(`actions/checkout`,
  `actions/setup-node`, `actions/upload-artifact`, `softprops/action-gh-release`)를
  v4/v4/v4/v2 → v7/v7/v7/v3로 올렸습니다(결정 이력 #60·#61) — v0.6.0 태그
  빌드 로그에 "Node.js 20 is deprecated" 경고가 떠서 계기가 됐습니다. 웹
  검색 결과가 setup-node 버전을 v5/v6/v7로 서로 다르게 말해 신뢰할 수 없었던
  탓에, `gh api repos/<owner>/<repo>/releases/latest`로 각 액션의 실제 최신
  태그를 직접 조회해 확정했고, 각 저장소 CHANGELOG를 v4~v7(gh-release는
  v2~v3) 구간까지 훑어 이 워크플로우가 쓰는 입력에 영향을 주는 breaking
  change가 없음을 확인한 뒤 반영했습니다. `gh workflow run`으로
  `workflow_dispatch`를 직접 실행해 재검증 — 1차 시도에서 macOS/Windows 둘
  다 `npm run build:mac`/`build:win` 단계에서 504 Gateway Timeout으로
  실패했지만, electron-builder가 빌드 리소스(dmgbuild-bundle,
  nsis-resources)를 받아오다 겪은 일시적 네트워크 문제이지 액션 버전과
  무관함을 로그로 확인했고, `gh run rerun --failed`로 재시도해 최종 전부
  성공했습니다 — 다음에 이 워크플로우에서 빌드 실패를 마주치면 먼저 로그의
  실패 지점이 액션 단계인지 `npm run build:*` 내부(주로 electron-builder
  리소스 다운로드)인지부터 구분하세요.
- **리팩토링 P0·P1이 구현 완료됐습니다(2026-09-22, 커밋 `4a5feb8`~`b651deb`).**
  상세 내용(각 RT의 구현 방식·수용 기준·테스트)은 `docs/refactoring/
  REFACTORING_TASKS.md` §5의 해당 RT 항목에 전부 기록돼 있으니 거기를
  확인하세요 — 여기서는 다음 세션이 바로 알아야 할 것만 요약합니다.
  - P0(RT-00b~04): vitest·Playwright(`_electron`)·CI(`ci.yml`) 도입,
    기존 `scripts/verify-phase*.ts`(custom assert)를 vitest로 승격 후
    삭제. `npm test`(vitest)·`npm run test:e2e`(Playwright, CI 미연동 —
    리눅스 러너에 xvfb 필요) 둘 다 그린.
  - P1(RT-10~17): R1(해시 필터 옵션 주입)·R2(커밋 조회 레이스)·R3(IPC
    입력 미검증)·R4·R5(분석 요청 레이스)와 U3~U8을 각각 별도 커밋으로
    수정. `lib/requestGuard.ts`(`createRequestGuard`)가 커밋 조회·분석
    요청 가드 둘 다에 재사용되는 공용 유틸로 자리잡았습니다 — 이후
    Reload/새 비동기 조회 계열 버그를 고칠 때도 이 패턴부터 찾아보세요.
  - **P2(RT-20~24, main/shared 구조 정리, 동작 불변) 완료**(2026-09-22).
    RT-20: `shared/ipc-channels.ts` 신규(채널명·params/result 타입 단일
    정의), `preload/index.ts`·`preload/index.d.ts`·main IPC 핸들러가 전부
    이걸 통해서만 채널을 참조. RT-21: 당시 196줄이던 `main/ipc/handlers.ts`
    단일 파일을 `main/ipc/handlers/{app,repository,git,mapping,analysis,
    package,update}.ts`(채널명 접두사별)로 분리하고 `index.ts`가 등록
    함수를 모아 호출(호출부 `main/index.ts`는 `./ipc/handlers`를 그대로
    import — 디렉터리로 바뀐 걸 몰라도 됨), `main/ipc/dialogs.ts` 신설
    (폴더 선택·확인창 공용 헬퍼로 복붙 4곳 제거), `getRemoteProjectName`
    설명이 엉뚱하게 `listTrackedFiles` 위에 붙어 있던 주석 버그(S7)도
    같이 고침. RT-22: 332줄이던 `main/analysis/dependencyAnalysis.ts`를
    `dependencyAnalysis/{projectIndex,resolve,implementations,index}.ts`로
    분리(호출부는 무변경). **이 알고리즘은 분할 전까지 자동 테스트가
    전혀 없었다**(v0.3.0 때 Playwright 수동 확인이 유일한 기록) — 분할과
    함께 `index.test.ts`(Spring Boot 모양 fixture 5개)를 신설해 분할
    전후 동작이 같음을 직접 증명했다. 다음에 이 모듈을 또 건드릴 일이
    있으면 이 테스트부터 확인하세요(회귀 안전망이 이제 이것뿐임). RT-23:
    `main/mapping/types.ts`(shared/types 재export뿐이던 껍데기) 삭제,
    `main/git/types.ts`는 진짜 main 전용 타입(`GitCommandResult`)만 남기고
    재export 줄 제거. `shared/` vs `renderer/src/lib/` 배치 기준을 처음
    문서화(IPC DTO/채널 → `shared/types.ts`·`shared/ipc-channels.ts`,
    main+renderer 둘 다 쓰는 순수 함수 → `shared/`, 그 외 Renderer 전용 →
    `renderer/src/lib/`) — 기존 배치가 이미 이 기준을 만족해 파일 이동은
    없었음. **RT-24**: `git/*.ts` 전체를 감사해 옵션 인젝션 방지 규약을
    통일 — pathspec(파일 경로)은 이미 전부 `--` 뒤였지만, revision(브랜치명·
    커밋 해시)은 `--`를 못 쓰는데도(재해석되어 무시됨, RT-10 주석에
    재현 확인돼 있음) 검증이 없던 자리가 있었다. `git/exec.ts`에
    `assertSafeRevisionArg`(`-`로 시작하면 거부) 신설 후 5개 함수(`commits.ts`
    listCommits의 branch, lsTree.ts, grep.ts, showFile.ts, `diff.ts`의
    commitHash/branch)에 적용 — **`diff.ts`의 commitHash는 `analysis:preview`
    IPC의 commitHashes를 형식 검증 없이 그대로 타는 R1과 같은 유형의 실제
    구멍이었고, 이번에 새로 발견해 막았다**(diff.ts엔 테스트가 아예
    없어서 `diff.test.ts` 신규). `grep.ts` 패턴 인자에도 `-e` 명시(실제
    저장소로 전/후 동작 동일함과 인젝션 케이스 둘 다 재현 확인). 상세는
    `docs/refactoring/REFACTORING_TASKS.md` §5 RT-20~24 항목.
  - **P3(RT-30~34, 스토어 분해, 동작 불변) 진행 중** — RT-30 완료
    (2026-09-22). `renderer/src/api/index.ts` 신규: `export const api`는
    안정된 Proxy 객체 하나로 고정, 내부적으로 `resolveApi()`(기본은 실제
    `window.api`)에 위임하며 실제 메서드 호출 시점에만 `window.api`를
    읽는다(모듈 최상단에서 읽으면 `window`를 세팅하지 않는 순수 함수
    테스트가 이 모듈을 import하는 순간 throw하기 때문). `setApiForTesting`/
    `resetApiForTesting`을 테스트 전용으로 export. `appStore.ts`의
    `window.api.*` 17곳을 전부 `api.*`로 교체(동작 무변경).
    `analysisGuard.test.ts`·`commitQueryGuard.test.ts`가 쓰던
    `vi.stubGlobal('window', {...})`(전역 자체를 통째로 바꿔치기)를
    `setApiForTesting(...)`(이 모듈만 교체)로 교체 — 다음에 스토어
    액션에서 새 IPC 호출을 추가할 때는 `window.api`가 아니라 이 `api`를
    import해서 쓰세요(그래야 나중에 그 액션을 테스트할 때도 같은 방식으로
    목킹 가능). **다음 착수 지점은 RT-31**입니다(스토어를 `repository`·
    `commitQuery`·`commits`·`analysis`·`deployFiles`·`export`·`update`
    slice로 분리). RT-60(문서 정식 병합)은 P4까지 다 끝난 뒤 P5에서 한
    번에 처리하는 게 이 계획의 순서라 아직 하지 마세요 — 지금까지는
    `docs/refactoring/REFACTORING_TASKS.md` §6 표에 반영 대상만 계속
    쌓아뒀습니다. P2/P3는 동작 불변이 원칙이라 RT-20~30 모두
    `npm test`(108개)·`typecheck`·`lint`·`build`·`test:e2e`(7개) 전부
    통과로 확인했고, 이후 RT도 시작 전에 같은 기준선이 통과하는지 먼저
    확인하세요.
  - RT-01에서 만든 `renderer/src/lib/filePattern.ts`(§3.1 글롭/패키지
    매칭 로직)는 **아직 UI에 배선되지 않았습니다** — RT-46(P4)에서
    기존 `excludePatternMatch.ts`(REQ-019 구버전, `*` 단일 세그먼트
    한정)를 이걸로 교체할 예정이니, 그 전까지는 죽은 코드처럼 보여도
    정상입니다.

먼저 이 순서로 읽어주세요 (짐작하지 말고 실제로 읽어야 합니다):

0. (리팩토링 관련 작업이면) docs/refactoring/REFACTORING_TASKS.md — 위 안내 참고.
   아래 1~6은 v0.6.0 기준의 기존 결정과 현행 동작을 확인하는 용도입니다.
1. REQUIREDMENT.md — 요구사항 원문. REQ-001~025, DR-001~019가 전부 확정 사항
   (이 번호 범위는 v0.6.0 기준 — 릴리스가 더 진행됐다면 문서에서 실제
   마지막 번호를 직접 확인하세요, 이 숫자를 갱신 없이 그대로 믿지 마세요).
   새 기능이 이 문서의 기존 요구와 상충하는지부터 확인하세요.
2. RISK_ISSUES.md — §4(결정 이력 로그)에 지금까지의 모든 설계/UI 결정이 시간순으로
   정리돼 있습니다. 여기 있는 결정을 모르고 "개선"을 시도하면 이미 한 번 정정됐던
   방향으로 되돌리는 실수를 하기 쉽습니다. §5(미조사 잠재 리스크)도 새 기능과
   관련 있는지 확인하세요. §6(보류된 결정 사항)·§7(차기 기능 요구사항 초안)은
   위에서 설명한 대로 전부 해소됐지만, 과거 결정의 배경(왜 이렇게 정했는지)을
   이해하는 데는 여전히 유용하니 필요시 참고하세요. **§8(차기 기능 백로그,
   미확정)은 아직 선택지 논의도 안 끝난 항목 5건이 있는 살아있는 섹션입니다
   — 이번 작업이 새 기능 요구라면 반드시 먼저 확인하세요.**
3. ARCHITECTURE.md — 기술 스택(Electron+React+TypeScript+Zustand), 모듈 구조,
   프로세스 경계.
4. DETAILED_DESIGN.md — 알고리즘/git 명령어/JSON 스키마의 확정본. 특히 §0 구현
   원칙은 새 기능에도 그대로 적용됩니다:
   - §0.1: git/외부 도구 동작에 대한 주장은 반드시 재현 테스트로 검증한다
     (기억이나 문서 서술만 믿지 않는다)
   - §0.2: REQUIREDMENT.md에 없는 걸 임의로 확장·개선하지 않는다 (과설계 금지)
5. UI_UX_SPEC.md — 컴포넌트/상태/인터랙션 명세. "정정"/"추가" 노트에 각 결정의
   이유와 날짜가 남아있으니 새 기능이 기존 UI와 겹치는 영역이면 먼저 확인하세요.
6. README.md — 파일 추출 기준(어떤 커밋/파일이 어떤 규칙으로 추출되는지)이
   요약돼 있습니다. 추출 로직에 손대는 기능이면 이 기준과 충돌하지 않는지 확인.

작업 방식:
- 문서에 없는 것을 발견하거나 새 기능이 기존 결정과 상충하면 임의로 판단하지
  말고 먼저 물어보세요.
- git 관련 동작을 새롭게 응용할 일이 생기면(플래그 추가 등) 실제 테스트
  저장소로 재현 확인 후 진행하세요.
- 새 기능이 요구사항/설계/UI 명세에 영향을 주면, 구현과 함께 해당 문서도
  갱신하세요 — "정정 (이유, 날짜)"/"추가 (이유, 날짜)" 형식과 RISK_ISSUES.md
  §4 결정 이력 로그에 항목을 추가하는 게 이 저장소의 정착된 컨벤션입니다.
- UI 변경이면 실제로 앱을 띄워서(npm run dev, 또는 Playwright로 재현) 확인한
  뒤 완료로 보고하세요.

지금부터 아래 기능을 검토·구현해주세요:

[여기에 추가할 기능을 설명해주세요]
(리팩토링 작업이면 기능 설명 대신 착수할 작업 번호를 적습니다. 예: "RT-01 진행" — 이 경우 위 "리팩토링 작업 규칙"이 우선합니다.)
```
