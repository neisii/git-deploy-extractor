# Git Deploy Extractor 상세 설계 문서

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

## 2.1 deploy-files.txt

배포 대상 파일의 **Server Path**(Mapping Rule 적용 결과, `git-deploy-extracted/` 기준 상대경로)를 한 줄에 하나씩 기록한다.

```
src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java
src/main/resources/static/js/guarantee/list.js
src/main/resources/templates/guarantee/list.html
```

## 2.2 delete-list.txt

내부망에서 삭제해야 할 파일의 Server Path를 한 줄에 하나씩 기록한다.

```
old.js
src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeController.java
```

**정정 (Rename 처리 단순화, 2026-08-04)**: 이전 초안은 Rename된 파일의 이전 경로에 `#` 주석으로 새 이름을 남기는 방식을 썼다. 하지만 DR-008이 "Rename을 별도로 감지하지 않는다"로 바뀌면서, 애초에 도구가 "이 삭제가 Rename 때문"이라는 사실 자체를 알지 못한다 — `--find-renames` 없이 git이 넘겨주는 정보는 그냥 삭제/추가일 뿐이다. 그래서 이 파일에는 더 이상 주석이 붙지 않는다. 위 예시의 `GuaranteeController.java`가 실제로는 `GuaranteeListController.java`로 이름이 바뀐 것인지는, Preview 화면에서 Added/Deleted 목록을 같이 보고 **사용자가 직접** 판단한다.

## 2.3 deploy-summary.json

```json
{
  "generatedAt": "2026-08-04T09:12:00+09:00",
  "repository": "D:\\workspace\\contract2",
  "branch": "contract2/main",
  "mappingProfile": "contract2-prod",
  "commits": [
    { "hash": "b61e2ab", "author": "hong", "date": "2026-07-30T11:02:00+09:00", "message": "guarantee html" },
    { "hash": "8dd9e91", "author": "hong", "date": "2026-07-30T11:40:00+09:00", "message": "guarantee backend" }
  ],
  "summary": {
    "files": 18,
    "added": 4,
    "modified": 14,
    "deleted": 2
  },
  "files": [
    {
      "localPath": "src/main/resources/templates/guarantee/list.html",
      "serverPath": "src/main/resources/templates/guarantee/list.html",
      "status": "modified"
    },
    {
      "localPath": "src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java",
      "serverPath": "src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeListController.java",
      "status": "added"
    }
  ],
  "deleted": [
    "old.js",
    "src/main/java/com/example/sell/interfaces/receipt/controller/GuaranteeController.java"
  ],
  "warnings": [
    { "path": "src/main/java/com/example/sell/legacy/Deprecated.java", "reason": "HEAD에 존재하지 않음 (DR-009)" }
  ]
}
```

| 필드 | 설명 | 대응 |
|---|---|---|
| `commits` | 선택된 Commit 목록 (REQ-004) | UI Commit List 선택 결과 |
| `summary` | 섹션 8 Deployment Preview 패널과 동일 집계 | Files/Added/Modified/Deleted (Renamed 없음, DR-008) |
| `files[].status` | `added` \| `modified` (deleted는 별도 배열) | DR-008 |
| `deleted` | 삭제된 파일(DR-007). Rename으로 인한 삭제와 구분하지 않는다 | delete-list.txt와 1:1 대응 |
| `warnings` | HEAD 미존재로 제외된 파일 | DR-009 |

두 번째 `files[]` 예시(`GuaranteeListController.java`)와 `deleted`의 `GuaranteeController.java`가 실제로는 같은 파일의 Rename이지만, JSON도 이 둘을 연결 짓는 필드를 두지 않는다 — 그 판단은 도구가 아니라 Preview를 보는 사용자의 몫이다.

**인코딩/줄바꿈 결정**: 세 Export 파일 모두 UTF-8(BOM 없음), LF(`\n`) 줄바꿈으로 고정한다. Windows에서 생성하더라도 CRLF를 쓰지 않는다 — 내부망 git이 이 파일을 그대로 diff/commit할 때 줄바꿈 문자로 인한 불필요한 변경이 발생하지 않도록 하기 위함이다.

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

**배경**: 지금까지 Export 결과물은 항상 저장소 루트 바로 아래 `git-deploy-extracted/`로 고정이었다(결정 이력 #20으로 이름은 고정 확정). 사용자가 원하는 위치로 결과물을 보내고 싶다는 요구에 따라, **이름이 아니라 부모 디렉터리 위치**만 사용자가 선택하도록 확장한다.

**deployDir 계산** (`src/main/package/buildPackage.ts`의 `getDeployDir`):

```
deployDir = join(exportParentDir ?? repoPath, 'git-deploy-extracted')
```

`exportParentDir`는 사용자가 OS 네이티브 폴더 다이얼로그(`package:browseExportDir` IPC, `repository:browse`와 동일한 `dialog.showOpenDialog({ properties: ['openDirectory'] })` 패턴)로 선택한 절대 경로다. 미선택 시 `undefined`이며 이 경우 저장소 루트가 기본값이다.

**저장**: 선택한 `exportParentDir`는 Renderer의 `localStorage`(`gde:exportParentDir` 키, `src/renderer/src/lib/exportPath.ts`)에 저장되는 전역 설정이다 — 저장소별로 구분하지 않는다(DeployFilesPanel 컬럼 폭 저장, `columnWidths.ts`와 동일 패턴). 값을 한 번도 선택하지 않으면 아무것도 저장하지 않고, 매번 현재 `repository.path`를 기본값으로 계산한다.

**덮어쓰기 확인(DR-013)**: `package:export` IPC 핸들러가 `buildPackage()`를 호출하기 **전에** `deployDir`가 이미 존재하고 내용이 있는지(`fs.readdir`가 빈 배열이 아닌지 — 없으면 `ENOENT`를 잡아 false로 취급) 확인한다(`deployDirHasContent`). 있으면 `dialog.showMessageBox`(Main Process, 네이티브 모달 — Renderer에 별도 커스텀 모달 컴포넌트를 두지 않는다, `repository:browse`의 네이티브 다이얼로그와 같은 이유로 일관성 유지)로 "이미 있는 git-deploy-extracted를 덮어씁니다, 계속할까요?"를 확인한다(버튼: `['취소', '계속']`, `defaultId`/`cancelId` 모두 0 — 안전한 선택지가 기본값). 사용자가 "취소"를 선택하면 `buildPackage()`를 호출하지 않고 IPC가 `null`을 반환한다.

**`null` 반환의 의미**: `repository:browse`가 취소 시 `null`을 반환하는 기존 패턴을 그대로 재사용한다(`package:export`의 반환 타입이 `BuildPackageResult | null`로 바뀜). Renderer(`appStore.ts`의 `runExport`)는 `null`을 에러가 아니라 "사용자가 명시적으로 중단함"으로 처리한다 — `exportStatus`를 `'error'`가 아니라 `'idle'`로 되돌리고 에러 배너를 띄우지 않는다.

**모듈 분리**: `getDeployDir(repoPath, exportParentDir)`와 `deployDirHasContent(deployDir)`를 `buildPackage()`와 별도로 export한다 — 덮어쓰기 확인은 실제 파일 삭제/쓰기가 시작되기 전에 IPC 핸들러 레벨에서 먼저 판단해야 하므로, `buildPackage()` 내부에 숨기지 않고 호출자가 먼저 조회할 수 있게 분리했다. `buildPackage.ts`는 여전히 Electron API(`dialog`)에 의존하지 않는 순수 fs 로직으로 유지한다 — Main Process 모듈 중 `ipc/handlers.ts`만 Electron API 경계를 직접 다루는 기존 설계(ARCHITECTURE.md §3)와 일관된다.

**UI 파생 결정**: Mapping Profile 드롭다운은 FooterActionBar에서 숨긴다 — 현재 프로필이 `default` 하나뿐이고 사용자가 커스텀 프로필을 만들거나 편집할 UI가 없어 사실상 무의미하기 때문이다(내부 로직은 `selectedProfile: 'default'`를 그대로 계산에 넘기며 동작 변경 없음). 이 과정에서 `default` 프로필의 `overrides`가 항상 빈 배열이라는 게 재확인되었고(`profileStore.ts`), 즉 Server Path가 사실상 항상 Local Path와 같다는 뜻이므로 `DeployFilesPanel`의 **Server Path 열도 함께 삭제**했다(UI_UX_SPEC.md §2.6).

---

# 5. 결정 사항 요약

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
| Export 결과물 위치(REQ-012) | 사용자가 부모 디렉터리만 선택 가능(네이티브 다이얼로그), 하위 폴더명(`git-deploy-extracted`)은 고정 | 결정 이력 #20(이름 고정)과 일관성 유지 — 이름이 아니라 위치만 커스터마이징. `localStorage` 전역 저장, 2026-08-07 확정 | 해결됨 |
| Export 대상 폴더 덮어쓰기(DR-013) | 기존 내용 있으면 `dialog.showMessageBox`로 확인, 취소 시 중단·기존 내용 보존 | 조용한 데이터 손실 방지("정확하게 추출" 원칙). `package:export`가 취소 시 `null` 반환(`repository:browse` 취소 패턴 재사용), 2026-08-07 확정 | 해결됨 |
