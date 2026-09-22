import { app } from 'electron'
import { join } from 'node:path'

// Electron userData 아래 Mapping Profile 저장 디렉터리. main/index.ts의
// 시드 초기화(seedDefaultProfileIfEmpty)와 mapping/analysis 핸들러가
// 공유한다.
export function getProfilesDir(): string {
  return join(app.getPath('userData'), 'profiles')
}
