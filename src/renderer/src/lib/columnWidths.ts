const STORAGE_KEY = 'gde:deployFilesColumnWidths'

export interface ColumnWidths {
  localPath?: number
  serverPath?: number
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
    const { localPath, serverPath } = parsed as Record<string, unknown>
    return {
      localPath: typeof localPath === 'number' ? localPath : undefined,
      serverPath: typeof serverPath === 'number' ? serverPath : undefined
    }
  } catch {
    return {}
  }
}

export function saveColumnWidths(widths: ColumnWidths): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
}
