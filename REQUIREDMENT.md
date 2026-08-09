# Git Deploy Extractor 요구사항 정의서 (MVP)

> Version: 0.1
> Status: Draft
> Author: TBD

---

# 1. 프로젝트 개요

## 1.1 목적

Git Commit 이력을 기반으로 배포 대상 파일을 자동 추출하여 망 분리 환경에서 안전하게 내부망으로 전달할 수 있는 배포 패키지를 생성하는 크로스플랫폼 Desktop Application을 개발한다.

본 도구는 Git Repository 간 동기화 도구가 아니며, 운영 서버 배포 도구도 아니다.

"배포해야 하는 파일을 정확하게 추출하는 것"이 핵심 목적이다.

---

# 2. 개발 배경

현재 프로젝트는 외부망과 내부망이 물리적으로 분리되어 있다.

## 외부망

- 인터넷 연결 가능
- 개발 수행
- 외부 Git Server 사용

## 내부망

- 인터넷 연결 불가
- 내부 Git Server 사용
- GitLab CI를 통한 배포 수행

외부망에서 개발한 내용을 내부망으로 전달하기 위해서는

- 변경 파일 추출
- 파일 복사
- 파일 전송
- 내부 Git 반영

과정을 모두 수작업으로 수행하고 있다.

이 과정에서

- 파일 누락
- 잘못된 파일 포함
- 중복 작업

등이 자주 발생한다.

---

# 3. 프로젝트 범위

본 프로젝트의 책임 범위

- Local Git Repository 분석
- Commit 기반 변경 파일 추출
- 최신 버전 파일 생성
- 배포 패키지 생성

본 프로젝트 범위 외

- Git Push
- Git Pull
- Git Merge
- GitLab CI
- 운영 서버 배포
- FTP/SFTP 전송

---

# 4. 배포 환경

## 전체 배포 흐름

```text
                외부망
──────────────────────────────────────────────

Local Git Repository

↓

contract2/main

↓

Git Deploy Extractor

↓

git-deploy-extracted/

↓

파일전송 프로그램

═══════════════════════════════════════

                내부망

↓

Local Git Repository

↓

git add

↓

git commit

↓

git push

↓

내부 Git Server

↓

GitLab CI

↓

운영 서버 배포
```

Git Deploy Extractor는 git-deploy-extracted 폴더 생성까지만 책임진다.

---

# 5. 용어 정의

| 용어 | 설명 |
|------|------|
| Repository | Local Git Repository |
| 기준 브랜치 | 배포 기준 브랜치 (예: contract2/main) |
| 선택 Commit | 사용자가 배포 대상으로 선택한 Commit |
| 배포 대상 파일 | 선택 Commit에서 변경된 파일의 최신 버전 |
| Mapping Rule | Local Path → Server Path 변환 규칙 |
| Deploy Package | 생성된 배포 폴더 |

---

# 6. 핵심 요구사항

## REQ-001 Repository 선택

사용자는 Local Git Repository를 선택할 수 있어야 한다.

---

## REQ-002 Branch 선택

배포 기준 Branch를 선택할 수 있어야 한다.

예)

contract2/main

Repository 선택 시 기본 Branch가 자동 선택된다.

기본 Branch는 main 또는 master 중 존재하는 Branch이다(main 우선).

둘 다 없으면 자동 선택하지 않고 사용자가 직접 선택해야 한다.

---

## REQ-003 Commit 조회

선택한 Branch의 Commit 목록을 조회할 수 있어야 한다.

표시 정보

- Commit Hash
- Author
- Date
- Message

Branch의 전체 이력을 한 번에 조회하지 않는다.

조회 기준은 Commit 시점의 시작일~종료일과 최대 조회 개수이며, 둘 다 사용자가 조정할 수 있다.

기본 시작일은 오늘로부터 7일 전, 기본 종료일은 오늘이며, 기본 최대 개수는 100개이다.

시작일~종료일 범위는 시작일 00:00:00부터 종료일 23:59:59까지를 포함한다.

---

## REQ-004 Commit 다중 선택

사용자는 여러 Commit을 동시에 선택할 수 있어야 한다.

---

## REQ-005 변경 파일 추출

선택된 Commit들의 변경 파일을 모두 수집한다.

Merge 여부와 관계없이 변경 파일을 식별한다.

---

## REQ-006 중복 제거

동일 파일이 여러 Commit에 포함되어 있더라도

최종 결과에는 1회만 포함한다.

---

## REQ-007 최신 파일 추출

배포 파일은 Commit 시점의 파일이 아니라

기준 Branch HEAD의 최신 파일을 사용한다.

---

## REQ-008 Mapping Rule 적용

Local Path를 Server Path로 변환한다.

본 문서의 예시는 전형적인 Spring Framework 프로젝트 구조를 기준으로 한다.

src/main/java, src/main/resources/{static, templates, ...}

이 구조에서는 Local Path와 Server Path가 동일하다.

`.java` 파일은 원본 패키지 경로를 그대로 유지한다. (DR-011)

resources 하위 파일도 원본 경로를 그대로 유지한다. (DR-012)

Mapping Rule은 이 기본 구조와 다른 배포 경로가 필요한 경우에만 적용한다. (DR-010)

예)

src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java

↓

git-deploy-extracted/src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java

src/main/resources/static/js/guarantee/list.js

↓

git-deploy-extracted/src/main/resources/static/js/guarantee/list.js

---

## REQ-009 Deploy Package 생성

배포 파일만 별도 디렉터리로 생성한다.

---

## REQ-010 Export

다음을 Export할 수 있어야 한다.

- deploy-files.txt
- delete-list.txt
- deploy-summary.json

---

## REQ-011 배포 파일 개별 선택

사용자는 자동 계산된 배포 대상 파일 중 개별 파일을 배포 대상에서 제외할 수 있어야 한다.

실제로 필요한 파일만 선택해서 추출할 수 있어야 하기 때문이다.

전체 파일을 한 번에 선택/해제하는 전체 선택 토글을 제공한다.

---

## REQ-012 Export 경로 선택

사용자는 Export 결과물(`git-deploy-extracted/`)이 생성될 **부모 디렉터리**를 선택할 수 있어야 한다.

디렉터리 선택은 OS 네이티브 폴더 선택 다이얼로그로만 이루어진다(자유 텍스트 경로 입력 없음).

선택하지 않으면 저장소 루트가 기본값이다.

하위 폴더 이름(`git-deploy-extracted`)은 사용자가 바꿀 수 없다 — RISK_ISSUES.md 결정 이력 #20("이름은 고정이어야 예측 가능한 표준 산출물")과 일관성을 유지한다. 이번 요구사항은 이름이 아니라 **위치**만 다룬다.

선택한 경로는 앱을 재실행해도 유지된다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §7.1, 2026-08-07)

---

## REQ-013 의존성 완결성 검사 (Java/Spring)

사용자는 배포 대상 파일 목록에 Java/Spring 의존성이 누락되지 않았는지 확인할 수 있어야 한다.

키워드로 커밋을 검색해 배포 대상을 고르는 방식은 관련 커밋을 놓칠 수 있다 — 실제로 다른 팀이 공통 구현체를 수정한 커밋이 검색어에 걸리지 않아 내부망 빌드가 실패한 사례가 있었다.

Java/Spring 단일 모듈(멀티모듈 미지원)을 대상으로, `@SpringBootApplication` 클래스의 패키지를 기준 삼아 우리 코드 범위를 정한다. 이 기준 패키지는 실제 애노테이션을 찾아서 판단하며, 특정 회사/프로젝트의 패키지명을 코드에 미리 넣어두지 않는다.

의존성은 import 문(텍스트 참조)과 Spring DI(생성자/필드로 주입되는 인터페이스 → 그 인터페이스를 구현하면서 `@Component`/`@Repository`/`@Service` 등 stereotype 애노테이션이 붙은 클래스) 두 경로 모두로 판정하며, 깊이 제한 없이 전이적으로 추적한다.

같은 인터페이스를 구현하는 클래스가 여러 개면 하나로 확정하려 하지 않고 전부 후보로 제시한다 — 최종 판단은 사용자가 한다.

찾아낸 후보는 배포 대상 파일 목록에 개별적으로 추가하거나 한 번에 모두 추가할 수 있어야 한다.

`@SpringBootApplication` 클래스를 찾지 못하면 이 기능은 비활성화된다(폴백 없음).

추가 (실사용 중 나온 요구, RISK_ISSUES.md §7.2, 2026-08-07)

---

## REQ-014 분할 영역 크기 조절

나뉜 화면 영역의 비율을 사용자가 마우스 드래그로 조절할 수 있어야 한다.

- 좌우 분할(폭 조절): 커밋 목록/분석 요약, 포함된 파일/누락된 의존성
- 상하 분할(높이 조절): 커밋 목록·분석 요약 영역 전체 / 포함된 파일·누락된 의존성 영역 전체

조절한 비율은 앱을 재실행해도 유지된다.

각 영역은 최소 크기 아래로는 줄어들지 않으며, 창이 두 영역의 최소 크기 합보다 좁아지거나(좌우) 짧아지면(상하) 스크롤이 나타난다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §7.4, 2026-08-07). 상하 분할은 §7.4 최초 구현 직후 추가 요청으로 확장(2026-08-07, 결정 이력 #27).

---

## REQ-015 커밋 선택 유지

사용자는 검색 조건(검색어, 검색 대상, 조회 기간, 최대 개수)을 바꿔가며 여러 번 재조회해도, 이전에 체크한 커밋 선택을 잃지 않아야 한다.

키워드 검색만으로는 관련 커밋을 놓칠 수 있어(예: 검색어를 바꿔가며 여러 번 찾아야 하는 경우), 검색할 때마다 선택이 초기화되면 매번 다시 체크해야 하는 불편이 있다.

단, 다음 두 경우는 선택을 지운다(DR-015).

- Repository를 전환할 때 — 다른 저장소의 커밋 hash가 남아있으면 오류·오동작으로 이어질 수 있다.
- Branch를 전환할 때 — 서로 다른 Branch의 커밋이 한 Export에 섞일 위험이 있다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §6.1, 2026-08-07)

---

## REQ-016 파일명으로 커밋 검색

사용자는 커밋 메시지가 아니라 **변경된 파일명**으로 커밋을 검색할 수 있어야 한다.

메시지 검색과는 별도 모드이며, 사용자가 "메시지"/"파일명" 중 하나를 선택해서 검색한다.

검색 대상은 현재 선택된 Branch의 **HEAD 트리에 존재하는 파일명**만이며, 파일 경로의 마지막 조각(파일명)에 대한 부분 일치로 판단한다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §7.3, 2026-08-07)

---

# 7. Deployment Rules

## DR-001 기준 Branch

배포 대상 파일은 기준 Branch의 HEAD를 기준으로 한다.

---

## DR-002 Commit의 역할

Commit은

배포 대상 파일을 식별하기 위한 용도로만 사용한다.

Commit 시점의 파일을 복원하지 않는다.

---

## DR-003 최신 파일 사용

선택된 Commit에서 변경된 파일을 모두 수집한다.

실제 복사되는 파일은

기준 Branch HEAD의 최신 버전이다.

---

## DR-004 동일 파일

동일 파일이 여러 Commit에서 수정되더라도

최종 결과에는 1회만 포함한다.

---

## DR-005 Merge/Rebase

Merge

Squash Merge

Rebase

Cherry-pick

등 Git 전략과 무관하게

변경 파일 집합만 계산한다.

---

## DR-006 공유 파일

ContractClient.java

CommonUtil.java

등

공유 컴포넌트도

선택 Commit에서 수정되었다면

배포 대상에 포함한다.

---

## DR-007 삭제 파일

삭제 파일은 복사하지 않는다.

Delete List에 기록한다.

---

## DR-008 Rename

Rename를 별도로 감지하지 않는다.

Rename은 이전 파일 삭제 + 새 파일 추가로 처리한다.

이전 이름은 DR-007에 따라 Delete List에 포함되고, 새 이름은 REQ-007에 따라 HEAD 최신 버전으로 배포 대상에 포함된다.

두 규칙을 그대로 적용하면 최종적으로 새 파일명만 남으므로, Rename 감지 로직 없이도 최종 파일명 기준 처리가 자연히 성립한다.

어떤 삭제/추가가 실제로는 하나의 Rename인지 판단하는 것은 Preview 화면에서 사용자가 직접 한다.

---

## DR-009 존재하지 않는 파일

HEAD에 존재하지 않는 경우

복사하지 않는다.

Warning으로 표시한다.

---

## DR-010 Mapping Rule

복사 경로는

Mapping Rule을 적용한다.

단, Spring 표준 구조(`.java`, `resources`)는 DR-011·DR-012에 따라 Mapping Rule 대상에서 제외된다.

DR-010은 표준 구조와 다른 배포 경로가 필요한 예외적인 경우에만 적용된다.

---

## DR-011 Java 소스 파일 경로 유지 (Spring 표준 구조)

`.java` 파일은 Mapping Rule 대상에서 제외한다.

`src/` 하위 패키지 경로 구조를 변환 없이 그대로 Deploy Package에 복사한다.

예)

src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java

↓

git-deploy-extracted/src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java

컴파일은 내부망 GitLab CI 단계에서 수행하므로, 원본 패키지 경로가 그대로 유지되어야 한다.

---

## DR-012 Resources 경로 유지 (Spring 표준 구조)

`src/main/resources` 하위 파일(static, templates 등)은 Mapping Rule 대상에서 제외한다.

원본 경로 구조를 변환 없이 그대로 Deploy Package에 복사한다.

WEB-INF 등 별도 서버 경로로 재배치하지 않는다.

예)

src/main/resources/static/js/guarantee/list.js

↓

git-deploy-extracted/src/main/resources/static/js/guarantee/list.js

src/main/resources/templates/guarantee/list.html

↓

git-deploy-extracted/src/main/resources/templates/guarantee/list.html

---

## DR-013 Export 대상 경로 덮어쓰기 확인

Export 대상 폴더(`<선택한 부모 디렉터리>/git-deploy-extracted`, REQ-012)에 이미 파일이 있으면

기존 내용을 지우기 전에 확인 팝업을 띄운다.

사용자가 취소하면 Export를 중단하고 기존 내용을 그대로 보존한다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §7.1, 2026-08-07)

---

## DR-014 Java/Spring 의존성 판정 기준 (REQ-013)

의존성 완결성 검사는 Java/Spring **단일 모듈**만 대상으로 한다(멀티모듈 미지원).

기준 패키지(우리 코드 범위)는 `@SpringBootApplication` 애노테이션이 붙은 클래스를 저장소에서 찾아 그 패키지로 정한다. 못 찾으면 폴백 없이 기능을 비활성화한다.

의존성은 두 가지 경로로 판정한다.

- import 문에 의한 텍스트 참조
- Spring DI: 생성자/필드로 주입되는 인터페이스 → 그 인터페이스를 `implements`하면서 `@Component`/`@Repository`/`@Service`/`@Controller`/`@RestController`/`@Configuration` 중 하나가 붙은 클래스

깊이 제한 없이 전이적 폐쇄까지 추적한다(A가 B를 참조하고 B가 C를 참조하면 C까지 포함).

같은 인터페이스를 구현하는 클래스가 여러 개 있으면 정적 분석으로 하나를 확정하지 않고 전부 후보로 제시한다 — 최종 판단은 사용자가 한다.

정확도 원칙: 실제로 필요한데 놓치는 경우(False Negative)를 막는 것이 최우선이며, 불필요한데 후보로 제안되는 경우(False Positive)는 사용자가 걸러내면 되는 참고용으로 허용한다.

이 검사로 찾아낸 파일은 선택된 Commit의 변경 파일이 아니라 **HEAD 기준으로 직접 포함**된다 — REQ-005~007이 정의하는 "선택 Commit → 변경 파일 수집" 경로와는 별개의, HEAD 트리를 직접 훑는 경로다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §7.2, 2026-08-07)

---

## DR-015 커밋 선택 유지/초기화 규칙 (REQ-015)

재조회(검색어/검색 대상/조회 기간/최대 개수 변경, Repository Reload) 시 `selectedHashes`는 기본적으로 유지한다.

다음 두 경우만 예외로 지운다.

- Repository 전환(Browse) — 다른 저장소의 hash로 git 명령을 시도하면 오류/오동작이 발생할 수 있다.
- Branch 전환 — 최종 배포 내용은 항상 현재 선택된 Branch의 HEAD 기준으로 해석되므로, 다른 Branch의 커밋이 섞이면 의도와 다르게 해석될 위험이 있다.

Repository Reload(같은 저장소를 다시 읽는 것)는 위 두 예외에 해당하지 않으므로 선택을 유지한다.

추가 (실사용 중 나온 요구, RISK_ISSUES.md §6.1, 2026-08-07)

---

# 8. UI 요구사항

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Git Deploy Extractor — contract2/main                                                    (읽기 전용 표시)   │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Repository                                                                               [Browse...]        │
│ D:\workspace\contract2                                                                   [Reload]           │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Branch : contract2/main ▼                           Search : [ guarantee                  ] [Search]        │
│ 조회 기간 : [ 2026-07-28 ] ~ [ 2026-08-04 ]          최대 [ 100 ] 개                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Commit List                                                    │ Deployment Preview                       │
│─────────────────────────────────────────────────────────────── │──────────────────────────────────────────│
│ □ a8f2d31  guarantee UI                                        │ Files                : 18                │
│ ☑ b61e2ab  guarantee html                                      │ Added                : 3                 │
│ ☑ 8dd9e91  guarantee backend                                   │ Modified             : 15                │
│ □ 5e0f712  payment bug                                         │ Deleted              : 1                 │
│ □ 66a3112  refactoring                                          │                                          │
│                                                                │                                          │
├────────────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ Deploy Files (HEAD Latest Version)              ☑ 전체 선택                              Filter: All ▼     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ☑ src/main/resources/templates/guarantee/list.html               → (경로 그대로 유지)                      │
│ ☑ src/main/resources/static/js/guarantee/list.js                 → (경로 그대로 유지)                      │
│ ☑ src/main/java/.../GuaranteeListController.java                 → (경로 그대로 유지)                      │
│ ☑ src/main/java/.../ContractClient.java                          → (경로 그대로 유지)                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Delete List                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ old.js                                                                                                       │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Mapping Profile : [contract2-prod ▼]                                                     [Preview] [Export] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. Deploy Package 구조

```
git-deploy-extracted/
├── src/main/
│   ├── java/              ← 원본 패키지 경로 구조 그대로 (DR-011)
│   │   ├── com/example/sell/interfaces/receipt/controller/GuaranteeListController.java
│   │   └── com/example/sell/.../ContractClient.java
│   └── resources/         ← 원본 경로 구조 그대로 (DR-012)
│       ├── static/js/guarantee/list.js
│       └── templates/guarantee/list.html
├── delete-list.txt
├── deploy-files.txt
└── deploy-summary.json
```

---

# 10. 비기능 요구사항

- macOS 지원(**정정, 2026-08-09**: Apple Silicon/arm64 전용, Intel Mac(x64) 미지원 — 패키징 용량 절감을 위해 universal 바이너리를 채택하지 않기로 결정. RISK_ISSUES.md 결정 이력 참고)
- Windows 지원
- Local Git Repository 기반 동작
- Git CLI 사용
- 인터넷 연결 없이 동작 가능
- 수천 개 Commit에서도 원활한 조회
- 프로젝트 설정(Profile) 저장 지원

---

# 11. MVP 범위

## 포함

- Repository 선택
- Branch 선택
- Commit 조회
- Commit 다중 선택
- 변경 파일 추출
- 중복 제거
- HEAD 최신 파일 추출
- Mapping Rule 적용
- 배포 파일 개별 선택
- Deploy Package 생성
- TXT / JSON Export

## 제외

- Git Push
- Git Pull
- Git Merge
- GitLab 연동
- GitHub 연동
- FTP/SFTP
- Jenkins 연동
- 운영 서버 배포

---

# 12. 구현 원칙

1. Commit은 파일을 식별하기 위한 용도로만 사용한다.
2. 실제 복사되는 파일은 항상 기준 Branch HEAD의 최신 버전이다.
3. Merge/Rebase 전략에 의존하지 않는다.
4. Git History를 복원하지 않는다.
5. Deploy Package 생성까지만 책임진다.
6. 망 분리 환경에서 안정적으로 사용할 수 있도록 인터넷 연결 없이 동작해야 한다.
