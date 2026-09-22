# 새 세션 구현 지시 프롬프트

> 이 파일은 문서가 아니라, 추가 기능 개발을 맡을 새 세션에게 그대로 붙여넣을 시작 메시지다.

---

```
Git Deploy Extractor에 새 기능을 추가합니다. 이 저장소(neisii/git-deploy-extractor)는
이미 구현 완료 후 v0.6.0으로 릴리스된 상태입니다 — 처음부터 만드는 게 아니라
기존 앱을 확장하는 작업입니다.

**⚠ 리팩토링이 진행 중입니다(2026-09-21 계획 수립, P0~P3 + P4의 RT-40~44·46 구현
완료 — 2026-09-22).** v0.6.0 대비 변경이 커서 계획·명세를 `docs/refactoring/`에
분리해 뒀습니다. **다음 착수 지점은 P4의 RT-45(U-3·U-5, StatusFilter·좌측
검색 삭제·added 녹색·`+ 파일 추가` 제목 줄 우측)입니다. RT-43(PopupHost)·
RT-44(PreviewSummary/Deleted·경고 팝업)·RT-46(FilterPatternBar/패턴 팝업)은
2026-09-22에 한 번에 구현 완료됐습니다(RT-43 명세가 RT-44/46을 전제해
AskUserQuestion으로 범위를 확인한 뒤 셋을 같이 진행 — §5 RT-43/44/46 항목의
구현 요약 참고). 착수 전에 §5.1의 RT-45 명세가 아직 없는 다른 RT(번호가 더
큰 것 포함)를 전제하고 있는지부터 확인하세요 — RT-41/42/43에서 실제로 이런
순서 문제가 있었습니다. P4는 실제 UI 변경 단계라 P0~P3의 "동작 불변" 원칙이
더 이상 적용되지 않습니다** — §3 확정 UI
변경(U-1~U-22)·목업(`component-playground.html`)·§5.1 각 RT 상세 명세를 따르고,
관련 §7 미결 사항(M-x)이 미확정이면 구현 전에 먼저 확인하세요. 이번 작업이
새 기능이 아니라 이 리팩토링의
일부(`RT-xx`)라면 아래 "리팩토링 작업 규칙"을 따르고, 새 기능이라면 그 계획과
겹치는지부터 확인하세요.

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
  - **P3(RT-30~34, 스토어 분해, 동작 불변) 진행 중** — RT-30·31 완료
    (2026-09-22). RT-30: `renderer/src/api/index.ts` 신규: `export const api`는
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
    목킹 가능). RT-31: 1098줄이던 `appStore.ts`를 `store/slices/
    {repository,commitQuery,commits,analysis,deployFiles,export,update}
    Slice.ts` 7개로 분리, `appStore.ts`는 56줄짜리 조립 전용 루트로
    축소(`AppState` = 7개 슬라이스 인터페이스 교집합). **슬라이스끼리
    다른 슬라이스의 액션을 부를 때는 파일을 직접 import하지 않고 zustand
    공유 `get()`으로만 부른다**(예: `get().loadCommitsFirstPage()`) —
    이 패턴을 앞으로도 유지하세요, 안 그러면 슬라이스 파일 사이에 순환
    import가 생깁니다. 리셋 상수(`emptyDependencyState`·
    `emptyManualAddState`·`idleExportState`)와 `analysisGuard`처럼
    "상태가 아니라 순수 값"인 것만 예외적으로 그 값을 정의한 슬라이스
    파일에서 export해 다른 슬라이스가 직접 import한다(전부 한 방향:
    commitsSlice ← analysisSlice/deployFilesSlice/exportSlice,
    analysisSlice ← deployFilesSlice — 순환 없음). `useAppStore`·
    `selectIsAnalysisStale`·`DeployFilesFilter` 등 기존 공개 API는 전부
    `./appStore`에서 재export해 컴포넌트·테스트 import 경로는 무변경.
    RT-32: `commitsSlice.ts`의 `loadCommitsFirstPage`/`loadNextPage`가
    복붙하던 `listCommits` 파라미터 조립(필터 8개, `skip`만 다름)을
    `services/commitQueryParams.ts`의 `buildListCommitsParams(...)`로
    단일화(`parseMultiValueFilter`도 이 파일로 이동). 디바운스 타이머는
    `renderer/src/lib/useDebouncedAction.ts` 훅으로 스토어 밖(컴포넌트
    쪽)으로 옮겼다 — 예전엔 `commitQuerySlice.ts` 모듈 전역 타이머
    하나를 검색어/작성자/해시/기간 네 필드가 공유해서 한 필드 편집이
    다른 필드의 대기 중이던 디바운스까지 우연히 취소했는데, 이제
    `BranchSearchBar.tsx`가 필드마다 독립된 훅 인스턴스를 갖는다.
    **스토어의 네 setter(`setSearchTerm` 등)는 이제 상태만 즉시
    반영하는 순수 setter다 — 조회를 트리거하려면 컴포넌트가 훅의
    `run()`을 명시적으로 불러야 한다**(스토어 setter 호출만으로는 더
    이상 자동 조회되지 않음, 새 필드를 추가할 때 잊지 마세요). 즉시
    조회 지점(Search 버튼·Ctrl/Cmd+Enter 등)은 4개 훅의 `cancel()`을
    전부 불러 예전 `clearTimeout` 효과를 재현한다. RT-33:
    `exportSlice.ts`의 `runExport` 안에 인라인이던 REQ-019/DR-018 판정
    (`included=true` 중 활성 제외 패턴에 안 걸리는 것만 Export 대상)을
    `services/exportPlan.ts`의 `buildExportFiles(deployFiles,
    excludePatterns)`로 추출. **이번엔 현재(`included` 불리언 기준)
    로직만 순수 함수로 뽑았을 뿐** — RT-51(P4, Extract 목록 모델 도입)
    에서 이 함수 내부가 "Extract 목록 − 활성 패턴 해당 항목" 기준으로
    바뀔 예정이고, `exportSlice`의 호출부 계약은 유지되도록 설계해뒀다
    (§5.1 RT-51 명세 참고 — RT-51 작업 시 이 파일부터 열어보세요).
    RT-34: `DeployFilesPanel.tsx`의 좌/우 파생 계산(상태 Filter→제외
    패턴→파일명 검색, 전체 선택 판정, 카운터)을 `lib/useIncludedFilesView.ts`·
    `lib/useMissingDependenciesView.ts`로, `DeploymentPreviewPanel.tsx`의
    "empty/stale/loading/ready/error" 우선순위 판정을 `lib/useAnalysisPhase.ts`로
    뺐다. 두 view 훅이 `includedSet`을 공유(누락된 의존성 중복 제거).
    **`FooterActionBar`/`CommitListPanel`은 의도적으로 `useAnalysisPhase`로
    옮기지 않았습니다** — 옮기면 그 두 컴포넌트가 지금 구독 안 하는
    `summary`/`analysisError`까지 구독하게 돼 불필요한 재렌더링이
    생기므로, 새로 이 훅을 쓸 컴포넌트를 고를 때도 "이 컴포넌트가 5개
    필드 전부를 실제로 쓰는가"부터 확인하세요. `useMemo` 기반 훅이라
    vitest로 직접 단위 테스트 못 합니다(jsdom 미도입, RT-01 방침 유지) —
    동작 검증은 `test:e2e`로 대신했습니다.
    **이걸로 P3(RT-30~34) 완료.**
  - **P4(컴포넌트 재정의 + UI 변경) 진행 중** — RT-40(primitives) 완료
    (2026-09-22). 착수 전에 §5.1 RT-40 명세와 관련 §7 미결 사항(M-7·
    M-8·M-9 — 전부 이미 확정됨, M-38은 RT-47 몫이라 블로킹 아님)을
    먼저 확인 — 미확정이었으면 구현 전에 물어봤을 것. `components/
    Panel.tsx`(`Panel`/`PanelHeader`/`PanelBody`)·`PanelState.tsx`(5상태,
    메시지 함수는 `lib/panelStateMessage.ts`로 분리 — 컴포넌트 파일이
    컴포넌트 아닌 값을 export하면 `react-refresh/only-export-components`
    린트 에러가 남)·`Chip.tsx`(exclude·include·manual, 새 색 안 만들고
    기존 error/primary/success 색 재사용)·`TriStateCheckbox.tsx`(S5
    중복 해소)·`CollapsibleSection.tsx`(헤더는 본문 밖, 본문은 `hidden`
    속성으로만 숨김, `section:hide`/`section:show`는 `window`
    CustomEvent로 발행 — 리스너는 RT-47이 붙임) 신규. **`TriStateCheckbox`만
    바로 실사용 배선했습니다** — `CommitListPanel.tsx`의 "전체 선택"
    체크박스가 이걸 쓰도록 교체(S5 중복 2곳 중 1곳 해소). 나머지 4개는
    RT-01의 `filePattern.ts`처럼 **아직 어느 화면에도 안 쓰입니다** —
    RT-41~47이 순서대로 실제 화면에 배선합니다(RT-41: FileListColumn
    해체하며 남은 TriStateCheckbox 중복도 해소, RT-44: PreviewSummary가
    PanelState 사용, RT-46: FilterPatternBar가 Chip 사용, RT-47:
    CollapsibleSection을 실제 3곳에 적용 + section:hide/show 리스너).
    RT-41: `FileListColumn`(393줄) 해체. **§5.1이 RT-41/42를 한 절에
    같이 적어둬서 범위가 헷갈리기 쉽습니다** — `IncludedFilesPane`/
    `ExtractTargetsPane`/`DeployFilesWorkspace`(좌우 패널 이름을
    "Extract" 모델로 바꾸는 것)는 RT-42 몫이고, RT-41 자체 체크리스트
    한 줄에는 그 이름이 없어 이번엔 컴포넌트 분리(`FilePane`+`FileList`+
    `FileRow`+`useMeasuredColumnWidth`)와 리사이즈 삭제·`PanelState`
    적용만 했습니다 — 좌/우 패널은 여전히 "포함된 파일"/"누락된 의존성"
    그대로입니다(RT-51 전까지 `deployFiles[].included`의 의미도 그대로).
    새 컴포넌트: `components/FileRow.tsx`(`FileListItem` 타입 소유) ·
    `components/deployFiles/FileList.tsx`(헤더 행은 이제
    `TriStateCheckbox` 하나뿐, 툴팁 "화면에 보이는 변경 파일을 모두
    Extract 대상으로 이동") · `components/FilePane.tsx`(RT-40의
    `Panel`/`PanelHeader`/`PanelBody`로 지음 — **RT-40에서 안 쓰이던
    4개 중 첫 배선**) · `lib/useMeasuredColumnWidth.ts`(헤더 라벨이
    없어져 아이템 텍스트만 측정). **toolbar 조립(검색·제외 패턴·+파일
    추가)은 지금 DeployFilesPanel.tsx가 직접 맡습니다** — `FilePane`은
    "좌측 전용 prop 없음"이라 그 로직을 모르고, RT-42가 `IncludedFilesPane`
    으로 옮길 예정입니다. **시각적 변화(임시)**: "+ 파일 추가" 버튼·
    Filter 드롭다운이 title 줄이 아니라 toolbar 줄로 내려갔습니다
    (RT-45가 title 줄 우측 배치를 확정할 예정 — 그 전까지 과도기
    배치이니 "제자리가 아니다"라고 되돌리지 마세요). Playwright로 실제
    렌더링을 스크린샷 확인(레이아웃 안 깨짐, `PanelState kind="na"`
    문구 정확) — 커밋 대상 아닌 임시 파일이라 삭제했습니다.
    RT-42: **착수 전 사용자에게 범위부터 확인했습니다** — §5.1은
    RT-42가 우측을 `ExtractTargetsPane`으로 바꾸고 "누락된 의존성"을
    RT-52의 `AddFilesPopup`으로 옮기라고 하지만, RT-51(Extract 상태
    모델)·RT-52(그 팝업) 둘 다 아직 없어서 그대로 하면 대체 기능
    없이 회귀가 됩니다 — "구조 정리만(우측은 지금 이름·내용 그대로)"
    vs "RT-51/52까지 앞당겨서 같이" vs "RT-51 먼저" 중 **"구조
    정리만"으로 확정**돼 그렇게 진행했습니다. `deployFiles/
    IncludedFilesPane.tsx`(좌측 조립을 그대로 옮김, CommitListPanel
    등과 같은 방식으로 스토어를 직접 구독) · `deployFiles/
    MissingDependenciesPane.tsx`(우측, **이름·동작 전부 그대로** —
    RT-52 전까지 존치) · `deployFiles/DeployFilesWorkspace.tsx`(조립만
    담당, 제목 없음) · `deployFiles/FilePaneCountTitle.tsx`(제목 문구
    공유) · `lib/includedPathsSet.ts`(`includedSet`을 `useIncludedFilesView`
    전체 없이 저렴하게 구함 — 이제 세 곳이 필요로 함). `DeployFilesPanel.tsx`는
    제목·경고 배너·`ManualAddPopup` 배치만 남은 얇은 껍데기(RT-44가
    마저 정리). **`+ 파일 추가` 트리거가 `IncludedFilesPane`(좌측 셀)
    안으로 들어갔는데도 팝업은 여전히 `DeployFilesPanel`이 부모
    레벨에서 렌더링해 좌우 두 Pane 전체 중앙에 뜹니다** — `Panel`/
    `FilePane`/`SplitPane` 전부 `position` 속성이 없어서 CSS
    `position:absolute`가 DOM 중첩 깊이와 무관하게 `.deploy-files-panel`
    (가장 가까운 `position:relative` 조상)을 그대로 기준으로 삼기
    때문입니다(Playwright 스크린샷으로 실제 확인). 앞으로 이 영역에
    컴포넌트를 더 쪼갤 때도 새 레이어에 `position:relative`를 실수로
    추가하면 팝업 앵커가 깨지니 주의하세요.
    **P4부터는 P2/P3와 원칙이 다릅니다** — 실제 UI 변경 단계라 "동작
    불변" 검증(테스트 그린만으로 충분)이 더 이상 적용되지 않고, §3
    확정 UI 변경(U-1~U-22)·목업(`component-playground.html`)·§5.1 각
    RT 상세 명세를 따라야 합니다. **각 RT 착수 전에 그 §5.1 명세가
    아직 존재하지 않는 다른 RT(번호가 더 큰 것 포함)를 전제하고
    있는지부터 확인하세요** — RT-41/42에서 실제로 이런 순서 문제가
    있었습니다. 관련 §7 미결 사항(M-x)이 미확정이거나 이런 순서
    충돌이 있으면 임의 판단하지 말고 먼저 물어보라는 게 이 리팩토링
    전체의 규칙입니다. RT-60(문서 정식 병합)은 P4까지 다 끝난 뒤
    P5에서 한 번에 처리하는 게 이 계획의 순서라 아직 하지 마세요 —
    지금까지는 `docs/refactoring/REFACTORING_TASKS.md` §6 표에 반영
    대상만 계속 쌓아뒀습니다. RT-40~42 모두 `npm test`(122개)·
    `typecheck`·`lint`·`build`·`test:e2e`(7개) 전부 통과로 검증했지만,
    RT-41부터는 실제 화면이 바뀌므로 이 테스트들이 그린이어도 "동작
    불변"을 의미하지 않습니다 — §5.1 수용 기준과 목업을 기준으로
    판단하세요.
  - RT-01에서 만든 `renderer/src/lib/filePattern.ts`(§3.1 글롭/패키지
    매칭 로직)는 RT-46에서 실제로 배선됐습니다(아래 항목) — 이 문단은
    RT-42 시점 기록이라 남겨둡니다.
  - **RT-43/44/46(2026-09-22, 한 번에 진행)**: 착수 전 RT-43 §5.1 명세를
    보니 `PreviewSummary`(RT-44 몫)·`FilterPatternBar`의 "보기" 버튼(RT-46
    몫)처럼 아직 없는 RT를 전제하고 있어(RT-41/42와 같은 순서 문제),
    AskUserQuestion으로 "RT-44/46을 앞당겨 함께 진행"을 확인받아 셋을
    한 번에 구현했습니다. 그 과정에서 RT-44 자신도 RT-53(TreeList)·
    RT-52(AddFilesPopup)를 전제하고 있는 걸 발견해 또 한 번
    AskUserQuestion: Deleted/경고 팝업 본문은 **평탄한 목록으로 우선
    구현**(RT-53이 TreeList를 만들면 교체), 파싱 실패 배너는 **지금의
    `ManualAddPopup` 상단에 임시로 유지**(RT-52가 `AddFilesPopup`으로
    바뀔 때 함께 이전)로 확정했습니다. `WorkArea.tsx`(신규, `openPopup`
    로컬 상태 소유 + `position:relative` 앵커) + `workAreaPopupContext.ts`
    (신규, React Context — `PreviewSummary`와 `DeployFilesPanel`이
    SplitPane의 서로 다른 셀에 있는 형제라 프롭 스레딩 대신 컨텍스트를
    씀) + `PopupHost.tsx`(신규, openPopup 값에 따라 팝업 하나만 렌더링).
    닫힘 조건(Esc/Preview 재실행/Reload)은 `useEffect` 안 `setState`가
    `react-hooks/set-state-in-effect` 린트에 걸려 React 공식 "렌더 중
    이전 값과 비교" 패턴으로 구현. `PreviewSummary.tsx`(신규, 기존
    `DeploymentPreviewPanel.tsx` 대체) — `Deleted`/`⚠ HEAD에 없음` 버튼
    추가. `DeletedFilesPopup.tsx`/`WarningsPopup.tsx`(신규, 평탄한 목록).
    `filePattern.ts`에 `parsePatternList` 추가(쉼표+줄바꿈 구분),
    `excludePatterns.ts`/`excludePatternMatch.ts` 삭제 →
    `filePatterns.ts`(신규, 저장 키는 유지하되 `mode` 필드 추가 + 기존
    데이터 마이그레이션)로 교체. `deployFilesSlice.ts`의
    `excludePatterns`→`filePatterns`, `addExcludePattern`→
    `addFilePatterns`(쉼표 다중 입력 + 모드, 피드백용 `{added,
    activated}` 반환). `FilterPatternBar.tsx`/`FilterPatternsPopup.tsx`
    (신규) — 모드 선택+다중 입력+해석 오버레이+"활성 K개"+"보기" /
    제외·포함 두 구역 Chip 목록. 검증: `npm test`(137개, 신규 15개 —
    `parsePatternList` 6건 + `deployFilesSlice.patterns.test.ts` 9건)·
    `typecheck`·`lint`·`build`·`test:e2e`(11개, 신규 `work-area-popups.spec.ts`
    4건 — Deleted 팝업, HEAD에 없음 경고, Reload 시 팝업 닫힘, 패턴
    추가→숨김→토글/삭제) 전부 통과. **다음 착수 지점은 RT-45**(U-3·U-5,
    StatusFilter·좌측 검색 삭제·added 녹색·`+ 파일 추가` 제목 줄 우측)
    입니다.

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
