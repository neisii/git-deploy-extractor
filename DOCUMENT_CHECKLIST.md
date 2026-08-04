# 문서화 작업 체크리스트

> 기준 문서: REQUIREDMENT.md (Git Deploy Extractor 요구사항 정의서 v0.1)

---

## 1. PRD (제품 요구사항 문서) → PRD.md

- [x] User Story 정의
- [x] 기능별 우선순위 지정
- [x] Acceptance Criteria 작성
- [x] 성공 지표 정의

---

## 2. 아키텍처 설계 문서 → ARCHITECTURE.md

- [x] 크로스플랫폼 Desktop App 기술 스택 제안 (Electron 채택)
- [x] 모듈 구조 설계
  - [x] Repository 접근 계층
  - [x] Commit 분석 엔진
  - [x] Mapping Rule 엔진
  - [x] Package Builder
  - [x] UI 계층 (개요 수준 — 상세 컴포넌트/상태는 4번 UI/UX 명세에서 진행)
- [x] 데이터 흐름도 작성 (Commit 선택 → diff 추출 → HEAD 파일 조회 → Mapping 적용 → Package 생성)

---

## 3. 상세 설계 문서 → DETAILED_DESIGN.md

- [x] Mapping Rule 스펙
  - [x] Local Path → Server Path 규칙 정의 방식
  - [x] Java/Resources 원본 경로 유지 규칙 (DR-011, DR-012, Spring 표준 구조 기준)
  - [x] Profile 저장 포맷
- [x] Deploy Summary JSON 스키마
  - [x] deploy-files.txt 포맷
  - [x] delete-list.txt 포맷
  - [x] deploy-summary.json 포맷
- [x] Git 연동 설계
  - [x] `git diff`, `git log`, `git show` 등 CLI 명령 조합 방식 정의

---

## 4. UI/UX 명세 → UI_UX_SPEC.md

- [x] REQUIREDMENT.md 8번 섹션 와이어프레임을 화면별 상세 스펙으로 확장
  - [x] 컴포넌트 정의
  - [x] 상태(State) 정의
  - [x] 인터랙션 정의

---

## 5. 테스트 계획 (후순위로 보류, 2026-08-04)

- [ ] REQ-001~011 기준 테스트 케이스 작성
- [ ] DR-001~012 기준 테스트 케이스 작성
- [ ] 엣지케이스 테스트 케이스 작성
  - [ ] Merge
  - [ ] Rebase
  - [ ] Rename (Delete+Add로 나뉘어 보이는지, Preview에서 사용자가 식별 가능한지 — DR-008 재정정 반영, 2026-08-04)
  - [ ] 삭제 파일
  - [ ] 조회 기간/최대 개수 경계값 (시작일·종료일 정확히 걸친 커밋 포함 여부 — DETAILED_DESIGN.md §3.2 `--since`/`--until` 시간 명시 규칙 검증)

---

## 6. 리스크/오픈이슈 문서 → RISK_ISSUES.md

- [x] 성능 리스크
  - [x] `--skip` 비용 (DETAILED_DESIGN.md §5 인용)
  - [x] Deploy Files 가상 스크롤 300개 임계값 (UI_UX_SPEC.md §2.6 반영 완료)
- [x] 정확성 리스크
  - [x] Merge Commit "첫 번째 부모 기준" (DETAILED_DESIGN.md §3.3 인용)
  - [x] Mapping Rule override 충돌 (DETAILED_DESIGN.md §1.2 인용)
  - [x] 메타 리스크(정확성 검증 수단 부재) + 완화 방향 후보 정리
  - [x] Rename 감지 threshold — 해소 이력만 기록
- [x] 플랫폼 차이 리스크
  - [x] 대소문자 구분, 줄바꿈 처리 (DETAILED_DESIGN.md §4 인용)
  - [x] Windows 경로 길이 제한 — 검토 후 리스크 아님으로 판단, 근거 기록
- [x] 결정 이력 로그 — 12건 타임라인 표로 정리
- [x] 미조사 잠재 리스크 3건 — 시나리오/영향만 가볍게 기록, 후속 조사 필요로 표기
