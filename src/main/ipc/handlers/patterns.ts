import { loadFilePatterns, saveFilePatterns } from '../../patterns/patternStore'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { getPatternsFilePath } from './patternsFile'

// REQ-026 정정(2026-09-28) — 파일 패턴을 userData/patterns.json 파일로
// 저장한다(전역, localStorage 대체). Renderer는 앱 시작 시 한 번
// patterns:load로 읽고, 추가/토글/삭제할 때마다 patterns:save로 전체
// 배열을 다시 쓴다(부분 갱신 없음 — 배열 자체가 작아 매번 통째로 써도
// 비용이 무시할 만하다, Mapping Profile과 달리 여러 파일이 아니라 파일
// 하나뿐이라 더 단순하다).
export function registerPatternsHandlers(): void {
  handle(IPC_CHANNELS['patterns:load'], () => {
    return loadFilePatterns(getPatternsFilePath())
  })

  handle(IPC_CHANNELS['patterns:save'], (_event, patterns) => {
    return saveFilePatterns(getPatternsFilePath(), patterns)
  })
}
