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

---

# 5. 미조사 잠재 리스크

아래는 시나리오와 영향만 가볍게 기록한다. 지금 결정하지 않고 후속 조사 대상으로만 남긴다.

| 리스크 | 시나리오 | 영향 | 상태 |
|---|---|---|---|
| git 미설치 PC | 배포 대상 PC에 git이 없거나 PATH에 없는 상태로 앱 실행 | Repository 선택 단계부터 모든 기능 불가 | 후속 조사 필요 |
| Mapping Profile JSON 파손 | 사용자가 프로필 JSON을 직접 열어 수정하다 문법 오류 발생 | 해당 프로필 로드 실패, 어떤 사용자 경험으로 안내할지 미정 | 후속 조사 필요 |
| 대용량 단일 파일 포함 | 바이너리·대용량 리소스 파일이 배포 대상에 포함됨 | 복사 성능/메모리 사용량 영향 미측정 | 후속 조사 필요 |
