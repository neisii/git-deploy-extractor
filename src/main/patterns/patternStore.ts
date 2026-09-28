import { promises as fs } from 'node:fs'
import type { FilePattern } from '../../shared/types'

// REQ-026 정정(2026-09-28) — 파일 패턴(제외/포함)을 Renderer의
// localStorage에서 이 파일(userData 아래 `patterns.json` 전역 하나)로
// 옮겼다. 사용자가 팀원과 패턴을 공유하고 싶을 때 이 파일 자체를 복사해
// 넘기기만 하면 되도록(별도 가져오기/내보내기 UI 없이), 그리고 필요하면
// 텍스트 에디터로 직접 열어 고칠 수 있도록 평범한 JSON 배열로 저장한다
// (Mapping Profile의 `profiles/<name>.json`과 같은 관례,
// `mapping/profileStore.ts` 참고).
function isValidEntry(entry: unknown): entry is FilePattern {
  if (typeof entry !== 'object' || entry === null) return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.pattern === 'string' &&
    typeof e.enabled === 'boolean' &&
    (e.mode === 'exclude' || e.mode === 'include')
  )
}

// 파일이 아직 없으면(최초 실행) 빈 배열 — 마이그레이션 여부는 호출자
// (Renderer의 initFilePatterns)가 판단한다. 손상된 JSON도 조용히 빈
// 배열로 폴백한다 — 이 기능이 없어져도 앱의 핵심 기능(Preview/Export)에는
// 영향이 없어야 하기 때문이다(REQ-010 오프라인 동작 원칙과 같은 이유).
export async function loadFilePatterns(filePath: string): Promise<FilePattern[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry)
  } catch {
    return []
  }
}

export async function saveFilePatterns(filePath: string, patterns: FilePattern[]): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(patterns, null, 2) + '\n', 'utf8')
}
