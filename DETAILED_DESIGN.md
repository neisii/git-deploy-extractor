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

# 8. 커밋 선택 유지 및 파일명 검색 설계 (REQ-015/016, DR-015, RISK_ISSUES.md §6.1/§7.3)

## 8.1 선택 유지/초기화 (DR-015)

`loadCommitsFirstPage(keepSelection = false)`가 Renderer(`appStore.ts`)의 모든 커밋 재조회 경로의 단일 진입점이다. 호출자가 `keepSelection`을 명시적으로 넘긴다.

| 호출자 | keepSelection | 근거 |
|---|---|---|
| `browseRepository()` | `false`(기본값) | DR-015 예외 (a) — 다른 저장소 |
| `setBranch()` | `false`(기본값) | DR-015 예외 (b) — 다른 Branch |
| `reloadRepository()` | `true` | 같은 저장소를 다시 읽을 뿐, 예외 (a)/(b) 어느 쪽도 아님 |
| `setSearchTerm()`(디바운스), `triggerSearch()`, `setSearchMode()`, `setDateRange()`, `setMaxCount()` | `true` | 검색 조건만 바뀜 — REQ-015가 유지를 요구하는 대상 |

`keepSelection=false`일 때만 `set()` 페이로드에 `selectedHashes: new Set()`을 포함시키고, `true`면 아예 그 필드를 생략해 기존 `Set`을 그대로 둔다(스프레드 조건부 포함 — `...(keepSelection ? {} : { selectedHashes: new Set() })`).

**Preview 관련 상태는 keepSelection과 무관하게 항상 리셋된다**(`summary`/`deployFiles`/`deleteList`/`warnings`/`analyzedSelection`/의존성 상태). `commits` 목록 자체가 매번 새로 로드되므로, `selectedHashes`가 그대로여도 "마지막 Preview가 지금 선택과 일치하는가"는 항상 다시 확인시킨다 — `isStale`이 즉시 true가 되어 사용자가 `[Preview]`를 다시 눌러야 한다(REQ-015 이전부터 있던 안전장치, 이번 기능으로 바뀌지 않음).

## 8.2 레이스 컨디션 가드 (§6.1 케이스 C)

`runAnalysis()`가 IPC 응답을 받은 시점에, 요청을 보낸 시점의 선택(`requestSelection`)과 **현재** `selectedHashes`/`selectedBranch`/`selectedProfile`이 여전히 같은지 확인한다(`selectionMatches()` — `selectIsAnalysisStale`과 비교 로직을 공유). 다르면(계산 중 사용자가 체크박스를 바꿨다면) 결과를 적용하지 않고 조용히 버린다 — `analyzedSelection`이 "요청 시점의 옛 선택"을 가리키게 되는 걸 막기 위함이다. 이 가드는 메인 Preview 계산과 §7.2 의존성 체이닝 호출 양쪽에 동일하게 적용된다(성공/실패 경로 전부).

REQ-015로 선택이 여러 검색을 거쳐 누적되면서 "Preview 계산 중에 다시 검색해 선택을 바꾸는" 시나리오가 실사용에서 더 자주 노출될 수 있다고 판단해, 이번 세션에서 §6.1 케이스 C(원래 미결정)를 같이 고쳤다(사용자 확인).

## 8.3 파일명으로 커밋 검색 (REQ-016)

**2단계 git 명령** (`src/main/git/commits.ts`):

```
1. git ls-tree -r <branch> --name-only        (listTrackedFiles 재사용, §6.3과 동일 함수)
2. 파일명(경로 마지막 조각) 부분 일치로 클라이언트 측 필터링
3. git log <branch> --since --until --pretty=format:... --skip --n -- <path1> <path2> ...
```

기존 메시지 검색(`--grep=<term> -i`)과는 완전히 다른 인자 구성이라 `listCommits()` 내부에서 `searchMode`로 분기한다 — `searchMode==='filename'`이면 `--grep`을 붙이는 대신 pathspec(`--`)을 맨 끝에 붙인다.

**재현으로 확인한 git 함정 (§0.1)**: `git log ... --`처럼 `--` 뒤에 경로를 하나도 안 주면 pathspec이 "없음"으로 해석되어 **필터링되지 않은 전체 커밋**을 돌려준다 — 빈 배열을 "매치 없음"으로 의도했다면 정반대의 결과가 나오는 함정이다. 실제 저장소로 재현해 확인했고, 매치된 경로가 0건이면 git을 아예 호출하지 않고 `{ commits: [], hasMore: false }`를 바로 반환하는 방식으로 회피했다.

pathspec 필터링과 `--skip`/`-n` 페이지네이션이 함께 정상 동작하는지도 재현 테스트로 확인했다(`--skip=1 -n 1 -- a b`가 필터링된 3건 중 2번째 항목만 정확히 반환).

**모드 전환 UI**: BranchSearchBar에 "검색 대상 : (●메시지 ○파일명)" 라디오 토글 추가(RISK_ISSUES.md §7.5 TO-BE 와이어프레임 그대로). 모드를 바꾸면 같은 검색어로 즉시 재조회하며(`keepSelection=true`), 검색어 자체는 지우지 않는다.

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
| Export 결과물 위치(REQ-012) | 사용자가 부모 디렉터리만 선택 가능(네이티브 다이얼로그), 하위 폴더명(`git-deploy-extracted`)은 고정 | 결정 이력 #20(이름 고정)과 일관성 유지 — 이름이 아니라 위치만 커스터마이징. `localStorage` 전역 저장, 2026-08-07 확정 | 해결됨 |
| Export 대상 폴더 덮어쓰기(DR-013) | 기존 내용 있으면 `dialog.showMessageBox`로 확인, 취소 시 중단·기존 내용 보존 | 조용한 데이터 손실 방지("정확하게 추출" 원칙). `package:export`가 취소 시 `null` 반환(`repository:browse` 취소 패턴 재사용), 2026-08-07 확정 | 해결됨 |
| Java 파싱 라이브러리(REQ-013) | `java-parser`(chevrotain 기반) 채택 | 실제 프로덕션 도구(prettier-java)가 쓰는 라이브러리, 재현 테스트로 실사용 Java 문법 파싱 확인. 전이 의존성 npm audit 경고(lodash)는 공격 표면 없다고 판단해 감수 | 낮음 — 업스트림이 lodash 의존성 정리하면 재검토 |
| Base package 감지(DR-014) | `@SpringBootApplication` grep 사전필터 + 파싱 확정, 못 찾거나 모호하면 비활성화 | 하드코딩 금지 원칙(결정 이력 #3) 준수, "단순화 우선" | 해결됨 |
| 심볼 참조 해석 모호성(DR-014) | import→같은 패키지→유일한 이름→같은 패키지 후보 순으로 시도, 그래도 모호하면 포기 | 완전한 classpath 기반 해석은 범위 밖(과설계 방지). 같은 단순 이름이 여러 패키지에 있는 극단적 케이스만 False Negative 가능성 있음(알려진 한계) | 낮음 |
| SplitPane 기본 비율/최소폭(REQ-014) | MainGrid 80:20(320px/180px, 결정 이력 #22 계승), DeployFilesPanel 50:50(260px/260px, 이번에 신규 결정) | MainGrid는 기존 비대칭 근거 유지, DeployFilesPanel 좌우는 동일 성격 콘텐츠라 대칭 + 가로 스크롤 안전망 존재 | 낮음 |
| 커밋 선택 유지 범위(REQ-015, DR-015) | Repository 전환·Branch 전환만 초기화, 그 외(Reload/검색/기간/개수)는 유지 | RISK_ISSUES.md §6.1 케이스 A/B를 사용자 확인 후 확정 — "다른 저장소/Branch 커밋이 섞이는 위험"만 예외로 남김 | 해결됨 |
| Preview 레이스 컨디션(§6.1 케이스 C) | IPC 응답 시점에 요청 시점 선택과 비교, 다르면 결과 폐기 | REQ-015로 검색 반복 워크플로우가 늘면서 노출 가능성도 같이 커진다고 판단해 이번에 같이 수정(사용자 확인) | 해결됨 |
| 커밋 목록 카운터 UI(§6.1 케이스 D) | 추가하지 않음 | "이번 요구사항 범위를 넘음"으로 이미 결론난 사안, §0.2에 따라 범위 유지 | 후속 제안으로만 남김 |
| Preview 재계산 시 included 상태(§6.1 케이스 E) | 수정하지 않음(기존 동작 유지) | 이번 기능이 만든 문제가 아니고, 고치려면 범위가 커짐 — 알려진 한계로만 문서화 | 알려진 한계 |
| 파일명 커밋 검색 pathspec(REQ-016) | `git log ... -- <path1> <path2> ...`, 매치 0건이면 git 호출 자체를 생략 | `--` 뒤 경로가 없으면 "필터 없음"으로 해석되어 전체 커밋이 반환되는 함정을 재현 테스트로 발견 | 해결됨 |
