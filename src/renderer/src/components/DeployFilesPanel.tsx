import { DeployFilesWorkspace } from './deployFiles/DeployFilesWorkspace'
import { useWorkAreaPopup } from '../lib/workAreaPopupContext'

// RT-42/RT-43/RT-44 — 좌우 조립(IncludedFilesPane/MissingDependenciesPane)은
// DeployFilesWorkspace가, 팝업 상태는 WorkArea/PopupHost가, 제목·경고
// 배너는 PreviewSummary/ManualAddPopup이 각각 가져가면서 이 컴포넌트는
// 이제 레이아웃 래퍼(.deploy-files-panel — SplitPane이 배정한 셀을 꽉
// 채우는 flex column)만 남았다.
export function DeployFilesPanel(): React.JSX.Element {
  const { open } = useWorkAreaPopup()

  return (
    <div className="deploy-files-panel fill">
      <DeployFilesWorkspace onOpenManualAdd={() => open('addFiles')} />
    </div>
  )
}
