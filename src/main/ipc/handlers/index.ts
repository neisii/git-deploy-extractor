import { registerAppHandlers } from './app'
import { registerRepositoryHandlers } from './repository'
import { registerGitHandlers } from './git'
import { registerMappingHandlers } from './mapping'
import { registerAnalysisHandlers } from './analysis'
import { registerPackageHandlers } from './package'
import { registerUpdateHandlers } from './update'

export { getProfilesDir } from './profilesDir'

// RT-21(S7) — 예전엔 이 파일(당시 handlers.ts) 하나에 모든 채널의
// ipcMain.handle 호출이 다 들어있었다. 이제 채널 그룹(app/repository/git/
// mapping/analysis/package/update)별로 나눈 등록 함수를 여기서 한 번에
// 호출한다 — 호출부(main/index.ts)는 여전히 `./ipc/handlers`에서
// `registerIpcHandlers`/`getProfilesDir` 두 개만 import하므로, 내부가
// 여러 파일로 쪼개진 것은 신경 쓸 필요가 없다.
export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerRepositoryHandlers()
  registerGitHandlers()
  registerMappingHandlers()
  registerAnalysisHandlers()
  registerPackageHandlers()
  registerUpdateHandlers()
}
