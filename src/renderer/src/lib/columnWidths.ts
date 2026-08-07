const STORAGE_KEY = 'gde:deployFilesColumnWidths'

// §7.2로 DeployFilesPanel이 좌(포함된 파일)/우(누락된 의존성) 두 개의
// 독립된 목록으로 나뉘면서, 컬럼 폭도 각각 따로 저장한다.
export interface ColumnWidths {
  includedPath?: number
  missingPath?: number
}

// 전역 설정 하나로 통일한다(저장소별 구분 없음). 재실행 후에도 남기기 위해
// localStorage에 저장 — Mapping Profile과 달리 파일시스템 영속화가 필요할
// 만큼 무거운 데이터가 아니라 Renderer에서 바로 처리한다.
export function loadColumnWidths(): ColumnWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const { includedPath, missingPath } = parsed as Record<string, unknown>
    return {
      includedPath: typeof includedPath === 'number' ? includedPath : undefined,
      missingPath: typeof missingPath === 'number' ? missingPath : undefined
    }
  } catch {
    return {}
  }
}

export function saveColumnWidths(widths: ColumnWidths): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
}
