# Git Deploy Extractor

Git Commit 이력을 기반으로 배포 대상 파일을 자동 추출하여, 망 분리 환경에서
내부망으로 안전하게 전달할 Deploy Package를 생성하는 크로스플랫폼 Desktop
Application.

요구사항/설계 문서는 저장소 루트의 `REQUIREDMENT.md`, `ARCHITECTURE.md`,
`DETAILED_DESIGN.md`, `UI_UX_SPEC.md`, `PHASE_PLAN.md`를 참고한다.

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
   다른 커밋에서 다시 추가/수정됐어도 무조건 삭제 대상(`delete-list.txt`)으로
   확정한다.
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
8. **사용자가 마지막에 개별 파일을 제외할 수 있다** — Preview로 계산된 목록에서
   체크박스를 해제한 파일은 최종 추출/`deploy-files.txt`에서 빠진다.
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

알고리즘 근거와 재현 테스트 이력은 `DETAILED_DESIGN.md` §1(Mapping),
§3(Commit 분석), §4(플랫폼 이슈), §6(의존성 완결성 검사)를, 구현은
`src/main/analysis/`(`dependencyAnalysis.ts`, `java/parseJavaFile.ts` 포함),
`src/main/mapping/`, `src/main/package/buildPackage.ts`를 참고한다.

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

## Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac
```

macOS/Windows만 지원한다 (REQUIREDMENT.md §10).

## Contributing

이슈/버그 제보는 [GitHub Issues](https://github.com/neisii/git-deploy-extractor/issues)로
남겨준다. PR을 보낼 땐 관련 설계 문서(`REQUIREDMENT.md` 등)와 상충하는 변경이 아닌지
먼저 확인하고, 변경 사항이 요구사항/설계에 영향을 준다면 문서도 함께 갱신해달라.

## License

[MIT](LICENSE) © 2026 [neisii](https://github.com/neisii)

단, `src/renderer/src/assets/goraeng.png`는 MIT 라이선스 대상에서 제외된다 —
저작권은 neisii에게 있으며 무단전재 및 재배포를 금지한다(자세한 내용은 `LICENSE` 참고).
