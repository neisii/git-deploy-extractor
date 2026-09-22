import { listBranches, getRemoteProjectName } from '../../git/repository'
import { listCommits } from '../../git/commits'
import { listTrackedFiles } from '../../git/lsTree'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'

export function registerGitHandlers(): void {
  handle(IPC_CHANNELS['git:listBranches'], (_event, repoPath) => {
    return listBranches(repoPath)
  })

  handle(IPC_CHANNELS['git:listCommits'], (_event, params) => {
    return listCommits(params)
  })

  // RT-21(S7) 정정 — 이 설명은 원래 listTrackedFiles 위에 붙어 있었지만
  // 내용은 getRemoteProjectName 것이었다(엉뚱한 핸들러 위 주석). 여기로
  // 옮김: RepositoryPanel 라벨 표시용 — remote가 없거나 파싱 실패하면
  // null(getRemoteProjectName 자체가 절대 throw하지 않는다). Renderer가
  // null이면 폴더명으로 폴백한다.
  handle(IPC_CHANNELS['git:getRemoteProjectName'], (_event, repoPath) => {
    return getRemoteProjectName(repoPath)
  })

  // REQ-021: 배포 대상 파일 수동 추가 팝업의 자동완성 후보 풀 — 선택된
  // Branch의 HEAD 트리 전체 파일 목록. §7.2(dependencyAnalysis/projectIndex.ts)가
  // 이미 쓰는 것과 같은 함수를 pathPrefix 없이 호출한다(Java 한정 아님).
  handle(IPC_CHANNELS['git:listTrackedFiles'], (_event, repoPath, branch) => {
    return listTrackedFiles(repoPath, branch)
  })
}
