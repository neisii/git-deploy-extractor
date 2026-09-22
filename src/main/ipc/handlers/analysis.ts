import { loadProfile } from '../../mapping/profileStore'
import { resolveServerPath } from '../../mapping/resolveServerPath'
import { computeDeployPlan } from '../../analysis/computeDeployPlan'
import { analyzeDependencies } from '../../analysis/dependencyAnalysis'
import { listTrackedFiles } from '../../git/lsTree'
import { assertManualFileInHeadTree } from '../validate'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { getProfilesDir } from './profilesDir'

export function registerAnalysisHandlers(): void {
  handle(IPC_CHANNELS['analysis:preview'], async (_event, req) => {
    const profile = await loadProfile(getProfilesDir(), req.profileName)
    return computeDeployPlan(req.repoPath, req.branch, req.commitHashes, profile)
  })

  // RISK_ISSUES.md §7.2: Preview 완료 직후 Renderer가 체이닝 호출한다
  // (별도 트리거 버튼 없음 — UI_UX_SPEC.md §2.6a 참고).
  handle(IPC_CHANNELS['analysis:dependencies'], async (_event, req) => {
    const profile = await loadProfile(getProfilesDir(), req.profileName)
    return analyzeDependencies(req.repoPath, req.branch, req.includedLocalPaths, profile)
  })

  // REQ-021/DR-019: 팝업에서 후보 하나를 선택했을 때 Server Path를 계산한다
  // (§7.2 의존성 후보와 동일하게 Mapping Rule 엔진을 그대로 재사용). status는
  // 항상 'added'로 고정 — 사용자가 지정한 경로라 diff 기반 Added/Modified
  // 구분 개념이 없다(DETAILED_DESIGN.md §13.4).
  handle(IPC_CHANNELS['analysis:resolveManualFile'], async (_event, req) => {
    // RT-12(R3): 렌더러가 보낸 localPath가 실제로 HEAD 트리에 있는지
    // 먼저 확인한다 — 팝업 후보 자체가 HEAD 트리 조회 결과라 정상
    // 경로면 항상 통과하지만, 오래된/조작된 값이 와도 존재하지 않는
    // 파일을 조용히 "added"로 만들지 않는다.
    const headTreeFiles = await listTrackedFiles(req.repoPath, req.branch)
    assertManualFileInHeadTree(req.localPath, headTreeFiles)

    const profile = await loadProfile(getProfilesDir(), req.profileName)
    return {
      localPath: req.localPath,
      serverPath: resolveServerPath(req.localPath, profile),
      status: 'added'
    }
  })
}
