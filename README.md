# Git Deploy Extractor

Git Commit 이력을 기반으로 배포 대상 파일을 자동 추출하여, 망 분리 환경에서
내부망으로 안전하게 전달할 Deploy Package를 생성하는 크로스플랫폼 Desktop
Application.

요구사항/설계 문서는 저장소 루트의 `REQUIREDMENT.md`, `ARCHITECTURE.md`,
`DETAILED_DESIGN.md`, `UI_UX_SPEC.md`, `PHASE_PLAN.md`를 참고한다.

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
