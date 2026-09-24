import type { FilePattern } from './filePattern'

const STORAGE_KEY = 'gde:excludePatterns'

// RT-46 — RT-01의 lib/excludePatterns.ts(REQ-019/DR-018, ExcludePatternEntry
// {pattern, enabled})를 대체한다. 저장 키는 기존 그대로 재사용(REQ-019
// 데이터와 호환)하되, 값 형태를 FilePattern({pattern, mode, enabled})으로
// 확장했다 — 기존에 저장된 항목은 mode가 없으므로 'exclude'로 마이그레이션.
export function loadFilePatterns(): FilePattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).pattern === 'string' &&
          typeof (entry as Record<string, unknown>).enabled === 'boolean'
      )
      .map((entry) => ({
        pattern: entry.pattern as string,
        enabled: entry.enabled as boolean,
        mode: entry.mode === 'include' ? 'include' : 'exclude'
        // B안(2026-09-24) — screenOnly 필드 제거. 기존에 저장돼 있던 값은
        // (릴리스 전 필드라 실사용자 데이터 없음) 그냥 무시된다.
      }))
  } catch {
    return []
  }
}

export function saveFilePatterns(patterns: FilePattern[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
  } catch {
    // 저장 실패는 무시 — 기능에 영향 없음(updateCheckCache.ts와 동일 이유)
  }
}
