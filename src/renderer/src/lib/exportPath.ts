const STORAGE_KEY = 'gde:exportParentDir'

// columnWidths.ts와 동일 패턴 — 전역 설정 하나로 통일한다(저장소별 구분
// 없음, RISK_ISSUES.md §7.1). 커스텀 경로를 한 번도 안 고르면 저장소
// 루트가 기본값이므로, 저장된 값이 없으면 null을 돌려준다.
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
