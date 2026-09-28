import { app } from 'electron'
import { join } from 'node:path'

// Electron userData 아래 파일 패턴(REQ-026) 저장 파일 — 전역 하나
// (저장소별 구분 없음, 2026-09-28 정정: localStorage에서 이관).
// profilesDir.ts와 같은 관례.
export function getPatternsFilePath(): string {
  return join(app.getPath('userData'), 'patterns.json')
}
