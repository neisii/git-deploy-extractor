# Git Deploy Extractor

Git Commit 이력을 기반으로 배포 대상 파일을 자동 추출하여, 망 분리 환경에서
내부망으로 안전하게 전달할 Deploy Package를 생성하는 크로스플랫폼 Desktop
Application.

현재 버전: **v0.9.1** (2026-09-28)

## 목차

- [주요 기능](#주요-기능)
- [파일 추출 기준](#파일-추출-기준)
- [Export 산출물](#export-산출물)
- [사용자 데이터 저장 위치](#사용자-데이터-저장-위치)
- [Tech Stack](#tech-stack)
- [프로젝트 구조](#프로젝트-구조)
- [Setup](#setup)
- [Development](#development)
- [Test](#test)
- [CI / Release](#ci--release)
- [Install](#install)
  - [방법 1. 빌드된 실행 파일 다운로드](#방법-1-빌드된-실행-파일-다운로드)
  - [방법 2. 저장소를 clone해 직접 빌드](#방법-2-저장소를-clone해-직접-빌드)
- [문서](#문서)
- [Contributing](#contributing)
- [License](#license)

## 주요 기능

- **Repository / Branch 선택**: 로컬 Git 저장소를 고르고 Branch를 검색해 선택한다.
  저장소/브랜치 요약 라벨이 상단에 표시되며, Reload로 최신 상태를 다시 읽는다.
- **Commit 조회 조건**: 조회 기간·최대 개수에 더해 아래 조건을 AND로 조합한다.
  - 키워드(한 줄에 하나, 커밋 메시지 부분 일치, 앞에 `-`를 붙이면 제외 조건)
  - 작성자(여러 명을 쉼표·공백·줄바꿈으로 구분, 하나라도 일치하면 포함)
  - Merge 커밋 제외
  - 해시 목록(정확히 일치, 축약 해시 허용) — 값이 있으면 다른 모든 조건을 무시한다
- **Commit 다중 선택 → Preview**: 선택한 커밋들의 변경 파일을 합쳐 배포 대상/삭제
  대상/Warning을 계산한다. 조회 조건이 바뀌어도 이미 선택한 커밋은 유지된다.
- **Extract 대상 이동 모델**: 좌측 "포함된 파일"에서 체크한 파일이 우측
  "Extract 대상"으로 옮겨가고, Extract 대상에 있는 파일만 Export된다(×/"모두
  되돌리기"로 원위치). 좌측 목록은 `*` 와일드카드를 지원하는 파일명 검색으로
  좁혀볼 수 있다.
- **파일 추가 팝업**: HEAD 트리 전체를 폴더 트리로 탐색하거나 검색해 임의 파일을
  배포 대상에 추가한다. Java/Spring 의존성 완결성 검사로 찾은 "누락된 의존성"도
  이 트리 안에 붉은 글자 + 종류 배지(`Impl`/`I`)로 표시되고, "+ 파일 추가" 버튼에
  `누락 N` 배지로 남은 개수가 상시 표시된다.
- **파일 패턴(제외/포함)**: 파일명·경로·Java 패키지 표기로 패턴을 등록해 켜고
  끈다. "포함된 파일"·"Extract 대상"·파일 추가 팝업 모두에 적용되며, 파일 추가
  팝업 안에서도 접이식 입력으로 바로 패턴을 추가할 수 있다(v0.9.0).
- **Mapping Profile**: 특정 Local Path를 Server Path로 1:1 치환하는 규칙을
  프로필 단위로 관리한다.
- **Export**: 두 가지 추출 위치 방식 중 선택한다 — 선택한 부모 폴더 아래
  `git-deploy-extracted` 폴더를 만들어 추출(기본) 또는 완전히 빈 폴더에 바로 추출.
  저장소 자신/하위/상위 경로는 어느 방식이든 차단된다.
- **업데이트 알림**: 실행 시 GitHub Releases의 최신 버전을 확인해 새 버전이 있으면
  알려준다. 오프라인이거나 확인에 실패해도 핵심 기능에는 영향이 없다.

## 파일 추출 기준

1. **대상 범위**: 사용자가 고른 Branch에서, 목록에 표시된 커밋 중 체크박스로
   선택한 커밋(들)만 대상이다. 선택한 커밋이 여러 개면 그 전부를 합쳐서 판단한다.
2. **커밋 하나의 변경 파일**: `git diff-tree <commit>^1 <commit>`로 그 커밋과
   바로 이전 부모 커밋의 트리를 직접 비교한다(부모가 없는 최초 커밋은 빈 트리와
   비교). Merge Commit이어도 항상 첫 번째 부모만 기준으로 비교하며, 두 번째 이후
   부모 쪽에만 있는 변경은 보지 않는다.
3. **여러 커밋 선택 시 합치는 방식**: 선택된 모든 커밋에서 나온 변경을 파일
   경로별로 모아 상태(Added/Modified/Deleted)를 합친다 — 이때 **Delete가
   우선**한다. 선택 범위 안의 어느 한 커밋에서라도 그 경로가 삭제됐다면, 이후
   다른 커밋에서 다시 추가/수정됐어도 무조건 삭제 대상(`extract-list.txt`의
   "삭제 대상 파일" 목록)으로 확정한다.
4. **Delete가 아닌 파일(Added/Modified)**: 실제로 배포 대상에 포함되려면
   **현재 Branch의 HEAD**에 그 파일이 존재해야 한다. 선택 범위 이후 다른 커밋이
   그 파일을 다시 지웠다면 HEAD엔 없으므로, 추출하지 않고 Warning으로만 표시한다.
5. **실제로 복사되는 내용은 항상 HEAD 기준 최신본이다.** 선택한 커밋 시점의
   과거 스냅샷이 아니라, 그 경로의 지금 최신 버전을 그대로 복사한다. 원본 바이트를
   그대로 옮기며 줄바꿈(CRLF/LF)이나 인코딩을 변환하지 않는다.
6. **Rename은 별도로 감지하지 않는다.** git이 Rename으로 인식하는 변경도
   이 도구에서는 항상 예전 경로의 Delete + 새 경로의 Add 두 건으로 따로 처리된다
   — 최종적으로 새 경로가 배포 대상에, 예전 경로가 삭제 대상에 들어가는 결과는
   같지만, 사용자가 화면에서 "이건 사실 Rename이구나"를 직접 판단해야 한다.
7. **경로 매핑(Local Path → Server Path)**: 기본은 원본 경로를 그대로 쓴다.
   `src/main/java/**`, `src/main/resources/**` 하위는 Mapping Profile을 조회하지
   않고 항상 원본 경로를 유지한다. 그 외 경로만 Mapping Profile에 정확히 일치하는
   1:1 override가 있을 때 그 경로로 바뀐다(와일드카드 없음, 대소문자 구분).
8. **사용자가 마지막에 개별 파일을 선택한다.** Preview 직후에는 전부 "포함된
   파일"(미선택) 상태로 시작하며, 체크한 파일만 "Extract 대상"으로 옮겨져
   최종 추출/`extract-list.txt`의 "배포 대상 파일" 목록에 들어간다(정정,
   2026-09-24 — 예전엔 반대로 "전부 선택된 상태에서 해제로 제외"하는
   방식이었다). 등록한 파일 패턴(제외/포함, 아래 참고)에 걸리는 파일은
   Extract 대상에 있어도 실제로는 추출되지 않는다.
9. **안전장치**: 대소문자만 다른 두 경로가 같은 Server Path로 매핑되면(파일시스템이
   두 경로를 같은 파일로 착각할 수 있어) 아무 파일도 쓰지 않고 즉시 중단한다.
10. **Java/Spring 의존성 완결성 검사(선택적, HEAD 기준 별도 경로)**: 위 1~9번은
    전부 "선택한 Commit의 변경 파일"에서 출발하지만, 이 검사는 커밋 diff와
    무관하게 **현재 배포 대상 목록에 이미 있는 Java 파일들이 참조하는 다른
    Java 파일이 목록에 빠져 있는지**를 HEAD 트리 기준으로 직접 확인한다(import
    문, Spring DI로 주입되는 인터페이스 → 그 인터페이스를 구현하는 클래스).
    Java/Spring 단일 모듈(`@SpringBootApplication` 클래스를 찾을 수 있는
    경우)에서만 동작하며, 사용자가 확인 후 개별적으로 또는 한 번에 배포 대상에
    추가할 수 있다. 추가된 파일도 원본 바이트 그대로 복사되고(5번과 동일),
    Mapping Rule도 동일하게 적용된다(7번과 동일) — 다른 점은 오직 "어떻게
    후보 목록에 들어왔는가"뿐이다.
11. **파일 수동 추가(선택적, HEAD 기준 별도 경로)**: 10번과 마찬가지로 커밋
    diff와 무관하게, 선택된 Branch의 HEAD 트리에 있는 임의 파일을 사용자가
    직접 찾아 배포 대상에 추가할 수 있다. Java 파일로 제한되지 않으며,
    코드 참조 관계도 요구하지 않는다 — 이전 배포 회차에서 리비전 동기화
    문제로 누락된 파일처럼, 10번의 의존성 완결성 검사로는 원리적으로 잡을 수
    없는 경우(이번 배포 대상과 코드로 연결돼 있지 않은 파일)를 사용자 판단으로
    보완하기 위함이다. **정정(2026-09-24)**: 검색어 입력 없이도 HEAD 트리
    전체를 폴더 트리로 훑어볼 수 있고(예전엔 자동완성 검색만 지원), 후보를
    클릭해야만 추가된다(오타로 잘못된 경로가 추가되는 것을 방지). 추가된
    파일도 원본 바이트 그대로 복사되고(5번과 동일) Mapping Rule도 동일하게
    적용된다(7번과 동일). **정정(2026-09-28)**: 활성 파일 패턴(12번)에 걸리는
    후보는 이 팝업에서 아예 숨겨진다 — 추가해도 어차피 Export에서 빠질 파일을
    미리 걸러낸다.
12. **파일 패턴(제외/포함)**: 위 1~11번과 별개로, 사용자가 등록한 패턴(파일명·
    경로·Java 패키지 표기 지원)에 매치되는 파일은 "포함된 파일"/"Extract
    대상" 어느 쪽에 있든 실제 추출 대상에서 항상 제외된다(제외 패턴이 항상
    우선, 포함 패턴이 하나라도 활성화돼 있으면 그중 하나 이상에 매치돼야
    남는다). 한 번 등록한 패턴은 앱을 재실행해도 유지되는 지속적 규칙이다
    (추가, 2026-09-24). Extract 대상에 있는데 패턴에 걸린 파일은 숨기지 않고
    흐리게+취소선+"패턴 제외" 태그로 표시해 조용히 빠지는 일이 없게 한다.
    **정정(2026-09-28)**: 패턴 저장소를 localStorage에서 파일(`patterns.json`,
    아래 [사용자 데이터 저장 위치](#사용자-데이터-저장-위치) 참고)로 옮겼다.
    기존 localStorage 값은 최초 실행 시 한 번 자동으로 이관된다.

알고리즘 근거와 재현 테스트 이력은 `DETAILED_DESIGN.md` §1(Mapping),
§3(Commit 분석), §4(플랫폼 이슈), §6(의존성 완결성 검사), §18(파일 패턴·
Extract 대상 모델)을, 구현은 `src/main/analysis/`(`dependencyAnalysis/`,
`java/parseJavaFile.ts` 포함), `src/main/mapping/`,
`src/main/package/buildPackage.ts`, `src/main/patterns/patternStore.ts`,
`src/renderer/src/lib/filePattern.ts`를 참고한다.

## Export 산출물

Export하면 배포 대상 파일이 Server Path 구조 그대로 복사되고, 같은 위치에
`extract-list.txt` 하나가 함께 생성된다(예전의 `deploy-files.txt`·
`delete-list.txt`·`deploy-summary.json` 세 파일을 통합).

- 머리말: 생성 시각, 기준 Branch, 원본 커밋 이력
- 배포 대상 파일 트리
- 삭제 대상 파일 트리 — 삭제 파일은 복사되지 않으므로 내부망에서 이 목록을 보고
  직접 지운다

## 사용자 데이터 저장 위치

Electron `userData` 디렉터리(macOS: `~/Library/Application Support/git-deploy-extractor`,
Windows: `%APPDATA%\git-deploy-extractor`) 아래에 평범한 JSON으로 저장한다.
텍스트 에디터로 직접 고치거나, 파일째 복사해 팀원과 공유할 수 있다.

| 경로 | 내용 |
| --- | --- |
| `profiles/<name>.json` | Mapping Profile (비어 있으면 최초 실행 시 기본 프로필을 생성) |
| `patterns.json` | 파일 패턴(제외/포함) 목록 — 저장소 구분 없이 전역 하나 |

## Tech Stack

Electron + React + TypeScript, `electron-vite`로 Main/Preload/Renderer
프로세스를 빌드한다 (ARCHITECTURE.md §2, §3).

| 영역 | 사용 기술 |
| --- | --- |
| 런타임 / UI | Electron 39, React 19, TypeScript 5.9 |
| 빌드 / 패키징 | electron-vite 5 (Vite 7), electron-builder 26 |
| 상태 관리 | zustand 5 (slice 단위 분리) |
| 대용량 목록 | react-window 2 |
| Java 정적 분석 | java-parser 3 |
| 테스트 | Vitest (단위), Playwright (E2E, Electron 실행) |
| 품질 | ESLint 9, Prettier 3 |

Git 작업은 라이브러리 없이 시스템에 설치된 `git` CLI를 직접 호출한다
(`src/main/git/exec.ts`) — 실행 환경에 `git`이 PATH에 있어야 한다.

## 프로젝트 구조

```
src/
├── main/                 # Electron Main 프로세스
│   ├── git/              # git CLI 래퍼 (commits, diff, ls-tree, show, grep)
│   ├── analysis/         # 커밋 분석·배포 계획 계산·Java 의존성 분석
│   ├── mapping/          # Mapping Profile 저장소, Server Path 계산
│   ├── patterns/         # 파일 패턴 저장소 (patterns.json)
│   ├── package/          # Export 대상 검증, 패키지 생성, extract-list.txt
│   ├── update/           # GitHub Release 업데이트 확인
│   └── ipc/              # IPC 핸들러(채널 그룹별) · 입력 검증 · 다이얼로그
├── preload/              # contextBridge로 window.api 노출
├── renderer/src/         # React UI
│   ├── components/       # 화면 컴포넌트 (deployFiles/ = 배포 파일 작업 영역)
│   ├── store/            # zustand 스토어 + slices/
│   ├── services/         # 조회 파라미터·Export 계획 등 순수 로직
│   ├── lib/              # 훅·유틸 (트리, 패턴 매칭, 디바운스 등)
│   └── api/              # window.api 래퍼
└── shared/               # Main/Renderer 공용 타입·IPC 채널 정의
e2e/                      # Playwright E2E 테스트
build/                    # 아이콘, afterPack(로케일 정리) 등 패키징 리소스
docs/                     # 보조 문서·HTML 와이어프레임/다이어그램
```

## Setup

```bash
npm install
```

## Development

```bash
npm run dev          # HMR 개발 서버로 앱 실행
npm run start        # 빌드 결과물 미리보기
npm run typecheck    # Main/Renderer 타입 검사
npm run lint         # ESLint
npm run format       # Prettier
npm run build:unpack # 설치 파일 없이 패키징된 앱 디렉터리만 생성
```

## Test

```bash
npm test             # Vitest 단위 테스트 (*.test.ts, 일부는 임시 git 저장소 fixture 사용)
npm run test:watch   # watch 모드
npm run test:e2e     # 빌드 후 Playwright로 실제 Electron 창을 띄워 E2E 실행
```

## CI / Release

- **CI** (`.github/workflows/ci.yml`): `main` push와 PR에서 `typecheck` → `lint`
  → `test`를 실행한다. E2E는 Electron 창이 필요해 CI에서는 아직 돌리지 않는다.
- **Release** (`.github/workflows/release.yml`): `v*` 태그를 push하면 macOS(`.dmg`)·
  Windows(`.exe`)를 빌드해 GitHub Release에 첨부한다. 코드 서명은 하지 않는다.

## Install

두 가지 방법 중 하나를 선택한다.

### 방법 1. 빌드된 실행 파일 다운로드

[GitHub Releases](https://github.com/neisii/git-deploy-extractor/releases)에서 OS에 맞는 설치 파일(Windows: `.exe`, macOS: `.dmg`)을 받아 실행한다.

> [!WARNING]
> 이 프로젝트는 유료 코드 서명 인증서를 사용하지 않는다 — 설치 파일 실행 시 아래 보안 경고가 뜰 수 있지만, 악성코드가 아니라 서명 평판이 없어서 뜨는 정상적인 경고다.
>
> - **Windows**: "Windows에서 PC를 보호했습니다" 창이 뜨면 **추가 정보 → 실행**을 누른다.
> - **macOS**: "손상되었으므로 열 수 없습니다" 메시지가 뜨면 앱을 휴지통으로 보내지 말고, **시스템 설정 → 개인정보 보호 및 보안**에서 아래로 스크롤해 **확인 없이 열기**를 누르거나 터미널에서 다음을 실행한다:
>   ```bash
>   xattr -cr "/Applications/Git Deploy Extractor.app"
>   ```
>
> 이 경고는 인터넷에서 다운로드한 파일에만 Windows(Zone.Identifier)/macOS(quarantine)가 출처 표시를 붙여서 뜬다 — 아래 방법 2(직접 빌드)처럼 다운로드 과정 없이 로컬에서 바로 실행하면 뜨지 않는다. 로컬 빌드와 CI 빌드는 서명 상태가 동일하므로 workflow 자체의 한계는 아니다.

### 방법 2. 저장소를 clone해 직접 빌드

```bash
git clone https://github.com/neisii/git-deploy-extractor.git
cd git-deploy-extractor
npm install

# Windows
npm run build:win

# macOS
npm run build:mac
```

macOS/Windows만 지원한다 (REQUIREDMENT.md §10).

**정정 (Intel Mac 미지원, 2026-08-09)**: macOS 빌드는 Apple Silicon(arm64) 전용이다. Intel Mac(x64)은 지원하지 않는다 — universal 바이너리는 두 아키텍처를 한 파일에 담아 용량이 거의 2배가 되므로, 패키징 용량 절감 목적과 반대 방향이라 채택하지 않았다(`electron-builder.yml` `mac.target.arch: [arm64]`로 명시). 같은 작업에서 Chromium 기본 번들 로케일(220개 언어)도 `ko`/`en`만 남기도록 잘라냈다(`build/afterPack.js`) — mac 앱 번들 기준 261MB → 218MB(-16%). RISK_ISSUES.md 결정 이력 참고.

## 문서

| 문서 | 내용 |
| --- | --- |
| `PRD.md` | 제품 개요·목표 |
| `REQUIREDMENT.md` | 요구사항(REQ-xxx)·판정 규칙(DR-xxx) |
| `ARCHITECTURE.md` | 프로세스 구조·모듈 경계 |
| `DETAILED_DESIGN.md` | 알고리즘·구현 상세 |
| `UI_UX_SPEC.md` | 화면 구성·상호작용 명세 |
| `RISK_ISSUES.md` | 리스크·결정 이력 |
| `PHASE_PLAN.md` | 단계별 개발 계획 |
| `HANDOFF.md` | 작업 인계 기록 |
| `docs/refactoring/REFACTORING_TASKS.md` | 리팩토링 과제(RT-xx) 기록 (동결) |

## Contributing

이슈/버그 제보는 [GitHub Issues](https://github.com/neisii/git-deploy-extractor/issues)로
남겨준다. PR을 보낼 땐 관련 설계 문서(`REQUIREDMENT.md` 등)와 상충하는 변경이 아닌지
먼저 확인하고, 변경 사항이 요구사항/설계에 영향을 준다면 문서도 함께 갱신해달라.

## License

[MIT](LICENSE) © 2026 [neisii](https://github.com/neisii)

단, `src/renderer/src/assets/goraeng.png`는 MIT 라이선스 대상에서 제외된다 —
저작권은 neisii에게 있으며 무단전재 및 재배포를 금지한다(자세한 내용은 `LICENSE` 참고).
