import type { ExportMode } from '../../../shared/types'

const STORAGE_KEY = 'gde:exportParentDir'
const MODE_STORAGE_KEY = 'gde:exportMode'

// splitRatio.ts와 동일 패턴 — 전역 설정 하나로 통일한다(저장소별 구분
// 없음, RISK_ISSUES.md §7.1). RT-56(REQ-012 정정)부터는 경로를 한 번도
// 안 고르면 Export 자체가 막히므로(저장소 루트 기본값 폐지), 저장된
// 값이 없으면 null을 돌려준다 — 호출부가 "선택 안 됨"으로 취급한다.
export function loadExportParentDir(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveExportParentDir(path: string): void {
  localStorage.setItem(STORAGE_KEY, path)
}

// RT-56(U-16) — Export 방식(sub/direct) 선택은 전역 저장(M-27), 기본값
// 'sub'. 저장된 값이 손상됐거나(구버전 잔재 등) 둘 중 하나가 아니면
// 기본값으로 되돌린다(splitRatio.loadSplitRatio와 동일한 방어).
export function loadExportMode(): ExportMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY)
    return raw === 'direct' ? 'direct' : 'sub'
  } catch {
    return 'sub'
  }
}

export function saveExportMode(mode: ExportMode): void {
  localStorage.setItem(MODE_STORAGE_KEY, mode)
}

// 실제로 파일이 생길 위치를 화면에 보여주기 위한 표시용 문자열
// (§5.1 RT-56). sub는 <선택 경로>/git-deploy-extracted, direct는
// <선택 경로> 그대로. 네이티브 폴더 다이얼로그가 돌려준 경로의 구분자
// 스타일(Windows `\` vs POSIX `/`)을 그대로 따라간다 — 이 앱엔 node
// path 모듈이 렌더러에 없으므로 문자열 안의 구분자를 보고 판단한다.
export function formatDeployDirDisplay(exportParentDir: string, mode: ExportMode): string {
  if (mode === 'direct') return exportParentDir
  const sep = exportParentDir.includes('\\') ? '\\' : '/'
  const trimmed = exportParentDir.replace(/[/\\]+$/, '')
  return `${trimmed}${sep}git-deploy-extracted`
}
