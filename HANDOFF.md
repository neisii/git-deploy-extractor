# 새 세션 구현 지시 프롬프트

> 이 파일은 문서가 아니라, 추가 기능 개발을 맡을 새 세션에게 그대로 붙여넣을 시작 메시지다.

---

```
Git Deploy Extractor에 새 기능을 추가합니다. 이 저장소(neisii/git-deploy-extractor)는
이미 구현 완료 후 v0.6.0으로 릴리스된 상태입니다 — 처음부터 만드는 게 아니라
기존 앱을 확장하는 작업입니다.

**⚠ 리팩토링이 진행 중입니다(2026-09-21 계획 수립, P0~P4 구현 완료 —
2026-09-22/23).** v0.6.0 대비 변경이 커서 계획·명세를 `docs/refactoring/`에
분리해 뒀습니다. **P4(RT-40~50)가 전부 끝났습니다 — 다음 착수 지점은
P5(RT-60 문서 동기화 → RT-61 루트 html 이동 → RT-62 untracked 정리 →
RT-63 릴리스)입니다.** RT-50(S8, `main.css` 컴포넌트별 분할 + `WorkArea`
채움 규칙(`.fill`/`.fill-scroll`) 공용화)은 2026-09-23에 구현 완료됐습니다
— 착수 전 §7 M-38(6)("간격·타이포 토큰화"가 RT-50 범위인지)이 유일한
결정 대기 항목이라 AskUserQuestion으로 확인, "RT-50 스펙 그대로만"으로
확정 후 진행했습니다(상세는 §5 RT-50 항목).
RT-43(PopupHost)·RT-44(PreviewSummary/Deleted·경고 팝업)·RT-46
(FilterPatternBar/패턴 팝업)은 2026-09-22에 한 번에(RT-43 명세가 RT-44/46을
전제해 AskUserQuestion으로 범위를 확인한 뒤), RT-45(StatusFilter·좌측 검색
삭제·added 녹색·`+ 파일 추가` 제목 줄 우측)는 그 직후 같은 날, RT-47
(`CollapsibleSection` 3곳·`section:hide/show`·`WorkArea` grid 재분배)은
2026-09-23에 구현 완료됐습니다. RT-48(U-8, 키워드 검색 통합)·RT-49(U-9·U-10,
CommitQueryBar 레이아웃)도 2026-09-23에 함께 구현 완료됐습니다 — 착수 전
§5.1 RT-48이 RT-49의 산출물(필터 그룹의 "키워드" 필드)을 전제하는 순서
충돌을 먼저 확인(RT-41/42/43/47과 같은 유형), AskUserQuestion으로 "RT-48을
앞당겨 함께 진행"을 확인받아 한 세션에서 처리했습니다. 이 과정에서 M-4의
원래 가정(`-P` PCRE 패턴 하나에 `\Q…\E`로 포함·제외를 전부 결합)이 실제
git(2.53)에서는 깨진다는 것을 재현으로 발견해(negative lookahead가
들어간 `-P --grep` 패턴은 실제로 불일치하는 커밋도 포함시키는 git 자체
버그) 포함/제외를 서로 다른 메커니즘(포함은 `-F`+반복 `--grep`, 제외는
클라이언트 필터+페이지네이션 재설계)으로 재설계했습니다 — §5 RT-48
항목의 "M-4 재검증" 문단 참고, 이 리팩토링에서 §0.1(재현 검증 원칙)이
실제로 원래 계획 문서의 가정을 뒤집은 사례입니다. **RT-51(U-11, Extract
대상 목록 상태 모델)·RT-52(U-12·U-19·U-20, `AddFilesPopup`)도 2026-09-23에
함께 구현 완료됐습니다** — RT-51이 요구하는 "누락된 의존성 복귀 위치 =
AddFilesPopup의 HEAD 트리"·"SplitPane 2분할"이 그때까지 존재하던
`MissingDependenciesPane`과 충돌하는 걸(RT-47이 이미 한 번 겪고 RT-51 선도를
보류했던 것과 동일 유형) 확인해 AskUserQuestion → "RT-51+RT-52를 평탄한
목록으로 함께"(RT-44의 "평탄한 목록 우선 구현 → RT-53이 교체" 패턴 재사용)
확정 후 처리했습니다 — §5 RT-51 항목 참고. **RT-53(U-13, `TreeList`
primitive)·RT-54(U-14, `Popup` 720×480)도 2026-09-23에 함께 구현
완료됐습니다** — 착수 전 AddFilesPopup의 HEAD 트리가 기존 480px 고정폭
팝업엔 비좁다는 걸 확인해 AskUserQuestion → "RT-54를 먼저(또는 함께)
처리"를 확인받고, RT-51이 평탄한 목록으로 임시 구현해 둔 6개 목록(왼쪽
포함된 파일·Extract 대상·AddFilesPopup 탐색/결과·삭제됨/경고 팝업)을
전부 진짜 트리로 교체했습니다 — §5 RT-53 항목 참고. **RT-55(U-15, Reload
전체 초기화)도 2026-09-23에 구현 완료됐습니다** — 착수 전 §7 M-22(유지
범위)·M-24(확인 대화상자 여부)가 둘 다 "결정 대기"라 AskUserQuestion으로
확인(M-22는 스펙 본문의 가정 그대로 확정, M-24는 원래 권장이던 "있음"을
뒤집어 "없음"으로 — 코드베이스에 confirm 패턴이 아예 없어 새로 설계하는
비용 대비 Reload는 버튼을 직접 눌러야만 일어나는 명시적 동작이라 불필요로
판단) 후 처리했습니다 — §5 RT-55 항목 참고. **P4부터는 이 순서 문제가
반복적으로 나타나므로(RT-41/42/43/47/48/51/53), 새 RT를 시작하기 전에 그
§5.1 명세가 아직 존재하지 않는 다른 RT를 전제하고 있는지 확인하는 걸 매번
빠뜨리지 마세요** — 지금까지는 전부 AskUserQuestion으로 사용자에게 먼저
확인받고 진행했습니다. §5 RT-43/44/45/46/47/48/49/51/52/53/54/55
각 항목의 구현 요약 참고. P4는 실제
UI 변경 단계라 P0~P3의 "동작 불변" 원칙이 더 이상 적용되지 않습니다 — §3 확정 UI
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
    추가→숨김→토글/삭제) 전부 통과.
  - **RT-45(같은 날 이어서 진행)**: §5.1 RT-45 명세에 인용된 M-1(좌측 검색
    삭제의 위험)·M-2(added 색 구분)·M-11(좁은 폭 줄바꿈)이 전부 이미
    결정돼 있어(§7 표) 추가 확인 없이 바로 구현. `deployFilesFilter`
    (상태 Filter)·`deployFilesSearchTerm`(좌측 파일명 검색, REQ-025)과
    그 액션·타입을 전부 삭제. **M-1 안전장치**: `FilePattern`에
    `screenOnly?: boolean` 추가 — true면 화면 필터링에는 적용되지만
    Export 대상 계산(`exportPlan.buildExportFiles`)에서는 제외한다(두
    호출부가 각자 `filter(p => !p.screenOnly)`로 걸러내고 `hiddenByPatterns`를
    부름 — 그 함수 자체는 screenOnly를 모름). `FilterPatternBar.tsx`에
    "화면만" 체크박스, `FilterPatternsPopup.tsx`의 칩마다 "화면만" 토글
    버튼, 스토어에 `togglePatternScreenOnly` 액션 신설. **M-2**:
    `FileListItem.status`(좌측만 채움), `FileRow.tsx`가 added면 녹색
    (`#67c090`, Chip manual 변형과 동일 색 재사용) + `+` 마커 병행.
    **제목 줄 우측**: `IncludedFilesPane.tsx`의 `title`을
    `FilePaneCountTitle` + `+ 파일 추가` 버튼 flex row로 재구성(버튼
    고정, 카운터 텍스트 쪽이 좁은 폭에서 줄바꿈). REQ-020의 3숫자
    표기는 §5.1 RT-45 프로즈의 "남은 N개/전체 M개"(2숫자)와 다르지만
    수용 기준엔 문구 자체가 없고 REQ-020은 이미 확정된 결정이라 표기는
    바꾸지 않고 버튼 위치만 옮겼다. **e2e 상태 오염을 실제로 겪고
    고침**: 파일 패턴은 저장소 구분 없이 `localStorage`에 전역
    저장되는데, e2e Electron 인스턴스가 테스트 실행 사이에도 같은
    userData를 공유해 한 테스트가 정리 없이 남긴 패턴이 무관한 다른
    spec 파일의 테스트 5개를 한꺼번에 실패시키는 걸 재현했다 — 패턴을
    추가하는 e2e 테스트는 시작·종료 시 항상 정리(`clearAllPatterns`
    같은 헬퍼)하는 게 이 저장소의 필수 관례임을 기록해 둔다. 검증:
    `npm test`(140개)·`typecheck`·`lint`·`build`·`test:e2e`(15개,
    신규 `e2e/included-files-pane.spec.ts` 4건) 전부 통과.
  - **RT-47(같은 날, 2026-09-22)**: 착수 전 §7 M-7(접힘 영속 여부·팝업
    처리)·M-8(접힌 Preview 버튼·경고 개수 노출)·M-13(트랙 최소 높이)이
    "결정 대기"로 남아 있어 AskUserQuestion으로 확정(M-7: 미영속+접을
    때 팝업 닫기, M-8: 접힌 헤더에 Preview 유지·경고는 요약에, M-13:
    목업 값 90px/120px 채택). 진행 중 §5.1 명세 원문의 배포 영역 접힌
    요약 문구("Extract N개 · 미선택 변경 파일 M개")가 아직 없는
    RT-51(Extract 상태 모델)을 전제하는 걸 또 발견(RT-41/42와 같은
    유형) — RT-51을 이 김에 앞당기는 방안도 검토했으나, RT-51 단독
    적용은 "미선택|Extract 2분할" 명세와 RT-52 전까지 존치하기로 한
    `MissingDependenciesPane`이 자리를 잃는 새 충돌을 낳아 보류,
    지금 모델 기준 문구("포함된 파일 N개(패턴 제외 K) · 누락된 의존성
    M개")로 임시 작성했다. `CollapsibleSection`에 `sectionKey`/`owner`/
    `headerActions`/`fill` prop 추가, `SplitPane`에 `startCollapsed`/
    `endCollapsed`(접힌 쪽 auto·펼친 쪽 1fr·핸들 0px, 둘 다 접히면
    `align-content:start`로 위에 붙음) 추가. `WorkArea`가 `children`
    대신 `commitWorkspace`/`deployFilesWorkspace` 두 슬롯을 받아 세로
    SplitPane과 커밋/배포 두 `CollapsibleSection`을 직접 조립(상태는
    WorkArea 소유, §5.1). `BranchSearchBar`는 자기 로컬 collapsed state로
    감쌌다(owner: `'local'`). **Playwright 스크린샷으로 실제 화면을
    확인하다가 자동 테스트(vitest/typecheck/lint/build/기존 e2e)로는
    전혀 안 잡히는 CSS 버그 두 개를 발견·수정**: ①
    `.collapsible-section{height:100%}`를 세 사용처 모두에 무조건
    걸었더니 app-shell의 평범한 flex 자식인 CommitQueryBar 인스턴스가
    그 퍼센트를 100vh로 해석해 레이아웃이 깨짐(체크박스 클릭이
    `.app-shell`에 가로채임) — `fill` prop(모디파이어 클래스)으로
    WorkArea 소유 두 섹션에만 걸도록 분리. ② `.collapsible-section__body
    {display:flex}`를 무조건 걸었더니 author 규칙이 UA 스타일시트의
    `[hidden]{display:none}`보다 우선해(특정도가 같아도 author가 이김)
    접힌 섹션의 본문이 계속 보이는 버그 — `:not([hidden])`로 펼친
    상태에만 걸어 해결. 검증: `npm test`(140개)·`typecheck`·`lint`·
    `build`·`test:e2e`(15개, 기존 스펙 그대로 — 새 e2e는 추가하지
    않았다, `useMemo`/DOM 기반이라 RT-01/34 방침대로 vitest 대상이
    아니라서 임시 Playwright 스크린샷 6장으로 육안 확인만 하고 삭제).
    상세는 `docs/refactoring/REFACTORING_TASKS.md` §5.1 RT-47 항목.
  - **RT-48(U-8, 키워드 통합)·RT-49(U-9·U-10, CommitQueryBar 레이아웃)를
    함께 구현(2026-09-23)** — 착수 전 §5.1 RT-48이 RT-49의 산출물(필터
    그룹 "키워드" 필드)을 전제하는 순서 충돌을 발견(RT-41/42/43/47과
    같은 유형), AskUserQuestion → "RT-48을 앞당겨 함께 진행" 확인 후
    한 세션에서 처리했다. **M-4를 실제 git(2.53)으로 재검증하다가
    원래 가정이 깨지는 걸 발견했다**: `-P`(PCRE) 자체는 지원되지만,
    그 패턴에 negative lookahead(제외 조건)를 넣으면 실제로는
    불일치하는 커밋도 git이 결과에 포함시키는 버그를 재현했다
    (`\A(?!fix)`처럼 최소화한 패턴으로도 재현 — 같은 저장소에서
    `--invert-grep`은 정상 동작하지만 포함 조건과 AND로 결합할 방법이
    없다). 그래서 **포함은 `-F`(고정 문자열)+반복 `--grep`(OR,
    `authors`와 동일 관례 — `[skip ci]`가 BRE 문자 클래스로 오인되던
    기존 결함도 함께 해소), 제외는 클라이언트(Node.js) 필터**로
    최종 구현했다. 제외를 클라이언트로 옮기면서 페이지네이션도 다시
    설계해야 했다 — git의 `--skip`을 그대로 쓰면 클라이언트 필터로
    걸러진 "이후" 개수가 실제 git 쪽 skip과 어긋나 이미 보여준
    커밋이 다음 페이지에 재등장하는 버그를 재현했고, `maxCount`
    전체를 한 번에 가져와 걸러낸 뒤 `[skip, skip+limit)`을 직접
    슬라이스하는 방식으로 막았다(회귀 테스트로 증명). `CommitQueryBar`는
    `SplitPane`(가로, 최소 폭 320/330px)으로 검색 조건 그룹·필터
    그룹(`QueryFilterGroup`, 키워드·작성자·해시 세 텍스트 영역)으로
    나눴고, 입력 시작 시 필드 아래 겹쳐 뜨는 힌트 툴팁(`FieldHint.tsx`)은
    가로 SplitPane의 `overflow-x:auto`가 CSS 스펙상 `overflow-y`도
    `auto`로 강제 승격시켜 `position:absolute`로는 잘리는 걸 확인해
    `position:fixed` + `getBoundingClientRect()`로 우회했다. 기본 창
    폭도 900→1100px로 키웠다(M-13 잔여분). 상세는
    `docs/refactoring/REFACTORING_TASKS.md` §5.1 RT-48·RT-49 항목,
    M-4·M-42·M-13(§7) 참고.
  - **RT-51(U-11, Extract 대상 목록)·RT-52(U-12·U-19·U-20, `AddFilesPopup`)를
    함께 구현(2026-09-23)** — 착수 전 §5.1 RT-51이 요구하는 "누락된 의존성
    복귀 위치 = AddFilesPopup의 HEAD 트리"·"SplitPane 2분할 그대로"가 그때
    까지 별도 존재하던 `MissingDependenciesPane`과 충돌하는 순서 문제를
    발견(RT-47이 이미 겪고 RT-51 선도를 보류했던 것과 동일 유형),
    AskUserQuestion → "RT-51+RT-52를 평탄한 목록으로 함께"(RT-44가
    Deleted/경고 팝업에 쓴 "평탄한 목록 우선 구현 → RT-53이 TreeList로
    교체" 패턴 재사용) 확정 후 한 세션에서 처리했다.
    **상태 모델**: `DeployFileEntry`에 `source: 'changed'|'dependency'|'manual'`
    (+`dependency`에만 `kind`) 추가. `included`는 명세대로 "소속 목록"
    의미로 재정의됐지만 필드 이름·타입은 안 바꿨다 — RT-33이 미리 설계해
    둔 `exportPlan.buildExportFiles`("included=true 중 패턴 미매치만
    Export")가 "Extract 목록 − 활성 패턴 해당 항목"과 정확히 같은 판정이라
    그 함수는 실제로 한 글자도 안 바꿨다. `source==='changed'`만
    `included:false`로 배열에 남고(왼쪽 "포함된 파일" 목록), dependency/
    manual은 항상 `included:true`이며 "되돌리기"는 배열에서 완전히
    제거하는 것으로 표현한다. 왼쪽 목록은 `source==='changed' && !included`
    로 필터링하도록만 바꿨더니 체크박스·전체선택 로직은 그대로 재사용한
    채(코드 변경 없이) "체크=Extract로 이동"이 자연히 단방향으로
    동작하게 됐다(화면에 늘 `!included`만 보이므로). "선택 N개"(REQ-020)는
    이제 "이미 Extract로 이동한 변경 파일 개수"(필터와 무관한 절대값,
    원래 원칙 그대로).
    **오른쪽 `ExtractTargetsPane.tsx`(신규, `MissingDependenciesPane.tsx`
    대체)**: `useExtractTargetsView.ts` 신규 — `included===true` 전부
    (출처 무관)를 모아 활성(비 screenOnly) 패턴 매치 여부를 같이 계산.
    `ExtractRow.tsx`/`ExtractList.tsx` 신규 — 체크박스 대신 `×` 버튼
    (출처별 복귀 위치가 다름), 종류 배지(Impl/I, 의존성 출처만·중립
    회색), 출처 배지(변경/수동 — 의존성은 표시 안 함, 사용자 결정),
    패턴 제외 시 흐림+취소선+"패턴 제외" 태그(숨기지 않음). "모두
    되돌리기" 버튼. 경로 복사 버튼(RT-53)은 범위 밖.
    **`AddFilesPopup.tsx`(신규, `ManualAddPopup.tsx` 대체, 팝업 키도
    `'manual'`→`'addFiles'`로 개명, M-18)**: 검색어가 없으면 발견성
    보존을 위해 누락된 의존성만 보여주고(HEAD 트리 전체를 평탄하게 다
    나열하면 수천~수만 개라 못 씀 — RT-53이 트리로 바뀌면 전체 탐색
    가능), 검색어가 있으면 매칭되는 HEAD 트리 후보 전체를 보여주며 그중
    누락된 의존성은 계속 붉은 글자(`status-text--error`와 같은 색
    재사용)+배지로 구분한다 — `lib/addFilesCandidates.ts` 신규(순수
    함수, vitest 6케이스). 검색은 `lib/matchesFileName.ts`(`*` 와일드카드
    포함) 재사용. "보이는 항목 모두 추가 (N)"은 누락된 의존성만 add-only로
    추가. `+ 파일 추가` 버튼에 `누락 N` 배지(50 초과 시 붉은색, REQ-020
    이월) — 팝업이 닫혀 있어도 `IncludedFilesPane`이 항상 계산해 보여준다.
    **실측 CSS 버그**: `ExtractRow`가 처음엔 `FileRow`의
    `width:max-content`(긴 경로를 가로 스크롤로 다 보여주는 방식)를 그대로
    재사용했는데, Extract 행 오른쪽의 ×·배지가 화면 밖으로 밀려나 안
    보이는 걸 Playwright 요소 스크린샷으로 발견 — `width:100%` + 파일명
    `text-overflow:ellipsis`(전체 경로는 title 툴팁)로 바꿔 해결했다.
    **e2e 대량 수정**: 예전엔 Preview 직후 변경 파일이 왼쪽 "포함된
    파일"에 체크된 채로 나타난다고 가정한 테스트가 5개 스펙에 걸쳐
    있었는데(RT-51 기본값 "전체 Extract 이동"으로는 그 가정이 전부
    깨짐), `preview-export`·`export-feedback`·`work-area-popups`·
    `included-files-pane`·`popup-behavior` 전부 Extract 모델 기준으로
    다시 썼다(예: U8 키보드 토글 테스트는 ×로 왼쪽에 되돌린 뒤 그
    체크박스를 Space로 토글하는 흐름으로 재구성). `manual-add.spec.ts`→
    `add-files-popup.spec.ts`로 개명하며 발견성 시나리오 1건을 추가했다.
    검증: `npm test`(169개, 신규 `addFilesCandidates.test.ts` 6개 +
    `deployFilesSlice.extract.test.ts` 8개)·`typecheck`·`lint`·`build`·
    `test:e2e`(20개) 전부 통과. Playwright 임시 스크린샷(Spring Boot
    모양 fixture로 실제 누락된 의존성 2건 재현 — 인터페이스 1·구현체 1)
    으로 빨간 글자·배지·Extract 행·모두 되돌리기까지 육안 확인 후 삭제.
    상세는 `docs/refactoring/REFACTORING_TASKS.md` §5.1 RT-51·RT-52 항목,
    M-14·M-18(§7) 참고.
  - **RT-53(U-13, `TreeList` primitive)·RT-54(U-14, `Popup` 720×480)를
    함께 구현(2026-09-23)** — 착수 전 AddFilesPopup의 HEAD 트리(들여쓰기+
    파일명+종류 배지+경로 복사+추가 버튼)가 기존 480px 고정폭 `Popup`엔
    비좁다는 걸 확인, RT-15가 "전체 표준 크기(720×480)는 RT-54 몫"이라고
    이미 미뤄둔 걸 발견해 AskUserQuestion으로 "RT-54를 먼저(또는 함께)
    처리"를 확인받아 함께 진행했다. 착수 전 M-20도 확정(AskUserQuestion,
    2026-09-23): 펼침 상태는 로컬에만(저장 안 함, 새로고침하면 항상 기본
    전부 펼침) · **300개 초과 기본 접힘은 채택하지 않음**(가상 스크롤이
    이미 렌더링 비용을 해결해 성능상 이유가 없고 "한눈에 구조 파악"
    이점도 이 앱의 목록 크기에선 크지 않다는 게 실제 이유 — 사용자가
    "화면에 안 보이면 스크롤하면 되는데 왜 굳이 접어야 하냐"고 근거를
    요구해 재검토한 뒤 원래 권장안을 뒤집은 항목) · 폴더 체크박스에
    **indeterminate 추가**(일부만 Extract로 이동된 폴더 표시,
    `TriStateCheckbox` 재사용).
    **순수 함수**(`lib/tree.ts` 신규): `buildTree(items, getPath)`·
    `compressChains(node, compactFromDepth)`·`flatten(root, isOpen)` —
    `component-playground.html`의 `buildTree`/`treeHtml` 알고리즘을 그대로
    이식. vitest 12케이스(단일 파일·중첩·같은 이름 다른 폴더·한글 경로·
    체인 병합·병합 중간에 파일 있으면 끊김·`compactFromDepth` 미만 병합
    안 함·폴더 우선 정렬·같은 레벨 이름순·접힌 폴더 flatten 제외·펼침
    상태별·depth 반영).
    **`useTreeExpansion(defaultOpen)`**(`lib/useTreeExpansion.ts` 신규) —
    펼침 상태는 이 훅을 호출한 컴포넌트 로컬에만 있다(M-20). 목록마다(그리고
    AddFilesPopup의 탐색/결과 트리처럼 한 컴포넌트 안에서도) 이 훅을 별도로
    호출해 서로 독립된 펼침 상태를 갖는다.
    **`TreeList.tsx`**(신규) — `renderLeaf`/`renderFolder` 슬롯,
    `expansion` prop(호출부 소유), `compactFromDepth`(기본 1, AddFilesPopup
    탐색 트리만 3). 경로 복사 버튼(U-18, `CopyPathButton.tsx` 신규 +
    `lib/toRepoRelativePath.ts` 신규, `useCopyToClipboard` 재사용)은
    `copyable` prop(기본 true)으로 TreeList가 자동으로 붙이거나, Extract처럼
    `×`와의 16px 간격·순서 규칙이 있는 곳은 꺼서(`copyable={false}`)
    `renderLeaf`/`renderFolder` 안에서 직접 배치한다. `rowClassName` prop
    (선택)은 스타일 목적이 아니라 e2e가 "동시에 떠 있는 여러 TreeList 중
    어느 것"을 구체적으로 짚을 수 있게 하는 훅이다 — `IncludedFilesPane`은
    `included-row`, `ExtractTargetsPane`은 `extract-row`(기존 이름 유지로
    하위 e2e 호환).
    **6개 트리 인스턴스**(§5.1 "5곳"이지만 AddFilesPopup의 탐색/결과가
    펼침 상태 분리된 별도 인스턴스라 실질 6개): `IncludedFilesPane`(왼쪽,
    폴더 체크박스로 하위 변경 파일 이동, indeterminate는 "이 폴더 아래
    원래 변경 파일 개수가 화면에 보이는 fileCount보다 많은지"로 판정) ·
    `ExtractTargetsPane`(오른쪽, 폴더 `×`=신규 `returnFolderFromExtract`
    액션) · `AddFilesPopup` 탐색 트리(`compactFromDepth:3`, 기본 펼침 =
    1단계 ∪ 누락된 의존성 조상 폴더) · 같은 팝업 결과 트리(검색어 있을 때,
    `compactFromDepth:1`, 전부 펼침) · `DeletedFilesPopup`·`WarningsPopup`
    (읽기 전용, `renderFolder` 기본값 그대로).
    **AddFilesPopup 재구성**: `lib/addFilesCandidates.ts`를 RT-52의
    "빈 검색어=누락된 의존성만" 2분기에서 `buildBrowseCandidates`(HEAD
    트리 전체)·`buildSearchCandidates`(매칭 50개 상한 + truncated 플래그)·
    `missingDependencyAncestorPaths`(누락된 의존성 경로의 모든 조상 폴더
    집합 — compact 병합 후 폴더 노드의 `path`가 항상 이 조상 경로 중
    하나와 같다는 걸 이용해, TreeList 내부 트리 구조를 몰라도 기본 펼침
    규칙을 맞출 수 있다) 셋으로 재구성. 이제 진짜 HEAD 트리 탐색이 된다.
    **폴더 인덱터미네이트 계산**: `useIncludedFilesView`가 `changedFiles`
    (패턴·이동 여부 무관, source==='changed' 전체)를 추가로 반환하도록
    확장 — `IncludedFilesPane`의 `renderFolder`가
    `changedFiles.filter(prefix 매치).length > info.fileCount`로 "이 폴더
    중 일부가 이미 Extract로 이동했거나 패턴에 걸려 안 보인다"를 판정한다.
    **실측 CSS 버그**: `ExtractRow`(RT-51)의 `width:max-content` 가로
    스크롤 방식을 그대로 재사용했다가 Playwright 요소 스크린샷으로
    ×/배지가 화면 밖으로 밀려나 안 보이는 걸 재발견 — `TreeList`의 모든
    행에 `width:100%` + 이름 `text-overflow:ellipsis`로 통일했다(전체
    경로는 행 `title` 툴팁). `FileList.tsx`/`FileRow.tsx`/
    `lib/useMeasuredColumnWidth.ts`(가로 스크롤 실측 방식 전체)는 더 이상
    쓰이지 않아 삭제.
    **`.popup` 크기(RT-54)**: `width: 480px` 고정 → `width: min(720px, 94%)`,
    `height: min(480px, calc(100% - 20px))`로 변경. `Popup.tsx` 로직은
    무변경(크기는 전적으로 CSS가 결정) — `AddFilesPopup`·
    `FilterPatternsPopup`·`DeletedFilesPopup`·`WarningsPopup` 전부 이
    표준 크기로 자동 통일됐다.
    검증: `npm test`(190개, 신규 `tree.test.ts` 12개+
    `toRepoRelativePath.test.ts` 4개+`addFilesCandidates.test.ts` 재작성
    10개)·`typecheck`·`lint`·`build`·`test:e2e`(23개 — 기존 스펙들이
    "리프는 전체 경로를 표시"하던 가정이 "파일명만 표시"로 바뀌어
    `hasText` 로케이터를 전부 갱신, 신규 `tree-list.spec.ts` 3건) 전부
    통과. Playwright 임시 스크린샷(Spring Boot 모양 fixture)으로 720px
    폭 팝업·탐색 트리(1~2단계 병합 안 함+누락된 의존성 조상 자동 펼침)·
    결과 트리(전 구간 병합)·Extract 트리 폴더 압축까지 육안 확인 후 삭제.
    상세는 `docs/refactoring/REFACTORING_TASKS.md` §5.1 RT-53·RT-54 항목,
    M-20(§7) 참고.
  - **RT-55(U-15, Reload 전체 초기화)를 구현(2026-09-23)** — 착수 전 §7
    M-22(유지 범위)·M-24(확인 대화상자 여부)가 둘 다 "결정 대기"라
    AskUserQuestion으로 확인했다. M-22는 스펙 본문에 이미 "가정"으로 적힌
    목록(파일 패턴 이력·Export 경로/방식·접힘 상태·분할 비율·트리 펼침
    유지)을 그대로 확정. M-24는 원래 권장이던 "있음"을 뒤집어 **"없음"**
    으로 확정했다 — 이유는 현재 코드베이스에 `confirm` 대화상자 패턴이
    전혀 없어(`grep`으로 확인) 새로 설계해야 하는데, 그 비용 대비 Reload는
    버튼을 직접 눌러야만 발생하는 명시적 동작이라 확인창 없이 바로
    초기화하는 쪽이 낫다고 판단했기 때문이다.
    **새 reset 액션 3개**: `commitQuerySlice.resetQuery()`(조회 조건 전부
    기본값 — 기간은 `getDefaultDateRange()`를 **그 시점에 다시 호출**해
    "오늘" 기준으로 재계산, 모듈 최상단의 `defaultRange`는 앱 시작 시점에
    한 번만 계산돼 재사용할 수 없다는 점이 함정이었다) · `commitsSlice.
    clearSelection()`(`selectedHashes` 비움) · `analysisSlice.
    resetAnalysis()`(요약·변경 파일·Extract·삭제·경고·누락된 의존성·수동
    추가 전부 폐기 — `deployFiles`/`manuallyAddedPaths`/`headTreeFiles`는
    원래 `deployFilesSlice` 소유지만, `runPreview`의 "선택 없음" 분기·
    `commitsSlice`의 기존 인라인 초기화도 이미 슬라이스 경계를 넘어 같은
    필드를 직접 `set()`해 온 이 저장소의 기존 패턴을 그대로 따랐다).
    **`reloadRepository` 수정**: 검증 성공 후 `selectedBranch`를 (기존
    "현재 Branch가 여전히 존재하면 유지"에서) **항상 `pickDefaultBranch
    (branches)`**로 바꿨다 — Reload가 이제 부분 재조회가 아니라 전체
    초기화이므로. 위 세 reset을 호출한 뒤 `loadCommitsFirstPage(true)` →
    **`loadCommitsFirstPage(false)`**로 바꿔 선택을 더 이상 유지하지
    않는다(스펙이 지시한 "`keepSelection` 파라미터 경로 정리"). **열려
    있는 팝업을 닫는 로직은 새로 만들 필요가 없었다** — `WorkArea.tsx`가
    이미 `repository.status==='validating'` 전환을 감지해 팝업을 닫고
    있었고(RT-43), `reloadRepository`가 검증을 시작하는 시점에 제일 먼저
    이 상태가 되기 때문이다. 검증 실패 경로는 그대로 조기 `return`이라
    reset 호출부에 아예 도달하지 않는다 — "검증 실패 시 초기화하지 않고
    오류만 표시"가 코드 구조상 자연히 성립한다.
    **검증**: `npm test`(194개, 신규 `repositorySlice.reload.test.ts` 4개 —
    초기화 필드 전부·기간 재계산·M-22 유지 필드(`exportParentDir`) 불변·
    검증 실패 시 무변화)·`typecheck`·`lint`·`build`·`test:e2e`(24개, 신규
    `reload-reset.spec.ts` 1개 — 키워드로 목록을 거른 뒤 커밋 선택→Preview
    →Reload하면 키워드가 풀려 전체 커밋이 다시 보이고 체크박스가 전부
    해제되고 Extract 결과가 사라지는지 확인) 전부 통과. 상세는
    `docs/refactoring/REFACTORING_TASKS.md` §5.1 RT-55 항목, M-22·M-24(§7)
    참고.
  - **RT-56(U-16, `ExportModeSelect` + 추출 위치 방식/저장소 겹침 검증)을
    구현(2026-09-23)** — 착수 전 §7 M-25(`direct` 빈 폴더 전용 a안)·
    M-27(모드 영속)·M-33(저장소 경로 검증 범위)이 RT-55의 M-22/M-24와
    달리 스펙 본문·표 둘 다에 이미 "결정 대기" 표시 없이 권장값까지
    확정돼 있어(이 RT만의 특징) AskUserQuestion 없이 그대로 구현했다.
    **겹침 판정**: `classifyExportTarget(repoPath, deployDir)`(순수 함수,
    `src/main/package/classifyExportTarget.ts`)가 `path.relative`만으로
    INSIDE_REPO(F가 R과 같거나 하위)/CONTAINS_REPO(R이 F의 하위 — `sub`의
    `fs.rm(recursive)`가 저장소를 지울 수 있는 경우)/OK를 판정하고,
    `startsWith` 접두사 비교를 쓰지 않아 `<저장소>-old` 같은 형제를
    오판하지 않는다. `validateExportTarget()`(`src/main/package/
    validateExportTarget.ts`)이 `fs.realpath`(경로가 없으면 존재하는
    가장 가까운 상위까지만 resolve)로 심볼릭 링크·`.`/`..`·끝 구분자를
    해소하고, `process.platform` 기준으로 Windows/macOS는 소문자로 접고
    Linux는 그대로 두는 대소문자 정책을 적용한 뒤 이 함수를 부른다.
    우선순위는 ①경로 미선택(NO_PATH, IPC 왕복 없이 즉시 판정) ②겹침
    ③(`direct`만) 폴더가 비어 있지 않음(NOT_EMPTY, a안).
    **IPC**: `package:validateExportTarget` 신설 — 경로 선택 직후·저장소
    변경(Browse)/Reload 직후·모드 변경 시 렌더러가 호출한다.
    `package:export`도 실행 직전 같은 함수로 재검증해 실패하면
    `IpcValidationError`로 거부한다(렌더러 상태를 신뢰하지 않는 이
    저장소의 기존 원칙 그대로). `assertValidExportMode`(`validate.ts`,
    RT-12)로 `mode` 문자열이 `'sub'`/`'direct'`인지 화이트리스트 확인.
    **`getDeployDir`**이 3번째 인자로 `mode`를 받도록 바뀌었다(신규 필수
    필드 `BuildPackageParams.mode`) — `'direct'`면 `exportParentDir` 그대로
    최종 산출물 위치, `'sub'`면 기존과 동일하게 `<parent>/
    git-deploy-extracted`. `buildPackage()`는 `mode==='sub'`일 때만
    `fs.rm(recursive)` 후 재생성하고, `'direct'`는 **절대 `fs.rm`을
    호출하지 않는다**(비어 있음은 이미 Main이 보장) — `fs.mkdir
    (recursive)`만 호출. `package:export` 핸들러의 "이미 내용이 있으면
    덮어쓰기 확인창"은 `sub`일 때만 실행(`direct`는 애초에 빈 폴더만
    허용되므로 불필요).
    **렌더러**: `exportSlice.ts`에 `exportMode`(localStorage
    `gde:exportMode`, 기본 `sub`, `exportParentDir`과 같은 전역 저장
    패턴)·`exportTargetValidation`·`setExportMode`·`revalidateExportTarget`
    (오래된 응답이 최신 상태를 덮어쓰지 않도록 기존 `requestGuard.ts`
    재사용) 추가. `repositorySlice.ts`의 `browseRepository`/
    `reloadRepository` 끝에서 `revalidateExportTarget()`을 호출해 검증
    시점 ②(저장소 변경/Reload 직후)를 만족시킨다. `FooterActionBar.tsx`
    (ExportBar)에 신규 `ExportModeSelect.tsx`를 `Export` 버튼 왼쪽에
    배치하고, 상태 메시지 우선순위(경로 검증 실패 > RT-17 분석 중 >
    `isStale`)를 반영했다. **REQ-012 정정**: 경로 미선택 시 저장소
    루트로 대체하던 기존 기본값을 완전히 폐지 — 이제 "추출할 폴더를
    선택하세요"가 뜨고 Export가 막힌다.
    **검증**: `npm test`(220개, 신규 26개 — `classifyExportTarget.test.ts`
    7개·`validateExportTarget.test.ts`(임시 폴더 통합 테스트, 동일/끝
    구분자/`.`·`..`/심볼릭 링크/깊은 하위 폴더 전부 INSIDE_REPO, F가
    저장소를 포함하면 CONTAINS_REPO, 형제·접두사만 같은 형제 통과,
    `direct`의 빈 폴더/비어 있지 않음/아직 없는 경로, `sub`는 비어
    있어도 NOT_EMPTY를 반환하지 않음, `normalizeForCasePolicy`는
    `process.platform`을 강제로 바꿔가며 세 플랫폼 모두 결정적으로
    확인)·`buildPackage.test.ts`에 `direct` 모드 케이스(무관한 기존
    파일이 `fs.rm` 없이 보존됨) 추가)·`typecheck`·`lint`·`build`·
    `test:e2e`(24개) 전부 통과. **e2e**: `package:browseExportDir`도
    `repository:browse`(`GDE_E2E_REPO_PATH`)와 같은 이유로
    `GDE_E2E_EXPORT_DIR` 우회를 추가했다(REQ-012 정정으로 Playwright도
    경로를 반드시 "골라야" 하므로) — `launchApp.ts`(`exportDir` 2번째
    인자)·`fixtureRepo.ts`(`createExportDirFixture`). 저장소 루트 기본값에
    의존하던 `preview-export.spec.ts`·`export-feedback.spec.ts`를 "변경"
    클릭 + 별도 빈 폴더로 교체(기존처럼 저장소 루트에 Export하면 이제
    `INSIDE_REPO`로 막힌다). 상세는 `docs/refactoring/REFACTORING_TASKS.md`
    §5.1 RT-56 항목, M-25·M-27·M-33(§7) 참고.
  - **RT-57(U-17, Export 산출물을 `extract-list.txt` 하나로 통합)을
    구현(2026-09-23)** — 착수 전 §7 M-30(트리 체인 병합·서버 경로 기준)·
    M-31(인코딩 BOM 여부)·M-32(머리말 커밋 목록 형식)가 명세 원문에 직접
    "결정 대기"로 표시돼 있어 AskUserQuestion으로 확정(M-30: 화면
    TreeList와 동일하게 체인 병합 + 서버 경로만, M-31: BOM 없는 UTF-8,
    M-32: 가정대로 — 해시7자리+날짜+작성자+제목, 10줄 상한+"… 외 K개").
    `src/main/package/extractListText.ts`(신규) — `treeText(paths)`·
    `buildExtractListText({ branch, generatedAt, commits, files, deleted })`
    순수 함수, `docs/refactoring/component-playground.html`의
    `buildTree`/`treeText` 프로토타입을 그대로 이식(폴더 먼저·이름순·
    `├──`/`└──`/`│   ` 커넥터·단일 자식 폴더 체인 병합). `buildPackage.ts`가
    `deploy-files.txt`·`delete-list.txt`·`deploy-summary.json` 3종 대신
    `extract-list.txt` 하나만 씀. **`shared/types.ts` 정리**:
    `DeploySummary` 타입 삭제, `BuildPackageParams`에서 `mappingProfileName`·
    `warnings`(요약 전용으로만 쓰이던 필드, M-29 "매핑 프로필·경고는 머리말에
    안 남김"과 일치) 제거, `BuildPackageResult`는 `{ deployDir }`만 남김 —
    `exportSlice.ts`의 `runExport` 호출부도 맞춰 정리(`selectedProfile`/
    `warnings` destructure 제거). `verify-phase3.ts`는 P0에서 이미 삭제된
    파일이라 갱신 대상이 없었다(확인만 하고 스킵). README.md(3·8번 항목의
    `delete-list.txt`/`deploy-files.txt` 언급)·ARCHITECTURE.md(§4.4 Package
    Builder 단계 설명, 파이프라인 다이어그램)를 `extract-list.txt` 기준으로
    갱신. REQUIREDMENT.md/UI_UX_SPEC.md/DETAILED_DESIGN.md/PRD.md는 RT-60
    문서 정식 병합 때 함께 처리하는 게 이 계획의 순서라 이번엔 손대지
    않았다(§6 문서 동기화 표 참고). 검증: `npm test`(238개, 신규
    `extractListText.test.ts` 20개 — 빈 목록·루트 파일·체인 병합·체인
    중간에 파일 있으면 끊김·정렬(폴더 먼저)·한글 경로·머리말 형식(시각
    주입 결정적 테스트)·커밋 행 형식/정렬·10줄 경계(0·1·10·11·25개)·
    배포/삭제 개수 제목 일치)·`typecheck`·`lint`·`build`·`test:e2e`
    (24개, 기존 스펙 전부 그대로 통과 — extract-list.txt 내용을 직접
    검증하는 e2e는 없었고 이번에도 추가하지 않음, vitest로 충분히
    커버됨) 전부 통과.
    **RT-59(U-21, `RepositoryBar`의 `Browse...`·`Reload`·버전 배지를
    저장소 바 오른쪽 끝으로 모으는 배치 변경)도 2026-09-23에 구현
    완료됐습니다** — 착수 전 §7 M-39(그룹 내부 순서)는 이미 결정돼
    있었지만, 명세·목업 어디에도 없던 새 질문을 하나 더 발견했습니다:
    현재 앱엔 `RepoLabel`과 우측 버튼 그룹 사이에 저장소 **전체 경로
    텍스트**(`.repository-panel__path`, 결정 이력 #38에서 추가된
    ellipsis+툴팁)가 있는데, RT-59 목업의 `RepoLabel`엔 이게 없어서
    삭제/이동/유지 중 뭘 해야 할지가 명세에 안 적혀 있었습니다.
    AskUserQuestion으로 ASCII 목업 3안(그대로 유지/라벨 아래 둘째 줄/
    삭제)을 비교해 확인받아 **"그대로 유지"**로 확정(M-44 신규,
    §7 표 참고) — 목업(`component-playground.html`)에도 `RepoPath`
    요소로 먼저 반영한 뒤 구현했습니다. `RepositoryPanel.tsx`에
    `.repository-panel__right`(신규 래퍼, `margin-left:auto`)를 추가해
    Browse.../Reload + 버전 배지를 한 그룹으로 묶었고, 경로 텍스트는
    그 밖에서 기존 위치·스타일 그대로 유지했습니다. `npm test`(238개)·
    `typecheck`·`lint`·`build`·`test:e2e`(24개) 전부 통과, Playwright
    스크린샷(넓은/좁은 폭)으로 오른쪽 정렬 유지까지 육안 확인 — 상세는
    §5.1 RT-59 항목 참고.
    **RT-50(S8, `main.css` 컴포넌트별 분할 + `WorkArea` 채움 규칙 공용화)도
    2026-09-23에 구현 완료됐습니다 — 이걸로 P4(RT-40~50)가 전부
    끝났습니다.** 착수 전 §7 M-38(6)("간격·타이포 토큰화"가 RT-50
    범위인지)이 유일한 결정 대기 항목이라 AskUserQuestion으로 확인 —
    **"RT-50 스펙 그대로만"**(CSS 분할 + `.fill`/`.fill-scroll`, 토큰화는
    제외)로 확정 후 진행했습니다(M-38 나머지 (1)~(5)와 함께 후속으로
    남음, §7 표 참고). `assets/main.css`(1265줄)를 `assets/components/`
    아래 17개 파일(공용 유틸 `fill.css` + 컴포넌트/컴포넌트-묶음별
    16개 — repositoryPanel·footerActionBar·commitQueryBar·
    commitListPanel·previewSummary·workArea·splitPane·deployFilesPanel·
    filePane·filterPattern·popup·addFilesPopup·panel·chip·
    collapsibleSection·treeList, 전역 primitive는 `shell.css`)로
    분할했고, `main.css`는 `@import`만 남았습니다 — `fill.css`를 가장
    먼저 import해서, 컴포넌트별 규칙이 같은 속성을 재정의할 때
    (`.commit-query-bar__groups{height:auto}` 등) 커스케이드 순서상
    뒤에 오는 쪽이 이기게 했습니다. `.fill{height:100%;min-height:0}`·
    `.fill-scroll{flex:1;min-height:0}`을 신설해, 그동안 컴포넌트마다
    따로 적던 동일 패턴(`.work-area`·`.vertical-main-split`·
    `.split-pane`·`.commit-list-panel`+`__body`·`.deployment-preview-panel`·
    `.deploy-files-panel`+`__split`·`.file-pane`·`.file-list__scroll`+
    `__body`·`.panel-frame__body`·`.collapsible-section--fill`·
    `.add-files-popup__tree`)를 유틸리티 클래스로 교체했습니다 —
    `SplitPane.tsx`는 모든 인스턴스에 `fill`을 기본으로 얹고,
    `Panel.tsx`의 `PanelBody`는 `fill-scroll`을 기본으로 얹어 `FilePane`
    등 모든 소비자에 자동 전파됩니다(계산되는 최종 스타일은 교체 전과
    동일 — 같은 속성·같은 값을 다른 selector로 옮겼을 뿐). 부수적으로
    더 이상 어느 컴포넌트도 참조하지 않던 죽은 규칙
    (`.file-list-column__search`, RT-41 이후 leftover)도 삭제했습니다.
    검증: `npm test`(238개)·`typecheck`·`lint`·`build`(vite가 `@import`
    체인을 문제없이 단일 CSS로 번들)·`test:e2e`(24개, 기존 스펙 전부
    그대로 통과) 전부 통과. RT-50 자체 수용 기준(작업 영역 높이를
    줄여도 자식이 밀려나지 않고 목록 내부에서만 스크롤)은 임시
    Playwright 스크립트로 창을 900×420까지 줄여 헤더 4곳(저장소 바·조회
    조건·커밋 목록 헤더·footer)이 전부 보이고 `.commit-list-panel__body`가
    `.commit-list-panel` 경계를 넘지 않는 것을 스크린샷+bounding box로
    확인 후 삭제(RT-41 이후 관례 — 커밋 대상 아님). 상세는 §5.1 RT-50
    항목 참고.
    **RT-50 직후, 계획에 없던 후속 요청 2건(M-45, 2026-09-23, 사용자가
    화면을 직접 보고 요청)도 처리했습니다** — CommitQueryBar(§5.1 RT-49
    산출물) 실사용 중 발견된 시각적 버그 둘입니다. (1) 키워드/작성자/
    해시 필터 세 필드 사이 간격이 달라 보임 — 원인은 작성자/해시가
    `<label>`이라 전역 `label{align-items:center}`(shell.css)가 새서
    그 둘만 내용이 중앙 정렬·축소된 것(`gap`은 처음부터 12px로 동일했다)
    — `.query-filter-group__field{align-items:stretch}` 명시로 해결.
    (2) 조회 조건 왼쪽(검색 조건)·오른쪽(필터) 패널 높이가 다름 —
    `input[type=date]` 브라우저 기본 폭(~158px)×2 때문에 "조회 기간" 행이
    줄바꿈된 게 원인. **"SplitPane 비율만 옮기기"(78px 부족)→"오른쪽
    텍스트영역만 줄이기"(45px 부족)를 차례로 실측해 불가능함을 확인한
    뒤에야 "날짜 입력창도 같이 줄이기"로 확정**했습니다(AskUserQuestion
    3회, 매 시도마다 실측 수치를 먼저 보여주고 다음 방향을 물었다) —
    날짜 입력창 158→140px(122px 이하에서는 일자 숫자가 잘리는 걸
    스크린샷으로 직접 확인), 오른쪽 필터 필드 110→68px(키워드는 라디오
    버튼 때문에 150px 유지), `.query-filter-group__fields` gap 12→8px,
    SplitPane `defaultRatio` 0.5→0.67 — 기본 창(1100px)에서 양쪽 다
    줄바꿈 없이 77px vs 79px(2.2px 차이, 줄바꿈이 없는 넓은 창에서도 나는
    반올림 오차와 동일)로 수렴했습니다. **M-42(a)의 "기본 비율 50:50"
    결정을 대체합니다** — §7 M-45, §5.1 RT-49 항목(정정 표시)도 갱신해
    뒀습니다. 검증은 RT-50과 동일하게 `npm test`(238개)·`typecheck`·
    `lint`·`build`·`test:e2e`(24개) 전부 통과 + 임시 Playwright
    스크린샷(날짜 값 잘림 여부·좌우 높이 비교) 육안 확인 후 삭제.
    RT-50·M-45 전부 커밋 `f46442f`로 완료(2026-09-23).

    **커밋 직후 사용자와 나눈 Q&A(2026-09-23, 코드 변경 없음, §7 M-46에
    기록)** — "화면만"(screenOnly) 체크박스의 의도를 사용자가 이해하기
    어려워해서 여러 차례에 걸쳐 설명했다: 화면 표시(왼쪽 "포함된 파일"
    숨김)와 실제 Export 계산(오른쪽 "Extract 대상"의 "패턴 제외" 흐림
    표시 + Export 시 제외)에 패턴이 각각 어떻게 다르게 작용하는지,
    그리고 이 이중 동작 중 오른쪽(Extract 대상) 효과는 이번 리팩토링의
    새 모델(RT-51)이 만든 것이고 왼쪽(포함된 파일) 효과는 REQ-019
    (v0.4.0)부터 있던 원래 동작인데, 거기에 U-5(검색 삭제)가 "화면
    검색 대체" 역할을 얹으면서 패턴 하나가 두 가지 의미(영구적 배포
    규칙 vs 일시적 화면 필터)를 갖게 된 게 혼란의 근원이라는 것까지
    설명했다. **"화면만" UX를 어떻게 개선할지 3안(A: 라벨 개선+중복
    제거 권장 / B: 검색 기능 부활로 역할 분리 / C: 현행 유지) 제안했지만
    사용자가 아직 고르지 않았다** — 대신 "Extract 대상 = 실제 추출될
    파일만 포함"·"왼쪽 목록도 파일 추가로 넣은 걸 포함할 수 있다"는
    잘못된 전제로 결론을 내리려 해서, 코드 근거(`deployFilesSlice.ts`의
    `addManualFile`/`addDependencyToExtract`가 `included:true`로 곧장
    Extract에 넣어 왼쪽엔 절대 안 나타남, §3.2의 "패턴 제외" dim 표시로
    Extract 대상에도 안 나갈 파일이 섞여 있을 수 있음)로 정정했다.
    그러자 "그럼 요구사항 문서를 정정해야겠다"고 했다가, §0.1 용어
    정의(왼쪽="변경 파일"만, 수동 추가는 명시적으로 "변경 파일 아님")가
    2026-09-21 최초 작성 이후 지금까지 실제로 틀린 적이 없다는 걸
    재확인하고 **문서 정정은 보류**했다. 이어서 "REFACTORING_TASKS.md가
    전체적으로 오래됐나" 물어서 `git blame` 섹션별 집계를 보여줬다 —
    **§0~§4·§8(825줄 중 700줄, 85%)이 2026-09-21 최초 커밋 이후 한 번도
    수정 안 됨**(§5/§5.1/§7처럼 "구현하면서 갱신하는 로그"가 아니라
    "한 번 쓰고 끝"인 스펙 섹션이라 구조상 자연스럽지만, 지난 이틀간
    43개 항목(P0~P4)을 구현하면서 실제 코드와 재대조된 적은 없다 —
    RT-60(문서 동기화)이 원래 이걸 하려던 작업임). 사용자가 "쉬었다가
    다시 얘기하자"며 중단했다가, **같은 날(2026-09-23) 대화를 재개해
    "화면만" B안(검색 부활) 세부 설계까지 확정했다**(검색은 왼쪽
    "포함된 파일"에만·오른쪽엔 안 만듦, 매칭은 `lib/matchesFileName.ts`
    재사용, `screenOnly` 필드는 완전히 제거) — **하지만 구현 착수 전에
    사용자가 "선택지를 잘못 이해했다"며 완전히 다른 화제로 전환해 B안
    구현은 착수하지 않은 채 보류 중이다**(§7 M-46 갱신 완료).

    **대신 "현재 구현 기준으로 요구사항 3건을 제시하겠다"며 시작된
    새 작업 흐름에서 실제로 3건을 처리했다(전부 §7 M-47/M-14/M-13에
    기록, 2026-09-23)**:
    1. **M-47(신규)** — "파일 추가 팝업 초기 화면에 트리가 안 보인다"는
       관찰로 시작했으나, 실제 앱을 Playwright로 열어 확인해보니 Preview
       실행 후엔 트리가 바로 보여(U-19 정상 동작) 버그가 아니었다 — 사용자가
       스스로 "Preview 실행 전에 팝업을 본 것 같다"고 정정(`AddFilesPopup.tsx`의
       `headTreeFiles.length===0` 분기가 "Preview 후 사용할 수 있습니다"
       안내만 보여주는 걸 착각). 여기서 나온 진짜 요구사항: **Preview
       실행 전엔 "+ 파일 추가" 버튼 자체를 비활성화** — `IncludedFilesPane.tsx`에
       `headTreeFiles` 구독 추가, `disabled={headTreeFiles.length===0}`
       + 비활성 시 안내 `title`. 목업(`component-playground.html`의
       `btnAdd`)도 `st.phase`가 `ready`/`depLoading`/`depNa`가 아니면
       같은 방식으로 비활성화해 동기화.
    2. **M-14 재정정** — Preview 직후 기본값을 "전체 Extract로 이동"(RT-51
       결정)에서 **"전체 미선택"**으로 뒤집었다. `analysisSlice.ts`의
       `runPreview`가 `included:true`→`included:false`로 매핑하도록 한 줄
       수정. **파급 효과가 컸다** — 기존 e2e 7개 파일(`preview-export`·
       `export-feedback`·`included-files-pane`·`reload-reset`·`tree-list`·
       `work-area-popups`·`add-files-popup`)이 전부 "Preview 직후 자동으로
       Extract에 들어가 있다"를 전제하고 있어서, 각 테스트에 "왼쪽에서
       체크해서 Extract로 옮기는" 단계를 추가해야 했다. **그 과정에서 실제
       버그급 함정을 하나 발견**: 체크하는 순간 그 행이 DOM에서 사라지는
       체크박스(포함된 파일 목록의 체크박스는 체크하자마자 Extract로 이동해
       사라짐)에 Playwright의 `.check()`를 쓰면, 클릭 후 "실제로 checked가
       됐는지" 확인하는 내장 단계가 이미 사라진 요소를 계속 기다리다
       30초 타임아웃난다 — `.click()`으로 바꾸면 그 사후 확인이 없어 문제
       없다(전부 교체, 재현 스크립트로 원인 직접 확인). 처음엔 소스만
       고치고 빌드 없이 e2e를 돌려서 8개가 실패했었는데(스테일 빌드),
       재빌드 후에도 같은 8개가 또 실패해서 이 `.check()`/`.click()` 문제를
       발견한 것 — 다음에 비슷한 "액션 성공 로그는 찍히는데 타임아웃나는"
       Playwright 실패를 보면 이 패턴부터 의심하세요.
    3. **M-13 재정정** — 화면 폭을 1100px에서 **1200px**로 올렸다. 목업
       (`#optW` 슬라이더 min/max/기본값, `#stage` 초기 폭)과 실제 앱
       (`src/main/index.ts`의 `width`) 둘 다 반영, 높이(760)는 그대로.

    검증: `npm test`(238개)·`typecheck`·`lint`·`build`·`test:e2e`(24개,
    전부 갱신된 채로 통과) 전부 통과.

    **M-48(신규, 같은 날 이어서)** — "최대 [N]개" 입력창(`MaxCountField`,
    조회 조건 왼쪽)의 폭이 브라우저 기본값 153px라 숫자 3~4자리엔
    과하다는 지적으로 1/3인 51px로 줄였다(`MaxCountField.tsx`에
    `className="max-count-field"` 추가, `commitQueryBar.css`에
    `width:51px`). `npm test`(238개)·`typecheck`·`lint`·`build`·
    `test:e2e`(24개) 전부 통과.

    **M-49(신규, 2026-09-24) — REQ-016(파일명으로 커밋 검색) 전체 폐기**:
    사용자가 키워드 필드의 "메시지"/"파일명" 검색 대상 라디오를 없애고
    항상 메시지만 대상으로 하도록 요청했다. 범위가 커서(렌더러 UI뿐
    아니라 `main/git/commits.ts`의 실제 git 분기, `shared/types.ts`의
    `CommitSearchMode` 타입까지) 먼저 서브에이전트로 전체 참조 지점을
    조사한 뒤 제거했다 — `shared/types.ts`(타입+필드)·`main/git/commits.ts`
    (파일명 모드 git 분기 전체, `matchesFileName`, `listTrackedFiles`
    import까지)·`main/git/commits.test.ts`(파일명 모드 테스트 2건)·
    `services/commitQueryParams.ts`/`.test.ts`·`store/slices/
    commitQuerySlice.ts`(state·액션·리셋)·`store/slices/commitsSlice.ts`
    (파라미터 조립 2곳)·`store/repositorySlice.reload.test.ts`·
    `components/QueryFilterGroup.tsx`(라디오 UI 삭제, 키워드 필드를 이제
    작성자/해시와 완전히 같은 `<label>` 구조로 통일 — 예전엔 라디오 때문에
    중첩 label을 피하려고 키워드만 `<div>`를 썼었다)·`components/
    BranchSearchBar.tsx`(`buildKeywordSummary`가 모드 라벨 없이, 키워드가
    비면 요약에서 통째로 빠지도록 — 작성자/해시 필터와 같은 방식)·
    `commitQueryBar.css`(`--keyword` 변형·모드 라디오 CSS 삭제, 세 필드가
    이제 완전히 같은 폭 규칙 공유)·`e2e/query-filter-group.spec.ts`(파일명
    모드 테스트 삭제). **부수 발견**: 작업 중 자정을 넘겨(9/23→24)
    `repositorySlice.reload.test.ts`의 날짜 재계산 테스트가 실패 — 원인은
    테스트가 기준값을 `toISOString()`(UTC)으로 계산하는데 실제 로직
    (`getDefaultDateRange`)은 로컬 시간 기준이라 KST 자정~오전 9시엔
    하루 어긋나는, 작업과 무관한 기존 결함이었다 — 같은 함수로 기준값을
    잡도록 고쳤다. REQUIREDMENT.md REQ-016은 "문서 관리 원칙"에 따라
    RT-60(문서 정식 병합) 때 삭제 반영 예정, 지금은 안 건드림. 검증:
    `npm test`(236개, 파일명 모드 테스트 2건 삭제로 238→236)·`typecheck`·
    `lint`·`build`·`test:e2e`(23개, 24→23) 전부 통과. 상세는 §7 M-49.

    **M-50(신규, 같은 날 이어서)** — "포함된 파일" 패턴 입력창이
    `flex:1`이라 353px까지 늘어나 있던 걸 200px로 고정해달라는 요청 —
    `filterPattern.css`의 `.filter-pattern-bar__row input[type='text']`를
    `flex:0 0 200px;min-width:200px`로 변경. `npm test`(236개)·
    `typecheck`·`lint`·`build`·`test:e2e`(23개) 전부 통과.

    **B안 구현 완료(2026-09-24, §7 M-46 — "화면만" 체크박스 대신 검색
    부활)** — 사용자가 "B안 구현 승인"으로 확정 설계를 그대로 구현하라고
    했다. `screenOnly` 필드를 `FilePattern`(`lib/filePattern.ts`)에서
    완전히 삭제하고, 그걸 참조하던 5곳(`exportPlan.ts`·
    `useIncludedFilesView.ts`·`useExtractTargetsView.ts`·
    `deployFilesSlice.ts`의 `addFilePatterns`/`togglePatternScreenOnly`·
    `FilterPatternBar.tsx`/`FilterPatternsPopup.tsx`의 UI)를 전부
    단순화(패턴은 다시 "항상 Export에 영향을 주는 영구 규칙"이라는
    단일한 의미로 복귀). 대신 `deployFilesSlice.ts`에
    `includedSearchTerm`/`setIncludedSearchTerm`을 새로 추가(생명주기는
    `headTreeFiles`와 동일 — `emptyManualAddState`에 편입), 매칭은
    AddFilesPopup이 쓰던 `lib/matchesFileName.ts`를 그대로 재사용,
    `IncludedFilesPane.tsx` 툴바에 패턴 입력 줄 바로 위 검색창을 추가했다.
    `e2e/included-files-pane.spec.ts`의 옛 "화면만" 테스트 2건을 검색
    기능 테스트 2건으로 교체(화면만 걸러내고 Extract·선택 개수엔 영향
    없음 확인, `*` 와일드카드 + 빈 결과 안내 문구 확인) — 첫 번째 기존
    테스트 이름도 "Filter·검색 UI가 없고"에서 "상태 Filter UI가 없고"로
    정정했다(검색 UI가 이제 다시 있으므로 이름이 거짓말이 됨). 검증:
    `npm test`(233개, screenOnly 테스트 3건 삭제로 236→233)·`typecheck`·
    `lint`·`build`·`test:e2e`(23개, 화면만 2건→검색 2건 교체라 개수
    동일) 전부 통과, Playwright 임시 스크린샷(검색창 평시 모습 +
    타이핑 중 필터링 동작)으로 육안 확인 후 삭제. REQUIREDMENT.md
    REQ-025는 "문서 관리 원칙"에 따라 지금 안 건드리고 RT-60(문서 정식
    병합) 때 "부활"로 반영 예정. 상세는 §7 M-46(해소로 상태 갱신)·U-5
    행(정정 표시).

    **M-51(신규, 같은 날 이어서, 2026-09-24)** — M-50(패턴 입력창
    200px 고정) 직후 사용자가 "패턴 입력란을 파일 패턴 팝업으로
    옮길까?"로 제안, 팝업에서 추가한 게 왼쪽 "포함된 파일" 목록에 즉시
    반영되는지 확인 질문에 zustand 구독 구조(툴바·팝업·
    `useIncludedFilesView` 모두 같은 `filePatterns` state 구독)를
    근거로 즉시 반영됨을 답변, 순서도 시각화 후 "승인"으로 확정. 패턴
    추가 입력 전체(모드 선택·텍스트 입력·`+추가` 버튼·붙여넣기 처리·
    해석 오버레이·피드백 메시지)를 `FilterPatternBar.tsx`에서
    `FilterPatternsPopup.tsx`로 이동 — 툴바는 "패턴: 활성 N개 [보기+추가]"
    요약줄만 남았고, 이 버튼이 이제 패턴 추가의 유일한 진입점이라
    `filePatterns.length===0`이어도 더는 비활성화하지 않는다. 팝업의
    "패턴 0개면 자동으로 닫는다" 로직도 삭제(0개에서 추가를 시작하는
    화면이 됐으므로). `e2e/included-files-pane.spec.ts`의
    `clearAllPatterns` 헬퍼와 `e2e/work-area-popups.spec.ts`의 패턴
    테스트를 새 흐름(팝업 먼저 열고 그 안에서 추가, 자동 닫힘 대신
    직접 닫기)에 맞게 갱신. 검증: `typecheck`·`lint` 클린,
    `npm test`(233개, 개수 변화 없음), `npx playwright test`(전체
    23개) 전부 통과 — 추가로 임시 스크린샷 4장으로 툴바→팝업 열기→
    입력→추가 후 칩 표시·피드백·툴바 "활성 N개" 실시간 갱신을 육안
    확인 후 삭제. 상세는 §7 M-51.

    **M-52(신규, 같은 날 이어서, 2026-09-24)** — "포함된 파일" 검색란
    가로 길이를 절반으로 줄이고, 패턴 요약·"보기+추가" 버튼을 검색란
    오른쪽 같은 줄에 배치해달라는 요청. `IncludedFilesPane.tsx` toolbar를
    `.included-toolbar-row`(flex row)로 감싸 검색창과 `FilterPatternBar`를
    한 줄에 배치, `.included-search-bar`는 `width:50%`, `.filter-pattern-bar`는
    남는 공간을 채우며 오른쪽 끝에 붙도록(`flex:1;justify-content:flex-end`)
    변경. 검증: `typecheck`·`lint`·`npm test`(233개)·전체 e2e(23개) 전부
    통과, Playwright `boundingBox()` 실측(검색창 285px/전체 570px = 정확히
    절반)으로 확인 후 임시 파일 삭제. 상세는 §7 M-52.

    **M-53(버그 수정, 2026-09-24)** — 사용자가 "선택한 경로에 바로 추출"
    (direct 모드)에서 실제로는 빈 폴더인데 NOT_EMPTY 오류가 계속 뜬다고
    보고. 실측해보니 macOS Finder가 폴더를 열람하며 남긴 `.DS_Store`가
    원인 — `deployDirHasContent`(`buildPackage.ts`)가 `fs.readdir` 결과
    엔트리 개수만 보고 판단해서 점 파일도 "내용물"로 셌다. `.DS_Store`·
    `Thumbs.db`·`desktop.ini`를 무시하도록 `deployDirHasContent`를
    수정(이 함수는 direct 모드 NOT_EMPTY 판정과 sub 모드 덮어쓰기 확인
    팝업 둘 다에서 쓰여 양쪽 다 같이 고쳐짐). `validateExportTarget.test.ts`에
    2건 추가. 사용자의 실제 `~/Downloads/git-deploy-extracted`에서
    `.DS_Store` 존재를 확인 후 삭제해 즉시 해결됨을 검증. 검증:
    `typecheck`·`lint`·`npm test`(235개, +2)·전체 e2e(23개) 전부 통과.
    상세는 §7 M-53.

    **M-54(2026-09-24)** — "Extract 대상" 패널의 "모두 되돌리기" 버튼을
    제목 텍스트 우측 끝에 배치해달라는 요청(좌측 "포함된 파일"의
    "+ 파일 추가"와 같은 패턴). `ExtractTargetsPane.tsx`의 `title`을
    프래그먼트로 바꿔 버튼을 카운터 텍스트 옆에 넣음(`FilePane`의
    `.file-pane__title`이 이미 `justify-content:space-between`이라
    추가 레이아웃 작업 없이 우측 정렬됨), 본문의 `.file-list__header-row`
    div는 버튼이 빠지며 비어서 제거. `filePane.css`에
    `.file-pane__title-action{flex-shrink:0}` 신설(`.add-file-button`과
    역할은 같지만 이름이 안 맞아 분리). 검증: `typecheck`·`lint`·
    `npm test`(235개)·전체 e2e(23개) 전부 통과, 스크린샷으로 확인 후
    삭제. 상세는 §7 M-54.

    **M-55(2026-09-24)** — 패턴 요약 텍스트를 "활성 N개"(포함/제외
    합산)에서 "포함 N개/제외 N개"로 나눠 표기, 팝업을 여는 "보기+추가"
    버튼 텍스트를 "설정"으로 변경해달라는 요청. `FilterPatternBar.tsx`가
    `activePatterns`를 `mode`별로 나눠 `activeIncludeCount`/
    `activeExcludeCount`를 계산, 배지 텍스트와 버튼 라벨을 각각 변경.
    e2e 셀렉터(`getByRole('button', { name: '보기+추가' })`) 2곳을
    `'설정'`으로 갱신. 검증: `typecheck`·`lint`·`npm test`(235개)·전체
    e2e(23개) 전부 통과, 스크린샷으로 "패턴: 포함 1개/제외 1개 [설정]"
    표기 확인 후 삭제. 상세는 §7 M-55.

    **M-56(2026-09-24)** — "포함된 파일" 파일명 검색란 placeholder 문구를
    바꾸고 싶다는 요청에 4가지 안(정보 유지+간결화/구체적 예시/최소화/
    직접 입력)을 제시, AskUserQuestion으로 "구체적 예시로 대체" 채택.
    `IncludedFilesPane.tsx`의 placeholder를 `파일명 검색... (* 와일드카드
    가능, 화면에만 적용)` → `파일명 검색 (예: *.java)`로 변경. 검증:
    `typecheck`·`lint`·`npm test`(235개)·전체 e2e(23개) 전부 통과. 상세는
    §7 M-56.

    **M-57(2026-09-24, "문서 업데이트할 것 남아있는지 확인" 요청에 대한
    점검·조치)** — `REFACTORING_TASKS.md`·`HANDOFF.md`는 M-45~M-56 전부
    빠짐없이 반영돼 있었지만, `component-playground.html`(목업)이
    M-46(B안 검색 부활)부터는 동기화가 끊겨 있었음을 발견(이번 세션에서
    M-13/M-14 재정정·M-47만 반영되고 그 뒤 M-50~M-52·M-55·M-56은 누락).
    AskUserQuestion으로 "지금 갱신"/"동결(정책대로 방치)" 확인 — "지금
    갱신" 채택. 목업에 검색(`includedSearchTerm`+`matchesFileName()`
    이식)·패턴 입력을 팝업으로 이동·검색+패턴 요약 한 줄 배치·포함/제외
    분리 표기·"설정" 버튼명·검색 placeholder까지 전부 반영. 목업은
    typecheck/lint/test 대상이 아니라(실제 앱 코드 아님), 로컬 Playwright
    Chromium 캐시가 오래돼(`npx playwright install chromium`으로 리비전
    1243 설치) 임시 스크립트로 headless Chromium을 띄워 3가지 상태(검색+
    패턴 요약 한 줄, 패턴 추가 입력이 팝업 안, 검색 필터링+빈 결과 안내)를
    스크린샷으로 확인 후 스크립트·스크린샷 삭제. 상세는 §7 M-57.

    **M-47·M-14 재정정·M-13 재정정·M-48·M-49·M-50·B안(M-46)·M-51·M-52·
    M-53·M-54·M-55·M-56·M-57 전부 커밋 `cbfcdef`로 완료(2026-09-24).**

    **M-58(2026-09-24)** — 연쇄 질문 끝에 나온 요청. ① "+ 파일 추가를
    전체 선택 행으로 옮기면?" → 타이틀 줄 우측 대칭(M-54)·배지 발견성
    근거로 현행 유지 추천, 사용자 동의. ② "조회 조건↔커밋 간격이 더
    커 보이는 게 착시냐" → Playwright 실측으로 둘 다 정확히 8px임을
    확인, 커밋↔배포 대상 파일 쪽에만 있는 SplitPane 핸들의 2px 수평선이
    기준점이 돼 생기는 대비 착시라고 답변. ③ "그 수평선 지우면 리사이즈
    기능에 영향 있냐" → `SplitPane.tsx` 확인, 드래그 이벤트는 8px 히트
    영역(`.split-pane__handle`)에 걸려 있고 선(`.split-pane__handle-bar`)은
    장식용이라 영향 없음, 다만 3곳이 공유하는 컴포넌트라 지우면 전부
    같이 없어진다고 답변 — 수평선은 유지하기로 함. ④ 실제 요청: "전체
    선택 체크박스를 파일명 검색 왼쪽으로 옮기고 원래 행은 삭제하면
    사용성에 나쁜 영향 있냐" → sticky는 toolbar가 이미 스크롤 밖이라
    무관하지만 열-정렬 단서·구분선을 잃는다고 답변, "구분선만 옮겨
    유지" 절충안 제안 → 사용자가 상상이 안 된다고 해서 ASCII
    다이어그램 3장(AS-IS/구분선까지 삭제/구분선만 이동)으로 시각화 →
    승인. 구현: `IncludedFilesPane.tsx`의 "전체 선택" `TriStateCheckbox`를
    전용 헤더 행(`.file-list__header-row`, sticky)에서 toolbar
    (`.included-toolbar-row`) 맨 왼쪽으로 이동, 빈 헤더 행 제거 —
    `panel-frame__header`(title+toolbar 전체 아래)에 이미 있던
    `border-bottom`이 체크박스가 toolbar로 들어오면서 자동으로 "검색 줄
    바로 아래"가 돼 새 CSS 없이 요청대로 구현됨. `filePane.css`에서
    `.file-list__header-row` 규칙 삭제. 목업도 동일하게 반영(`#chkAll`을
    `FileListHeaderRow`에서 `toolbarRow`로). 검증: `typecheck`·`lint`·
    `npm test`(235개)·전체 e2e(23개) 전부 통과, 실제 앱+목업 스크린샷
    으로 확인 후 삭제. 상세는 §7 M-58. **커밋 `5938cac`로 완료.**

    **앱 아이콘 교체(2026-09-24, 커밋 `79181fc`)** — `Credit.tsx`가 쓰던
    `goraeng.png`(50×50 도트 아트)를 앱 아이콘으로 채택. 단순 확대는
    도트 경계가 흐려져서(bicubic/Lanczos류 부드러운 보간 때문), 대신
    nearest-neighbor로 정확히 20배(1000×1000) 키운 크리스프 마스터를
    만든 뒤 그 마스터에서 각 필요 해상도로 고품질 축소(LANCZOS)해
    `build/icon.icns`(macOS)·`build/icon.ico`(Windows)·`build/icon.png`
    + `resources/icon.png`(Linux, 512×512)를 생성. `electron-builder --mac
    --dir`로 실제 `.app`을 만들어 그 안의 `.icns`를 꺼내 계단현상·블러
    없이 선명함을 확인 후 빌드 산출물 삭제. `resources/icon 복사본.png`
    (RT-62가 지목한 아이콘 교체 시도 흔적)도 이 작업 중에 삭제 — RT-62
    남은 항목은 `.gitignore` vim 스왑 추가뿐.

    **v0.7.0 릴리스(2026-09-24)** — 사용자 요청("버전 갱신하고 릴리즈
    올리자")으로 RT-60(문서 동기화)·RT-61(루트 html 이동)·RT-62(vim
    스왑) 완료 전에 먼저 진행 — 셋 다 배포 앱 동작과 무관한 문서/저장소
    정리라 순서를 바꿔도 안전하다고 판단(§7 RT-63 참고). `npm version
    0.7.0 --no-git-tag-version`으로 `package.json`/`package-lock.json`
    갱신, 태그 전 전체 검증(`typecheck`·`lint`·`npm test` 235개·`build`·
    `test:e2e` 23개) 재확인 통과. 이번 릴리스 범위: M-45~M-58 + 새 앱
    아이콘. `HEAD`가 이미 `origin/main`과 동일(이번 세션 커밋들이 이미
    푸시돼 있었음)해서 버전 커밋 하나만 추가로 푸시 후 `v0.7.0` 태그를
    올려 `.github/workflows/release.yml`(태그 `v*` 푸시 시 mac·win 빌드
    + GitHub Release 생성)을 트리거.

    **RT-60 문서 동기화 완료(2026-09-25, 사용자 요청 "RT-60 문서 동기화
    진행해")** — 8개 정식 문서를 v0.6.0 기준에서 v0.7.0 기준으로 갱신.
    §6 체크리스트를 기준으로 삼되, 이후 결정으로 덮어써진 부분(예:
    §6이 "REQ-025 폐기/축소"라고 적어둔 건 실제로는 B안으로 부활해서
    틀렸음 — 실제 코드/M-x 로그로 재확인해 바로잡음)을 계속 대조하며
    진행. 문서별 변경 폭:
    - **REQUIREDMENT.md** — REQ-003(키워드 검색 스펙 보강)·REQ-009/010
      (extract-list.txt 통합)·REQ-011(Extract 대상 이동 모델)·REQ-012
      (Export 위치 방식+겹침 검증+DS_Store 수정)·REQ-013/DR-019(파일
      추가 팝업 트리 탐색화)·REQ-015/DR-015(Reload 전체 초기화)·
      REQ-016(폐기)·REQ-019/024/025(→REQ-026 신설: 파일 패턴 제외+포함
      관리)·REQ-020(누락된 의존성 카운터→배지)·DR-013(덮어쓰기 확인
      방식별 분기)·§8/§9(ASCII 다이어그램 재작성) 반영.
    - **UI_UX_SPEC.md** — §1(컴포넌트 트리)·§2.3(CommitQueryBar 키워드
      통합)·§2.5(PreviewSummary 개명+팝업 트리거)·§2.6(DeployFilesPanel
      을 IncludedFilesPane/ExtractTargetsPane/FilterPatternsPopup/
      AddFilesPopup 구조로 전면 재작성)·§2.7(DeletedFilesPopup)·§2.8
      (FooterActionBar Export 방식 분기)·§3(상태 스토어 슬라이스
      구조)·§4(인터랙션 표)·§5(로딩/빈/에러 상태 표) 재작성. 옛 구조가
      광범위하게 바뀐 곳은 세부 "정정" 누적 대신 섹션째로 다시 씀.
    - **DETAILED_DESIGN.md** — §2(Export 포맷 단일화)·§4.3(Export 경로
      계산 정정)·§8(커밋 선택/Reload 규칙, REQ-016 폐기)·§9(결정 사항
      요약표)·§17(REQ-016 관련 서술 정리) 정정 + **§18 신규**(파일 패턴
      판정 알고리즘·Extract 대상 이동 모델·팝업 시스템·TreeList). §12·
      §13·§16은 옛 구조 설명이라 "역사적 기록" 정정 배너를 상단에 달아
      현재 코드와 혼동하지 않게 표시(설계 이유는 지금도 유효해 남김).
    - **RISK_ISSUES.md** — 결정 이력 로그에 #62~69 추가(P1/P4/이번
      세션/아이콘/v0.7.0 릴리스/이 문서 동기화 자체를 요약 단위로 —
      REFACTORING_TASKS.md에 이미 있는 세부는 중복 기록하지 않음).
      §7.5(TO-BE 와이어프레임)는 REQUIREDMENT.md §8로 이관(중복 동기화
      부담 축소). §8 백로그 5건 중 3건(8.3 접기/펼치기, 8.4 패턴 팝업,
      8.1 패키지 패턴)은 해소/부분 해소, 8.5(중첩 스크롤)도 부분 해소로
      갱신.
    - **ARCHITECTURE.md** — §3에 IPC 계층 구조화(RT-12/20/21) 반영,
      §4.1(REQ-016 제거)·§4.6(UI 계층 목록)·§4.8(AddFilesPopup 교체)
      정정, §4.9 신설(파일 패턴 관리), §2.2에 `shared/` vs
      `renderer/lib/` 배치 기준(RT-23) 추가.
    - **README.md** — 파일 추출 기준 8번(선택 모델 반전)·11번(트리
      탐색으로 변경) 정정, 12번(파일 패턴) 신규.
    - **PRD.md** — REQ-010(단일 파일)·REQ-011(선택 모델 반전) 정정.
    - DOCUMENT_CHECKLIST.md·PHASE_PLAN.md는 §6 결정대로 변경 없음.

    각 문서 상단 "현행 기준" 배너를 v0.6.0→v0.7.0으로 갱신.
    REFACTORING_TASKS.md의 RT-60 체크박스도 완료 처리. **이 문서
    (HANDOFF.md)는 동결하지 않는다** — §6의 "전부 끝나면 동결"은
    REFACTORING_TASKS.md 자체에 해당하는 조항이고, RT-61(루트 html
    이동)·RT-62(vim 스왑 `.gitignore`)가 아직 남아 P5 전체가 끝나지
    않았다.

    **다음 착수 지점은 P5 잔여(RT-61 루트 html 이동 → RT-62 vim 스왑
    `.gitignore` 추가)입니다. 이번 세션에서 만든 문서 변경은 전부 아직
    커밋하지 않았습니다.**

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
