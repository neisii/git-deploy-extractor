# Git Deploy Extractor 상세 설계 문서

> **현행 기준: v0.7.0**(2026-09-24 RT-60 문서 동기화로 갱신). §12·§13·§16은 옛 구조 설명이 남아있는 부분 역사적 기록이니 각 섹션 상단의 정정 안내를 먼저 확인하라 — 현재 설계는 §18(신규).

> Version: 0.1
> Status: Draft
> 기준 문서: REQUIREDMENT.md, ARCHITECTURE.md

이 문서는 ARCHITECTURE.md 7번(오픈 이슈)에서 상세 설계로 이관된 항목을 확정한다.

---

# 0. 구현 원칙 (새로 이 문서를 읽는 모든 세션/구현자 필독)

## 0.1 Git·외부 도구 동작에 대한 주장은 반드시 재현 테스트로 검증한다

기억, 문서, 일반 상식만으로 git 명령어나 외부 도구의 동작을 단정하지 않는다. 실제로 임시 git 저장소 등을 만들어 재현 가능한 테스트로 확인한 뒤에만 설계/구현에 반영한다.

**이 원칙이 왜 필요한지 실제 사례 2건**:
- §3.3: `diff-tree -m`이 "병합 커밋을 첫 번째 부모 기준으로 diff한다"고 잘못 서술했던 초안이 있었다. 실제로는 **모든 부모 각각과** diff하는 옵션이라 부모가 2개면 결과가 왜곡될 수 있었다. 재현 테스트로 발견하고 `<commit>^1 <commit>` 방식으로 교체했다.
- §3.2: `--since`/`--until`에 시간 없이 날짜만 주면 git이 그 날짜의 자정이 아니라 **명령 실행 시점의 시:분:초**를 붙여서 경계로 쓴다는 사실을 재현 테스트로 발견했다. 문서나 기억만 믿었다면 발견하지 못했을 함정이다.

두 사례 모두 "그럴듯하게 들리는 설명"이 실제로는 틀렸던 경우다. 이 문서에 적힌 git 명령어라도, 새로운 플래그를 추가하거나 다른 방식으로 응용할 때는 다시 검증한다.

## 0.2 REQUIREDMENT.md에 없는 것을 임의로 설계하지 않는다 (과설계 방지)

"나중에 필요할 수도 있으니까", "이렇게 하면 더 유연해지니까" 같은 이유로, 요구사항에 없는 확장성·일반화를 미리 설계·구현하지 않는다. 실제로 요구된 것만 만든다.

**이 원칙이 왜 필요한지 실제 사례**:
- §1.1: Mapping Rule을 처음엔 glob 패턴(`**`) + `{rest}` 캡처·치환을 지원하는 범용 템플릿 엔진으로 설계했다. 하지만 REQUIREDMENT.md 어디에도 디렉터리 단위 리매핑이 필요하다는 근거가 없었다 — 실제 필요는 "경로 하나를 다른 경로로 바꾸는" 1:1 override뿐이었다. 뒤늦게 발견해 단순화했다.

REQUIREDMENT.md·DR-XXX에 명시된 요구만 구현 대상이다. 요구사항 문구가 모호하거나 이 문서에 없는 케이스를 만나면, **임의로 판단해서 "개선"하지 말고 먼저 질문한다.** 이 프로젝트는 처음부터 지금까지 애매한 지점(Java 경로 구조, WEB-INF 처리, Rename 처리, Deploy Files 체크박스 상호작용, Build 버튼 의미 등)을 임의로 짐작했다가 전부 정정된 이력이 있다 — 짐작보다 질문이 항상 더 빨랐다.

---

# 1. Mapping Rule 스펙

## 1.1 매핑 결정 알고리즘

ARCHITECTURE.md 4.3에서 정의한 "기본값 identity, 예외만 Mapping Profile로 override" 원칙을 실행 가능한 알고리즘으로 정의한다.

**정정**: 이전 초안은 Mapping Rule을 glob 패턴(`**`) + `{rest}` 캡처·치환을 지원하는 범용 템플릿 엔진으로 설계했다. 하지만 REQUIREDMENT.md 전체에서 디렉터리 단위 리매핑이 실제로 필요했던 사례는 한 번도 없었고, DR-010이 요구하는 건 "기본 구조와 다른 배포 경로가 필요한 경우"에 대한 override일 뿐이다. 검증되지 않은 확장성을 미리 설계에 넣은 것이므로, **경로 하나하나를 정확히 지정하는 1:1 override 테이블**로 단순화한다. 와일드카드/패턴 매칭은 없다.

```
function resolveServerPath(localPath, mappingProfile):
    if match(localPath, "src/main/java/**"):
        return localPath                          # DR-011, override 테이블 조회 안 함
    if match(localPath, "src/main/resources/**"):
        return localPath                          # DR-012, override 테이블 조회 안 함

    override = mappingProfile.overrides.find(o => o.from == localPath)   # 대소문자 구분, 정확히 일치할 때만
    if override:
        return override.to

    return localPath                               # override 없음 → 기본값 identity
```

**대소문자 구분 (확정)**: `from == localPath` 비교는 항상 대소문자를 구분한다. 배포 대상인 내부망 서버가 대소문자를 구분하는 환경이므로, 매칭도 동일하게 구분해야 한다. 구현 시 대소문자를 무시하는 비교 함수(예: `toLowerCase()` 정규화)를 쓰지 않도록 주의한다 — 자세한 배경은 §4 참고.

`match(localPath, "src/main/java/**")`의 `**`는 사용자 설정이 아니라 DR-011/012에 고정된 두 구조적 접두사(`src/main/java/`, `src/main/resources/`)를 가리키는 표기일 뿐, Mapping Profile이 다루는 대상이 아니다.

**결정**: `.java`, `src/main/resources/**`는 Mapping Profile을 아예 조회하지 않는다 — Profile에 실수로 이 경로에 대한 override를 추가해도 무시된다(DR-011/012는 하드 규칙). 그 외 경로는 override가 없으면 기본값도 identity다. 즉 Mapping Profile은 "예외 경로를 하나씩 나열하는 opt-in 설정"이며, 비워두면 전체가 identity mapping으로 동작한다.

## 1.2 Override 데이터 구조

```ts
interface MappingOverride {
  from: string;   // 정확한 Local Path (저장소 루트 기준 상대경로, 와일드카드 없음)
  to: string;     // 정확한 Server Path
  description?: string;
}
```

**검증 규칙**: 같은 프로필 안에서 `from` 값은 중복될 수 없다(로드 시점에 거부). `to` 값이 우연히 겹치는 경우(서로 다른 두 override가 같은 target을 가리켜 배포 패키지에서 덮어쓰는 경우)는 자동 검증하지 않는다 — 목록이 사람이 직접 작성하는 명시적인 짧은 표라서, 발생하면 리뷰 과정에서 바로 눈에 띄는 실수이기 때문이다.

## 1.3 Profile 저장 포맷

**저장 위치**: Electron `app.getPath('userData')/profiles/<profileName>.json` (프로필 1개 = 파일 1개, 디렉터리 목록으로 프로필 목록 UI 구성)

- macOS: `~/Library/Application Support/git-deploy-extractor/profiles/`
- Windows: `%APPDATA%/git-deploy-extractor/profiles/`

**스키마**:

```json
{
  "profileName": "contract2-prod",
  "version": "1.0",
  "overrides": [
    {
      "from": "config/deploy-only.properties",
      "to": "config/override/deploy-only.properties",
      "description": "예: 사내망 전용 설정 파일을 별도 경로로 배치해야 하는 경우"
    }
  ]
}
```

`overrides`가 빈 배열이면 순수 identity mapping 프로필이며, MVP의 기본 프로필(예: `default`)은 이 형태로 제공한다.

**최초 실행 시드**: 앱 최초 실행 시 `profiles/` 디렉터리가 비어 있으면 `overrides: []`인 `default.json`을 자동 생성한다. 이 시드 로직은 Main Process 시작 시 1회 실행한다.

---

# 2. Export 포맷

**정정(2026-09-24 문서 동기화, RT-57/U-17)**: 세 파일(`deploy-files.txt`·`delete-list.txt`·`deploy-summary.json`)이 `extract-list.txt` 하나로 통합됐다(REQ-010 정정). 아래는 이 파일 하나의 포맷이다.

## 2.1 extract-list.txt

`src/main/package/extractListText.ts`의 `buildExtractListText()`가 생성한다. 사람이 읽기 좋은 고정폭 텍스트이며, 배포 대상 파일과 삭제 대상 파일을 각각 **폴더 트리**로 표현한다(UI의 TreeList와 같은 트리 빌드 로직 재사용 — 단일 자식 폴더 체인은 한 줄로 병합).

```
================================================================
 Extract 목록
 생성 시각   : 2026-08-04 09:12:00 +09:00
 기준 브랜치 : contract2/main
 원본 커밋 (2개)
   b61e2ab  2026-07-30 11:02  hong  guarantee html
   8dd9e91  2026-07-30 11:40  hong  guarantee backend
================================================================

================================================================
 배포 대상 파일 (18개)
================================================================
src/main/
├── java/com/example/sell/interfaces/receipt/controller/
│   └── GuaranteeListController.java
└── resources/
    ├── static/js/guarantee/
    │   └── list.js
    └── templates/guarantee/
        └── list.html

================================================================
 삭제 대상 파일 (2개)
================================================================
old.js
src/main/java/com/example/sell/interfaces/receipt/controller/
└── GuaranteeController.java
```

| 구간 | 설명 | 대응 |
|---|---|---|
| 머리말 | 생성 시각, 기준 브랜치, 선택된 커밋 이력(최대 10개 표시, 초과 시 "… 외 N개") | REQ-004 |
| 배포 대상 파일 트리 | Export 시점 기준 Extract 대상 중 **활성 파일 패턴에 걸리지 않는** 파일만(Server Path 기준, REQ-026) | REQ-005~008, REQ-011 |
| 삭제 대상 파일 트리 | DR-007. Rename으로 인한 삭제와 구분하지 않는다(DR-008) — 배포 대상 파일 트리의 Added 파일과 함께 보고 사용자가 직접 판단 |

**정정(Rename 처리 단순화, 2026-08-04)**: 삭제 대상 트리는 Rename의 "이전 이름"에 대한 주석을 달지 않는다 — DR-008에 따라 도구 자체가 그 삭제가 Rename 때문인지 알지 못한다(`--find-renames` 미사용).

**인코딩/줄바꿈 결정**: UTF-8(BOM 없음), LF(`\n`) 줄바꿈으로 고정한다. Windows에서 생성하더라도 CRLF를 쓰지 않는다 — 내부망 git이 이 파일을 그대로 diff/commit할 때 줄바꿈 문자로 인한 불필요한 변경이 발생하지 않도록 하기 위함이다.

---

# 3. Git 연동 설계

## 3.1 공통 실행 규칙

모든 git 호출은 아래 규칙을 따른다.

- `-C <repoPath>` 로 대상 저장소 명시 (process cwd 변경 대신)
- `-c core.quotepath=false` 항상 추가 — 비-ASCII(한글) **파일명**이 8진수로 이스케이프되는 것을 방지
- `git log`/`diff-tree` 등 커밋 메시지를 포함하는 명령에는 `--encoding=UTF-8`을 항상 추가 — **커밋 메시지 내용**은 파일명과 별개 문제다. 과거 `i18n.commitEncoding=euc-kr`로 설정된 환경에서 만들어진 커밋이 섞여 있으면 원본 바이트가 EUC-KR일 수 있는데, 이 플래그가 git 스스로 UTF-8로 재인코딩해서 출력하게 만든다. (일반 `LANG`/`LC_ALL` 환경변수는 git 자신의 안내 메시지 로케일에만 영향을 주고 `--pretty=format` 출력 인코딩을 보장하지 않으므로 근본 대책이 아니다 — 이전 초안의 착오를 이번 검토에서 수정함)
- stdout/stderr는 buffer로 받아 명시적으로 `utf8`로 디코딩 (OS 로케일에 의존하지 않음)
- **인자는 항상 배열로 전달**한다 (Node `execFile`/`spawn`, 셸 문자열 조합 금지). Commit 검색어(REQ-003 Search)처럼 사용자 입력이 그대로 git 인자가 되는 경로가 있으므로, 셸을 거치는 `exec`류를 쓰면 명령 인젝션 위험이 생긴다.

```ts
interface GitCommandResult { stdout: string; stderr: string; exitCode: number; }
function runGit(repoPath: string, args: string[]): Promise<GitCommandResult>
// 구현은 반드시 execFile('git', args, { cwd: repoPath }) 형태 — exec(command: string) 금지
```

## 3.2 기능별 명령어 매핑

| 기능 | 명령 | 대응 요구사항 |
|---|---|---|
| Repository 유효성 검사 | `git -C <repo> rev-parse --is-inside-work-tree` | REQ-001 |
| Branch 목록 | `git -C <repo> for-each-ref --format="%(refname:short)" refs/heads/` | REQ-002 |
| Commit 목록 (페이지네이션) | `git -C <repo> log <branch> --since="<startDate>T00:00:00" --until="<endDate>T23:59:59" --encoding=UTF-8 --pretty=format:"%H%x1f%an%x1f%ad%x1f%s%x1e" --date=iso-strict --skip=<offset> -n <min(pageSize, maxCount-offset)>` | REQ-003 |
| Commit 검색 | `git -C <repo> log <branch> --since="<startDate>T00:00:00" --until="<endDate>T23:59:59" --encoding=UTF-8 --grep=<term> -i --pretty=format:"%H%x1f%an%x1f%ad%x1f%s%x1e" --date=iso-strict` | REQ-003 (Search) |
| Commit별 변경 파일 | `git -C <repo> diff-tree --no-commit-id --name-status -r <commit>^1 <commit>` (root commit은 3.3 참고, `--find-renames` 미사용 — DR-008) | REQ-005, DR-005, DR-008 |
| HEAD 파일 내용 | `git -C <repo> show <branch>:<path>` | REQ-007, DR-003 |

**정정 (원격 추적 브랜치 제외, 2026-08-04)**: 이전 초안은 `refs/heads/`와 `refs/remotes/`를 모두 조회해 Branch 선택지에 원격 추적 브랜치(예: `origin/main`)까지 포함시켰다. 하지만 원격 추적 브랜치는 네트워크 호출 없이 로컬에 저장된 포인터일 뿐이라 "마지막 fetch 시점의 원격 스냅샷"이며, fetch가 오래됐으면 stale할 수 있다. 사용자가 이를 "로컬 기준"으로 착각해 오래된 내용을 추출할 위험이 있어, `refs/heads/`만 조회하도록 좁혔다.

필드 구분자로 `%x1f`(Unit Separator), 레코드 구분자로 `%x1e`(Record Separator)를 사용해 커밋 메시지에 포함될 수 있는 임의 문자(줄바꿈 포함)로부터 파싱을 안전하게 만든다. `%s`는 첫 줄(subject)만 포함한다 — REQ-003 목록에는 짧은 Message만 필요하므로 의도된 선택이다. Commit 검색도 현재 조회 기간(`startDate`~`endDate`) 밖의 결과를 보여주면 화면 다른 곳과 불일치하므로 동일하게 `--since`/`--until`을 적용한다.

**`--since`/`--until` 시간 명시 필수 (실측 확인, 2026-08-04)**: `--since`/`--until`에 시간 없이 날짜만 주면(`--since="2026-07-01"`), git은 그 날짜의 자정이 아니라 **명령 실행 시점의 시:분:초를 그 날짜에 붙여** 경계로 사용한다. 예를 들어 지금이 10:38이면 `--since="2026-07-01"`은 `2026-07-01T10:38:31`처럼 해석되어, 같은 날 그보다 이른 시각(예: 10:00)에 만들어진 커밋이 누락된다. 실제 저장소로 재현 확인함. 그래서 **`startDate`는 항상 `T00:00:00`을, `endDate`는 항상 `T23:59:59`를 붙여서** git에 전달해야 시작일~종료일 전체가 빠짐없이 포함된다(위 명령어들에 이미 반영).

## 3.3 Merge Commit 처리 (DR-005)

**정정**: 초안에서는 `diff-tree -m`이 "첫 번째 부모 기준 diff"를 만든다고 서술했으나 사실이 아니다. git 문서상 `-m`은 병합 커밋을 **모든 부모 각각과** diff하는 옵션이라, 부모가 2개면 diff 결과가 2세트 나와 파일 집합이 중복/왜곡될 수 있다. 이번 검토에서 발견해 아래로 교체한다.

**채택 방식**: 병합 커밋인지 여부와 무관하게, 선택된 커밋과 그 **첫 번째 부모** 두 트리를 직접 diff한다.

```
git -C <repo> diff-tree --no-commit-id --name-status -r <commit>^1 <commit>
```

이 방식은 병합 커밋이든 일반 커밋이든 동일한 명령 형태로 "커밋 하나당 변경 파일 집합 하나"를 계산하므로 Merge/Squash Merge/Rebase/Cherry-pick 여부와 무관하다는 DR-005 요건을 만족하면서, 별도 분기 로직도 필요 없다. `--find-renames`를 쓰지 않으므로(DR-008) 결과는 항상 A(추가)/M(수정)/D(삭제) 세 가지 상태로만 나온다.

**엣지 케이스 — Root Commit**: 저장소의 첫 커밋은 부모가 없어 `<commit>^1`이 존재하지 않는다. 이 경우 git의 empty tree 상수(`4b825dc642cb6eb9a060e54bf8d69288fbee4904`, 모든 git 저장소에서 동일)를 부모 대신 사용한다.

```
git -C <repo> diff-tree --no-commit-id --name-status -r 4b825dc642cb6eb9a060e54bf8d69288fbee4904 <commit>
```

**재검토 필요**: "첫 번째 부모 기준" 자체가 실제 프로젝트의 병합 전략(예: 배포 대상 변경사항이 두 번째 부모 쪽에만 있는 경우)과 맞는지는 실제 병합 커밋 사례로 검증이 필요하다.

## 3.4 Commit 목록 페이지네이션/캐싱

**REQ-003 기본값(최근 7일, 최대 100개)이 조회 범위 자체를 좁힌다.** "Branch 전체 이력을 무한 스크롤로 다 훑는다"는 이전 설계를 대체한다 — 기본값 상태에서는 `maxCount`(100)가 페이지 크기(100)와 같아 첫 페이지 한 번으로 끝나고, `--skip`을 아예 쓸 일이 없다.

- 페이지 크기: 100 (초기값, UI 스크롤 체감에 따라 조정 가능)
- Renderer가 스크롤 하단 도달 시 다음 페이지 IPC 요청 (`--skip` 증가), 단 누적 로드 개수가 `maxCount`에 도달하면 요청하지 않는다

**정정 (Main Process 메모리 캐시 계획 폐기, 2026-08-04)**: 이전 초안은 Main Process가 `(repo, branch, startDate, endDate, maxCount, skip)` 키로 조회 결과를 메모리 캐시해 동일 세션 내 스크롤 왕복 시 재조회를 막는 것을 계획했다. 하지만 실제 구현은 Renderer(Zustand 스토어)가 로드된 commits를 페이지 단위로 누적 보관하고, 다음 페이지 IPC는 "아직 로드하지 않은 페이지"에 도달했을 때만 요청한다 — 이미 로드한 페이지를 스크롤로 다시 보는 동작 자체가 IPC를 발생시키지 않으므로, Main Process 캐시가 막으려던 재조회가 애초에 일어나지 않는다. 같은 목표를 다른(더 단순한) 방식으로 이미 달성하고 있어 별도 캐시 계층은 만들지 않는다. 단, `startDate`/`endDate`/`maxCount`/검색어를 이전 값으로 되돌리는 경우는 이 대상이 아니며(그 경우 Renderer는 항상 초기화 후 재조회한다), 이는 실사용 근거가 없는 훨씬 좁은 케이스로 별도 최적화하지 않는다.

**성능 캐비어트(완화됨)**: `--skip`은 매 호출마다 HEAD부터 다시 그래프를 걸어야 하므로 깊은 히스토리에서 느려질 수 있다는 우려가 있었으나, `maxCount` 상한이 있는 이상 `--skip`은 최대 `maxCount`까지만 진행되고 그 이상 깊이 들어가지 않는다. 사용자가 `maxCount`를 크게 늘리는 경우(예: 수천 개)에만 여전히 유효한 우려이며, 그 경우엔 실제 저장소로 측정 후 필요 시 커서 방식(`git log <lastHash>..<branch>`)으로 교체한다.

---

# 4. Package Builder 구현 규칙

개발 환경 정보(2026-08-04 확인: 개발 장비 Windows 11, IDE는 JetBrains IntelliJ이며 Line separator 설정이 System-Dependent)를 반영해 두 가지를 확정한다.

## 4.1 대소문자 구분

**확정**: 모든 경로 비교(§1.1 Mapping Rule 매칭 포함)는 항상 대소문자를 구분한다. 배포 대상인 내부망 서버가 대소문자를 구분하는 환경이기 때문이다.

**리스크**: 개발 장비가 Windows 11(NTFS, 기본적으로 대소문자를 구분하지 않음)이다. Git 저장소 자체는 대소문자를 구분해서 저장하므로, 이론상 대소문자만 다른 두 경로가 서로 다른 파일로 존재할 수 있다. 이 경우 Package Builder가 `git-deploy-extracted/`에 파일을 쓸 때 로컬 파일시스템이 두 경로를 같은 파일로 인식해 하나가 다른 하나를 조용히 덮어쓸 수 있다.

**대응**: 파일을 쓰기 전, 계산된 배포 대상 경로 목록에서 대소문자만 다른 경로 쌍이 있는지 사전 검사한다. 발견되면 자동으로 진행하지 않고 즉시 에러로 중단하며 어떤 두 경로가 충돌하는지 사용자에게 보여준다(자동 덮어쓰기 금지 — DR-002 "정확하게 추출" 원칙에 따라 조용한 데이터 손실보다 명시적 실패가 낫다).

## 4.2 파일 쓰기 모드 (줄바꿈 보존)

**배경**: Windows + IntelliJ System-Dependent 조합이면 로컬에서 새로 저장되는 줄은 CRLF로 기록될 가능성이 높다. 다만 Package Builder는 파일 내용을 워킹트리가 아니라 `git show <branch>:<path>`(§3.2)로 읽는다 — 이 명령은 체크아웃 필터(`core.autocrlf`)를 거치지 않고 커밋된 blob 원본 바이트를 그대로 반환하므로, 우리 프로세스가 별도로 손대지 않는 한 원본 그대로 재현된다.

**확정**: Package Builder가 이 내용을 `git-deploy-extracted/` 하위에 쓸 때는 반드시 **binary/raw 모드**로 쓴다(Node.js에서 텍스트 모드로 쓰면 줄바꿈이 조용히 변환될 수 있음). 즉 git이 반환한 바이트를 그대로, 어떤 형태의 텍스트 처리(인코딩 재해석, 줄바꿈 정규화)도 거치지 않고 디스크에 옮긴다. 이 규칙은 §2.3의 UTF-8/LF 고정 규칙과는 별개다 — 그건 Export 산출물 3종(deploy-files.txt 등 메타데이터)에만 적용되고, 이 규칙은 복사되는 소스 파일 자체에 적용된다.

## 4.3 Export 경로 계산 및 덮어쓰기 확인 (REQ-012, DR-013, RISK_ISSUES.md §7.1)

**정정(2026-09-24 문서 동기화, RT-56/U-16)**: "선택 안 하면 저장소 루트가 기본값" 원칙을 폐지하고, 추출 위치 **방식**(폴더 생성/바로 추출)과 저장소 겹침 검증을 추가했다. 아래가 현재 설계다.

**deployDir 계산** (`src/main/package/buildPackage.ts`의 `getDeployDir(repoPath, exportParentDir, mode)`):

```
deployDir = mode === 'direct' ? exportParentDir : join(exportParentDir, 'git-deploy-extracted')
```

`exportParentDir`는 사용자가 OS 네이티브 폴더 다이얼로그(`package:browseExportDir` IPC)로 선택한 절대 경로다 — 더 이상 옵셔널이 아니다, 선택 전까지 `[Export]` 자체가 비활성화된다(REQ-012 정정). `mode`는 `'sub'`(기본값, 하위 폴더 생성) \| `'direct'`(바로 추출).

**저장**: `exportParentDir`는 `localStorage`(`gde:exportParentDir`), `exportMode`는 `localStorage`(`gde:exportMode`)에 저장되는 전역 설정이다(저장소 무관).

**저장소 겹침 검증(신규, `src/main/package/validateExportTarget.ts`)**: `package:validateExportTarget`(UI 즉시 피드백)과 `package:export`(Export 직전 재검증) 둘 다 아래 우선순위로 판정한다.

1. `NO_PATH` — 경로 미선택
2. `INSIDE_REPO` — 선택 위치가 저장소와 같거나 저장소 안의 하위 경로
3. `CONTAINS_REPO` — 선택 위치가 저장소를 포함(저장소가 그 하위에 있음)
4. `NOT_EMPTY`(`direct` 모드만) — 선택 경로가 비어 있지 않음

겹침 판정은 `fs.realpath`로 심볼릭 링크·정션·`.`/`..`를 해소한 뒤 문자열 비교한다(존재하지 않는 경로 꼬리는 존재하는 접두사까지만 realpath하고 이어 붙인다 — 아직 한 번도 Export하지 않은 새 경로일 수 있으므로). 대소문자 정책은 §4.1과 같이 OS 기본값(mac/win 무시, linux 구분)을 따른다.

**`NOT_EMPTY` 판정에서 OS 메타데이터 파일 제외(버그 수정, 2026-09-24)**: `deployDirHasContent(deployDir)`가 `fs.readdir` 엔트리 개수만으로 "비어 있음"을 판정하면, macOS Finder가 폴더를 열람하며 자동으로 남기는 `.DS_Store`(Windows는 `Thumbs.db`/`desktop.ini`) 때문에 실제로는 빈 폴더인데도 "비어 있지 않다"고 오판한다. `IGNORED_METADATA_FILES` 세트(`.DS_Store`·`Thumbs.db`·`desktop.ini`)에 속한 엔트리는 "내용물"로 치지 않도록 수정했다 — `entries.some(e => !IGNORED_METADATA_FILES.has(e))`. 이 함수는 `direct` 모드의 `NOT_EMPTY` 판정과 `sub` 모드의 덮어쓰기 확인(아래) 양쪽에서 공유되므로 둘 다 같이 고쳐진다.

**덮어쓰기 확인(DR-013, `sub` 모드만)**: `package:export` IPC 핸들러가 `buildPackage()`를 호출하기 전에 `deployDirHasContent(deployDir)`로 확인한다. 있으면 `dialog.showMessageBox`(`['취소', '계속']`, 안전한 선택지가 기본값)로 확인한다. `direct` 모드는 애초에 완전히 빈 폴더에서만 허용되므로(위 `NOT_EMPTY` 검증) 이 확인창 자체가 뜨지 않는다. 사용자가 "취소"를 선택하면 `buildPackage()`를 호출하지 않고 IPC가 `null`을 반환한다 — Renderer는 이를 에러가 아니라 "사용자가 명시적으로 중단함"으로 처리한다(`exportStatus`를 `'idle'`로).

**모듈 분리**: `getDeployDir`·`deployDirHasContent`를 `buildPackage()`와 별도로 export한다 — 덮어쓰기 확인/겹침 검증은 실제 파일 삭제/쓰기가 시작되기 전에 IPC 핸들러 레벨에서 먼저 판단해야 하므로다. `buildPackage.ts`는 여전히 Electron API(`dialog`)에 의존하지 않는 순수 fs 로직으로 유지한다.

**UI 파생 결정**: Mapping Profile 드롭다운은 여전히 FooterActionBar에서 숨겨져 있다(v0.6.0부터, `selectedProfile: 'default'` 내부 고정). `default` 프로필의 `overrides`가 항상 빈 배열이라 Server Path가 사실상 항상 Local Path와 같으므로, IncludedFilesPane/ExtractTargetsPane 모두 Local Path 단일 컬럼만 보여준다.

---

# 6. 의존성 완결성 검사 설계 (REQ-013, DR-014, RISK_ISSUES.md §7.2)

## 6.1 Java 파싱 도구

**선정**: `java-parser`(npm, chevrotain 기반, `prettier-java` 프로젝트가 실사용·유지보수 중). 대안으로 `java-ast`(antlr4ts 기반)를 함께 조사했으나, `java-parser`가 더 최근에 발행되었고(2025-08) 실제 프로덕션 도구(prettier-java)에 쓰이고 있어 신뢰도가 더 높다고 판단했다.

**재현 검증** (§0.1 원칙 적용): 실제로 패키지를 설치해 다음을 확인했다.
- 기본 필드 주입/생성자 주입, `@Component`류 stereotype 애노테이션, `implements`/`extends`(class·interface 양쪽), 제네릭(`List<Foo>`), 람다·스트림·`var` 등 실사용 Java 문법이 정상 파싱됨.
- 200회 반복 파싱 평균 약 0.4ms/파일 — 성능 문제 없음.

**알려진 트레이드오프**: `java-parser`의 전이 의존성(chevrotain 내부의 `lodash`/`lodash-es`)에서 `npm audit` 경고가 발생한다(moderate 4건, high 2건 — `_.template`/`_.unset`/`_.omit` 관련). 이 앱은 오프라인 로컬 데스크톱 도구이고, 취약 함수들은 chevrotain이 **자기 자신의 정적 문법을 빌드할 때만** 내부적으로 쓰는 것이지 사용자가 넘긴 Java 소스 텍스트가 그 경로를 타지 않는다 — 공격 표면이 사실상 없다고 판단해 감수하고 채택했다. 향후 `java-parser`/`chevrotain` 업스트림이 이 의존성을 정리하면 재검토한다.

**CST 순회 방식**: `java-parser`가 내보내는 CST 타입은 문법 규칙 하나하나가 `children`이 서로 다른 정밀 타입으로 좁혀진 형태다(수백 개 규칙 각각 별도 인터페이스). 이 프로젝트가 필요한 건 "이름이 X인 규칙을 재귀적으로 다 찾아서 Identifier 토큰만 모으는" 범용 순회이므로, `src/main/analysis/java/parseJavaFile.ts` 내부에서만 쓰는 느슨한 구조 타입(`AnyCstNode`/`AnyCstElement`)을 따로 정의하고 `parse()` 결과를 그 타입으로 한 번만 캐스팅한다. 이 파일 밖으로 노출되는 공개 타입(`ParsedJavaFile`, `JavaImport`, `JavaTypeInfo`)은 그대로 정확한 타입을 유지한다.

**재현으로 확인한 CST 구조 세부사항** (§0.1 — 기억/추측이 아니라 실제 파싱 결과로 확인):
- `unannType`은 `fieldDeclaration`에서는 직접 자식이지만 `formalParameter`(생성자 파라미터)에서는 `variableParaRegularParameter`를 한 단계 거쳐야 한다 — 두 구조를 각각 외우는 대신 재귀 탐색(`findAll`)으로 통일했다.
- 클래스 레벨 애노테이션은 인자가 있든 없든(`@Component` vs `@Component("name")`) 항상 `classModifier > annotation > typeName > Identifier` 형태로 동일하다.
- 필드/파라미터 타입, `implements`/`extends` 절 안의 식별자는 점(`.`)으로 이어진 qualified 이름이나 제네릭 타입 인자를 구조적으로 구분하지 않고, 그 부분트리 안의 모든 `Identifier` 토큰을 평평하게 모으는 방식(`collectIdentifiers`)으로 충분하다 — `List<Foo>` 같은 제네릭도 별도 처리 없이 `Foo`가 그대로 수집된다.

## 6.2 Base Package 감지

`@SpringBootApplication` 애노테이션이 붙은 클래스를 찾아 그 패키지를 기준 패키지로 삼는다(DR-014, 하드코딩 금지).

```
1. git grep -l -F "@SpringBootApplication" <branch> -- '*.java'   (저장소 전체, 후보 경로만 빠르게 좁힘)
2. 각 후보를 git show <branch>:<path>로 읽어 파싱, 실제로 클래스 레벨에
   @SpringBootApplication이 붙어 있고 package 선언이 있는지 확인
3. 확인된 결과가 정확히 1건이면 그 package를 기준 패키지로 채택
   0건 또는 2건 이상이면(모호함) 폴백 없이 기능 비활성화(applicable: false)
```

**소스 루트 계산**: 기준 패키지 문자열을 하드코딩된 `src/main/java/`에 그냥 이어붙이지 않고, `@SpringBootApplication` 클래스 파일의 실제 경로에서 "패키지 세그먼트 수 + 1(파일명)"만큼 뒤에서부터 잘라내 역산한다. 이 프로젝트가 이미 Spring 표준 구조를 전제하므로(DR-011/012) 실제로는 항상 `src/main/java`로 계산되지만, 문자열을 직접 박아넣지 않고 실제 파일 경로로부터 유도하는 쪽이 더 방어적이라고 판단했다.

**주의(fixture/테스트 작성 시 실수하기 쉬운 지점, RISK_ISSUES.md 결정 이력 #39로 재확인)**: 기준 패키지는 `@SpringBootApplication` 클래스가 선언된 **정확히 그 패키지**다 — 실제 Spring Boot의 기본 컴포넌트 스캔과 동일하게, 그 패키지의 **하위 패키지만** 스캔 대상이고 형제·조상 패키지는 대상 밖이다. 예를 들어 `Application.java`가 `com.example.sell.app`에 있고 나머지 코드가 `com.example.sell.interfaces.*`(형제 패키지)에 있으면, `interfaces.*` 전체가 인덱스 밖이라 참조 해석이 조용히 실패하고(§6.4 "그래도 모호하면 포기"가 아니라 애초에 후보 자체가 없음) 아무것도 missing으로 안 잡힌다 — 버그가 아니라 실제 Spring 프로젝트에서도 이 구조면 컴포넌트 스캔 자체가 안 되는 것과 같은 이치다. Fixture를 만들 때는 `Application.java`를 최상위 패키지에, 나머지 코드를 그 하위에 둬야 한다.

## 6.3 프로젝트 인덱스 (경로 ↔ FQN)

기준 패키지 경로 아래 `.java` 파일 목록은 `git ls-tree -r <branch> --name-only -- <prefix>`로 한 번에 가져온다(재현 테스트로 디렉터리 접두사 pathspec이 하위 전체를 재귀적으로 매칭함을 확인, §0.1). 각 파일의 FQN은 **내용을 읽지 않고 경로에서 바로 유도**한다(`sourceRoot` 기준 상대경로의 `/`를 `.`으로 치환) — Spring 표준 구조(파일 경로가 패키지·클래스명과 일치)를 전제하는 건 이 프로젝트 전체가 이미 하는 가정과 같다. 이 덕분에 기준 패키지 아래 파일 전부를 미리 파싱할 필요가 없다.

## 6.4 참조 해석(resolve) 전략

필드/파라미터 타입, `implements`/`extends`, import에서 뽑은 이름(항상 점 없는 단순 이름 — §6.1의 평평한 수집 방식 때문)을 프로젝트 내부 파일로 해석하는 순서:

```
1. 현재 파일의 import 목록에 명시적으로 있으면 그 FQN
2. 같은 패키지에 그 이름의 클래스가 있으면 그것 (Java 기본 규칙)
3. 프로젝트 전체에서 그 이름이 유일하면 그것
4. 여러 개 있으면 같은 패키지 후보로 좁혀서 유일해지면 그것
5. 그래도 모호하면 포기 (추측하지 않는다 — false positive를 만들 바엔 안 잡는다)
```

이 전략은 완전한 Java 심볼 해석(실제 컴파일러가 하는 classpath 기반 해석)이 아니라 실용적 근사치다. 5번 케이스(진짜 모호함)는 이론상 false negative가 될 수 있는 유일한 지점이지만, 기준 패키지 범위(단일 모듈) 안에서 같은 단순 이름이 서로 다른 패키지에 여러 번 존재하는 경우는 실무에서 드물다고 판단해 범위에서 제외했다(알려진 한계).

## 6.5 전이적 폐쇄 탐색 (BFS) + 구현체 탐색

포함된 파일(`deployFiles`) 중 `.java` 파일들을 시작점으로 BFS를 돈다. 각 파일을 파싱해서:
- import·`implements`·`extends`에서 뽑은 이름을 해석해 프로젝트 내부 파일이면 엣지로 추가
- 필드/생성자 파라미터 타입에서 뽑은 이름도 동일하게 해석해 엣지로 추가하되, 그 대상이 나중에 실제로 **인터페이스**로 확인되면 구현체 탐색을 트리거한다

구현체 탐색은 그 인터페이스의 단순 이름으로 `git grep -l -F <이름> <branch> -- <기준 패키지 경로>`를 돌려 후보를 빠르게 좁히고(사전 필터 — 주석이나 무관한 문자열 매치까지 섞여 들어올 수 있음), 각 후보를 실제로 파싱해서 **그 이름을 `implements`하고 있고 stereotype 애노테이션(`@Component`/`@Repository`/`@Service`/`@Controller`/`@RestController`/`@Configuration`)이 붙어 있는지** 확정 확인한다(DR-014, false positive 후보를 최종 필터링). 같은 인터페이스에 구현체가 여러 개 확인되면 전부 후보로 남긴다(모호성 처리, 하나로 확정하지 않음).

큐가 빌 때까지(더 이상 새 파일이 발견되지 않을 때까지) 반복하므로 깊이 제한 없는 완전 전이적 폐쇄가 된다. `git grep`은 인터페이스 단순 이름 단위로 결과를 캐싱해 같은 인터페이스가 여러 경로에서 재발견돼도 중복 호출하지 않는다.

**Java 파싱/조회 실패 처리**: 개별 파일이 파싱에 실패하거나(문법 오류, 지원하지 않는 문법) `git show`가 실패하면 그 파일만 건너뛰고 `parseWarnings`에 기록한다 — 전체 검사를 중단하지 않는다.

## 6.6 트리거 시점과 결과 반영

`[Preview]` 버튼 클릭 한 번이 Commit 분석·Mapping Rule 계산에 이어 의존성 검사까지 자동으로 체이닝한다(별도 트리거 버튼 없음 — TO-BE 와이어프레임에도 없음, UI_UX_SPEC.md §2.6 참고). 의존성 검사가 실패해도(예: 예외) 앞서 계산된 `summary`/`deployFiles`/`deleteList`는 그대로 유효하다 — 우측 "누락된 의존성" 패널에만 영향을 준다(best-effort 후속 단계).

**우측 패널 항목의 표시/추가 시맨틱**: 발견된 후보(`missingDependencies`)는 사용자가 체크/추가해도 목록에서 사라지지 않는다 — 좌측 "포함된 파일" 체크박스가 `included` 여부를 계속 보여주는 것과 동일하게, 우측도 "이미 `deployFiles`에 들어갔는가"를 체크 상태로 계속 보여준다. 개별 체크박스는 그 자리에서 즉시 `deployFiles`에 추가/제거하고, `[전체 추가]` 버튼은 아직 추가되지 않은 후보를 한 번에 전부 추가한다(모두 추가된 상태면 비활성화). 추가된 항목은 커밋 diff와 무관하게 HEAD 기준으로 포함되므로 `status: 'added'`로 기록한다(새로운 상태값을 추가하지 않고 기존 `DeployFileStatus` 재사용 — README.md "파일 추출 기준" 갱신 참고).

**알려진 한계**: 새 `[Preview]` 실행 시 `deployFiles`가 통째로 다시 계산되므로, 이전 Preview에서 수동으로 추가한 의존성 파일은 새 Preview 결과에 자동으로 이어지지 않는다(그 파일이 새 선택 커밋들의 diff에 실제로 포함되지 않는 한). RISK_ISSUES.md §6.1 케이스 E(개별 `included` 제외 상태가 재계산 시 초기화되는 것)와 같은 성격의 기존 한계이며, 같은 이유로 이번에도 해결하지 않고 문서화만 한다(범위 확대 방지, §0.2).

---

# 7. 분할 드래그 리사이즈 설계 (REQ-014, RISK_ISSUES.md §7.4)

**적용 대상 3곳**: (a) MainGrid의 CommitListPanel↔DeploymentPreviewPanel(가로), (b) DeployFilesPanel의 포함된 파일↔누락된 의존성(가로), (c) MainGrid 전체↔DeployFilesPanel 전체(세로, 결정 이력 #27로 추가). 공통 컴포넌트 `SplitPane`(`src/renderer/src/components/SplitPane.tsx`)으로 구현해 세 곳에서 재사용한다. `direction?: 'horizontal'|'vertical'`(기본 `horizontal`) prop으로 두 방향을 모두 지원하며, 세 번째 적용처(c)는 (a)를 그대로 자신의 `start`로 감싸 중첩시킨 형태다(App.tsx — `SplitPane(vertical)`의 `start`가 `SplitPane(horizontal, main-grid)`).

**Prop 이름**: `left`/`right`/`minLeftPx`/`minRightPx`(가로 전용 이름)를 방향 중립적인 `start`/`end`/`minStartPx`/`minEndPx`로 정정했다(결정 이력 #27) — 세로 방향을 지원하면서 "왼쪽/오른쪽"이라는 이름이 "위/아래"에는 맞지 않게 됐기 때문이다.

**비율 계산**: 시작 영역(가로: 왼쪽, 세로: 위)이 차지하는 비율(0~1)을 상태로 갖고, 가로는 `grid-template-columns`, 세로는 `grid-template-rows`에 `minmax(<minStartPx>px, <ratio*100>%) <handle두께>px minmax(<minEndPx>px, 1fr)`를 렌더링한다. `minmax()`가 각 영역의 최소 크기를 보장하고, 컨테이너의 `overflow-x`(가로)/`overflow-y`(세로) auto가 두 최소 크기의 합보다 컨테이너가 작아졌을 때의 안전망 역할을 한다(#22와 같은 패턴). 두 오버플로 축을 동시에 열지 않는다 — DeployFilesPanel §2.6에서 이미 실측으로 확인한 문제(하나만 열어야 헤더/스크롤이 어긋나지 않음)와 같은 이유다.

**드래그 처리**: RISK #21의 컬럼 리사이즈(`handleResizeStart`)와 같은 mousedown/mousemove/mouseup 패턴을 재사용하되, mouseup에서도 mousemove와 **같은 계산 함수**로 마지막 좌표를 한 번 더 계산해 확정값을 저장한다 — 드래그 시작 시점에 캡처된 클로저가 최신 상태를 못 따라가는 stale closure 문제를 피하기 위함이다(React state 대신 매번 좌표에서 직접 재계산). 세로 방향은 `clientX`/`rect.left`/`rect.width` 대신 `clientY`/`rect.top`/`rect.height`를 쓰는 것만 다르다.

**영속화**: `localStorage`에 세 경계선을 별도 키(`gde:splitRatio:mainGrid`, `gde:splitRatio:deployFiles`, `gde:splitRatio:commitsVsFiles`)로 저장한다 — 컬럼 폭 저장과 같은 전역 패턴(저장소별 구분 없음).

**MainGrid 기본값**: 결정 이력 #22의 80:20 고정값을 `defaultRatio={0.8}`(및 기존 `minStartPx=320`/`minEndPx=180`)로 그대로 이어받았다 — 이제 이 값은 "초기 기본값"일 뿐이고 사용자가 드래그로 바꿀 수 있다(#22를 대체).

**DeployFilesPanel 분할 기본값**: 50:50(§7.2 point 8), 최소 폭은 양쪽 다 260px로 정했다 — 이 구현 세션에서 새로 결정한 값이다(RISK_ISSUES.md §7.4가 "§7.2 분할은 구현 시 결정"으로 위임한 부분). 두 컬럼 다 비슷한 성격(파일 경로 목록)이라 MainGrid처럼 비대칭 근거가 없어 대칭으로 뒀고, 어차피 컬럼 자체도 가로 스크롤이 기본값이라(§7.2 point 8) 260px는 "읽기 불가능하게 좁아지지 않을 정도"의 여유치일 뿐이다.

**MainGrid↔DeployFilesPanel 세로 분할 기본값(결정 이력 #27)**: 50:50, 최소 높이는 위/아래 각각 140px. 처음에는 200px로 잡았으나, 앱 기본 창 크기(900×760, `src/main/index.ts`)로 재현 테스트한 결과 이 두 영역이 실제로 쓸 수 있는 높이가 391px뿐이었다 — `minmax(200px, …) + 8px + minmax(200px, …) = 408px > 391px`가 되어 드래그 가능 범위가 완전히 0으로 붕괴하는(항상 정확히 50:50에 고정되어 버리는) 문제를 실측으로 발견했다(§0.1). 140px로 낮춰 기본 창 크기에서도 실제로 드래그할 수 있는 여유(391 − 288 = 103px)가 생기는 것을 재현 테스트로 확인했다.

**핸들 두께(결정 이력 #27)**: 처음엔 그리드 트랙 자체가 6px(가로 전용, 굵어 보임)였고 거기에 `.split-pane`의 `gap: 8px`까지 겹쳐 영역 사이에 실질적으로 22px가 낭비되고 있었다. 사용자 피드백으로 실제 목록에 쓸 수 있는 공간을 늘리기 위해 재설계했다 — 그리드 트랙(`HANDLE_HIT_PX`)은 마우스로 잡기 편하도록 8px를 유지하되, `gap`은 0으로 없애고, 트랙 안에는 시각적으로 2px 두께의 막대(`.split-pane__handle-bar`)만 중앙에 그린다. 결과적으로 영역 사이 낭비 폭이 22px → 8px로 줄었고, 시각적으로는 2px로 얇아 보인다.

**중첩 시 CSS 선택자 함정(재현으로 발견, §0.1)**: 세로 SplitPane(c) 안에 가로 SplitPane(a)이 중첩되면서, `.split-pane--horizontal .split-pane__handle-bar`/`.split-pane--vertical .split-pane__handle-bar`처럼 방향별로 다른 폭/높이를 주는 규칙을 **후손 선택자**로 작성했더니 중첩된 가로 인스턴스의 막대가 (자신을 감싸는) 세로 인스턴스의 규칙까지 같이 매치되어, CSS 소스 순서상 나중에 나온 세로 규칙이 방향과 무관하게 모든 막대를 덮어써버리는 버그가 실제로 재현됐다(가로 막대가 얇은 세로줄이 아니라 굵은 가로줄로 렌더링됨). `>` 자식 결합자(`.split-pane--horizontal > .split-pane__handle > .split-pane__handle-bar`)로 "가장 가까운 SplitPane"만 정확히 스코프해서 해결했다 — 후손 선택자는 임의 깊이의 조상까지 다 매치한다는 걸 실측으로 재확인한 사례.

---

# 8. 커밋 선택 유지/초기화, 키워드 검색 설계 (REQ-003/015, DR-015, RISK_ISSUES.md §6.1/§7.3)

## 8.1 선택 유지/초기화 (DR-015)

`loadCommitsFirstPage(keepSelection = false)`가 Renderer(`commitsSlice.ts`)의 모든 커밋 재조회 경로의 단일 진입점이다. 호출자가 `keepSelection`을 명시적으로 넘긴다.

| 호출자 | keepSelection | 근거 |
|---|---|---|
| `browseRepository()` | `false`(기본값) | DR-015 예외 (a) — 다른 저장소 |
| `setBranch()` | `false`(기본값) | DR-015 예외 (b) — 다른 Branch |
| `reloadRepository()` | **`false`**(정정, 2026-09-24 RT-47/RT-55·U-15) | Reload가 조회 조건·분석 결과까지 전부 기본값으로 되돌리는 동작으로 바뀌면서, 선택도 함께 지우는 세 번째 예외가 됐다(§8.1 정정 참고) — `resetQuery()`·`clearSelection()`도 함께 호출 |
| 키워드/작성자/해시/기간/최대 개수 변경, `triggerSearch()` | `true` | 검색 조건만 바뀜 — REQ-015가 유지를 요구하는 대상 |

`keepSelection=false`일 때만 `set()` 페이로드에 `selectedHashes: new Set()`을 포함시키고, `true`면 아예 그 필드를 생략해 기존 `Set`을 그대로 둔다.

**정정(Reload 전체 초기화, 2026-09-24, RT-47/RT-55)**: 예전엔 Reload가 "같은 저장소를 다시 읽는 것뿐"이라 DR-015 예외 (a)/(b) 어느 쪽도 아니라고 보고 선택을 유지했다. 하지만 Reload 시점에 분석 결과(Extract 대상 포함)가 폐기되는데 선택만 남아있으면 화면과 실제 상태가 어긋나 보이는 문제(결정 이력 #33과 같은 유형)가 있어, `reloadAll()`이 `resetQuery()`(조회 조건을 REQ-003 기본값으로) + `clearSelection()` + `loadCommitsFirstPage(false)`를 순서대로 호출하도록 바꿨다. 유지되는 것은 파일 패턴(REQ-026)·Export 경로·화면 접힘 상태·SplitPane 비율뿐이다.

**Preview 관련 상태는 keepSelection과 무관하게 항상 리셋된다**(`summary`/`deployFiles`/`deleteList`/`warnings`/`analyzedSelection`/의존성 상태). `commits` 목록 자체가 매번 새로 로드되므로, `selectedHashes`가 그대로여도 "마지막 Preview가 지금 선택과 일치하는가"는 항상 다시 확인시킨다 — `isStale`이 즉시 true가 되어 사용자가 `[Preview]`를 다시 눌러야 한다.

## 8.2 레이스 컨디션 가드 (§6.1 케이스 C)

`runAnalysis()`가 IPC 응답을 받은 시점에, 요청을 보낸 시점의 선택(`requestSelection`)과 **현재** `selectedHashes`/`selectedBranch`가 여전히 같은지 확인한다(`selectionMatches()` — `selectIsAnalysisStale`과 비교 로직을 공유). 다르면(계산 중 사용자가 체크박스를 바꿨다면) 결과를 적용하지 않고 조용히 버린다. 이 가드는 메인 Preview 계산과 §6.6 의존성 체이닝 호출 양쪽에 동일하게 적용된다(성공/실패 경로 전부). RT-11(R2)로 커밋 조회 자체에도, RT-17(R4·R5)로 분석 요청에도 같은 세대 비교 패턴(`lib/requestGuard.ts`의 `createRequestGuard`)이 적용됐다 — 자세한 근거는 §8.2 정정 참고.

**정정(요청 ID 가드 공용화, 2026-09-24 문서 동기화, RT-11/RT-17)**: 커밋 조회(`loadCommitsFirstPage`)와 분석 요청(Preview) 둘 다 "새 요청을 시작할 때 세대(generation) 번호를 증가시키고, 응답이 왔을 때 그 세대가 여전히 최신인지 비교" 패턴을 쓴다 — `lib/requestGuard.ts`의 `createRequestGuard()`가 이 로직을 한 곳으로 모았다. stale 응답은 상태 플래그(`loading`/`analyzing`)를 건드리지 않고 조용히 버려진다 — 무효화는 "응답이 도착했을 때"가 아니라 "선택이 바뀌는 시점"에 이미 새 세대가 발급되므로, 늦게 도착한 옛 응답은 자동으로 무시된다.

## 8.3 ~~파일명으로 커밋 검색 (REQ-016)~~ (폐기)

**폐기(2026-09-24 문서 동기화, 사용자 요청)**: REQ-016이 폐기되면서 이 절의 2단계 git 명령·`searchMode` 분기·모드 전환 라디오 UI가 전부 삭제됐다. 키워드는 이제 항상 커밋 메시지만 대상으로 한다(REQ-003 참고) — `git log --grep=<term> -i --extended-regexp`로 포함 키워드를 OR 결합하고, 제외 키워드(`-` 접두)에 매치되는 커밋을 결과에서 추가로 걸러낸다. `listTrackedFiles`/pathspec 관련 코드(`main/git/commits.ts`)는 삭제됐다 — 여전히 필요한 `listTrackedFiles` 소스는 AddFilesPopup(§13 정정)이 별도로 쓴다.

---

# 9. 결정 사항 요약

| 항목 | 결정 | 근거 | 재검토 필요도 |
|---|---|---|---|
| Mapping Profile 규칙 매칭 순서 | 배열 순서, 첫 매치 적용 | 구현/디버깅 단순성 | 낮음 |
| Rename 감지 여부 | Rename을 감지하지 않는다. Delete+Add로 그대로 처리 | DR-008 재정정(2026-08-04) — 이전엔 `#` 주석/`oldPath`로 추적했으나, "어떤 삭제/추가가 Rename인지는 Preview에서 사용자가 직접 보고 판단"하는 쪽이 로직이 더 단순하고 정확성 리스크(threshold 오탐)도 없앰 | 해결됨 |
| Export 파일 인코딩/줄바꿈 | UTF-8, LF 고정 | 내부망 git diff 노이즈 방지, 이번 세션 인코딩 이슈 재발 방지 | 낮음 |
| Merge Commit diff 방식 | `diff-tree <commit>^1 <commit>` 두 트리 직접 비교 | 1차 초안의 `-m` 옵션은 실제로 "모든 부모와 diff"라 오류였음 — 이번 검토에서 수정 | 중간 — 실제 병합 사례 검증 필요 |
| Root Commit(부모 없음) 처리 | git empty tree 상수와 diff | `<commit>^1`이 존재하지 않는 엣지 케이스 보완 | 낮음 |
| 커밋 메시지 인코딩 | `git log --encoding=UTF-8` 항상 사용 | 과거 EUC-KR 커밋 인코딩 설정 가능성 대응. 1차 초안의 `LANG`/`LC_ALL` 환경변수 의존은 근본 대책이 아니어서 대체 | 낮음 |
| Git 인자 전달 방식 | 배열 인자 + `execFile`(셸 미경유) | 커밋 검색어 등 사용자 입력이 git 인자가 되는 경로의 명령 인젝션 방지 | 낮음 |
| Mapping Rule 표현 방식 | glob/템플릿 엔진 → 정확한 경로 1:1 override 테이블로 단순화 | 실제로 필요했던 디렉터리 단위 리매핑 사례가 없었음(과설계 정정) | 낮음 |
| Commit 페이지 크기 | 100 | 초기 추정치 | 낮음 |
| Commit 조회 기본 범위 | 시작일=오늘-7일 / 종료일=오늘 / 최대 100개, 사용자 조정 가능 | Branch 전체 이력을 기본으로 다 훑지 않도록 조회 범위 자체를 좁힘(REQ-003), 2026-08-04 확정 | 해결됨 |
| `--since`/`--until` 시간 명시 | 항상 `T00:00:00`/`T23:59:59` 명시 | 시간 없이 날짜만 주면 git이 현재 시각을 그 날짜에 붙여 해석해 경계 커밋이 누락됨(실측 확인) | 해결됨 |
| 기본 Branch 자동 선택 | main 우선, 없으면 master | 매번 수동 선택하지 않도록, 2026-08-04 확정 | 낮음 |
| Branch 목록 대상 | `refs/heads/`만 조회, `refs/remotes/` 제외 | 원격 추적 브랜치는 fetch 시점의 로컬 스냅샷이라 stale할 수 있는데, 사용자가 "로컬 기준"으로 착각해 선택할 위험이 있음. 구현 단계에서 재정정(2026-08-04) | 낮음 |
| `--skip` 페이지네이션 성능 | 기본값(maxCount=100)에서는 사실상 미사용. `maxCount`를 크게 늘릴 때만 유효한 우려로 축소 | Commit 조회 기본 범위 축소로 완화됨 | 낮음 — `maxCount` 대폭 확장 시에만 재검토 |
| 경로 대소문자 구분 | 항상 대소문자 구분 비교, Package Builder 쓰기 전 충돌 사전 검사 | 내부망 서버가 대소문자 구분 환경. 개발 장비는 Windows 11(NTFS, 비구분)이라 로컬에서 덮어쓰기 위험 있음, 2026-08-04 확정 | 해결됨 |
| 소스 파일 쓰기 모드 | binary/raw 모드, 텍스트 처리 없음 | Windows+IntelliJ System-Dependent 환경이라 CRLF 가능성 높음. `git show`가 이미 autocrlf 미적용이라 원본 보존되지만, 쓰기 단계에서 텍스트 모드 사용 시 훼손 위험, 2026-08-04 확정 | 해결됨 |
| Export 결과물 위치(REQ-012) | 사용자가 부모 디렉터리 선택(네이티브 다이얼로그, 미선택 시 Export 불가) + 추출 위치 방식(폴더 생성/바로 추출) 선택 + 저장소 겹침 검증 | 결정 이력 #20(이름 고정)과 일관성 유지. **정정(2026-09-24, RT-56)**: "미선택 시 저장소 루트 기본값" 폐지, 방식 분기와 겹침 검증 추가(§4.3) | 해결됨 |
| 파일 패턴 제외+포함 통합(REQ-019→026) | §18 참고 | 제외 전용을 포함 모드까지 확장, 종류(경로/패키지/파일명) 자동 파생, 패턴 추가 입력을 별도 팝업으로 | 해결됨 |
| Extract 대상 이동 모델(REQ-011 정정) | §2.6(UI_UX_SPEC.md), §18 참고 | "체크 = 제외 토글"에서 "체크 = Extract 대상으로 실제 이동"으로 — 활성 패턴에 걸린 항목은 숨기지 않고 흐리게+태그 표시(조용한 누락 방지) | 해결됨 |
| `.DS_Store` 등 OS 메타데이터로 인한 NOT_EMPTY 오판(버그) | §4.3 참고 | `IGNORED_METADATA_FILES` 세트로 `.DS_Store`/`Thumbs.db`/`desktop.ini` 제외, 2026-09-24 사용자 보고로 발견·수정 | 해결됨 |
| Export 대상 폴더 덮어쓰기(DR-013) | 기존 내용 있으면 `dialog.showMessageBox`로 확인, 취소 시 중단·기존 내용 보존 | 조용한 데이터 손실 방지("정확하게 추출" 원칙). `package:export`가 취소 시 `null` 반환(`repository:browse` 취소 패턴 재사용), 2026-08-07 확정 | 해결됨 |
| Java 파싱 라이브러리(REQ-013) | `java-parser`(chevrotain 기반) 채택 | 실제 프로덕션 도구(prettier-java)가 쓰는 라이브러리, 재현 테스트로 실사용 Java 문법 파싱 확인. 전이 의존성 npm audit 경고(lodash)는 공격 표면 없다고 판단해 감수 | 낮음 — 업스트림이 lodash 의존성 정리하면 재검토 |
| Base package 감지(DR-014) | `@SpringBootApplication` grep 사전필터 + 파싱 확정, 못 찾거나 모호하면 비활성화 | 하드코딩 금지 원칙(결정 이력 #3) 준수, "단순화 우선" | 해결됨 |
| 심볼 참조 해석 모호성(DR-014) | import→같은 패키지→유일한 이름→같은 패키지 후보 순으로 시도, 그래도 모호하면 포기 | 완전한 classpath 기반 해석은 범위 밖(과설계 방지). 같은 단순 이름이 여러 패키지에 있는 극단적 케이스만 False Negative 가능성 있음(알려진 한계) | 낮음 |
| SplitPane 기본 비율/최소폭(REQ-014) | MainGrid 80:20(320px/180px, 결정 이력 #22 계승), DeployFilesPanel 50:50(260px/260px, 이번에 신규 결정) | MainGrid는 기존 비대칭 근거 유지, DeployFilesPanel 좌우는 동일 성격 콘텐츠라 대칭 + 가로 스크롤 안전망 존재 | 낮음 |
| 커밋 선택 유지 범위(REQ-015, DR-015) | Repository 전환·Branch 전환만 초기화, 그 외(Reload/검색/기간/개수)는 유지 | RISK_ISSUES.md §6.1 케이스 A/B를 사용자 확인 후 확정 — "다른 저장소/Branch 커밋이 섞이는 위험"만 예외로 남김 | 해결됨 |
| Preview 레이스 컨디션(§6.1 케이스 C) | IPC 응답 시점에 요청 시점 선택과 비교, 다르면 결과 폐기 | REQ-015로 검색 반복 워크플로우가 늘면서 노출 가능성도 같이 커진다고 판단해 이번에 같이 수정(사용자 확인) | 해결됨 |
| 커밋 목록 카운터 UI(§6.1 케이스 D) | **정정(2026-08-07)**: 추가함 — "N개 선택됨" 카운터를 CommitListPanel 헤더에 항상 표시 | 최초엔 "범위를 넘음"으로 판단했으나 AskUserQuestion 없이 임의 판단한 것이었고, 사용자가 직접 뒤집음(RISK_ISSUES.md 결정 이력 #31) | 해결됨 |
| Preview 재계산 시 included 상태(§6.1 케이스 E) | 수정하지 않음(기존 동작 유지) | 이번 기능이 만든 문제가 아니고, 고치려면 범위가 커짐 — 알려진 한계로만 문서화 | 알려진 한계 |
| 파일명 커밋 검색 pathspec(REQ-016) | `git log ... -- <path1> <path2> ...`, 매치 0건이면 git 호출 자체를 생략 | `--` 뒤 경로가 없으면 "필터 없음"으로 해석되어 전체 커밋이 반환되는 함정을 재현 테스트로 발견 | 해결됨 |
| DeployFilesPanel 필터-무시 버그 | `toggleAllDeployFiles()`/`addAllMissingDependencies()`가 화면에 보이는 필터링된 목록이 아니라 자체적으로 다시 계산한(그마저도 검색어는 반영 안 하는) 대상을 토글 — 검색어로 좁혀놓고 전체선택/전체추가를 누르면 화면에 안 보이는 파일까지 건드림. 근본 수정: 필터 로직을 store에서 다시 계산하지 않고, `DeployFilesPanel.tsx`가 이미 계산한 화면 표시 목록(`includedItems`/`missingItems`)의 경로를 액션 함수 파라미터로 그대로 넘겨 단일 진실 공급원으로 통일 | 필터 로직이 컴포넌트(화면 표시용)와 store(토글 대상 계산용) 두 곳에 중복 구현되어 서로 어긋난 것이 원인 — 코드 리딩으로 발견(RISK_ISSUES.md 결정 이력) | 해결됨 |
| 업데이트 확인 UI 배지(REQ-017, DR-016) | §10 참고 | GitHub Release 알림 신규 설계 | 해결됨 |
| 저장소/브랜치 요약 라벨(REQ-018, DR-017) | §11 참고 | 로컬 폴더명 대신 git remote 기반 "진짜" 이름 표시, 별도 행(TitleBar) 대신 RepositoryPanel 경로 왼쪽으로 합침, 앱 이름 접두어 제거 | 해결됨 |
| 배포 대상 파일 제외 패턴(REQ-019, DR-018) | §12.1 참고 | 검색(포함 필터, 일시적)과 역할이 다른 제외 필터(지속적) 신규 설계. Playwright로 등록/토글/재실행 유지/Export 실제 제외까지 검증 | 해결됨 |
| DeployFilesPanel 가상 스크롤 중첩 가로 스크롤(300개 초과 시) | §12.2 참고 | react-window 내부 루트가 자체 `overflow-x` 컨텍스트를 갖는 게 원인 — 재현 테스트로 정확히 300개 초과 시에만 발생함을 확인, `style` prop으로 수정 후 재검증 완료 | 해결됨 |
| 포함된 파일/누락된 의존성 선택 카운터(REQ-020) | §12.3 참고 | "선택 N/전체 N(필터 전 전체 N)" 세 숫자, 55개 fixture로 50개 초과 경고까지 검증 | 해결됨 |
| 전체 선택 체크박스 위치 이동 + 누락된 의존성 양방향화 | §12.4 참고 | 헤더 영역 → Local Path 컬럼 헤더 행(각 행 체크박스와 동일 x 위치)으로 이동, 우측 "전체 추가"(단방향 버튼)를 좌측과 동일한 "전체 선택"(양방향 체크박스)로 교체 | 해결됨 |
| 커밋 이력 필터링 조건 추가(REQ-022) | §14 참고 | 작성자(`--author -i`)/Merge 커밋 제외(`--no-merges`) 두 조건을 기존 검색과 AND 결합, 기본값은 필터 없음 | 해결됨 |
| 해시로 커밋 필터링(REQ-023) | §15 참고 | `git log --no-walk`로 붙여넣은 해시와 정확히 일치하는 커밋만 조회, 값이 있으면 다른 모든 조건 무시. 일부 해시 오류 시 `cat-file -e`로 개별 검증 후 유효한 것만 재시도 | 해결됨 |
| 제외 패턴 삭제(REQ-024) | §16 참고 | 칩을 토글용 버튼 + 삭제용 `×` 버튼 두 개로 분리(button 중첩 불가 제약), 삭제는 이력에서 완전히 제거 | 해결됨 |
| Merge 커밋 제외 기본값 변경 | §14.4 참고 | `excludeMerges` 렌더러 초기값을 `false`→`true`로 변경(사용자 요청) | 해결됨 |
| 작성자 필터 여러 명 지원 | §14.2/§14.3 참고 | `authors: string[]`로 변경, `--author` 반복 push로 git 기본 OR 활용. 해시 필터와 파싱 함수(`parseMultiValueFilter`) 공유 | 해결됨 |
| 작성자/해시 필터 UI 다듬기 | §14.5 참고 | 좌우 반반 배치(`flex: 1 1 320px`), 라벨 설명 문구를 placeholder로 이동 | 해결됨 |
| 포함된 파일 검색 와일드카드(REQ-025) | §17 참고 | `*`가 있으면 REQ-019와 같은 문법(단일 세그먼트)으로 파일명 전체 매치(대소문자 무관), 없으면 기존 부분 일치 유지 | 해결됨 |

---

# 10. GitHub Release 업데이트 확인 설계 (REQ-017, DR-016)

## 10.1 체크 흐름

```
Renderer 시작(스토어 생성 시점 — 컴포넌트 마운트 후가 아니라 초기 상태값 자체를 localStorage에서 동기적으로 읽어 채운다.
              splitRatio/columnWidths와 동일한 lazy initializer 패턴 — "깜빡임" 방지, §10.6)
  → localStorage(gde:lastUpdateCheck) 확인
  → 24시간 이내면: 캐시된 { hasUpdate, latestVersion, checkedAt }를 updateInfo 초기값으로 그대로 사용, 네트워크 호출 없음
  → 24시간 초과/없으면: 캐시된 값(있다면)을 updateInfo 초기값으로 우선 사용하면서, window.api.checkForUpdate() IPC 호출(Main)

Main: checkForUpdate()
  → app.getVersion()을 /^v?\d+\.\d+\.\d+$/로 검증(로컬 버전이 형식에 안 맞으면 즉시 { ok: false })
  → GET https://api.github.com/repos/neisii/git-deploy-extractor/releases/latest (타임아웃 5s)
  → 성공 + 응답이 { tag_name: string, ... } 형태로 파싱 가능 + tag_name이 같은 정규식 형식:
    hasUpdate(원격이 로컬보다 엄격히 큰지, §10.2)까지 Main에서 판정해 { ok: true, hasUpdate, latestVersion } 응답
    (**구현 시점 정정** — 애초엔 Renderer가 app.getVersion()과 비교하는 설계였으나, app.getVersion()이
    이미 Main에 있어 Renderer에 따로 노출할 이유가 없다는 판단으로 비교까지 Main에서 끝내는 쪽으로 단순화.
    §10.5에서 이미 "구현 시점에 더 단순한 쪽으로 정한다"고 열어둔 부분. RISK_ISSUES.md 결정 이력 참고)
  → 실패(네트워크/타임아웃/HTTP 에러/필드 없음/형식 불일치): { ok: false } 응답 — 예외를 던지지 않는다(§0.2, 실패는 정상 경로).
    5초 타임아웃이 있으므로 이 IPC 프라미스는 항상 유한 시간 내 resolve된다 — Renderer 쪽에 별도 타임아웃이 필요 없다.

Renderer: 응답 반영
  → 성공 시: updateInfo 갱신, localStorage 갱신(checkedAt=now)
  → 실패 시: updateInfo 변경 없음(직전 값 유지), localStorage 갱신 안 함(다음 트리거 때 재시도)
```

## 10.2 버전 비교

`tag_name`(`vX.Y.Z`)과 `app.getVersion()` 둘 다 `/^v?(\d+)\.(\d+)\.(\d+)$/`로 검증 후 `[major, minor, patch]` 정수 배열로 비교한다. 이 프로젝트는 항상 단순 `X.Y.Z` 형식만 태깅하므로(pre-release 접미사·빌드 메타데이터 없음) 범용 semver 파서는 과설계(§0.2) — 3개 정수 배열 비교로 충분하다. 단, 형식이 어긋나면(수동 태그 실수, GitHub API 응답 변경 등) 조용히 실패 처리하고 **크래시하지 않는다**.

**`hasUpdate`는 "다르다"가 아니라 "원격이 로컬보다 엄격히 크다"이다.** 로컬 버전이 GitHub 최신 릴리스보다 같거나 큰 경우(예: `package.json` 버전은 올렸지만 아직 태그/릴리스를 만들기 전 — 이번 프로젝트에서 실제로 여러 번 있었던 순서) 업데이트 없음으로 취급한다. `!==` 비교로 잘못 구현하면 이런 상황에서 "새 버전이 있다"는 오탐 배지가 뜬다.

## 10.3 트리거와 클릭 상호작용

| 트리거 | 캐시 확인 | 확인창 |
|---|---|---|
| 앱 시작 | 24시간 캐시 확인, 만료 시에만 호출 | 없음(백그라운드) |
| 버전 배지 클릭 | 캐시 무시, 항상 강제 호출 — **단, 이미 `updateChecking===true`(진행 중인 확인이 있음)면 새 네트워크 호출은 생략하고 기존 진행 중인 호출을 그대로 기다린다** | `dialog.showMessageBox`("GitHub 저장소를 여시겠습니까?", 버튼 `[아니오, 네]`) — **재확인 완료를 기다리지 않고 클릭 즉시** 표시. 단, **확인창이 이미 열려 있으면(연속 클릭) 다시 띄우지 않는다** — Electron 모달 스택 동작이 검증되지 않았고(§0.1), 연속 클릭 자체가 실수일 가능성이 높다 |

클릭 시 확인창과 강제 재확인은 서로 독립적인 두 흐름이다 — 확인창 문구가 버전 정보를 담지 않으므로 재확인 결과를 기다릴 이유가 없다("긴급 패치를 바로 인지해야 한다"는 사용자 요구, 2026-08-12). "네" 응답 시 `shell.openExternal('https://github.com/neisii/git-deploy-extractor/releases')`(항상 이 고정 인덱스 URL — 특정 릴리스 태그로 딥링크하지 않는다), "아니오"는 아무 동작 없음.

재확인이 진행되는 동안(트리거 무관) 버전 배지 옆에 로딩 스피너를 표시하고, 기존 배지 색/툴팁은 그대로 유지한다 — 완료되면 스피너가 사라지고 결과가 반영된다.

## 10.4 UI 상태 (RepositoryPanel 우측)

| 상태 | 배경 | title 툴팁 |
|---|---|---|
| 최신 버전 확인됨(로컬 ≥ 원격 포함) | 없음(투명) | "최신 버전입니다" |
| 새 버전 있음(원격 > 로컬) | 강조색(제안: `#d4ff00` 배경 / `#1a1a1a` 텍스트 — 구현 후 육안 조정 가능) | "새 버전으로 업데이트 하세요 (vX.Y.Z)" |
| 확인 실패, 직전 캐시 없음 | 없음(투명) | "업데이트 확인 실패 — 인터넷 연결을 확인하세요" |
| 확인 실패, 직전 캐시 있음 | 직전 상태 그대로 유지 | "업데이트 확인 실패 — 인터넷 연결을 확인하세요"(배경은 안 바뀜) |
| 재확인 진행 중(위 4가지 중 하나에 중첩) | 직전 상태 유지 | 직전 상태 유지 + 스피너 아이콘 추가 |

## 10.5 IPC/데이터 흐름 참고

`dialog.showMessageBox`/`shell.openExternal` 둘 다 Main process 호출이라, 클릭 핸들러는 Main에 확인창 요청과 강제 재확인 요청을 각각 보낼 수도 있고, 하나의 IPC 핸들러가 두 동작을 순차로 처리(확인창 → 그 다음 강제 재확인)할 수도 있다 — 어느 쪽이든 **확인창이 재확인 완료를 기다리면 안 된다**는 제약만 지키면 되므로, 실제 구현 시점에 더 단순한 쪽으로 정한다(§0.2, 과설계 방지).

`checkForUpdate` 응답에는 `html_url`(특정 릴리스 태그로의 딥링크)을 담지 않는다 — 클릭 시 항상 고정된 `.../releases` 인덱스 URL만 여는 걸로 확정했으므로(§10.3, 사용자가 원 지시에서 이 URL을 명시), 특정 태그 딥링크를 상태로 들고 있을 이유가 없다(§0.2, 안 쓰는 데이터를 만들지 않는다). 응답은 `{ ok: true; hasUpdate: boolean; latestVersion: string } | { ok: false }`로 충분하다.

**구현 시점 추가 — `app:getVersion` IPC**: 버전 배지는 캐시가 신선한 동안(하루 이내 재실행 등) `checkForUpdate`가 아예 호출되지 않는 경우에도 항상 `vX.Y.Z` 텍스트를 표시해야 한다. 이 표시용 현재 버전은 `checkForUpdate`의 응답에서 얻을 수 없으므로(그 IPC 자체가 호출 안 될 수 있어서), 별도의 작은 IPC(`app:getVersion` → `app.getVersion()`)를 추가했다 — 최초 설계에는 없던 채널이지만 §0.2 범위를 벗어나는 기능 추가는 아니고, "배지가 항상 버전을 보여준다"는 이미 확정된 요구(REQ-017)를 만족시키기 위한 구현 디테일이다.

## 10.6 알려진 제약 — 비인증 GitHub API 요청 제한 공유

비인증 GitHub API 호출은 IP당 시간당 60회로 제한된다. 여러 사용자가 같은 사내망 공인 IP(NAT/프록시)를 공유하는 환경에서, 출근 직후처럼 짧은 시간에 여러 명이 동시에 앱을 켜면 이 한계에 걸려 일부 사용자의 확인 요청이 조용히 실패할 수 있다. 실패는 이미 "조용히 무시, 직전 상태 유지"로 설계돼 있어 안전하게 저하되지만(에러가 노출되거나 다른 기능이 멈추지 않음), **그 사용자에게는 새 버전이 나와도 배지가 계속 평시 상태로 보일 수 있다는 뜻**이다. 인증 토큰을 앱에 내장하면 이 한계를 없앨 수 있지만, 이 정도 편의 기능에 토큰 배포·회전 인프라를 두는 건 과설계로 판단해 채택하지 않는다 — 알려진 한계로만 문서화한다.

---

# 11. 저장소/브랜치 요약 라벨 표시 설계 (REQ-018, DR-017)

**정정(2026-08-12, RISK_ISSUES.md 결정 이력 #38)**: 이 섹션은 원래 별도 컴포넌트(`TitleBar.tsx`, 앱 최상단 별도 행) 설계로 작성됐으나, 최종적으로 `RepositoryPanel.tsx`에 흡수되어 경로 텍스트 왼쪽에 같은 행으로 합쳐졌다 — `TitleBar.tsx`는 삭제됐다. §11.1~11.3(배경/파싱/조회 시점)은 그대로 유효하고, §11.4~11.5는 최종 위치 기준으로 갱신했다.

## 11.1 배경

TitleBar는 원래 `Git Deploy Extractor — {로컬 폴더명} / {브랜치}` 형식이었다. 두 가지 문제가 논의 중 드러났다:

1. "Git Deploy Extractor" 부분은 macOS/Windows 앱 창 제목에 이미 표시되는 텍스트와 중복이다. 다만 창 타이틀로 이 정보를 옮기는 대안(`win.setTitle()`)은 검토 후 기각했다 — mac 네이티브 풀스크린은 진입 시 타이틀바 자체가 사라지고(재현 테스트로 확인, `.scratch-fullscreen-steady.png`류 스크린샷), 커서를 올려 나타나는 화면 상단 바는 창의 타이틀이 아니라 macOS 전역 메뉴바(빌드 시점에 고정된 `CFBundleName`)라 동적 텍스트를 애초에 못 받는다 — 이 프로젝트가 v0.1.1에서 "dev 모드 메뉴바 앱 이름이 여전히 'Electron'으로 표시된다"를 실측으로 확인했을 때 이미 드러난 사실과 일치한다. 결국 in-app 요소로 유지하는 쪽으로 결론났다.
2. 로컬 폴더명은 사용자가 clone 시 임의로 바꿀 수 있어 "진짜" 프로젝트 이름과 다를 수 있다(예: `deep-backend`를 `shallow-backend`로 리네임).

## 11.2 remote URL 파싱

`getRemoteProjectName(repoPath)`(`src/main/git/repository.ts`):

```
git remote get-url origin
  → exit code 0: stdout(URL 문자열)에서 ".git" 접미사·끝 슬래시 제거 후
    "/"로 분리, 마지막 조각을 프로젝트 이름으로 사용
  → exit code ≠ 0(origin 없음 등) 또는 명령 자체 실패: null
```

재현 테스트로 세 가지 URL 형식 모두 확인:

| 형식 | 예시 | 파싱 결과 |
|---|---|---|
| HTTPS(.git 있음) | `https://github.com/org/deep-backend.git` | `deep-backend` |
| HTTPS(.git 없음) | `https://github.com/org/deep-backend` | `deep-backend` |
| SSH scp-like(GitLab 서브그룹) | `git@gitlab.internal:team/subteam/deep-backend.git` | `deep-backend` |

특정 호스트를 하드코딩하지 않는 범용 파싱이라 사내 GitLab 등 내부 서버에도 동일하게 동작한다.

**빌드 도구 설정 파일(Gradle `settings.gradle`의 `rootProject.name` 등)을 참조하는 대안은 검토 후 기각**했다 — 이 앱이 Java/Gradle 전용이 아니라 빌드 도구마다 다른 파일을 봐야 해 일반화가 안 되고, `settings.gradle`은 실행 가능한 스크립트라 정적 파싱이 불안정하며, 무엇보다 워킹트리에서 읽으면 GDE에서 **선택한 Branch**가 아니라 로컬에 실제 체크아웃된 Branch 값을 읽게 되는 위험이 있다 — §4.2가 이미 정한 "파일 내용은 워킹트리가 아니라 `git show <branch>:<path>`로 읽는다" 원칙과 상충한다. `git remote`는 브랜치와 무관한 저장소 레벨 정보라 이 문제 자체가 없다.

## 11.3 조회 시점과 실패 처리

`browseRepository()`/`reloadRepository()`에서 `listBranches()`와 함께 `Promise.all`로 동시 조회한다(순차 호출로 지연시키지 않음). `getRemoteProjectName`은 절대 throw하지 않고 실패 시 `null`을 반환하므로, 이 조회 실패가 저장소 전환 흐름 자체를 막지 않는다.

## 11.4 표시 규칙

`RepoLabel`(`RepositoryPanel.tsx`)이 `remoteProjectName`(store)과 `basename(repository.path)`를 비교해 렌더링을 분기한다:

| 상태 | 표시 |
|---|---|
| remote 이름 있음, 폴더명과 다름 | `{remote 이름} ({폴더명})` — 폴더명은 `.repository-panel__title-local`(`--ev-c-text-2`, 기존 보조정보 색 토큰 재사용) |
| remote 이름 있음, 폴더명과 같음 | `{remote 이름}`만(중복 표시 안 함) |
| remote 이름 없음(null) | `{폴더명}`만(기존 동작과 동일) |

Playwright로 세 상태 전부 실제 fixture 저장소(remote 다름/remote 없음/remote=폴더명)로 재현해 검증했다 — 스크린샷으로 색 구분(`rgb(199,199,207)` vs 기본 텍스트색)도 확인.

## 11.5 RepositoryPanel로 흡수 + 앱 이름 접두어 제거

**배치**: 별도 행이었던 TitleBar를 없애고, 그 내용(`{RepoLabel} / {브랜치}`)을 `RepositoryPanel`의 `.repository-panel__title`로 저장소 경로 텍스트(`.repository-panel__path`) **왼쪽**에 배치했다(`flex: 0 0 auto`, 경로 텍스트의 `flex:1` truncation을 방해하지 않음). "Git Deploy Extractor —" 접두어는 11.1의 결론에 따라 넣지 않는다.

**경로 텍스트 truncation 추가**: 라벨이 새로 붙어 행이 붐빌 수 있어, `.repository-panel__path`에 `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`을 추가했다 — 이전엔 이 규칙이 없어서(형제 요소인 `.footer-action-bar__export-path`엔 이미 있었음, 결정 이력 #19) 좁아지면 줄바꿈되는 잠재 버그가 있었는데 이번에 같이 고쳤다. 동시에 `title={repository.path}`로 hover 시 전체 경로를 보여준다.

Playwright로 최종 배치(라벨+경로가 한 행, TitleBar 요소 자체가 DOM에 없음)와 경로 텍스트의 computed style(`overflow:hidden`/`ellipsis`/`nowrap`)을 재현 검증했다.

---

# 12. DeployFilesPanel 개선 3건 설계 (REQ-019/020, DR-018, 2026-08-12) — 역사적 기록

> **정정(2026-09-24 문서 동기화, RT-40~53)**: 이 섹션이 설명하는 `DeployFilesPanel`/`FileListColumn`/`BulkAction` 구조는 P4 리팩토링으로 전면 교체됐다(IncludedFilesPane/ExtractTargetsPane/TreeList, UI_UX_SPEC.md §2.6). **아래 코드·컴포넌트 이름은 더 이상 저장소에 존재하지 않는다** — "왜 세 숫자 카운터 형식을 택했는가", "왜 전체 선택을 양방향으로 통일했는가" 같은 **설계 이유**는 지금도 유효해 그대로 남겨두지만(REQ-020은 지금도 같은 형식을 쓴다), 코드 경로를 그대로 믿고 따라가면 안 된다. 현재 설계는 §18을 참고.

기존 기능+신규 3건 전체 UI/UX 회귀 검증(결정 이력 #39) 직후 실사용 중 나온 개선 요구 3건. 전부 DeployFilesPanel(`FileListColumn`) 영역이라 한 섹션에 묶는다.

## 12.1 배포 대상 파일 제외 패턴 (REQ-019, DR-018)

**패턴 문법(DR-018 정정, 2026-08-20 — `*`만 지원, `**` 등은 백로그)**: `.gitignore` 관례를 따르되 지원 범위를 `*`(한 세그먼트 안에서만 매치, 슬래시를 못 넘음) 하나로 한정한다 — `/`가 없는 패턴은 파일명(경로 마지막 조각)에 매치, `/`가 있는 패턴은 경로 전체에 매치. 구현은 각 패턴을 정규식으로 변환해 판정한다(세그먼트 단위로 쪼갠 뒤 `*` → `[^/]*`, 나머지 리터럴 문자는 이스케이프 — 새 의존성 추가 없이 직접 구현). `**`(다중 세그먼트 와일드카드)·`!`(부정 패턴)·트레일링 슬래시 디렉터리 매치는 이번 범위에 넣지 않는다 — RISK_ISSUES.md 결정 이력 #42에 근거와 함께 백로그로 남겨둔다. 대소문자는 항상 구분한다(결정 이력 #8과 일관성).

**저장** (`src/renderer/src/lib/excludePatterns.ts`, `columnWidths.ts`/`updateCheckCache.ts`와 동일 패턴):
```ts
interface ExcludePatternEntry {
  pattern: string
  enabled: boolean
}
// localStorage 키: gde:excludePatterns
// 전역 공통 — 저장소별 구분 없음(exportPath.ts와 동일 이유)
```

**적용 위치**: `DeployFilesPanel.tsx`의 `includedItems` `useMemo` 체인에 상태 Filter → 활성 제외 패턴 → 파일명 검색 순서로 한 단계 추가한다(순서 자체는 전부 AND 조건이라 결과에 영향 없음, 계산량이 가장 적은 것부터 앞에 두는 정도의 최적화 여지만 있음).

**파생 계산 원칙 재확인(DR-018)**: `deployFiles[].included`를 직접 고치지 않는다 — Export 시점에 별도로 "활성 제외 패턴에 매치되는가"를 한 번 더 확인해 AND 조건으로 걸러낸다. `runExport()`가 이미 `deployFiles.filter(f => f.included)`로 대상을 추리는 지점에 `&& !matchesAnyActiveExcludePattern(f.localPath)`를 추가하는 정도로 충분하다. 이렇게 하면 패턴을 비활성화했을 때 해당 파일이 다시 보이면서 원래 `included` 값(대개 `true`)이 그대로 유지되어 있어 별도 복원 로직이 필요 없다 — REQ-019/DR-018 문서에서 이미 결정 이력 #33과 비교해 설명한 이유와 동일.

**UI**: 검색(파일명) 입력 아래 새 행 — 텍스트 입력 + `[+추가]` 버튼, 그 아래 이력 패턴들을 칩(chip) 형태로 나열(각 칩 클릭 시 `enabled` 토글, 활성 칩은 강조 표시). 새 패턴 추가 시 기본값 `enabled: true`.

**적용 범위**: "포함된 파일"에만(좌측 `FileListColumn` 인스턴스). "누락된 의존성"은 REQ-013 설계상 항상 `.java`만 나와 이 기능이 무의미하므로 `extraHeaderControl`처럼 이 인스턴스에만 별도 prop으로 내려준다(우측 인스턴스에는 전달하지 않음).

## 12.2 가상 스크롤 중첩 가로 스크롤 수정

**재현(§0.1)**: 롱패스 파일 450개(가상 스크롤 임계값 300 초과) fixture로 재현 — `.deploy-files-panel__body` 안에 react-window가 만드는 내부 루트 DIV가 `overflowX: auto`이면서 `scrollWidth(1199) > clientWidth(582)`로, 바깥 `.deploy-files-panel__scroll`과 별개로 자체 가로 스크롤 컨텍스트를 가짐을 실측 확인. 같은 fixture를 100개(임계값 미만)로 줄이면 이 내부 루트가 아예 생기지 않고 단일 스크롤 컨텍스트로 정상 동작 — 정확히 300개 초과가 트리거 조건임을 확인했다. 원인은 UI_UX_SPEC.md §2.6 "알려진 제약"에 이미 기록되어 있던 것과 같다: react-window가 세로 가상 스크롤을 위해 자기 루트에 `overflow-y:auto`를 설정하면 CSS 스펙상 `overflow-x:visible`과 함께 쓸 수 없어 `overflow-x`도 `auto`로 강제 승격된다.

**수정 방향(검증 완료, §0.1)**: `node_modules/react-window/dist/react-window.js`를 직접 읽어 확인한 결과, `List`가 렌더링하는 루트 요소는 `style: { position:'relative', maxHeight:'100%', flexGrow:1, overflowY:'auto', ...사용자가_넘긴_style }`처럼 사용자 `style` prop을 **마지막에 spread**한다 — 즉 CSS 선택자 우회가 필요 없고, `<List style={{ overflowX: 'hidden' }} ...>`처럼 공개 API로 바로 덮어쓸 수 있음을 코드로 확인했다(`className`도 동일하게 마지막에 적용됨). `FileListColumn.tsx`의 `<List rowComponent={...} ... />` 호출에 `style={{ overflowX: 'hidden' }}`만 추가하면 된다 — 세로 가상화(윈도잉)는 `overflow-y`만으로 이미 충분하므로 `overflow-x`를 react-window가 관여할 이유가 없다.

**수락 기준**: 300개 초과 여부와 무관하게 항상 스크롤바가 하나이고(가로/세로 각 1개), 가로 스크롤 시 헤더 행(`Local Path`)과 목록 행이 항상 같은 위치를 유지한다 — 즉 지금의 "300개 이하" 동작을 파일 개수와 무관하게 항상 재현한다.

## 12.3 선택 카운터 (REQ-020)

**표시 위치**: `FileListColumn`의 `headerTitle` 옆(`.file-list-column__title` 바로 뒤). 좌/우 두 인스턴스 모두 공통으로 표시.

**정정 — 세 숫자 형식으로 확정(2026-08-20, 결정 이력 #42/#44)**: 최초안은 "선택"도 필터된 `items`에서 파생시켰으나, 상태 Filter/검색으로 화면을 좁히면 실제로는 체크돼 있어 Export될 파일이 카운터에서 누락되는 문제(§6.1 케이스 D와 같은 유형의 위험)를 자기 반성 검토에서 발견해 정정했다. 최종 형식: `(선택 N개/전체 N개(필터 전 전체 N개))`.

| 숫자 | 의미 | Filter/검색 영향 | REQ-019 제외 패턴 영향 |
|---|---|---|---|
| 선택 | Export될 파일 수(절대값) | 무관 | 받음(매치되면 실제로 Export 안 되므로 제외) |
| 전체 | 현재 화면에 표시된 개수(기존 확정 유지) | 받음 | 받음 |
| (필터 전 전체) | 모든 필터 무시한 순수 전체 개수(참고용) | 무관 | 무관 |

**계산**: "전체"는 지금처럼 `items.length`(필터된 배열)로 파생 가능하지만, "선택"과 "(필터 전 전체)"는 필터링 전 원본 배열(`deployFiles`/`missingDependencies`)이 있어야 계산할 수 있다 — `DeployFilesPanel.tsx`가 이 두 값을 새 prop으로 계산해서 내려준다(`FileListColumn` 자신은 여전히 `items`만으로 "전체"를 파생).

```ts
interface FileListColumnProps {
  // ...기존 prop 그대로
  selectedCount: number       // 절대값 — Export될 파일 수
  totalBeforeFilter: number   // 절대값 — 모든 필터 무시한 전체 개수
}
```

좌측(포함된 파일):
```ts
const selectedCount = deployFiles.filter(
  (f) => f.included && !matchesAnyActiveExcludePattern(f.localPath) // §12.1과 동일 predicate 재사용
).length
const totalBeforeFilter = deployFiles.length
```

우측(누락된 의존성) — REQ-019 제외 패턴이 이쪽엔 적용 안 되므로 더 단순하다:
```ts
const selectedCount = missingDependencies.filter((d) => includedSet.has(d.localPath)).length
const totalBeforeFilter = missingDependencies.length
```

**누락된 의존성 50개 초과 경고(REQ-020 확정, 2026-08-20)**: `FileListColumn`에 선택적 prop `overCountThreshold?: number`를 추가하고, "누락된 의존성" 인스턴스에만 `50`을 넘겨준다("포함된 파일" 인스턴스는 전달하지 않음 → 기본 비활성). 판단 대상은 위 표의 "전체"(=`items.length`, 화면 표시 기준)다 — "선택"·"(필터 전 전체)"는 이 경고와 무관하다.

```ts
const total = items.length
const isOverThreshold = overCountThreshold !== undefined && total > overCountThreshold
// isOverThreshold이면 "전체 {total}개" 부분만 status-text--error로 렌더링 + title="50개를 초과했습니다"
```

이 세 기능은 서로 독립적이지만 전부 `DeployFilesPanel.tsx`의 같은 계산 범위(items 파생 + 원본 배열 접근)에 관여한다 — 12.1(제외 패턴 predicate)을 12.3의 "선택" 계산이 그대로 재사용하고, 12.2(스크롤 수정)는 이 데이터 흐름과 무관한 순수 렌더링 레이어 수정이다.

---

## 12.4 전체 선택 체크박스 위치 이동 + 누락된 의존성 양방향화 (2026-08-20)

12.1~12.3 구현·검증 완료 직후 사용자 요청으로 추가된 두 가지 변경.

**위치 이동**: "전체 선택" 체크박스가 원래 `.deploy-files-panel__header`(패널 제목·Filter 드롭다운과 같은 줄)에 있었으나, `.deploy-files-panel__columns`(컬럼 헤더 행, `Local Path` 라벨 왼쪽)로 옮겼다 — CSS 그리드가 이미 `grid-template-columns: 24px minmax(...)`로 체크박스 열 폭을 잡아두고 있어서(각 행의 체크박스가 이 24px 열에 들어감), 컬럼 헤더 행의 같은 위치(기존엔 빈 `<span></span>`)에 체크박스를 넣기만 하면 각 행 체크박스와 자동으로 정확히 정렬된다 — 새 CSS 불필요. Playwright로 헤더 체크박스와 첫 행 체크박스의 x 좌표가 일치함을 실측 확인. 텍스트 라벨("전체 선택")은 24px 폭에 들어갈 자리가 없어 빼고, `title` 툴팁("전체 선택"/"전체 해제", 현재 상태에 따라 문구 전환)으로 대체했다.

**누락된 의존성 양방향화**: 우측은 원래 `BulkAction`의 `kind: 'button'` 변형("전체 추가" — 아직 안 추가된 것만 단방향으로 추가, 이미 전부 추가됐으면 비활성화)이었다. 좌측과 동일한 `kind: 'checkbox'` 패턴으로 교체해 양방향 토글(전체 추가 ↔ 전체 제거)을 지원한다.

```ts
// appStore.ts — addAllMissingDependencies(단방향)를 대체
toggleAllMissingDependencies: (visibleLocalPaths) => {
  set((state) => {
    const visibleSet = new Set(visibleLocalPaths)
    const existing = new Set(state.deployFiles.map((f) => f.localPath))
    const visibleMissing = state.missingDependencies.filter((d) => visibleSet.has(d.localPath))
    const allChecked =
      visibleMissing.length > 0 && visibleMissing.every((d) => existing.has(d.localPath))

    if (allChecked) {
      return { deployFiles: state.deployFiles.filter((f) => !visibleSet.has(f.localPath)) }
    }
    const toAdd = visibleMissing.filter((d) => !existing.has(d.localPath))
    if (toAdd.length === 0) return {}
    return { deployFiles: [...state.deployFiles, ...toAdd.map(/* DependencyCandidate → DeployFileEntry */)] }
  })
}
```

좌측 `toggleAllDeployFiles()`와 정확히 같은 판정 방식(`allChecked` → 전체 해제, 그 외 → 아직 없는 것만 전체 추가)이며, "화면에 실제로 보이는(검색 반영된) 대상만" 원칙(#33/#36)도 동일하게 유지한다 — `visibleLocalPaths`는 `missingItems.map(item => item.localPath)`(검색 적용 후)를 그대로 받는다.

**타입 단순화**: 우측이 checkbox로 통일되면서 `BulkAction`의 `kind: 'button'` 변형을 쓰는 곳이 완전히 없어져, 판별 유니온을 없애고 `BulkSelectAction`(`{ checked, indeterminate, onClick }`) 단일 인터페이스로 정리했다 — 안 쓰는 분기를 남겨두지 않는다는 원칙에 따름.

Playwright로 검증: 헤더 체크박스가 각 행 체크박스와 같은 x 위치에 정렬됨, 좌측 전체 선택/해제 토글 정상 동작(회귀 없음), 우측이 버튼에서 체크박스로 바뀌었고 "전체 추가" 버튼 자체는 DOM에서 사라짐, 클릭 시 전체 추가(선택 카운터도 즉시 반영) → 재클릭 시 전체 해제(양방향)까지 확인.

---

# 13. 배포 대상 파일 수동 추가 설계 (REQ-021, DR-019, 2026-08-22) — 역사적 기록

> **정정(2026-09-24 문서 동기화, RT-52/RT-53)**: `ManualAddPopup`(480px 고정 모달)·자동완성 후보 목록 UI는 `AddFilesPopup`(720×480, HEAD 트리 탐색)으로 교체됐다. §13.1(왜 참조 그래프 확장 대신 수동 추가를 택했는가)·§13.5(생명주기 트레이드오프)의 **설계 이유**는 지금도 유효해 남겨두지만, §13.2·§13.3·§13.4의 UI/코드 세부는 옛 구조 기준이다. 현재 설계는 §18을 참고.

## 13.1 배경과 §6(REQ-013)과의 관계

실사용 중 나온 사고 사례(팀원이 GDE로 추출한 파일을 배포했는데, 그 파일이 참조하는 다른 클래스가 이전 배포 회차에서 누락되어 있어 Spring 빈 생성이 실패)를 계기로 논의를 시작했다. 처음엔 §6(REQ-013)의 import/DI 참조 그래프 탐색을 더 정교하게(예: 빌드 도구 레벨 의존성 추적까지) 확장하는 방향을 검토했으나, 다음 두 가지를 확인하고 방향을 바꿨다.

1. **참조 그래프로 이미 잡히는 범위는 이미 충분하다** — §6.5의 BFS는 깊이 제한 없이 전이적 폐쇄까지 추적하므로(A→B→C), 직접 import가 아니라 여러 단계를 거쳐 간접 참조되는 파일도 이미 후보로 잡는다. 여기서 더 정교화할 실익이 없다.
2. **참조 그래프로 원리적으로 못 잡는 범위가 진짜 문제였다** — 사고 사례처럼 "이번 Export 대상과 코드 참조 관계가 전혀 없는, 예전 커밋에서 그냥 누락된 파일"은 애초에 BFS 시작점(이번 Export의 포함 파일)과 그래프상 연결이 없어 아무리 깊이 탐색해도 못 찾는다. 이건 코드 의존성 분석의 한계가 아니라 애초에 "코드 참조"와 무관한 문제(리비전 추적/배포 이력의 문제)다 — RISK_ISSUES.md 결정 이력 #48 참고.

리비전 추적 자체(내부망에 마지막으로 뭐가 반영됐는지 GDE가 아는 것)는 망분리 특성상 GDE가 관측할 수 없는 이벤트(팀장 경유 메신저 전달)에 의존하고, 팀 전체가 참여하는 공유된 진실의 원천이 없으면 한 사람이 아무리 잘 기록해도 재발한다는 결론에 도달해 이 방향은 채택하지 않았다. 대신 탐지를 포기하고, 사용자가 의심되는 파일을 직접 지정해 추출 큐에 얹는 "최후의 보루"로 범위를 좁혔다.

## 13.2 입력: HEAD 트리 자동완성

§6.3의 프로젝트 인덱스와 달리 Java 파일로 제한하지 않는다 — 이 기능은 Java/Spring 여부와 무관하게 임의의 파일을 대상으로 한다. `listTrackedFiles(repoPath, branch)`(§6와 동일 소스, `src/main/git/lsTree.ts`)로 얻은 선택된 Branch의 HEAD 트리 전체 파일 경로 목록을 후보 풀로 삼아, 입력값에 대한 부분 일치로 실시간 필터링한다.

사용자가 후보 목록에서 항목을 클릭(또는 키보드로 선택)해야만 추가되며, 목록에 없는 임의 텍스트를 그대로 제출하는 경로는 제공하지 않는다 — 오타로 무효 경로가 추가될 여지를 UI 레벨에서 차단한다.

## 13.3 UI: 중앙 모달 팝업 (2026-08-22 정정)

**최초 설계(폐기)**: 팝업이 트리거 버튼(좌측 "포함된 파일" 헤더) 아래 고정 위치에 뜨고, "포함된 파일" 목록의 첫 행 y좌표를 넘지 않도록 `max-height`를 실측해서 제한하는 형태였다(`useLayoutEffect`로 트리거~목록 시작 사이 여유 공간을 매번 측정). 목록을 절대 가리면 안 된다는 제약이 강한 전제였다.

**최종 설계**: 사용자가 이 제약 자체를 철회했다 — "포함된 파일"/"누락된 의존성" 둘 다 가려도 상관없고, 어차피 추가한 파일이 뭔지는 팝업 안 칩 이력으로 확인되니 목록이 안 보여도 문제 없다는 판단(RISK_ISSUES.md 결정 이력 참고). 그래서 팝업을 트리거 버튼에 앵커링된 좁은 flyout이 아니라, 좌우 두 `FileListColumn`을 감싸는 부모(`DeployFilesPanel`의 `.deploy-files-panel`) **중앙에 고정 크기로 뜨는 모달**로 단순화했다:

- 위치: `.deploy-files-panel`에 `position: relative`를 주고, 반투명 backdrop(`.manual-add-backdrop`, `position:absolute; inset:0`)이 그 위를 덮은 뒤 `display:flex; align-items:center; justify-content:center`로 팝업을 중앙 정렬한다. 목록 상단까지 거리를 재는 `useLayoutEffect`는 완전히 제거했다 — CSS만으로 끝난다.
- 크기: `width: 480px; max-height: 60vh` 고정값(뷰포트 대비 상한만 둬서 아주 작은 창에서도 넘치지 않게 함). 사용자 드래그 리사이즈는 없음 — "고정 크기 단순 팝업"으로 명시적으로 확정.
- 닫기: backdrop 클릭(팝업 안 클릭은 `stopPropagation`으로 무시) 또는 팝업 안 `×` 버튼.
- 구조 변경: 팝업 렌더링을 `FileListColumn`에서 걷어내 새 컴포넌트 `ManualAddPopup.tsx`로 분리하고, `DeployFilesPanel.tsx`가 소유·렌더링한다(부모 중앙에 뜨려면 두 컬럼과 같은 레벨에서 열림 상태를 가져야 하므로). `FileListColumn`은 트리거 버튼만 남고 `onOpenManualAdd` 콜백 prop 하나로 단순화됐다.
- 목록이 가려지는 것에 대한 보완: 팝업 안 "수동 추가 이력" 칩을 REQ-019 제외 패턴 칩(무채색)과 다르게, REQ-017 버전 배지의 강조색(`#d4ff00`)을 재사용해 눈에 띄게 렌더링한다 — 목록이 안 보여도 "지금까지 뭘 추가했는지"는 팝업 안에서 바로 확인 가능하다.

## 13.4 추가 동작: §6.6/§12.4와 동일한 패턴 재사용

새 상태나 새 액션 유형을 만들지 않는다. §12.4의 `toggleAllMissingDependencies`가 하는 것과 동일하게, 선택한 경로 하나를 `deployFiles`에 바로 push하는 것뿐이다 — HEAD 기준 파일 내용 조회(`getHeadFileContent`, §6에서 이미 쓰는 것과 동일 함수)로 원본 바이트를 그대로 복사하고, Server Path는 기존 Mapping Rule(`resolveServerPath`)을 동일하게 거친다.

```ts
// appStore.ts (신설) — 팝업에서 후보 하나를 선택했을 때
addManualFile: (localPath: string) =>
  set((state) => {
    if (state.deployFiles.some((f) => f.localPath === localPath)) return {}
    // getHeadFileContent + resolveServerPath로 DeployFileEntry 구성 (§6과 동일 유틸 재사용)
    return {
      deployFiles: [...state.deployFiles, /* 새 DeployFileEntry, status는 'added'로 고정 */],
      manuallyAddedPaths: [...state.manuallyAddedPaths, localPath] // 칩 이력 표시 전용, §13.5
    }
  })
```

**시각적 구분을 두지 않는 이유**: `DeployFileEntry`엔 지금 출처(provenance) 필드가 없다 — diff-derived든 §6의 의존성 후보든 전부 동일한 배열에 동일한 타입으로 섞여 있다. 이번 기능을 위해 3-way 색상 구분(기본/의존성 후보/수동 추가)을 검토했으나, (a) §6 의존성 후보는 지금까지 구분 요구가 없었던 기존 기능이라 소급 확장은 이번 작업 범위를 벗어나고, (b) 출처 정보는 Export 결과물(`deploy-files.txt`)에 실리지 않아 이번 GDE 세션 안에서만 의미 있는 정보이며, (c) 그 용도(추가 직후 확인)는 아래 13.5의 칩 이력만으로 충분히 커버된다 — 근거로 기각했다(RISK_ISSUES.md 결정 이력 #48).

## 13.5 생명주기: 별도 영속 상태 없음

`manuallyAddedPaths`(칩 이력 표시 전용 배열)는 `localStorage`에 저장하지 않는다 — REQ-019 제외 패턴(영구 저장, 앱 재실행 후에도 유지)과 성격이 다르다. `[Preview]`가 재실행되어 `deployFiles`가 새 Preview 결과로 전체 교체될 때 `manuallyAddedPaths`도 함께 빈 배열로 초기화한다 — 파일은 목록에서 빠졌는데 칩만 "추가됨"으로 남아있으면 실제 상태와 어긋난 표시가 되기 때문이다(결정 이력 #33과 같은 유형의 함정 회피).

**검토했으나 기각한 대안(Preview 재실행 후에도 유지)**: 수동 추가는 커밋/분석과 무관한 고정된 사용자 의도이므로, §6 의존성 후보(재계산 후 유효성이 보장 안 되는 파생 결과)와 달리 이론적으로는 재실행 후에도 살아남아야 더 정확하다. 하지만 이러려면 `manuallyAddedPaths`를 Preview 재실행 후 별도로 재보정(HEAD 기준으로 다시 조회해 `deployFiles`에 재삽입)하는 로직과, Repository/Branch 전환 시 이 배열을 지우는 규칙(DR-015와 동일 트리거)이 새로 필요하다. 논의 끝에 §6과 동일한 단순한 생명주기로 통일하는 쪽을 택했다 — 구현 단순성과 기존 패턴 일관성을 정확성보다 우선한 의도적 트레이드오프(RISK_ISSUES.md 결정 이력 #48).

## 13.6 제외 패턴(REQ-019)과의 관계

예외를 두지 않는다. `DeployFilesPanel.tsx`의 `includedItems` 파생 계산은 출처를 구분하지 않고 `deployFiles` 전체에 동일하게 적용되므로, 수동 추가한 파일이 활성 제외 패턴에 매치되면 다른 파일과 똑같이 목록에서 숨겨지고 Export에서 제외된다 — 구현을 위해 새로 분기할 것이 없다.

---

# 14. 커밋 이력 필터링 조건 추가 설계 (REQ-022, 2026-09-14)

## 14.1 배경

기존 커밋 검색은 메시지(REQ-003)/파일명(REQ-016) 두 경로만 지원했다. 여러 팀원이 커밋하는 저장소에서 특정 인원의 변경만 좁혀 보거나, 배포 대상 파일 추출 목적상 노이즈에 가까운 Merge 커밋을 걸러내고 싶다는 요구가 있어, 구현 비용이 낮은(git 플래그 추가만으로 되는) 두 조건을 먼저 REQ 번호로 정리하고 구현했다. §8(REQ-015/016)·§13(REQ-021)과 달리 실사용 중 발견된 사고나 버그가 아니라 설계 논의에서 나온 사전 제안이다.

## 14.2 구현: `listCommits()`에 조건부 git 플래그 추가

`src/main/git/commits.ts`의 `args` 배열에 기존 `--since`/`--until`/`--grep` 등과 동일한 자리에서 조건부로 추가한다 — 새 명령 경로나 2단계 조회(§8.3의 pathspec처럼)가 필요 없다.

```ts
if (authors && authors.length > 0) {
  for (const a of authors) {
    args.push(`--author=${a}`)
  }
  args.push('-i')
}
if (excludeMerges) {
  args.push('--no-merges')
}
```

`--author`는 git 정규식 매칭이지만 특수문자를 이스케이프하지 않고 그대로 넘긴다 — §8.3의 `--grep=<searchTerm>`과 동일한 기존 관례를 따른 것으로, 사용자 이름에 정규식 메타문자가 흔하지 않아 실용적으로 충분하다고 판단했다. `-i`(대소문자 무관)는 `--grep`에 붙는 `-i`와 별개로 `--author`에도 각각 붙이므로, 메시지 검색과 작성자 필터를 동시에 쓰면 `-i`가 인자 목록에 중복 등장한다 — git이 동일 플래그 중복을 그대로 허용해 동작에 영향은 없다.

**정정(2026-09-14, 사용자 요청) — 여러 작성자 지원**: `authorFilter`가 단일 문자열에서 여러 줄 텍스트로 바뀌면서 IPC 파라미터도 `author?: string`에서 `authors?: string[]`로 바뀌었다. `--author`를 여러 번 주면 git이 기본적으로(즉 `--all-match`를 안 준 경우) OR로 묶는 것을 그대로 활용해 "여러 작성자 중 하나라도 일치하면 포함"을 새 로직 없이 얻는다 — 로컬 fixture 저장소(작성자 3명)로 단일/2인 OR/필터 없음 3가지 케이스를 직접 실행해 이 OR 동작을 확인했다.

## 14.3 상태 관리: `searchTerm`과 동일한 디바운스 패턴 재사용

`authorFilter`(텍스트 입력)는 `setSearchTerm`과 동일하게 300ms 디바운스 후 `loadCommitsFirstPage(true)`를 호출한다. `excludeMerges`(체크박스)는 `setSearchMode`와 동일하게 디바운스 없이 즉시 재조회한다 — 텍스트 입력은 타이핑 중 매 keystroke마다 조회하면 낭비지만, 체크박스 토글은 클릭당 한 번의 명확한 의도라 디바운스가 오히려 체감 지연만 늘린다는 기존 판단(§8.1)을 그대로 따랐다.

`loadCommitsFirstPage`/`loadNextPage` 양쪽에 `authors`/`excludeMerges`를 `listCommits` 파라미터로 전달하며, `keepSelection` 인자는 항상 `true`로 호출한다 — REQ-015가 이미 확립한 "검색 조건 변경은 선택을 지우지 않는다" 원칙에 새 조건 두 개를 추가한 것뿐, 별도 예외를 두지 않았다.

**정정(2026-09-14) — 파싱 함수 공유**: REQ-023 해시 필터에서 처음 만든 `parseHashFilter`(쉼표/공백/줄바꿈 분리)를 `parseMultiValueFilter`로 일반화해 작성자 필터도 재사용한다 — 두 필드가 정확히 같은 붙여넣기 파싱 규칙을 쓰므로 별도 함수를 새로 만들 이유가 없었다.

## 14.4 기본값과 하위 호환

`authorFilter=''`가 기본값이며, `listCommits()`는 이 값이 없거나 falsy면 `--author` 플래그를 아예 추가하지 않는다. `excludeMerges`는 IPC 레벨에서는 여전히 falsy면 `--no-merges`를 안 붙이는 동일한 규칙이지만, **정정(2026-09-14, 사용자 요청)**: 렌더러 쪽 초기 state가 `false`에서 `true`로 바뀌어, 별도로 끄지 않는 한 기본적으로 Merge 커밋이 제외된 상태로 조회된다 — 배포 대상 파일 추출 목적상 Merge 커밋은 대개 노이즈라는 판단에 따른 것으로, "기존 사용자에게 동작 변화를 주지 않는다"는 애초 설계 의도와는 의도적으로 어긋나는 변경이다.

## 14.5 UI 다듬기 (2026-09-14, 사용자 요청 2건)

**좌우 반반 배치**: 작성자/해시 필터 textarea가 각자 독립된 행에서 `flex: 1 1 100%`로 전체 폭을 차지해 "너무 좌우로 길다"는 피드백을 받았다. DeployFilesPanel의 포함된 파일/누락된 의존성 50:50 분할과 같은 감각을 원했지만, 두 필드는 항상 같은 비율이면 충분해 드래그 리사이즈 가능한 `SplitPane`까지는 쓰지 않고 한 행(`branch-search-bar__row--split`)에 `flex: 1 1 320px`로 나란히 뒀다 — 창이 넓으면 절반씩, 640px보다 좁아지면(각 320px 미만) `flex-wrap`만으로 자동 세로 스택된다(미디어 쿼리 없음).

**라벨 → placeholder 이동**: "작성자 (쉼표/공백/줄바꿈 구분, 여러 명이면 하나라도 일치 시 포함) :"처럼 라벨에 붙어 있던 설명 문구를 라벨은 "작성자 :"로 줄이고 `<textarea placeholder="...">`로 옮겼다 — 라벨이 매번 화면에 그대로 노출돼 좁은 화면에서 줄바꿈을 유발하던 것을, 포커스 전까지는 안 보이는 placeholder로 옮겨 공간을 아꼈다.

---

# 15. 해시로 커밋 필터링 설계 (REQ-023, 2026-09-14)

## 15.1 배경과 §14(REQ-022)와의 차이

§14의 두 필터(작성자/Merge 제외)는 기존 검색·기간과 AND로 결합되는 "좁히는" 필터였다. REQ-023은 성격이 다르다 — 다른 곳(메신저, PR)에서 복사한 정확한 커밋 해시 목록을 그대로 붙여넣어 "그 커밋들만" 보고 싶은 경우로, 이미 어떤 커밋인지 정확히 알고 있는 상태에서 쓴다. 그래서 다른 조건과 AND 결합하지 않고, 값이 있으면 branch/기간/검색어/작성자/Merge 제외를 전부 무시하는 별도 경로로 설계했다 — AND로 묶으면 "정확히 아는 커밋"이 날짜 범위 밖이라는 이유로 누락되는 등, 필터의 존재 이유(정확한 재현)와 정반대의 결과가 나올 수 있기 때문이다.

## 15.2 구현: `--no-walk` + 개별 검증 폴백

`src/main/git/commits.ts`의 `listCommitsByHash()`가 전담한다. 기존 `listCommits()`의 `--since`/`--until`/`branch` 기반 조회와 완전히 분리된 별도 함수다 — `hashFilter`가 있으면 `listCommits()` 맨 앞에서 이 함수로 바로 위임하고 나머지 로직은 타지 않는다.

```
1. git log --no-walk --pretty=format:... <hash1> <hash2> ...   (한 번에 조회 시도)
2. 실패하면(하나라도 잘못된 해시) 각 해시를 개별 검증:
     git cat-file -e <hash>^{commit}
3. 유효한 해시만 모아 1번을 다시 시도. 유효한 게 하나도 없으면 빈 결과.
```

`--no-walk`는 주어진 revision 자체만 보여주고 조상까지 훑지 않는다 — "그 커밋들만" 요구사항과 정확히 맞는 플래그다. 기본 전략은 "일단 한 번에 다 시도"다 — 붙여넣은 해시가 전부 유효한 흔한 경우엔 git 호출이 1번으로 끝난다. 실패했을 때만 `cat-file -e`로 하나씩 검증하는 비용을 지불한다 — 오타 하나 때문에 나머지 유효한 해시까지 전부 빈 결과로 나오는 것을 막기 위한 폴백이다(§8.3의 pathspec 0건 처리와 같은 동기: "일부라도 못 찾으면 전체를 포기"가 아니라 "찾을 수 있는 만큼은 보여준다").

축약 해시(예: 7자리)도 `--no-walk`/`cat-file -e` 양쪽 다 git이 알아서 완전한 해시로 resolve하므로, 별도 처리 없이 REQUIREDMENT.md REQ-023이 요구하는 "축약 해시도 정확히 일치로 인정"이 자연히 성립한다.

## 15.3 페이지네이션: git이 아니라 함수가 슬라이스

다른 모드는 `--skip`/`-n`을 git에 넘겨 git이 직접 페이지네이션한다. 해시 필터는 애초에 대상이 붙여넣은 목록 크기로 정해져 있어(git 쪽에서 정렬·페이지 단위로 다시 걸러낼 이유가 없음) `git log --no-walk`로 전체를 한 번에 가져온 뒤 `all.slice(skip, skip + limit)`로 이 함수 안에서 직접 자른다. `maxCount`도 기존 모드와 동일하게 상한으로 적용된다(대부분 붙여넣는 해시 개수가 적어 사실상 걸릴 일은 없음).

## 15.4 상태 관리와 UI

`authorFilter`와 동일한 패턴이다 — `hashFilterText`(원본 텍스트, textarea)를 300ms 디바운스로 `loadCommitsFirstPage(true)`에 넘긴다. 파싱(`parseHashFilter`, `appStore.ts`)은 `/[\s,]+/`로 분리해 쉼표·공백·줄바꿈 어느 구분자로 붙여넣어도 동일하게 처리하며, 빈 토큰은 걸러낸다. 파싱은 store가 IPC 호출 직전에 하고, `hashFilterText` 자체는 원본 그대로 들고 있는다 — textarea 값과 상태가 항상 1:1로 대응해야 재렌더링 시 커서 위치 등이 꼬이지 않는다.

`BranchSearchBar.tsx`에 새 행으로 `<textarea rows={2}>`를 추가했다(다른 필드는 전부 한 줄 `<input>`이라 별도 CSS 규칙 `.branch-search-bar__hash-filter`로 `align-items: flex-start`와 `flex: 1 1 100%`를 줘, 키가 큰 textarea가 한 줄 전체를 차지하면서도 라벨 텍스트가 세로 중앙에 어중간하게 걸리지 않게 했다).

## 15.5 검증

실제 이 저장소의 커밋 해시로 스크립트를 작성해 `listCommits()`를 직접 호출·확인했다: (1) 정상 해시(전체 길이) + 축약 해시(7자리) + 존재하지 않는 해시를 섞으면 유효한 2개만 반환, (2) 전부 존재하지 않는 해시면 빈 배열, (3) `skip`/`pageSize`가 함수 내부 슬라이스로 정확히 동작(2개 중 skip=1, pageSize=1로 두 번째 것만 반환).

---

# 16. 제외 패턴 삭제 설계 (REQ-024, 2026-09-14) — 부분 역사적 기록

> **정정(2026-09-24 문서 동기화, RT-40/RT-46)**: `excludePatterns`/`<span className="exclude-pattern-chip">` 마크업은 공용 `Chip.tsx` 프리미티브(§18)로 교체됐지만, **button-in-button 제약과 그걸 피한 구조(라벨 버튼+삭제 버튼 형제)는 지금도 그대로 유효**하다 — `Chip.tsx`가 정확히 이 구조를 재사용한다. `removeExcludePattern` 같은 개별 액션명은 `removeFilePattern`(제외+포함 공용, §18)으로 바뀌었다.

## 16.1 배경

REQ-019 제외 패턴은 처음부터 "한 번 입력하면 지우지 않는 한 이력(칩)에 남는다"는 전제로 설계됐다(`excludePatterns.ts` 주석에도 이미 이렇게 적혀 있었다) — 다만 그 "지운다"에 해당하는 기능은 실제로 구현된 적이 없었다. 실사용 중 칩이 쌓여 목록이 지저분해지는 문제가 나오면서 이 gap이 드러났다.

## 16.2 마크업 제약: button 안에 button을 넣을 수 없다

기존 칩은 통째로 `<button onClick={toggle}>`이었다 — 클릭 영역 전체가 토글이었다. 여기에 별도 삭제 버튼을 추가하려면 `<button>` 안에 `<button>`을 중첩해야 하는데 이는 유효한 HTML이 아니다(브라우저가 파싱 단계에서 바깥 button을 강제로 닫아버려 예측 불가능한 DOM이 만들어진다). 그래서 칩을 `<span className="exclude-pattern-chip">`(모양만 담당하는 순수 래퍼)로 바꾸고, 그 안에 `<button className="exclude-pattern-chip__label">`(토글, 기존 클릭 동작 그대로)과 `<button className="exclude-pattern-chip__remove">×</button>`(삭제, REQ-024 신규) 두 형제 버튼을 나란히 뒀다. `ManualAddPopup.tsx`의 칩(REQ-021)은 애초에 토글 개념이 없어 칩 전체가 단일 삭제 버튼이었으므로 이 제약에 걸리지 않았다 — REQ-019 칩만 "토글 + 삭제" 두 동작을 한 칩에 담아야 해서 이 구조 변경이 필요했다.

## 16.3 구현: `removeExcludePattern`

`toggleExcludePattern`과 형태가 거의 같다 — `excludePatterns` 배열에서 해당 패턴을 찾아 갱신하는 대신 아예 필터링해서 제거하고, `localStorage`에 다시 저장한다(`appStore.ts`).

```ts
removeExcludePattern: (pattern) => {
  set((state) => {
    const next = state.excludePatterns.filter((p) => p.pattern !== pattern)
    saveExcludePatterns(next)
    return { excludePatterns: next }
  })
},
```

활성(enabled) 패턴을 삭제하면 배열에서 아예 빠지므로, `matchesAnyActiveExcludePattern`이 다음 렌더에서 더 이상 그 패턴을 매치하지 않는다 — 별도의 "삭제 시 재계산" 로직 없이 기존 파생 계산 체인(§12.1)이 자연히 반영한다.

## 16.4 확인 다이얼로그를 넣지 않은 이유

이 앱의 다른 유사 액션(REQ-019 토글, REQ-021 팝업 칩 `×`)이 전부 확인창 없이 즉시 처리되는 관례를 따랐다 — 여기만 확인창을 넣으면 일관성이 깨지고, 삭제된 패턴은 다시 타이핑하면 되살릴 수 있는 가벼운 문자열이라 되돌릴 수 없는 파괴적 작업에 준하는 수준의 안전장치가 필요하다고 보지 않았다.

---

# 17. 포함된 파일 검색 와일드카드 설계 (REQ-025, 2026-09-14)

## 17.1 배경

"포함된 파일" 파일명 검색은 지금까지 대소문자 무관 부분 일치(`includes`)만 지원했다. `*.html`, `*List.html`처럼 접미사/패턴 기반으로 좁혀보고 싶다는 요청이 있었다 — 경로 전체가 아니라 파일명까지만(§7.2 매칭 기준 유지).

## 17.2 구현: `*` 유무로 분기, REQ-019 문법 재사용

**정정(2026-09-24 문서 동기화, RT-45/RT-46/RT-51)**: `matchesFileName()`은 `DeployFilesPanel.tsx`가 아니라 독립 모듈 `src/renderer/src/lib/matchesFileName.ts`로 옮겨졌다 — B안(§7 M-46)으로 이 검색이 잠깐 삭제됐다가 되살아나는 과정에서, AddFilesPopup의 통합 검색(HEAD 트리 후보 + 누락된 의존성)도 같은 함수를 쓰게 되어 공용 모듈로 뺐다. 새 매칭 엔진을 만들지 않고 REQ-019/026 제외+포함 패턴(`lib/filePattern.ts`)이 이미 쓰는 글롭→정규식 변환(`*` → `[^/]*`, 특수문자 이스케이프, 전체 앵커 `^...$`)과 동일한 문법을 재사용하는 원래 설계는 그대로다.

```ts
function matchesFileName(path: string, term: string): boolean {
  if (!term) return true
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  if (!term.includes('*')) {
    return fileName.toLowerCase().includes(term.toLowerCase())
  }
  const escaped = term.replace(GLOB_SPECIAL_CHARS, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`, 'i').test(fileName)
}
```

`excludePatternMatch.ts`의 `matchesExcludePattern()`을 그대로 호출하지 않고 로직을 별도로 둔 이유: (1) 그쪽은 항상 전체 앵커 매치라 `*` 없는 입력("List")도 "파일명이 정확히 List여야" 매치되는데, 여기는 `*` 없을 때 기존 부분 일치(하위 호환)를 유지해야 한다. (2) 그쪽은 대소문자를 항상 구분(REQ-019는 Export 결과에 영향을 주는 영속 규칙이라 git의 대소문자 구분과 일관성을 맞춘 결정)하지만, 이 검색은 그때그때 타이핑하는 일시적 조건이라 대소문자 무관이 사용자 기대에 맞다 — 두 요구사항이 근본적으로 달라 함수를 공유하면 조건 분기가 오히려 더 많아졌을 것이다.

## 17.3 좌우 공유, 경로 미확장

**정정(2026-09-24 문서 동기화)**: `deployFilesSearchTerm`/`dependencySearchTerm` 필드명은 이제 `includedSearchTerm`(IncludedFilesPane 전용) 하나다 — "누락된 의존성" 목록이 AddFilesPopup 안으로 통합되면서(§13 정정) 별도 검색어 필드 자체가 없어지고, AddFilesPopup은 자기 `query` 로컬 상태로 HEAD 트리 검색을 담당한다. `matchesFileName()` 공유 원칙(§7.2 "좌우 매칭 기준 통일")은 유지된다.

경로 전체 검색(디렉터리 기준 필터링)은 별도로 논의됐으나(2026-09-14, "파일이 포함된 경로 기준 조회" 제안) 이번 범위에서 제외하고 보류했다 — REQ-019가 이미 슬래시 포함 패턴으로 절반쯤 커버하는 영역이고, 목록 크기 자체가 보통 작아 경로 기준 필터가 얼마나 자주 필요할지 불확실하다는 게 보류 근거였다.

## 17.4 ~~REQ-016(커밋 파일명 검색)과의 의도적 불일치~~ (대상 소멸)

**정정(2026-09-24 문서 동기화)**: REQ-016 자체가 폐기되면서(§8.3 정정) 이 절이 비교하던 대상(`src/main/git/commits.ts`의 파일명 검색)이 없어졌다 — "두 `matchesFileName`이 서로 다른 규칙을 가진 의도적 불일치"라는 서술은 더 이상 적용되지 않는다. 남은 `matchesFileName`(§17.2 정정, `lib/matchesFileName.ts`)은 렌더러의 화면 검색·파일 추가 전용 하나뿐이다.

## 17.5 검증

12개 케이스(기존 부분 일치 유지, 접미사 와일드카드 매치/불일치, 대소문자 무관, 빈 검색어, 경로 레벨 오매치 방지 등)로 매칭 함수를 직접 실행해 확인했다.

**추가 검증(2026-09-14) — 확장자 무관 확인**: `.html` 예시만 보고 그 확장자에 한정된 구현이 아니냐는 질문을 받아, `*.java`/`*Controller.java`(음성 케이스로 `*Repository.java`)/`*.js`/`*.test.js`(음성 케이스로 `*Test.js`)/`*.yml`(음성 케이스로 `.yaml`)/`*.py`(대소문자 무관, `Foo.PY`)까지 9개 케이스를 추가로 실행해 전부 통과 확인 — `*`를 `[^/]*`로 치환하는 로직 자체가 애초에 확장자·패턴 종류와 무관한 범용 글롭 변환이라, `.html`은 REQ-025 요청 당시 예시로 든 것일 뿐 구현을 한정하지 않는다.

---

# 18. 배포 대상 파일 P4 재구성 — 패턴 관리·Extract 대상 모델·팝업 시스템 (REQ-011/026, RT-40~53, 2026-09-24 신규)

v0.6.0에는 이 섹션이 없었다. §12·§13이 설명하던 옛 `DeployFilesPanel` 구조 전체가 P4 리팩토링으로 교체되면서, 그 설계를 대신하는 현재 구조를 여기 새로 정리한다.

## 18.1 파일 패턴 — 종류 자동 파생과 판정 (REQ-026)

**핵심 로직**(`src/renderer/src/lib/filePattern.ts`, 순수 함수 — RT-01로 가장 먼저 테스트 이식됨):

```ts
const PKG_RE = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*\.\*\*$/

function interpret(pattern: string): { kind: 'path'|'pkg'|'name'; glob: string } {
  const t = pattern.trim()
  if (t.includes('/')) return { kind: 'path', glob: t }
  if (PKG_RE.test(t)) return { kind: 'pkg', glob: '**/' + t.slice(0, -3).split('.').join('/') + '/**' }
  return { kind: 'name', glob: t }
}

function matchPattern(pattern: string, path: string): boolean {
  const { kind, glob } = interpret(pattern)
  return globToRe(glob).test(kind === 'name' ? basename(path) : path)
}

// 제외가 항상 우선. 활성 포함 패턴이 하나라도 있으면 그중 하나 이상에 매치돼야 남는다.
function hiddenByPatterns(path: string, patterns: FilePattern[]): boolean {
  const active = patterns.filter((p) => p.enabled)
  if (active.some((p) => p.mode === 'exclude' && matchPattern(p.pattern, path))) return true
  const includes = active.filter((p) => p.mode === 'include')
  return includes.length > 0 && !includes.some((p) => matchPattern(p.pattern, path))
}
```

**종류 파생 규칙**: `/`가 있으면 `path`(경로 전체 매치, REQ-019 원래 문법). 점 구분 식별자 나열이 `.**`로 끝나면(`com.acme.legacy.**`) `pkg` — 내부적으로 `**/com/acme/legacy/**` 경로 패턴으로 변환해서 매치한다(자바 패키지 표기를 경로로 자동 번역 — 같은 패키지의 리소스·테스트 소스까지 함께 잡힘, `.java` 한정 아님). 그 외는 `name`(파일명만 매치, REQ-019 원래 문법). 글롭→정규식 변환(`globToRe`)은 REQ-019 시절과 동일(`*` → `[^/]*`, 특수문자 이스케이프, 전체 앵커).

**저장**: `localStorage`(`gde:filePatterns`) 전역 키, `FilePattern[] = { pattern, mode: 'exclude'|'include', enabled }[]`. 마이그레이션(`lib/filePatterns.ts`)이 v0.6.0의 `excludePatterns`(REQ-019, `mode` 필드 없음 — 전부 `exclude`로 취급)를 읽어 새 스키마로 자동 변환한다.

## 18.2 Extract 대상 이동 모델 (REQ-011 정정)

**핵심 발상 전환**: v0.6.0까지 `deployFiles[].included`는 "Export에 포함할지"를 뜻하는 단순 불리언 토글이었다(§12.4). RT-51부터는 같은 필드가 "이 파일이 지금 Extract 대상 목록에 있는가"를 뜻한다 — **체크 = 실제 이동**이라는 시각적 은유를 데이터 모델에도 그대로 반영했다. `useIncludedFilesView`/`useExtractTargetsView`(순수 훅, RT-34) 두 파생 훅이 각각 좌/우 화면을 계산한다.

```ts
// lib/useExtractTargetsView.ts — 개념적 정의
extractItems = [
  ...changedFiles.filter(f => f.included).map(f => ({ ...f, source: 'changed' })),
  ...missingDependencies.filter(d => includedSet.has(d.localPath)).map(d => ({ ...d, source: 'dependency' })),
  ...manuallyAddedPaths.map(p => ({ localPath: p, source: 'manual' })),
].map(item => ({ ...item, patternExcluded: hiddenByPatterns(item.localPath, filePatterns) }))
```

**패턴 걸린 항목을 숨기지 않는 이유**: 좌측(포함된 파일)에서는 패턴에 걸리면 목록에서 완전히 사라지지만(REQ-026), Extract 대상에서는 **숨기지 않고** 흐리게+취소선+"패턴 제외" 태그로 표시한다 — 체크(=이동)했는데 그 파일이 조용히 화면에서 사라지면 "정말 빠진 건가, 아직 있는데 안 보이는 건가"를 사용자가 확인할 방법이 없다. RT-51(§5.1)이 이 "조용한 누락 방지"를 명시적 설계 원칙으로 확정했다.

**되돌리기(×)**: 출처(`source`)에 따라 분기한다 — `changed`는 `included=false`(좌측으로 복귀), `dependency`는 `missingDependencies`에서 제거(AddFilesPopup 후보로 복귀), `manual`은 `manuallyAddedPaths`에서 제거(철회, 원위치가 없음). 폴더 단위 ×(`returnFolderFromExtract`)는 그 경로 접두사를 가진 항목 전체에 같은 규칙을 적용한다.

## 18.3 팝업 시스템 (PopupHost/WorkArea, RT-43/44)

**소유권**: `openPopup: OpenPopup`(`'addFiles'|'patterns'|'deleted'|'warnings'|null`)은 `WorkArea`에만 존재한다 — PreviewSummary(Deleted/경고 버튼)와 DeployFilesWorkspace(파일 추가/패턴 버튼)의 공통 부모이기 때문이다. `WorkAreaPopupContext`로 트리거 컴포넌트에 `open`/`close`를 내려준다(props 릴레이 없이).

**동시 하나만**: 종류 무관 단일 값이라 구조적으로 둘 이상 동시에 열릴 수 없다.

**자동 닫힘 트리거**: ① `[Preview]` 클릭 시작 시점(`analyzing`이 켜지는 순간) — 재계산 중 팝업이 가리키던 데이터가 무효해지므로. ② Reload/Browse 시작 시점(`repository.status`가 `'validating'`이 되는 순간). ③ WorkArea 소유 섹션(커밋/배포 대상 파일)이 접힐 때(RT-47) — CommitQueryBar가 접히는 건 무시(그쪽엔 팝업 트리거가 없음).

**크기/접근성**: 720×480 고정, 부모 컨테이너 높이가 그보다 작으면 `min(480px, calc(100% - 20px))`로 클램프(U2). `Esc`로 닫힘, 닫히면 트리거 버튼으로 포커스 복귀, 포커스 트랩 포함(`Popup.tsx` 공용 프리미티브, RT-40).

## 18.4 FilterPatternsPopup — 추가 입력 (RT-46/RT-51)

패턴 추가 입력(모드 select·텍스트 input·`+추가` 버튼)은 처음 FilterPatternBar(툴바)에 있었으나 RT-51에서 팝업 안으로 옮겼다 — 좁은 툴바 폭 제약 없이 입력할 수 있게 하기 위함. 여러 패턴을 한 번에 추가할 수 있다(쉼표·줄바꿈 구분, 붙여넣기 시 줄바꿈을 자동으로 쉼표로 변환 — 텍스트 입력창은 기본적으로 붙여넣은 줄바꿈을 지워버리므로 `paste` 이벤트를 가로채 직접 삽입). 입력에 포커스가 있고 값이 있을 때만 입력창 바로 아래에 해석 미리보기가 겹쳐 뜬다(레이아웃 불변).

**0개에서도 안 닫힘(RT-51 정정)**: v0.6.0 시절(§16) 칩 삭제 UI는 별도 팝업이 아니라 인라인이라 이 문제가 없었지만, 지금은 패턴이 전부 삭제돼도 팝업이 자동으로 닫히지 않는다 — 팝업 자체가 "0개에서 첫 패턴을 추가하는" 진입점이기도 해서, 자동으로 닫히면 그 흐름이 막히기 때문이다.

## 18.5 AddFilesPopup — HEAD 트리 탐색 + 의존성 통합 (REQ-013/021, RT-52/53)

**정정(§13 대체)**: 자동완성 텍스트 입력(§13.2)이 HEAD 트리 탐색으로 바뀌었다. `TreeList`(§18.6)로 렌더링하며, 두 모드를 완전히 분리된 펼침 상태(`useTreeExpansion`을 두 번 호출)로 관리한다.

- **탐색 모드**(검색어 없음): HEAD 트리 전체. 기본 펼침 = 경로 세그먼트 1단계(`src`가 보이면 `main`까지) ∪ 누락된 의존성의 모든 조상 폴더(중요한 항목이 접혀서 안 보이는 일이 없도록).
- **결과 모드**(검색어 있음): 매치 최대 50개, 전부 펼침. 50개 초과 시 "상위 50개만 표시합니다 — 더 구체적으로 입력하세요" 안내.

**누락된 의존성 통합**: 이미 `deployFiles`에 있는 경로(출처 무관)는 후보에서 제외한다(§0.1 결정 이력 반영, `includedPathsSet`). 누락된 의존성은 트리 안에서 파일명이 붉은 글자 + `Impl`/`I` 종류 배지로 표시되고, "보이는 항목 모두 추가" 버튼(검색으로 좁힌 범위 + 접힌 폴더 안까지 포함)으로 한 번에 추가할 수 있다.

**추가 시 곧바로 Extract 대상으로**: 후보를 클릭하면(의존성이든 일반 파일이든) `deployFiles`에 `included=true`로 바로 들어간다 — "포함된 파일"에는 들어가지 않는다(§18.2, 원래 그 목록에 없던 파일이라 되돌릴 원위치가 없음, × 클릭 시 이 팝업 후보로 복귀).

## 18.6 TreeList 공용 컴포넌트 (RT-40/53)

경로 목록 → 디렉터리 트리로 빌드하는 로직을 모든 목록(포함된 파일/Extract 대상/AddFilesPopup/Deleted/경고)이 공유한다(`components/TreeList.tsx`).

**폴더 압축(compact)**: 하위가 디렉터리 하나뿐이고 파일이 없는 체인은 한 줄로 합친다(IDE의 compact middle packages와 동일 관례, 예: `src/main/java`가 파일 없이 폴더 하나씩만 이어지면 `src/main/java`로 한 줄). `compactFrom` 파라미터로 병합을 시작할 최소 깊이를 조절한다 — AddFilesPopup 탐색 트리는 3(`src`/`main`은 병합하지 않고 그대로 보여줌), 나머지 목록은 기본값 1(가능한 모든 체인을 병합).

**indeterminate 판정(M-20)**: 폴더 체크박스는 "이 폴더 아래 원래 대상 개수(패턴·이동 여부 무관)가 화면에 실제로 보이는 개수보다 많을 때" indeterminate로 표시한다 — 그 차이가 "이미 Extract로 이동했거나 패턴에 걸려 안 보이는" 몫이다.

**경로 복사 버튼**: 각 행에 호버/포커스 시에만 보이는 복사 버튼(`⧉`)을 자동 배치한다(`copyable` prop으로 끌 수 있음 — ExtractTargetsPane은 ×와의 16px 간격 규칙 때문에 자동 배치를 끄고 직접 배치한다).
