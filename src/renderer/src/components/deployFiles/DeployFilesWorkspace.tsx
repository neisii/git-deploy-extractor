import { SplitPane } from '../SplitPane'
import { IncludedFilesPane } from './IncludedFilesPane'
import { MissingDependenciesPane } from './MissingDependenciesPane'

const SPLIT_MIN_PX = 260

export interface DeployFilesWorkspaceProps {
  onOpenManualAdd: () => void
}

// RT-42(§5.1 RT-41/42) — 조립만 담당한다(제목 없음). 좌 IncludedFilesPane |
// 우 MissingDependenciesPane, SplitPane 2분할(기본 50:50, 최소 폭 각
// 260px, 드래그 리사이즈, 비율 localStorage 영속) — DeployFilesPanel.tsx가
// 갖고 있던 좌우 조립 로직이 전부 이 두 Pane으로 옮겨가서, 여기 남는 건
// 순수 레이아웃 조립뿐이다. onOpenManualAdd 하나만 그대로 통과시킨다 —
// ManualAddPopup 자체는 두 Pane을 감싸는 부모(DeployFilesPanel의
// .deploy-files-panel) 중앙에 떠야 해서 이 워크스페이스 밖에서 렌더링된다.
export function DeployFilesWorkspace({
  onOpenManualAdd
}: DeployFilesWorkspaceProps): React.JSX.Element {
  return (
    <SplitPane
      className="deploy-files-panel__split"
      storageKey="gde:splitRatio:deployFiles"
      defaultRatio={0.5}
      minStartPx={SPLIT_MIN_PX}
      minEndPx={SPLIT_MIN_PX}
      start={<IncludedFilesPane onOpenManualAdd={onOpenManualAdd} />}
      end={<MissingDependenciesPane />}
    />
  )
}
