# Git Deploy Extractor

Git Commit 이력을 기반으로 배포 대상 파일을 자동 추출하여, 망 분리 환경에서
내부망으로 안전하게 전달할 Deploy Package를 생성하는 크로스플랫폼 Desktop
Application.

요구사항/설계 문서는 저장소 루트의 `REQUIREDMENT.md`, `ARCHITECTURE.md`,
`DETAILED_DESIGN.md`, `UI_UX_SPEC.md`, `PHASE_PLAN.md`를 참고한다.

## 목차

- [파일 추출 기준](#파일-추출-기준)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Development](#development)
- [Install](#install)
  - [방법 1. 빌드된 실행 파일 다운로드](#방법-1-빌드된-실행-파일-다운로드)
  - [방법 2. 저장소를 clone해 직접 빌드](#방법-2-저장소를-clone해-직접-빌드)
- [Contributing](#contributing)
- [License](#license)

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
    적용된다(7번과 동일).
12. **파일 패턴(제외/포함)**: 위 1~11번과 별개로, 사용자가 등록한 패턴(파일명·
    경로·Java 패키지 표기 지원)에 매치되는 파일은 "포함된 파일"/"Extract
    대상" 어느 쪽에 있든 실제 추출 대상에서 항상 제외된다(제외 패턴이 항상
    우선, 포함 패턴이 하나라도 활성화돼 있으면 그중 하나 이상에 매치돼야
    남는다). 한 번 등록한 패턴은 앱을 재실행해도 유지되는 지속적 규칙이다
    (추가, 2026-09-24).

알고리즘 근거와 재현 테스트 이력은 `DETAILED_DESIGN.md` §1(Mapping),
§3(Commit 분석), §4(플랫폼 이슈), §6(의존성 완결성 검사), §18(파일 패턴·
Extract 대상 모델)을, 구현은 `src/main/analysis/`(`dependencyAnalysis/`,
`java/parseJavaFile.ts` 포함), `src/main/mapping/`,
`src/main/package/buildPackage.ts`, `src/renderer/src/lib/filePattern.ts`를
참고한다.

## Tech Stack

Electron + React + TypeScript, `electron-vite`로 Main/Preload/Renderer
프로세스를 빌드한다 (ARCHITECTURE.md §2, §3).

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

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

## Contributing

이슈/버그 제보는 [GitHub Issues](https://github.com/neisii/git-deploy-extractor/issues)로
남겨준다. PR을 보낼 땐 관련 설계 문서(`REQUIREDMENT.md` 등)와 상충하는 변경이 아닌지
먼저 확인하고, 변경 사항이 요구사항/설계에 영향을 준다면 문서도 함께 갱신해달라.

## License

[MIT](LICENSE) © 2026 [neisii](https://github.com/neisii)

단, `src/renderer/src/assets/goraeng.png`는 MIT 라이선스 대상에서 제외된다 —
저작권은 neisii에게 있으며 무단전재 및 재배포를 금지한다(자세한 내용은 `LICENSE` 참고).
