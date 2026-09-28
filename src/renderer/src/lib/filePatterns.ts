import type { FilePattern } from './filePattern'

const LEGACY_STORAGE_KEY = 'gde:excludePatterns'

// REQ-026 정정(2026-09-28) — 파일 패턴 저장소가 localStorage에서 Main이
// 관리하는 파일(patterns.json)로 옮겨갔다. 이 함수는 그 전환의 1회성
// 마이그레이션 전용이다 — deployFilesSlice의 initFilePatterns()가 파일이
// 비어 있을 때만(아직 한 번도 마이그레이션 안 한 최초 실행) 호출해
// 예전 localStorage 값을 읽어 새 파일에 옮겨 쓴다. 옮긴 뒤에는 파일에
// 데이터가 생기므로 이 함수가 다시 호출될 일이 없다 — 저장(save)은 더
// 이상 하지 않는다(patterns:save IPC로 대체).
export function loadLegacyFilePatterns(): FilePattern[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
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
      }))
  } catch {
    return []
  }
}
