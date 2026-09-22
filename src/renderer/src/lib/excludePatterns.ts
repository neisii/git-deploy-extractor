const STORAGE_KEY = 'gde:excludePatterns'

// REQ-019/DR-018 — 전역 설정 하나로 통일한다(저장소별 구분 없음, splitRatio.ts/
// exportPath.ts와 동일 관례). 입력한 패턴은 지우지 않는 한 이력에 남고,
// enabled만 토글해서 켜고 끈다 — 활성 패턴만 실제로 적용된다.
export interface ExcludePatternEntry {
  pattern: string
  enabled: boolean
}

export function loadExcludePatterns(): ExcludePatternEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is ExcludePatternEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as ExcludePatternEntry).pattern === 'string' &&
        typeof (entry as ExcludePatternEntry).enabled === 'boolean'
    )
  } catch {
    return []
  }
}

export function saveExcludePatterns(patterns: ExcludePatternEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
  } catch {
    // 저장 실패는 무시 — 기능에 영향 없음(updateCheckCache.ts와 동일 이유)
  }
}
