// RISK_ISSUES.md §7.4 — 드래그로 조절한 좌우 분할 비율(0~1, 왼쪽 영역이
// 차지하는 비율)을 저장한다. 컬럼 폭(columnWidths.ts)과 같은 패턴 —
// 전역 설정, 저장소별 구분 없음, 앱 재실행 후에도 유지.
export function loadSplitRatio(storageKey: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 && n < 1 ? n : fallback
  } catch {
    return fallback
  }
}

export function saveSplitRatio(storageKey: string, ratio: number): void {
  localStorage.setItem(storageKey, String(ratio))
}
